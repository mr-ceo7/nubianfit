import pytest

from app.config import settings
from app.services import email

PROTECTED_LISTS = [
    "/api/nutrition/log", "/api/nutrition/goals", "/api/nutrition/daily", "/api/meal-plans", "/api/foods/custom", "/api/habits/checkins",
    "/api/clients", "/api/exercises", "/api/programs", "/api/workouts", "/api/metrics",
    "/api/prs", "/api/habits", "/api/photos", "/api/messages", "/api/activity",
]


async def test_health(api):
    res = await api.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


@pytest.mark.parametrize("path", PROTECTED_LISTS)
async def test_endpoints_require_auth(api, path):
    assert (await api.get(path)).status_code == 401


async def test_coach_login_and_me(api, coach):
    res = await api.get("/api/auth/me", headers=coach)
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == settings.DEFAULT_COACH_EMAIL
    assert body["role"] == "coach"
    assert body["hasPassword"] is True


async def test_login_rejects_bad_password(api):
    res = await api.post("/api/auth/login", json={"email": settings.DEFAULT_COACH_EMAIL, "password": "wrong"})
    assert res.status_code == 401


async def test_coach_registration_requires_invite_code(api):
    res = await api.post("/api/auth/register-coach", json={
        "email": "new@example.com", "password": "long-enough", "fullName": "New", "inviteCode": "nope",
    })
    assert res.status_code == 403


async def test_old_open_register_endpoint_is_gone(api):
    res = await api.post("/api/auth/register", json={"email": "x@example.com", "password": "x", "full_name": "x"})
    assert res.status_code in (404, 405)


async def test_otp_request_does_not_reveal_unknown_emails(api):
    res = await api.post("/api/auth/otp/request", json={"email": "nobody@example.com"})
    assert res.status_code == 200
    assert email.outbox == []


async def test_client_otp_login(api, client_user):
    me = (await api.get("/api/auth/me", headers=client_user)).json()
    assert me["role"] == "client"
    assert me["clientId"] == "client-1"


async def test_otp_wrong_code_then_lockout(api, demo_client_email):
    await api.post("/api/auth/otp/request", json={"email": demo_client_email})
    code = email.outbox[-1]["text"].split("code is ")[1][:6]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(settings.OTP_MAX_ATTEMPTS):
        res = await api.post("/api/auth/otp/verify", json={"email": demo_client_email, "code": wrong})
        assert res.status_code == 400
    # Even the right code fails once attempts are used up.
    res = await api.post("/api/auth/otp/verify", json={"email": demo_client_email, "code": code})
    assert res.status_code == 400


async def test_otp_code_is_single_use(api, demo_client_email):
    await api.post("/api/auth/otp/request", json={"email": demo_client_email})
    code = email.outbox[-1]["text"].split("code is ")[1][:6]
    first = await api.post("/api/auth/otp/verify", json={"email": demo_client_email, "code": code})
    assert first.status_code == 200
    second = await api.post("/api/auth/otp/verify", json={"email": demo_client_email, "code": code})
    assert second.status_code == 400


async def test_coach_email_cannot_use_otp_login(api, coach):
    # A client profile sharing the coach's email must not grant a client session for the coach account.
    await api.post("/api/clients", headers=coach, json={"name": "Me", "email": settings.DEFAULT_COACH_EMAIL})
    await api.post("/api/auth/otp/request", json={"email": settings.DEFAULT_COACH_EMAIL})
    code = email.outbox[-1]["text"].split("code is ")[1][:6]
    res = await api.post("/api/auth/otp/verify", json={"email": settings.DEFAULT_COACH_EMAIL, "code": code})
    assert res.status_code == 400


async def test_client_can_set_password_then_log_in(api, client_user, demo_client_email):
    res = await api.post("/api/auth/change-password", headers=client_user, json={"newPassword": "client-pass-123"})
    assert res.status_code == 200
    res = await api.post("/api/auth/login", json={"email": demo_client_email, "password": "client-pass-123"})
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "client"


async def test_dev_login_signs_in_demo_accounts(api):
    coach = (await api.post("/api/auth/dev-login", params={"role": "coach"})).json()
    assert coach["user"]["role"] == "coach"
    client = (await api.post("/api/auth/dev-login", params={"role": "client"})).json()
    assert client["user"]["role"] == "client" and client["user"]["clientId"]


async def test_dev_login_disabled_in_production(api, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert (await api.post("/api/auth/dev-login")).status_code == 404
