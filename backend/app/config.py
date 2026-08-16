"""
Application Configuration and Settings
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "NubianFit Coach & Athlete Platform API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./nubianfit.db"
    
    # JWT Authentication
    SECRET_KEY: str = "nubianfit-super-secret-jwt-signing-key-2026-secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Default Coach Account (auto-seeded)
    DEFAULT_COACH_NAME: str = "Head Coach Qassim"
    DEFAULT_COACH_EMAIL: str = "coach@nubianfit.com"
    DEFAULT_COACH_PASSWORD: str = "Coach@123"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
