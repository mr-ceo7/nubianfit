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

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db, get_current_user
from app.models.client import Client
from app.models.habit import Habit
from app.models.otp import EmailOTP
from app.models.user import User
from app.rate_limiter import rate_limit, rate_limiter
from app.schemas.auth import (
    ChangePasswordRequest,
    ClientRegisterRequest,
    CoachRegisterRequest,
    GoogleAuthRequest,
    LoginRequest,
    OtpRequest,
    OtpVerifyRequest,
    TokenResponse,
    UserResponse,
)
from app.security import create_access_token, get_password_hash, verify_password
from app.services.activity import log_activity
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


@router.post(
    "/register-client",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(10, 60, "register-client"))],
)
async def register_client(req: ClientRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Self-serve open registration for athletes joining NubianFit."""
    email = _normalize_email(req.email)
    existing_user = await db.execute(select(User).where(User.email == email))
    user = existing_user.scalar_one_or_none()
    if user and user.hashed_password and req.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists. Please sign in.",
        )

    # Check for existing client profile
    existing_client = await _find_client_for_email(db, email)

    # Find the Coach to assign this athlete to
    coach_res = await db.execute(
        select(User).where(User.role == "coach").order_by(User.is_admin.desc(), User.id.asc())
    )
    coach = coach_res.scalars().first()
    coach_id = coach.id if coach else "coach-1"

    if not existing_client:
        client_id = f"client-{uuid.uuid4().hex[:12]}"
        client = Client(
            id=client_id,
            coach_id=coach_id,
            name=req.full_name.strip(),
            avatar="",
            email=email,
            phone="",
            age=req.age,
            gender=req.gender or "prefer_not_to_say",
            status="Active",
            goal=req.goal or "Strength & Strategy",
            experience_level=req.experience_level or "Intermediate",
            start_date=datetime.now().strftime("%Y-%m-%d"),
            compliance_rate=100.0,
            workouts_completed=0,
            total_workouts_assigned=0,
            starting_weight_kg=req.starting_weight_kg,
            current_weight_kg=req.starting_weight_kg,
            target_weight_kg=req.target_weight_kg,
        )
        db.add(client)

        # Baseline habits
        db.add(Habit(
            id=f"habit-{uuid.uuid4().hex[:12]}",
            client_id=client_id,
            title="Daily Hydration (3L)",
            target_value=3.0,
            unit="L",
            days_of_week=[],
            active=True,
            sort_order=1,
        ))
        db.add(Habit(
            id=f"habit-{uuid.uuid4().hex[:12]}",
            client_id=client_id,
            title="Hit protein target",
            target_value=None,
            unit="",
            days_of_week=[],
            active=True,
            sort_order=2,
        ))
        db.add(Habit(
            id=f"habit-{uuid.uuid4().hex[:12]}",
            client_id=client_id,
            title="Daily Steps (10k)",
            target_value=10000.0,
            unit="steps",
            days_of_week=[],
            active=True,
            sort_order=3,
        ))

        # Log activity feed item for the coach
        log_activity(
            db,
            client,
            type_="client_joined",
            title="New Athlete Enrolled",
            description=f"{client.name} joined NubianFit with goal: {client.goal}.",
        )
    else:
        client = existing_client
        client_id = client.id

    if not user:
        user = User(
            id=f"user-{uuid.uuid4().hex[:12]}",
            email=email,
            hashed_password=get_password_hash(req.password) if req.password else None,
            full_name=req.full_name.strip(),
            role="client",
            client_id=client_id,
            avatar="",
            is_active=True,
        )
        db.add(user)
    else:
        user.client_id = client_id
        if req.password and not user.hashed_password:
            user.hashed_password = get_password_hash(req.password)

    await db.commit()
    await db.refresh(user)
    return _token_response(user)


@router.post("/otp/request", dependencies=[Depends(rate_limit(5, 60, "otp-request"))])
async def request_login_code(req: OtpRequest, db: AsyncSession = Depends(get_db)):
    """Email a login code to an existing client or athlete."""
    email = _normalize_email(req.email)
    response = {"message": "If this email belongs to a NubianFit client, a login code is on its way."}

    # Silently drop requests for unknown emails — an attacker shouldn't be able to enumerate our client list.
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    client = await _find_client_for_email(db, email)
    if not user and not client:
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
    """Exchange a valid login code for a session, creating the athlete profile if new."""
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
        # Auto-provision open athlete profile
        coach_res = await db.execute(
            select(User).where(User.role == "coach").order_by(User.is_admin.desc(), User.id.asc())
        )
        coach = coach_res.scalars().first()
        coach_id = coach.id if coach else "coach-1"

        client_id = f"client-{uuid.uuid4().hex[:12]}"
        athlete_name = email.split("@")[0].replace(".", " ").title()
        client = Client(
            id=client_id,
            coach_id=coach_id,
            name=athlete_name,
            avatar="",
            email=email,
            phone="",
            status="Active",
            goal="Strength & Strategy",
            experience_level="Intermediate",
            start_date=datetime.now().strftime("%Y-%m-%d"),
            compliance_rate=100.0,
            workouts_completed=0,
            total_workouts_assigned=0,
        )
        db.add(client)

        db.add(Habit(
            id=f"habit-{uuid.uuid4().hex[:12]}",
            client_id=client_id,
            title="Daily Hydration (3L)",
            target_value=3.0,
            unit="L",
            days_of_week=[],
            active=True,
            sort_order=1,
        ))
        db.add(Habit(
            id=f"habit-{uuid.uuid4().hex[:12]}",
            client_id=client_id,
            title="Hit protein target",
            target_value=None,
            unit="",
            days_of_week=[],
            active=True,
            sort_order=2,
        ))
        db.add(Habit(
            id=f"habit-{uuid.uuid4().hex[:12]}",
            client_id=client_id,
            title="Daily Steps (10k)",
            target_value=10000.0,
            unit="steps",
            days_of_week=[],
            active=True,
            sort_order=3,
        ))
        log_activity(
            db,
            client,
            type_="client_joined",
            title="New Athlete Enrolled",
            description=f"{client.name} signed in with email: {email}.",
        )

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
        current = await db.get(Client, user.client_id) if user.client_id else None
        if current is None:
            user.client_id = client.id
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated")

    await db.commit()
    return _token_response(user)


async def verify_google_token(credential: str) -> dict:
    """Verifies a Google ID token via Google's tokeninfo endpoint, checking aud, iss, and email_verified."""
    if (settings.TESTING or not settings.is_production) and credential.startswith("mock-google-"):
        email = credential.replace("mock-google-", "")
        return {
            "email": email,
            "name": "Google Athlete",
            "picture": "https://lh3.googleusercontent.com/a/mock",
            "email_verified": True,
            "sub": "mock-sub-12345",
        }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": credential},
            )
        except httpx.RequestError as exc:
            logger.error("Failed to connect to Google tokeninfo: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to connect to Google Identity Services. Please try again.",
            )

        if resp.status_code != 200:
            logger.warning("Google tokeninfo returned %d: %s", resp.status_code, resp.text)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired Google credential.",
            )

        data = resp.json()
        token_aud = data.get("aud")
        if token_aud != settings.GOOGLE_CLIENT_ID:
            logger.warning("Google token aud mismatch: expected %s, got %s", settings.GOOGLE_CLIENT_ID, token_aud)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google token was not issued for NubianFit.",
            )

        token_iss = data.get("iss")
        if token_iss not in ("accounts.google.com", "https://accounts.google.com"):
            logger.warning("Google token invalid iss: %s", token_iss)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token issuer.",
            )

        email_verified = data.get("email_verified")
        if not (email_verified is True or email_verified == "true"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google account email is not verified.",
            )

        return data


