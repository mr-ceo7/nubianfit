"""
Platform admin: every coach on the marketplace, suspension, and platform-wide payments.
"""

from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.business import Payment, PayoutAccount, Subscription
from app.models.client import Client
from app.models.user import User
from app.schemas.business import SuspendBody
from app.services.billing import to_major

router = APIRouter(prefix="/admin", tags=["Admin"])


def is_admin(user: User) -> bool:
    # A database flag only (set for the bootstrapped head coach); never derived from an
    # email address, since coach sign-up doesn't verify email ownership.
    return user.is_admin


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


@router.get("/summary")
async def summary(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
    pays = (await db.execute(select(Payment).where(Payment.status == "success"))).scalars().all()
    volume_30d = sum(p.amount_minor for p in pays if p.paid_at and p.paid_at >= since)
    return {
        "coaches": (await db.execute(select(func.count()).select_from(User).where(User.role == "coach"))).scalar_one(),
        "clients": (await db.execute(select(func.count()).select_from(Client))).scalar_one(),
        "activeSubscriptions": (await db.execute(select(func.count()).select_from(Subscription).where(Subscription.status == "active"))).scalar_one(),
        "volume30d": to_major(volume_30d),
        "volumeAllTime": to_major(sum(p.amount_minor for p in pays)),
        "platformFeePercent": settings.PLATFORM_FEE_PERCENT,
        "platformFees30d": to_major(int(round(volume_30d * settings.PLATFORM_FEE_PERCENT / 100))),
        "currency": settings.PAYMENT_CURRENCY,
    }


@router.get("/coaches")
async def list_coaches(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    coaches = (await db.execute(select(User).where(User.role == "coach").order_by(User.created_at))).scalars().all()
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
    out: List[dict] = []
    for c in coaches:
        clients = (await db.execute(select(func.count()).select_from(Client).where(Client.coach_id == c.id))).scalar_one()
        volume = (await db.execute(select(func.coalesce(func.sum(Payment.amount_minor), 0)).where(
            Payment.coach_id == c.id, Payment.status == "success", Payment.paid_at >= since
        ))).scalar_one()
        account = await db.get(PayoutAccount, c.id)
        out.append({
            "id": c.id, "name": c.full_name, "email": c.email, "active": c.is_active, "isAdmin": is_admin(c),
            "clients": clients, "volume30d": to_major(volume), "payoutReady": bool(account and account.active),
            "joinedAt": c.created_at.isoformat() if c.created_at else None,
        })
    return out


@router.patch("/coaches/{coach_id}")
async def set_coach_status(coach_id: str, body: SuspendBody, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Suspending a coach blocks their login and their clients' pay links."""
    coach = await db.get(User, coach_id)
    if not coach or coach.role != "coach":
        raise HTTPException(status_code=404, detail="Coach not found")
    if coach.id == admin.id and not body.active:
        raise HTTPException(status_code=400, detail="You can't suspend yourself")
    coach.is_active = body.active
    await db.commit()
    return {"id": coach.id, "active": coach.is_active}


@router.get("/payments")
async def platform_payments(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Payment).where(Payment.status != "pending").order_by(Payment.created_at.desc()).limit(200))).scalars().all()
    names = {u.id: u.full_name for u in (await db.execute(select(User).where(User.role == "coach"))).scalars().all()}
    return [{
        "id": p.id, "reference": p.reference, "coachName": names.get(p.coach_id, p.coach_id), "amount": to_major(p.amount_minor),
        "fees": to_major(p.fees_minor), "currency": p.currency, "status": p.status, "channel": p.channel,
        "paidAt": p.paid_at.isoformat() if p.paid_at else None, "createdAt": p.created_at.isoformat(),
    } for p in rows]
