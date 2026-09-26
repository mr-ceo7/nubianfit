"""
Test setup: point the app at a throwaway SQLite DB *before* app modules are imported,
and reseed the demo data before every test.
"""

import os
import sys
import tempfile

_tmpdir = tempfile.mkdtemp(prefix="nubianfit-tests-")
os.environ["TESTING"] = "true"
os.environ["ENVIRONMENT"] = "development"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmpdir}/test.db"
os.environ.pop("RESEND_API_KEY", None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.services import email  # noqa: E402
from seed_data import seed_database  # noqa: E402

DEMO_CLIENT_ID = "client-1"


@pytest.fixture(autouse=True)
async def fresh_db():
    await seed_database(force=True)
    email.outbox.clear()
    yield


@pytest.fixture
async def api():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def login_headers(api, email_addr: str, password: str) -> dict:
    res = await api.post("/api/auth/login", json={"email": email_addr, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['accessToken']}"}


@pytest.fixture
async def coach(api):
    return await login_headers(api, settings.DEFAULT_COACH_EMAIL, settings.DEFAULT_COACH_PASSWORD)


@pytest.fixture
async def other_coach(api):
    res = await api.post("/api/auth/register-coach", json={
        "email": "rival@example.com",
        "password": "rival-password",
        "fullName": "Rival Coach",
        "inviteCode": settings.COACH_INVITE_CODE,
    })
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['accessToken']}"}


async def client_login(api, email_addr: str) -> dict:
    res = await api.post("/api/auth/otp/request", json={"email": email_addr})
    assert res.status_code == 200
    code = email.outbox[-1]["text"].split("code is ")[1][:6]
    res = await api.post("/api/auth/otp/verify", json={"email": email_addr, "code": code})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['accessToken']}"}


@pytest.fixture
async def demo_client_email(api, coach):
    res = await api.get(f"/api/clients/{DEMO_CLIENT_ID}", headers=coach)
    return res.json()["email"]


@pytest.fixture
async def client_user(api, demo_client_email):
    return await client_login(api, demo_client_email)
