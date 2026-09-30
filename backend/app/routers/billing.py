"""
Coach billing: payout account (Paystack subaccount), packages, payment links, subscriptions,
payments and business analytics. Clients see their own billing via /billing/me.
"""

from datetime import date, datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_accessible_client, get_current_user, get_db, require_coach
from app.models.business import Package, Payment, PaymentRequest, PayoutAccount, Subscription
from app.models.client import Client
from app.models.engagement import Autoflow, CheckinForm, CheckinResponse
from app.models.program import TrainingProgram
from app.models.user import User
from app.models.workout import ScheduledWorkout
from app.schemas.business import (
    Analytics, PackageBody, PackageResponse, PaymentRequestBody, PaymentRequestResponse, PaymentResponse,
    PayoutAccountBody, PayoutAccountResponse, SubscriptionResponse,
)
from app.services import paystack
from app.services.activity import new_id
from app.services.billing import INTERVAL_MONTHS, create_payment_request, pay_url, to_major, to_minor

router = APIRouter(prefix="/billing", tags=["Billing"])


def _package_out(p: Package) -> PackageResponse:
    return PackageResponse(
        id=p.id, title=p.title, description=p.description, price=to_major(p.price_minor), currency=p.currency,
        billing=p.billing, interval=p.interval, duration_weeks=p.duration_weeks, program_id=p.program_id,
        autoflow_id=p.autoflow_id, onboarding_form_id=p.onboarding_form_id, active=p.active, created_at=p.created_at,
    )


def _request_out(r: PaymentRequest) -> PaymentRequestResponse:
    return PaymentRequestResponse(
        id=r.id, client_id=r.client_id, package_id=r.package_id, subscription_id=r.subscription_id, purpose=r.purpose,
        amount=to_major(r.amount_minor), currency=r.currency, status=r.status, url=pay_url(r.token),
        created_at=r.created_at, paid_at=r.paid_at,
    )


def _subscription_out(s: Subscription) -> SubscriptionResponse:
    return SubscriptionResponse(
        id=s.id, client_id=s.client_id, package_id=s.package_id, status=s.status,
        current_period_start=s.current_period_start, current_period_end=s.current_period_end,
        cancel_at_period_end=s.cancel_at_period_end, auto_renew=bool(s.authorization_code), card_label=s.card_label,
    )


def _payment_out(p: Payment) -> PaymentResponse:
    return PaymentResponse(
        id=p.id, reference=p.reference, client_id=p.client_id, package_id=p.package_id, subscription_id=p.subscription_id,
        amount=to_major(p.amount_minor), fees=to_major(p.fees_minor), currency=p.currency, status=p.status,
        channel=p.channel, failure_reason=p.failure_reason, created_at=p.created_at, paid_at=p.paid_at,
    )


