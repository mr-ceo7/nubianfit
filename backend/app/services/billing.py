"""
Marketplace billing: payment links, Paystack fulfilment and renewals.

Payments settle straight to the coach's Paystack subaccount (the coach bears Paystack's fee;
NubianFit's share is PLATFORM_FEE_PERCENT). A payment is applied at most once (Payment.fulfilled),
whether confirmed by webhook, by the client returning from checkout, or by a renewal charge.
"""

import calendar
import html
import logging
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.business import Package, Payment, PaymentRequest, PayoutAccount, Subscription
from app.models.client import Client
from app.models.engagement import AutoflowAssignment, Autoflow, CheckinAssignment, CheckinForm
from app.models.program import TrainingProgram
from app.models.user import User
from app.services import paystack
from app.services.activity import log_activity, new_id
from app.services.email import EmailDeliveryError, layout, send_email
from app.services.notify import client_user_ids, notify

logger = logging.getLogger("nubianfit.billing")

INTERVAL_MONTHS = {"monthly": 1, "quarterly": 3, "yearly": 12}
DEFAULT_ONE_TIME_WEEKS = 12


def to_minor(amount: float) -> int:
    return int(round(amount * 100))


def to_major(minor: int) -> float:
    return round(minor / 100, 2)


def format_money(minor: int, currency: str = "KES") -> str:
    return f"{currency} {minor / 100:,.0f}" if minor % 100 == 0 else f"{currency} {minor / 100:,.2f}"


def add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def next_period_end(package: Package, start: date) -> date:
    if package.billing == "recurring":
        return add_months(start, INTERVAL_MONTHS[package.interval or "monthly"])
    return start + timedelta(weeks=package.duration_weeks or DEFAULT_ONE_TIME_WEEKS)


def pay_url(token: str) -> str:
    return f"{settings.CLIENT_URL}/?pay={token}"


def new_reference() -> str:
    return f"nf_{secrets.token_hex(12)}"


# --- Payment links -------------------------------------------------------------

async def create_payment_request(
    db: AsyncSession, client: Client, package: Package, purpose: str = "purchase", subscription_id: Optional[str] = None
) -> PaymentRequest:
    """Create a pay link and tell the client (in-app + email). Commits."""
    request = PaymentRequest(
        id=new_id("payreq"), token=secrets.token_urlsafe(24), coach_id=package.coach_id, client_id=client.id,
        package_id=package.id, subscription_id=subscription_id, purpose=purpose,
        amount_minor=package.price_minor, currency=package.currency, status="pending",
    )
    db.add(request)
    await db.commit()

    url = pay_url(request.token)
    amount = format_money(request.amount_minor, request.currency)
    title = f"Renew {package.title}" if purpose == "renewal" else f"Payment for {package.title}"
    await notify(db, await client_user_ids(db, client.id), "payment_request", title, amount, {"tab": "profile"})
    if client.email:
        try:
            await send_email(
                client.email,
                f"{title} ({amount})",
                layout(html.escape(title), f"<p>Hi {html.escape(client.name.split(' ')[0])},</p>"
                       f"<p>Your coach has sent you a payment link for <strong>{html.escape(package.title)}</strong> ({amount}).</p>"
                       f'<p><a href="{url}" style="display:inline-block;background:#22d3ee;color:#0b1120;padding:12px 20px;'
                       f'border-radius:10px;font-weight:700;text-decoration:none">Pay securely</a></p>'
                       "<p style='font-size:12px;color:#94a3b8'>Payments are processed by Paystack. Card or M-Pesa.</p>"),
                f"{title}: {amount}. Pay here: {url}",
            )
        except EmailDeliveryError:
            logger.warning("Couldn't email payment link %s to %s", request.id, client.email)
    return request


# --- Fulfilment -----------------------------------------------------------------

