"""
NubianFit FastAPI Backend Main Application
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import engine, Base, AsyncSessionLocal
import app.models  # noqa: F401  (registers every model on Base.metadata)
from app.dependencies import get_db
from app.models.user import User
from app.security import get_password_hash
from app.services.scheduler import scheduler_loop

from app.routers import (
    auth_router,
    clients_router,
    exercises_router,
    programs_router,
    workouts_router,
    metrics_router,
    prs_router,
    habits_router,
    photos_router,
    messages_router,
    activity_router,
    workout_templates_router,
    foods_router,
    nutrition_router,
    engagement_router,
    community_router,
    checkins_router,
    autoflows_router,
    billing_router,
    pay_router,
    admin_router,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("nubianfit")


async def bootstrap_head_coach() -> None:
    """Production: create the first coach from DEFAULT_COACH_* when BOOTSTRAP_INITIAL_ADMIN is set."""
    async with AsyncSessionLocal() as session:
        if (await session.execute(select(User).where(User.role == "coach").limit(1))).scalar_one_or_none():
            return
        if not settings.BOOTSTRAP_INITIAL_ADMIN:
            logger.warning("No coach accounts exist. Set BOOTSTRAP_INITIAL_ADMIN=true once to create the head coach.")
            return
        session.add(User(
            id="coach-1",
            email=settings.DEFAULT_COACH_EMAIL.strip().lower(),
            hashed_password=get_password_hash(settings.DEFAULT_COACH_PASSWORD),
            full_name=settings.DEFAULT_COACH_NAME,
            role="coach",
            is_admin=True,
        ))
        await session.commit()
        logger.warning("Head coach account %s created. Unset BOOTSTRAP_INITIAL_ADMIN now.", settings.DEFAULT_COACH_EMAIL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import here: seed_data imports app modules, and the script is also run standalone.
    from seed_data import seed_database, seed_exercise_library

    if settings.is_production:
        # Schema is managed by Alembic (`alembic upgrade head` runs before the server starts).
        await seed_exercise_library()
        await bootstrap_head_coach()
    else:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        if settings.ENABLE_DEV_SEED or settings.TESTING:
            await seed_database(force=False)
        else:
            await seed_exercise_library()

    # Autoflow steps, check-in reminders and email digests (not in tests; they call run_tick directly).
    scheduler = None if settings.TESTING else asyncio.create_task(scheduler_loop())

    logger.info("NubianFit API ready (environment=%s).", settings.ENVIRONMENT)
    yield
    if scheduler:
        scheduler.cancel()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """Liveness + database readiness (used by Render's health check)."""
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Health check database failure")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")
    return {"status": "healthy", "service": settings.PROJECT_NAME, "version": settings.VERSION}


for router in (
    auth_router,
    clients_router,
    exercises_router,
    programs_router,
    workouts_router,
    metrics_router,
    prs_router,
    habits_router,
    photos_router,
    messages_router,
    activity_router,
    workout_templates_router,
    foods_router,
    nutrition_router,
    engagement_router,
    community_router,
    checkins_router,
    autoflows_router,
    billing_router,
    pay_router,
    admin_router,
):
    app.include_router(router, prefix=settings.API_PREFIX)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
