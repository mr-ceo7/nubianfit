"""
Application Configuration and Settings
"""

import os
from typing import List, Optional, Set
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_default_db_path = os.path.join(_backend_dir, "nubianfit.db")

INSECURE_SECRET_KEYS: Set[str] = {
    "nubianfit-dev-only-insecure-jwt-signing-key",
    "nubianfit-super-secret-jwt-signing-key-2026-secure",
    "secret",
    "changeme",
}

INSECURE_COACH_PASSWORDS: Set[str] = {"Coach@123", "password", "admin123", "12345678"}

INSECURE_INVITE_CODES: Set[str] = {"nubianfit-dev-coach-invite", "invite", "coach-invite"}


class Settings(BaseSettings):
    PROJECT_NAME: str = "NubianFit Coaching Platform API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # "development" or "production". Tests set TESTING=true.
    ENVIRONMENT: str = "development"
    TESTING: bool = False
    # Seeds demo data from seed_data.json on startup (never allowed in production).
    ENABLE_DEV_SEED: bool = False

    DATABASE_URL: str = f"sqlite+aiosqlite:///{_default_db_path}"

    # JWT
    SECRET_KEY: str = "nubianfit-dev-only-insecure-jwt-signing-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Head coach account. Seeded in dev; in production only created when BOOTSTRAP_INITIAL_ADMIN=true.
    BOOTSTRAP_INITIAL_ADMIN: bool = False
    DEFAULT_COACH_NAME: str = "Head Coach"
    DEFAULT_COACH_EMAIL: str = "coach@nubianfit.com"
    DEFAULT_COACH_PASSWORD: str = "Coach@123"
    # Required to self-register a new coach account.
    COACH_INVITE_CODE: str = "nubianfit-dev-coach-invite"

    # Email one-time codes for client login
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5

    # Transactional email (Resend). Without a key, emails are logged instead of sent (dev only).
    RESEND_API_KEY: Optional[str] = None
    FROM_EMAIL: str = "NubianFit <no-reply@nubianfit.com>"

    # USDA FoodData Central (https://fdc.nal.usda.gov/api-key-signup). DEMO_KEY works for
    # development but is limited to ~30 requests/hour per IP; set a real key in production.
    FDC_API_KEY: str = "DEMO_KEY"

    # Web push (VAPID). Generate with `python scripts/generate_vapid_keys.py`; push is off when unset.
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:admin@nubianfit.com"

    # Background jobs (Autoflow steps, check-in reminders, email digests) run every
    # SCHEDULER_INTERVAL_SECONDS while the server is awake. A cron job can also call
    # POST /api/internal/tick with header X-Cron-Token: CRON_TOKEN (e.g. when the host sleeps).
    SCHEDULER_INTERVAL_SECONDS: int = 600
    CRON_TOKEN: str = ""
    # Unread notifications older than this are included in the next email digest.
    DIGEST_DELAY_MINUTES: int = 30

    # Public URLs of the three portals, used in emails and CORS.
    LANDING_URL: str = "https://nubianfit.xn--jhb4c.com"
    COACH_URL: str = "https://coach.nubianfit.xn--jhb4c.com"
    CLIENT_URL: str = "https://app.nubianfit.xn--jhb4c.com"
    # Comma-separated extra origins (e.g. Vercel preview URLs).
    EXTRA_CORS_ORIGINS: str = ""

    model_config = SettingsConfigDict(
        env_file=(os.path.join(_backend_dir, ".env"), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production" and not self.TESTING

    @property
    def cors_origins(self) -> List[str]:
        origins = [self.LANDING_URL, self.COACH_URL, self.CLIENT_URL]
        if not self.is_production:
            origins += [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]
        origins += [o.strip() for o in self.EXTRA_CORS_ORIGINS.split(",") if o.strip()]
        return origins

    def is_head_coach(self, email: Optional[str]) -> bool:
        return bool(email) and email.strip().lower() == self.DEFAULT_COACH_EMAIL.strip().lower()

    @model_validator(mode="after")
    def validate_production_secrets(self):
        """Refuse to start in production with missing or default secrets."""
        if not self.is_production:
            return self
        if self.ENABLE_DEV_SEED:
            raise ValueError("ENABLE_DEV_SEED must not be set in production.")
        if self.SECRET_KEY in INSECURE_SECRET_KEYS or len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY must be set to a strong value (32+ chars) in production.")
        if self.COACH_INVITE_CODE in INSECURE_INVITE_CODES or len(self.COACH_INVITE_CODE) < 16:
            raise ValueError("COACH_INVITE_CODE must be set to a unique value (16+ chars) in production.")
        if self.BOOTSTRAP_INITIAL_ADMIN and (
            self.DEFAULT_COACH_PASSWORD in INSECURE_COACH_PASSWORDS or len(self.DEFAULT_COACH_PASSWORD) < 10
        ):
            raise ValueError("DEFAULT_COACH_PASSWORD must be strong (10+ chars) when bootstrapping in production.")
        if not self.RESEND_API_KEY:
            raise ValueError("RESEND_API_KEY must be set in production so login codes can be delivered.")
        if self.DATABASE_URL.startswith("sqlite"):
            raise ValueError("DATABASE_URL must point at Postgres in production.")
        return self


settings = Settings()