async def _apply_package(db: AsyncSession, package: Package, client: Client, today: date) -> None:
    """First purchase of a package: assign its program, start its Autoflow, send its onboarding form."""
    from app.services.scheduler import run_autoflow_assignment

    if package.program_id:
        program = await db.get(TrainingProgram, package.program_id)
        if program and program.coach_id == package.coach_id:
            from app.services.programs import assign_program_to_client
            assign_program_to_client(db, program, client, today)
    if package.onboarding_form_id:
        form = await db.get(CheckinForm, package.onboarding_form_id)
        if form and form.coach_id == package.coach_id:
            db.add(CheckinAssignment(id=new_id("chk-assign"), form_id=form.id, client_id=client.id, frequency="once",
                                     start_date=today, active=True, last_notified_date=today))
    await db.commit()
    if package.autoflow_id:
        flow = await db.get(Autoflow, package.autoflow_id)
        if flow and flow.coach_id == package.coach_id:
            assignment = AutoflowAssignment(id=new_id("flow-assign"), autoflow_id=flow.id, client_id=client.id,
                                            start_date=today, active=True, completed_step_ids=[])
            db.add(assignment)
            await db.commit()
            await run_autoflow_assignment(db, assignment, today)


async def fulfil(db: AsyncSession, data: Dict[str, Any], today: Optional[date] = None) -> Optional[Payment]:
    """Apply a Paystack transaction (from verify, webhook or charge_authorization). Idempotent."""
    today = today or date.today()
    # Row lock (Postgres) so the webhook and the client's return can't both apply the payment.
    payment = (await db.execute(
        select(Payment).where(Payment.reference == data.get("reference")).with_for_update()
    )).scalar_one_or_none()
    if not payment:
        logger.warning("Paystack event for unknown reference %s", data.get("reference"))
        return None
    if payment.fulfilled:
        return payment

    status = data.get("status")
    payment.raw = {k: data.get(k) for k in ("id", "status", "amount", "currency", "channel", "gateway_response", "paid_at", "fees")}
    if status != "success":
        if status in ("failed", "abandoned", "reversed"):
            payment.status = "failed"
            payment.failure_reason = (data.get("gateway_response") or status)[:255]
        await db.commit()
        return payment

    # Never trust a success that doesn't match what we asked for.
    if int(data.get("amount") or 0) != payment.amount_minor or (data.get("currency") or payment.currency) != payment.currency:
        payment.status = "failed"
        payment.failure_reason = "Amount or currency mismatch"
        await db.commit()
        logger.error("Amount mismatch on %s: got %s %s", payment.reference, data.get("amount"), data.get("currency"))
        return payment

    payment.status = "success"
    payment.channel = data.get("channel") or ""
    payment.fees_minor = int(data.get("fees") or 0)
    payment.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)
    payment.fulfilled = True

    package = await db.get(Package, payment.package_id)
    client = await db.get(Client, payment.client_id)
    request = await db.get(PaymentRequest, payment.payment_request_id) if payment.payment_request_id else None
    if request:
        request.status = "paid"
        request.paid_at = payment.paid_at

    subscription = await db.get(Subscription, payment.subscription_id) if payment.subscription_id else None
    first_purchase = subscription is None
    if subscription:
        # Renewal: the new period continues from the old end (or today if it lapsed).
        start = max(subscription.current_period_end, today)
        subscription.current_period_start = start
        subscription.current_period_end = next_period_end(package, start)
        subscription.status = "active"
    else:
        subscription = Subscription(
            id=new_id("sub"), coach_id=payment.coach_id, client_id=payment.client_id, package_id=package.id,
            status="active", current_period_start=today, current_period_end=next_period_end(package, today),
            email=(data.get("customer") or {}).get("email") or (client.email if client else ""),
        )
        db.add(subscription)
        payment.subscription_id = subscription.id

    auth = data.get("authorization") or {}
    if package.billing == "recurring" and auth.get("reusable") and payment.channel == "card" and auth.get("authorization_code"):
        subscription.authorization_code = auth["authorization_code"]
        subscription.card_label = f"{(auth.get('brand') or 'card').title()} •••• {auth.get('last4', '')}".strip()

    if client:
        log_activity(db, client, "payment_received", f"Paid: {package.title}", format_money(payment.amount_minor, payment.currency),
                     {"paymentId": payment.id})
    await db.commit()

    if first_purchase and client:
        await _apply_package(db, package, client, today)
    if client:
        amount = format_money(payment.amount_minor, payment.currency)
        await notify(db, [payment.coach_id], "payment_received", f"{client.name} paid {amount}", package.title,
                     {"tab": "business", "clientId": client.id})
        await notify(db, await client_user_ids(db, client.id), "payment_confirmed", "Payment received",
                     f"{package.title} · active until {subscription.current_period_end.isoformat()}", {"tab": "profile"})
    return payment


