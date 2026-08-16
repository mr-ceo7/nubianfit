"""
NubianFit FastAPI Backend Main Application
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base
from seed_data import seed_database

# Routers
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
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("nubianfit")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager: Initialize DB tables and seed mock data."""
    logger.info("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("Checking / running initial database seed...")
    try:
        await seed_database(force=False)
    except Exception as e:
        logger.error(f"Error during database seed: {e}")
    
    logger.info("NubianFit FastAPI Backend ready.")
    yield
    logger.info("Shutting down NubianFit FastAPI Backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }


# Mount all API routers
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(clients_router, prefix=settings.API_PREFIX)
app.include_router(exercises_router, prefix=settings.API_PREFIX)
app.include_router(programs_router, prefix=settings.API_PREFIX)
app.include_router(workouts_router, prefix=settings.API_PREFIX)
app.include_router(metrics_router, prefix=settings.API_PREFIX)
app.include_router(prs_router, prefix=settings.API_PREFIX)
app.include_router(habits_router, prefix=settings.API_PREFIX)
app.include_router(photos_router, prefix=settings.API_PREFIX)
app.include_router(messages_router, prefix=settings.API_PREFIX)
app.include_router(activity_router, prefix=settings.API_PREFIX)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
