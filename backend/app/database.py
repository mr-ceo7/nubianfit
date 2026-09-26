"""
SQLAlchemy Async Engine and Session Factory
Postgres (asyncpg) in production, SQLite (aiosqlite) for local dev and tests.
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


def normalize_db_url(url: str) -> str:
    """Render/Heroku hand out postgres:// URLs; SQLAlchemy async needs postgresql+asyncpg://."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


db_url = normalize_db_url(settings.DATABASE_URL)

engine_kwargs = {"echo": False, "pool_pre_ping": True}
if db_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update(pool_size=10, max_overflow=20, pool_recycle=1800)

engine = create_async_engine(db_url, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass
