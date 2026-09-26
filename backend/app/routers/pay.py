"""
Public pay page API (opened from an emailed link, no login) and the Paystack webhook.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.business import Package, Payment, PaymentRequest, PayoutAccount
from app.models.client import Client
from app.models.user import User
from app.rate_limiter import rate_limit
from app.schemas.business import PublicPaymentRequest, VerifyBody
from app.services import paystack
from app.services.billing import fulfil, start_checkout, to_major

logger = logging.getLogger("nubianfit.pay")

router = APIRouter(tags=["Payments"])


async def _get_request(token: str, db: AsyncSession) -> PaymentRequest:
    r = (await db.execute(select(PaymentRequest).where(PaymentRequest.token == token))).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="This payment link is invalid")
    return r


@router.get("/pay/{token}", response_model=PublicPaymentRequest, dependencies=[Depends(rate_limit(30, 60, "pay-view"))])
async def view_payment(token: str, db: AsyncSession = Depends(get_db)):
    r = await _get_request(token, db)
    package = await db.get(Package, r.package_id)
    coach = await db.get(User, r.coach_id)
    client = await db.get(Client, r.client_id)
    account = await db.get(PayoutAccount, r.coach_id)
    return PublicPaymentRequest(
        status=r.status, purpose=r.purpose, coach_name=coach.full_name if coach else "Your coach",
        client_first_name=(client.name.split(" ")[0] if client else ""), package_title=package.title if package else "",
        package_description=package.description if package else "", billing=package.billing if package else "one_time",
        interval=package.interval if package else None, duration_weeks=package.duration_weeks if package else None,
        amount=to_major(r.amount_minor), currency=r.currency,
        payments_enabled=bool(paystack.configured() and account and account.active and coach and coach.is_active),
    )


@router.post("/pay/{token}/checkout", dependencies=[Depends(rate_limit(10, 60, "pay-checkout"))])
async def checkout(token: str, db: AsyncSession = Depends(get_db)):
    r = await _get_request(token, db)
    if r.status != "pending":
        raise HTTPException(status_code=400, detail="This payment link has already been used or was cancelled")
    try:
        return {"authorizationUrl": await start_checkout(db, r)}
    except paystack.PaystackError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/pay/{token}/verify", dependencies=[Depends(rate_limit(20, 60, "pay-verify"))])
async def verify(token: str, body: VerifyBody, db: AsyncSession = Depends(get_db)):
    """Called when the client returns from Paystack; the webhook does the same thing server-to-server."""
    r = await _get_request(token, db)
    payment = (await db.execute(select(Payment).where(Payment.reference == body.reference))).scalar_one_or_none()
    if not payment or payment.payment_request_id != r.id:
        raise HTTPException(status_code=404, detail="Payment not found")
    if not payment.fulfilled:
        try:
            await fulfil(db, await paystack.verify_transaction(body.reference))
        except paystack.PaystackError as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
        await db.refresh(payment)
    return {"status": payment.status, "failureReason": payment.failure_reason}


@router.post("/webhooks/paystack", include_in_schema=False)
async def paystack_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    raw = await request.body()
    if not paystack.verify_webhook_signature(raw, request.headers.get("x-paystack-signature", "")):
        raise HTTPException(status_code=401, detail="Invalid signature")
    event = json.loads(raw or b"{}")
    if event.get("event") == "charge.success":
        data = event.get("data") or {}
        try:
            # Re-verify with Paystack rather than trusting the payload alone.
            await fulfil(db, await paystack.verify_transaction(data.get("reference", "")))
        except paystack.PaystackError:
            logger.exception("Webhook verification failed for %s", data.get("reference"))
            raise HTTPException(status_code=502, detail="Verification failed")  # Paystack will retry
    return {"received": True}