def _paystack_error(e: paystack.PaystackError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


# --- Payout account --------------------------------------------------------------

@router.get("/banks")
async def list_banks(coach: User = Depends(require_coach)):
    try:
        return await paystack.list_banks("kenya")
    except paystack.PaystackError as e:
        raise _paystack_error(e)


@router.get("/payout-account", response_model=PayoutAccountResponse | None)
async def get_payout_account(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    return await db.get(PayoutAccount, coach.id)


@router.put("/payout-account", response_model=PayoutAccountResponse)
async def set_payout_account(body: PayoutAccountBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    """Create (or update) the coach's Paystack subaccount. Paystack validates the account."""
    account = await db.get(PayoutAccount, coach.id)
    try:
        banks = {b["code"]: b["name"] for b in await paystack.list_banks("kenya")}
        if body.bank_code not in banks:
            raise HTTPException(status_code=422, detail="Choose a bank from the list")
        if account:
            await paystack.update_subaccount(account.subaccount_code, business_name=body.business_name,
                                             bank_code=body.bank_code, account_number=body.account_number)
        else:
            data = await paystack.create_subaccount(body.business_name, body.bank_code, body.account_number, coach.email)
            account = PayoutAccount(coach_id=coach.id, subaccount_code=data["subaccount_code"], business_name=body.business_name,
                                    bank_code=body.bank_code)
            db.add(account)
    except paystack.PaystackError as e:
        raise _paystack_error(e)
    account.business_name = body.business_name
    account.bank_code = body.bank_code
    account.bank_name = banks[body.bank_code]
    account.account_last4 = body.account_number[-4:]
    account.active = True
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return account


# --- Packages -------------------------------------------------------------------

async def _check_links(db: AsyncSession, coach: User, body: PackageBody) -> None:
    for model, value, label in ((TrainingProgram, body.program_id, "Program"), (Autoflow, body.autoflow_id, "Autoflow"),
                                (CheckinForm, body.onboarding_form_id, "Onboarding form")):
        if value:
            row = await db.get(model, value)
            if not row or row.coach_id != coach.id:
                raise HTTPException(status_code=422, detail=f"{label} not found")


def _apply(p: Package, body: PackageBody) -> None:
    p.title = body.title.strip()
    p.description = body.description
    p.price_minor = to_minor(body.price)
    p.currency = (body.currency or settings.PAYMENT_CURRENCY).strip().upper()
    p.billing = body.billing
    p.interval = body.interval if body.billing == "recurring" else None
    p.duration_weeks = body.duration_weeks if body.billing == "one_time" else None
    p.program_id, p.autoflow_id, p.onboarding_form_id = body.program_id, body.autoflow_id, body.onboarding_form_id
    p.active = body.active


async def _get_package(package_id: str, coach: User, db: AsyncSession) -> Package:
    p = await db.get(Package, package_id)
    if not p or p.coach_id != coach.id:
        raise HTTPException(status_code=404, detail="Package not found")
    return p


@router.get("/public/packages", response_model=List[PackageResponse])
async def list_public_packages(db: AsyncSession = Depends(get_db)):
    """Public active packages displayed on the landing page."""
    head_coach = (await db.execute(
        select(User).where(func.lower(User.email) == settings.DEFAULT_COACH_EMAIL.lower())
    )).scalar_one_or_none()
    coach_id = head_coach.id if head_coach else None
    rows = []
    if coach_id:
        rows = (await db.execute(
            select(Package).where(Package.coach_id == coach_id, Package.active == True).order_by(Package.price_minor.asc())
        )).scalars().all()
    if not rows:
        rows = (await db.execute(
            select(Package).where(Package.active == True).order_by(Package.price_minor.asc())
        )).scalars().all()
    return [_package_out(p) for p in rows]


@router.get("/packages", response_model=List[PackageResponse])
async def list_packages(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Package).where(Package.coach_id == coach.id).order_by(Package.created_at))).scalars().all()
    return [_package_out(p) for p in rows]


@router.post("/packages", response_model=PackageResponse, status_code=status.HTTP_201_CREATED)
async def create_package(body: PackageBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    await _check_links(db, coach, body)
    p = Package(id=new_id("pkg"), coach_id=coach.id, title="", price_minor=0, billing=body.billing)
    _apply(p, body)
    db.add(p)
    await db.commit()
    return _package_out(p)


@router.put("/packages/{package_id}", response_model=PackageResponse)
async def update_package(package_id: str, body: PackageBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    """Price changes apply to new links and future renewals; existing links keep their amount."""
    p = await _get_package(package_id, coach, db)
    await _check_links(db, coach, body)
    _apply(p, body)
    await db.commit()
    return _package_out(p)


# --- Payment links ----------------------------------------------------------------

@router.get("/payment-requests", response_model=List[PaymentRequestResponse])
async def list_payment_requests(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(PaymentRequest).where(PaymentRequest.coach_id == coach.id).order_by(PaymentRequest.created_at.desc()).limit(200)
    )).scalars().all()
    return [_request_out(r) for r in rows]


@router.post("/payment-requests", response_model=PaymentRequestResponse, status_code=status.HTTP_201_CREATED)
async def send_payment_link(body: PaymentRequestBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    client = await get_accessible_client(body.client_id, coach, db)
    package = await _get_package(body.package_id, coach, db)
    if not package.active:
        raise HTTPException(status_code=400, detail="This package is archived")
    if not await db.get(PayoutAccount, coach.id):
        raise HTTPException(status_code=400, detail="Set up your payout account before sending payment links")
    if not client.email:
        raise HTTPException(status_code=400, detail="Add the client's email address first")
    return _request_out(await create_payment_request(db, client, package))


@router.post("/payment-requests/{request_id}/cancel", response_model=PaymentRequestResponse)
async def cancel_payment_link(request_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    r = await db.get(PaymentRequest, request_id)
    if not r or r.coach_id != coach.id:
        raise HTTPException(status_code=404, detail="Payment link not found")
    if r.status != "pending":
        raise HTTPException(status_code=400, detail="Only unpaid links can be cancelled")
    r.status = "cancelled"
    await db.commit()
    return _request_out(r)


# --- Subscriptions & payments ------------------------------------------------------

@router.get("/subscriptions", response_model=List[SubscriptionResponse])
async def list_subscriptions(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Subscription).where(Subscription.coach_id == coach.id).order_by(Subscription.created_at.desc()))).scalars().all()
    return [_subscription_out(s) for s in rows]


async def _get_subscription(sub_id: str, user: User, db: AsyncSession) -> Subscription:
    s = await db.get(Subscription, sub_id)
    if not s:
        raise HTTPException(status_code=404, detail="Subscription not found")
    await get_accessible_client(s.client_id, user, db)
    return s


@router.post("/subscriptions/{sub_id}/cancel", response_model=SubscriptionResponse)
async def cancel_subscription(sub_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Stops renewal; access continues until the end of the paid period. Coach or client."""
    s = await _get_subscription(sub_id, user, db)
    s.cancel_at_period_end = True
    await db.commit()
    return _subscription_out(s)


@router.post("/subscriptions/{sub_id}/resume", response_model=SubscriptionResponse)
async def resume_subscription(sub_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await _get_subscription(sub_id, user, db)
    if s.status not in ("active", "past_due"):
        raise HTTPException(status_code=400, detail="This subscription has ended; send a new payment link instead")
    s.cancel_at_period_end = False
    await db.commit()
    return _subscription_out(s)


@router.get("/payments", response_model=List[PaymentResponse])
async def list_payments(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Payment).where(Payment.coach_id == coach.id, Payment.status != "pending").order_by(Payment.created_at.desc()).limit(300)
    )).scalars().all()
    return [_payment_out(p) for p in rows]


@router.get("/me")
async def my_billing(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """A client's subscriptions, open payment links and payment history."""
    if user.role != "client":
        raise HTTPException(status_code=403, detail="Client access required")
    subs = (await db.execute(select(Subscription).where(Subscription.client_id == user.client_id))).scalars().all()
    reqs = (await db.execute(select(PaymentRequest).where(PaymentRequest.client_id == user.client_id, PaymentRequest.status == "pending"))).scalars().all()
    pays = (await db.execute(
        select(Payment).where(Payment.client_id == user.client_id, Payment.status == "success").order_by(Payment.created_at.desc())
    )).scalars().all()
    package_ids = {s.package_id for s in subs} | {r.package_id for r in reqs} | {p.package_id for p in pays}
    packages = (await db.execute(select(Package).where(Package.id.in_(package_ids)))).scalars().all() if package_ids else []
    return {
        "subscriptions": [_subscription_out(s).model_dump(by_alias=True, mode="json") for s in subs],
        "paymentRequests": [_request_out(r).model_dump(by_alias=True, mode="json") for r in reqs],
        "payments": [_payment_out(p).model_dump(by_alias=True, mode="json") for p in pays],
        "packages": {p.id: {"title": p.title, "billing": p.billing, "interval": p.interval} for p in packages},
    }


# --- Analytics --------------------------------------------------------------------

@router.get("/analytics", response_model=Analytics)
async def analytics(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today = date.today()
    payments = (await db.execute(select(Payment).where(Payment.coach_id == coach.id, Payment.status == "success"))).scalars().all()
    rev = lambda frm, to: sum(p.amount_minor for p in payments if p.paid_at and frm <= p.paid_at < to)  # noqa: E731

    by_month = []
    for i in range(5, -1, -1):
        first = date(today.year, today.month, 1)
        month_start = date(first.year + (first.month - 1 - i) // 12, (first.month - 1 - i) % 12 + 1, 1)
        month_end = date(month_start.year + month_start.month // 12, month_start.month % 12 + 1, 1)
        total = sum(p.amount_minor for p in payments if p.paid_at and month_start <= p.paid_at.date() < month_end)
        by_month.append({"month": month_start.strftime("%Y-%m"), "revenue": to_major(total)})

    subs = (await db.execute(select(Subscription).where(Subscription.coach_id == coach.id))).scalars().all()
    packages = {p.id: p for p in (await db.execute(select(Package).where(Package.coach_id == coach.id))).scalars().all()}
    mrr = sum(
        packages[s.package_id].price_minor / INTERVAL_MONTHS[packages[s.package_id].interval or "monthly"]
        for s in subs
        if s.status == "active" and not s.cancel_at_period_end and s.package_id in packages and packages[s.package_id].billing == "recurring"
    )
    cancelled_30d = sum(1 for s in subs if s.status == "cancelled" and s.current_period_end >= today - timedelta(days=30))
    pending = (await db.execute(
        select(func.count()).select_from(PaymentRequest).where(PaymentRequest.coach_id == coach.id, PaymentRequest.status == "pending")
    )).scalar_one()

    clients = (await db.execute(select(Client).where(Client.coach_id == coach.id))).scalars().all()
    client_ids = [c.id for c in clients]
    since = (today - timedelta(days=30)).isoformat()
    workouts_done = (await db.execute(select(func.count()).select_from(ScheduledWorkout).where(
        ScheduledWorkout.client_id.in_(client_ids), ScheduledWorkout.status == "Completed", ScheduledWorkout.date >= since
    ))).scalar_one() if client_ids else 0
    checkins = (await db.execute(select(func.count()).select_from(CheckinResponse).where(
        CheckinResponse.client_id.in_(client_ids), CheckinResponse.submitted_at >= now - timedelta(days=30)
    ))).scalar_one() if client_ids else 0

    return Analytics(
        revenue_30d=to_major(rev(now - timedelta(days=30), now + timedelta(days=1))),
        revenue_prev_30d=to_major(rev(now - timedelta(days=60), now - timedelta(days=30))),
        mrr=to_major(int(round(mrr))),
        active_subscriptions=sum(1 for s in subs if s.status == "active"),
        past_due_subscriptions=sum(1 for s in subs if s.status == "past_due"),
        cancelled_30d=cancelled_30d,
        pending_requests=pending,
        revenue_by_month=by_month,
        active_clients=sum(1 for c in clients if c.status == "Active"),
        total_clients=len(clients),
        avg_compliance=round(sum(c.compliance_rate for c in clients) / len(clients), 1) if clients else 0,
        workouts_completed_30d=workouts_done,
        checkins_submitted_30d=checkins,
    )
