import pytest
from pydantic import ValidationError

from app.config import Settings
from app.database import normalize_db_url

STRONG = {
    "ENVIRONMENT": "production",
    "TESTING": False,
    "SECRET_KEY": "x" * 48,
    "COACH_INVITE_CODE": "a-long-unique-invite-code",
    "RESEND_API_KEY": "re_test",
    "DATABASE_URL": "postgresql://u:p@db/nubianfit",
}


def test_production_accepts_strong_config():
    settings = Settings(**STRONG)
    assert settings.is_production
    assert "http://localhost:3000" not in settings.cors_origins


@pytest.mark.parametrize("override", [
    {"SECRET_KEY": "nubianfit-dev-only-insecure-jwt-signing-key"},
    {"SECRET_KEY": "short"},
    {"COACH_INVITE_CODE": "nubianfit-dev-coach-invite"},
    {"RESEND_API_KEY": None},
    {"DATABASE_URL": "sqlite+aiosqlite:///./x.db"},
    {"ENABLE_DEV_SEED": True},
    {"BOOTSTRAP_INITIAL_ADMIN": True, "DEFAULT_COACH_PASSWORD": "Coach@123"},
])
def test_production_rejects_insecure_config(override):
    with pytest.raises(ValidationError):
        Settings(**{**STRONG, **override})


def test_render_postgres_urls_are_normalized():
    assert normalize_db_url("postgres://u:p@h/db") == "postgresql+asyncpg://u:p@h/db"
    assert normalize_db_url("postgresql://u:p@h/db") == "postgresql+asyncpg://u:p@h/db"