@router.post(
    "/google",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(15, 60, "google-auth"))],
)
async def login_with_google(req: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with Google Quick One Tap or Sign In with Google.
    Signs in existing athletes/users, or provisions a new athlete profile with baseline habits.
    """
    token_data = await verify_google_token(req.credential)
    email = _normalize_email(token_data["email"])
    full_name = token_data.get("name") or email.split("@")[0].replace(".", " ").title()
    avatar = token_data.get("picture") or ""

    user_res = await db.execute(select(User).where(User.email == email))
    user = user_res.scalar_one_or_none()

    if user:
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated")
        if avatar and not user.avatar:
            user.avatar = avatar
        if full_name and not user.full_name:
            user.full_name = full_name
        await db.commit()
        await db.refresh(user)
        return _token_response(user)

    # Find coach to assign this athlete to
    coach_res = await db.execute(
        select(User).where(User.role == "coach").order_by(User.is_admin.desc(), User.id.asc())
    )
    coach = coach_res.scalars().first()
    coach_id = coach.id if coach else "coach-1"

    existing_client = await _find_client_for_email(db, email)
    if not existing_client:
        client_id = f"client-{uuid.uuid4().hex[:12]}"
        client = Client(
            id=client_id,
            coach_id=coach_id,
            name=full_name.strip(),
            avatar=avatar,
            email=email,
            phone="",
            status="Active",
            goal="Strength & Strategy",
            experience_level="Intermediate",
            start_date=datetime.now().strftime("%Y-%m-%d"),
            compliance_rate=100.0,
            workouts_completed=0,
            total_workouts_assigned=0,
        )
        db.add(client)

        db.add(Habit(
            id=f"habit-{uuid.uuid4().hex[:12]}",
            client_id=client_id,
            title="Daily Hydration (3L)",
            target_value=3.0,
            unit="liters",
            days_of_week=[],
            active=True,
            sort_order=1,
        ))
        db.add(Habit(
            id=f"habit-{uuid.uuid4().hex[:12]}",
            client_id=client_id,
            title="Hit protein target",
            target_value=1.0,
            unit="",
            days_of_week=[],
            active=True,
            sort_order=2,
        ))
        db.add(Habit(
            id=f"habit-{uuid.uuid4().hex[:12]}",
            client_id=client_id,
            title="Daily Steps (10k)",
            target_value=10000.0,
            unit="steps",
            days_of_week=[],
            active=True,
            sort_order=3,
        ))

        log_activity(
            db,
            client,
            type_="client_joined",
            title="New Athlete Enrolled",
            description=f"{client.name} joined NubianFit via Google.",
        )
    else:
        client = existing_client
        client_id = client.id
        if avatar and not client.avatar:
            client.avatar = avatar

    user = User(
        id=f"user-{uuid.uuid4().hex[:12]}",
        email=email,
        full_name=full_name.strip(),
        role="client",
        client_id=client_id,
        avatar=avatar,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
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