async def start_checkout(db: AsyncSession, request: PaymentRequest) -> str:
    """Create a pending Payment and a Paystack checkout; returns the URL to redirect to."""
    account = await db.get(PayoutAccount, request.coach_id)
    client = await db.get(Client, request.client_id)
    coach = await db.get(User, request.coach_id)
    if not account or not account.active or not coach or not coach.is_active:
        raise paystack.PaystackError("Your coach can't accept payments right now.")
    if not client or not client.email:
        raise paystack.PaystackError("Your coach needs to add your email address before you can pay.")
    reference = new_reference()
    db.add(Payment(
        id=new_id("pay"), reference=reference, coach_id=request.coach_id, client_id=request.client_id,
        package_id=request.package_id, subscription_id=request.subscription_id, payment_request_id=request.id,
        amount_minor=request.amount_minor, currency=request.currency, status="pending",
    ))
    await db.commit()
    data = await paystack.initialize_transaction(
        email=client.email, amount=request.amount_minor, reference=reference, callback_url=pay_url(request.token),
        subaccount=account.subaccount_code, metadata={"payment_request_id": request.id, "client_id": client.id},
    )
    return data["authorization_url"]


# --- Renewals --------------------------------------------------------------------

async def _has_pending_renewal(db: AsyncSession, subscription: Subscription) -> bool:
    return (await db.execute(select(PaymentRequest.id).where(
        PaymentRequest.subscription_id == subscription.id, PaymentRequest.status == "pending"
    ))).first() is not None


async def run_renewals(db: AsyncSession, today: date) -> int:
    """Charge saved cards, send renewal links, and close out ended subscriptions. Returns actions taken."""
    actions = 0
    subs = (await db.execute(select(Subscription).where(Subscription.status.in_(("active", "past_due"))))).scalars().all()
    for sub in subs:
        package = await db.get(Package, sub.package_id)
        client = await db.get(Client, sub.client_id)
        coach = await db.get(User, sub.coach_id)
        if not package or not client:
            continue

        # One-time packages and cancelled renewals simply end.
        if package.billing == "one_time" or sub.cancel_at_period_end:
            if sub.current_period_end <= today and sub.status == "active":
                sub.status = "completed" if package.billing == "one_time" else "cancelled"
                await db.commit()
                actions += 1
            continue
        if not coach or not coach.is_active:
            continue

        due = sub.current_period_end <= today
        if sub.authorization_code and due and sub.status == "active":
            account = await db.get(PayoutAccount, sub.coach_id)
            if not account or not account.active:
                continue
            # A charge already attempted today (e.g. the loop and the cron tick overlapping) means skip.
            recent = (await db.execute(select(Payment.id).where(
                Payment.subscription_id == sub.id, Payment.payment_request_id.is_(None),
                Payment.created_at >= datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=20),
            ))).first()
            if recent:
                continue
            reference = new_reference()
            db.add(Payment(id=new_id("pay"), reference=reference, coach_id=sub.coach_id, client_id=sub.client_id,
                           package_id=package.id, subscription_id=sub.id, amount_minor=package.price_minor,
                           currency=package.currency, status="pending"))
            await db.commit()
            try:
                data = await paystack.charge_authorization(
                    email=sub.email or client.email, amount=package.price_minor, authorization_code=sub.authorization_code,
                    reference=reference, subaccount=account.subaccount_code, metadata={"subscription_id": sub.id},
                )
                data.setdefault("reference", reference)
                payment = await fulfil(db, data, today)
                succeeded = bool(payment and payment.status == "success")
            except paystack.PaystackError as e:
                logger.warning("Renewal charge for %s failed: %s", sub.id, e)
                succeeded = False
            if not succeeded:
                sub.status = "past_due"
                await db.commit()
                if not await _has_pending_renewal(db, sub):
                    await create_payment_request(db, client, package, "renewal", sub.id)
            actions += 1
        elif not sub.authorization_code:
            # Manual payers (M-Pesa etc.) get a link a few days ahead.
            if sub.current_period_end - timedelta(days=settings.RENEWAL_NOTICE_DAYS) <= today and not await _has_pending_renewal(db, sub):
                await create_payment_request(db, client, package, "renewal", sub.id)
                actions += 1
            if due and sub.status == "active":
                sub.status = "past_due"
                await db.commit()
                actions += 1
    return actions
