"""
Authentication Router

Coaches sign in with email + password; new coaches need COACH_INVITE_CODE.
Clients sign in with a one-time code emailed to the address their coach registered.
"""

import hashlib
import hmac
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db, get_current_user
from app.models.client import Client
from app.models.otp import EmailOTP
from app.models.user import User
from app.rate_limiter import rate_limit, rate_limiter
from app.schemas.auth import (
    ChangePasswordRequest,
    CoachRegisterRequest,
    LoginRequest,
    OtpRequest,
    OtpVerifyRequest,
    TokenResponse,
    UserResponse,
)
from app.security import create_access_token, get_password_hash, verify_password
from app.services.email import EmailDeliveryError, send_login_code

logger = logging.getLogger("nubianfit.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])

OTP_CODES_PER_HOUR = 5
LOGIN_FAILURES_PER_15_MIN = 10


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _hash_code(email: str, code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


def user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        client_id=user.client_id,
        avatar=user.avatar or "",
        is_active=user.is_active,
        has_password=bool(user.hashed_password),
        is_admin=user.is_admin,
    )


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(user.id), user=user_response(user))


async def _find_client_for_email(db: AsyncSession, email: str) -> Client | None:
    result = await db.execute(
        select(Client)
        .where(Client.email == email, Client.status != "Archived")
        .order_by(Client.start_date.desc())
    )
    return result.scalars().first()


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(10, 60, "login"))],
)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Email + password login (coaches, and clients who have set a password)."""
    email = _normalize_email(req.email)
    if not settings.TESTING and not await rate_limiter.allow(f"login-email:{email}", LOGIN_FAILURES_PER_15_MIN, 900, peek=True):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts. Try again in 15 minutes.")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password or not verify_password(req.password, user.hashed_password):
        if not settings.TESTING:
            await rate_limiter.allow(f"login-email:{email}", LOGIN_FAILURES_PER_15_MIN, 900)  # count the failure
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated")
    return _token_response(user)


@router.post(
    "/register-coach",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(5, 60, "register"))],
)
async def register_coach(req: CoachRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a coach account. Requires the private coach invite code."""
    if not hmac.compare_digest(req.invite_code.strip(), settings.COACH_INVITE_CODE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid invite code")

    email = _normalize_email(req.email)
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email already exists")

    user = User(
        id=f"coach-{uuid.uuid4().hex[:12]}",
        email=email,
        hashed_password=get_password_hash(req.password),
        full_name=req.full_name.strip(),
        role="coach",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    return _token_response(user)


@router.post("/otp/request", dependencies=[Depends(rate_limit(5, 60, "otp-request"))])
async def request_login_code(req: OtpRequest, db: AsyncSession = Depends(get_db)):
    """Email a login code to a client. Always answers the same way so emails can't be enumerated."""
    email = _normalize_email(req.email)
    response = {"message": "If this email belongs to a NubianFit client, a login code is on its way."}

    client = await _find_client_for_email(db, email)
    if not client:
        return response

    # Per-address cap so rotating IPs can't keep minting fresh codes (each code allows a few guesses).
    recent = (await db.execute(select(func.count()).select_from(EmailOTP).where(
        EmailOTP.email == email, EmailOTP.created_at >= datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)
    ))).scalar_one()
    if recent >= OTP_CODES_PER_HOUR:
        logger.warning("OTP request cap hit for %s", email)
        return response

    # Invalidate earlier codes so only the newest one works.
    await db.execute(update(EmailOTP).where(EmailOTP.email == email, EmailOTP.consumed == False).values(consumed=True))  # noqa: E712
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(EmailOTP(
        id=uuid.uuid4().hex,
        email=email,
        code_hash=_hash_code(email, code),
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
    ))
    await db.commit()

    try:
        await send_login_code(email, code)
    except EmailDeliveryError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="We couldn't send the email. Try again shortly.")
    return response


@router.post(
    "/otp/verify",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(10, 60, "otp-verify"))],
)
async def verify_login_code(req: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a valid login code for a session, creating the client's login on first use."""
    email = _normalize_email(req.email)
    invalid = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")

    result = await db.execute(
        select(EmailOTP)
        .where(EmailOTP.email == email, EmailOTP.consumed == False)  # noqa: E712
        .order_by(EmailOTP.created_at.desc())
    )
    otp = result.scalars().first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if not otp or otp.expires_at < now or otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise invalid

    if not hmac.compare_digest(otp.code_hash, _hash_code(email, req.code.strip())):
        otp.attempts += 1
        await db.commit()
        raise invalid
    otp.consumed = True

    user_res = await db.execute(select(User).where(User.email == email))
    user = user_res.scalar_one_or_none()
    if user and user.role != "client":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coaches sign in with their password")

    client = await _find_client_for_email(db, email)
    if not client:
        raise invalid

    if not user:
        user = User(
            id=f"user-{uuid.uuid4().hex[:12]}",
            email=email,
            full_name=client.name,
            role="client",
            client_id=client.id,
            avatar=client.avatar or "",
            is_active=True,
        )
        db.add(user)
    elif user.client_id != client.id:
        # Keep an existing link: another coach adding the same email must not take over this login.
        current = await db.get(Client, user.client_id) if user.client_id else None
        if current is None:
            user.client_id = client.id
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated")

    await db.commit()
    return _token_response(user)


@router.post("/dev-login", response_model=TokenResponse, include_in_schema=False)
async def dev_login(role: str = "coach", db: AsyncSession = Depends(get_db)):
    """Development only: sign in as the demo coach or the first demo client without credentials.
    Requires ENABLE_DEV_SEED (which production refuses), so a misconfigured deploy doesn't expose it."""
    if settings.is_production or not (settings.ENABLE_DEV_SEED or settings.TESTING):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    if role == "coach":
        result = await db.execute(select(User).where(User.email == _normalize_email(settings.DEFAULT_COACH_EMAIL)))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="Demo coach not found. Start the backend with ENABLE_DEV_SEED=true.")
        return _token_response(user)

    client = (await db.execute(
        select(Client).where(Client.email != "", Client.status != "Archived").order_by(Client.id)
    )).scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="No demo client with an email exists.")
    user = (await db.execute(select(User).where(User.email == client.email))).scalar_one_or_none()
    if not user:
        user = User(
            id=f"user-{uuid.uuid4().hex[:12]}",
            email=client.email,
            full_name=client.name,
            role="client",
            client_id=client.id,
            avatar=client.avatar or "",
            is_active=True,
        )
        db.add(user)
        await db.commit()
    return _token_response(user)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return user_response(current_user)


@router.post("/change-password", response_model=UserResponse)
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set or change the password. The current password is required once one exists."""
    if current_user.hashed_password and not (
        req.current_password and verify_password(req.current_password, current_user.hashed_password)
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.hashed_password = get_password_hash(req.new_password)
    await db.commit()
    return user_response(current_user)
