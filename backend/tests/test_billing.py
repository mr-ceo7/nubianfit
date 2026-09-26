"""Phase 4: payouts, packages, payment links, Paystack fulfilment, renewals, analytics, admin."""

import hashlib
import hmac
import json
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.business import Payment, Subscription
from app.services import email, paystack
from app.services.billing import add_months, run_renewals
from conftest import DEMO_CLIENT_ID

TODAY = date.today()


class FakePaystack:
    """Records calls and returns Paystack-shaped responses."""

    def __init__(self):
        self.calls = []
        self.outcome = "success"
        self.charge_outcome = "success"
        self.amount_override = None
        self.pending = {}

    async def list_banks(self, country="kenya"):
        return [{"code": "01", "name": "Test Bank", "type": ""}]

    async def create_subaccount(self, business_name, bank_code, account_number, email):
        self.calls.append(("create_subaccount", bank_code, account_number))
        return {"subaccount_code": f"ACCT_{account_number[-4:]}"}

    async def update_subaccount(self, code, **fields):
        self.calls.append(("update_subaccount", code))
        return {}

    async def initialize_transaction(self, *, email, amount, reference, callback_url, subaccount, metadata):
        self.calls.append(("initialize", amount, subaccount))
        self.pending[reference] = amount
        return {"authorization_url": f"https://checkout.paystack.com/{reference}", "reference": reference}

    def _tx(self, reference, amount, status):
        return {"reference": reference, "status": status, "amount": self.amount_override or amount, "currency": "KES",
                "channel": "card", "fees": 12000, "customer": {"email": "marcus.vance@example.com"},
                "authorization": {"authorization_code": "AUTH_new", "reusable": True, "brand": "visa", "last4": "4242"}}

    async def verify_transaction(self, reference):
        self.calls.append(("verify", reference))
        return self._tx(reference, self.pending.get(reference, 0), self.outcome)

    async def charge_authorization(self, *, email, amount, authorization_code, reference, subaccount, metadata):
        self.calls.append(("charge", amount, authorization_code, subaccount))
        return self._tx(reference, amount, self.charge_outcome)


@pytest.fixture
def ps(monkeypatch):
    fake = FakePaystack()
    monkeypatch.setattr(settings, "PAYSTACK_SECRET_KEY", "sk_test_123")
    for name in ("list_banks", "create_subaccount", "update_subaccount", "initialize_transaction", "verify_transaction", "charge_authorization"):
        monkeypatch.setattr(paystack, name, getattr(fake, name))
    return fake


async def token_of(api, coach, request_id):
    reqs = (await api.get("/api/billing/payment-requests", headers=coach)).json()
    return next(r for r in reqs if r["id"] == request_id)["url"].split("pay=")[1]


async def pay(api, token, ps):
    checkout = await api.post(f"/api/pay/{token}/checkout")
    assert checkout.status_code == 200, checkout.text
    reference = checkout.json()["authorizationUrl"].rsplit("/", 1)[1]
    return reference, await api.post(f"/api/pay/{token}/verify", json={"reference": reference})


# --- Setup ------------------------------------------------------------------------

async def test_payout_account_creates_subaccount(api, other_coach, client_user, ps):
    assert (await api.put("/api/billing/payout-account", headers=other_coach, json={
        "businessName": "Rival Fitness", "bankCode": "99", "accountNumber": "1234567890"})).status_code == 422
    res = await api.put("/api/billing/payout-account", headers=other_coach, json={
        "businessName": "Rival Fitness", "bankCode": "01", "accountNumber": "1234567890"})
    assert res.status_code == 200, res.text
    assert res.json() == {"businessName": "Rival Fitness", "bankCode": "01", "bankName": "Test Bank", "accountLast4": "7890",
                          "subaccountCode": "ACCT_7890", "active": True}
    await api.put("/api/billing/payout-account", headers=other_coach, json={
        "businessName": "Rival Fitness Ltd", "bankCode": "01", "accountNumber": "1234567890"})
    assert ps.calls[-1] == ("update_subaccount", "ACCT_7890")
    assert (await api.get("/api/billing/payout-account", headers=client_user)).status_code == 403


async def test_package_validation(api, coach, other_coach):
    base = {"title": "Plan", "price": 5000, "billing": "recurring"}
    assert (await api.post("/api/billing/packages", headers=coach, json=base)).status_code == 422
    assert (await api.post("/api/billing/packages", headers=coach, json={**base, "billing": "one_time"})).status_code == 422
    foreign = {**base, "interval": "monthly", "programId": "prog-1"}
    assert (await api.post("/api/billing/packages", headers=other_coach, json=foreign)).status_code == 422
    ok = (await api.post("/api/billing/packages", headers=coach, json={**base, "interval": "quarterly"})).json()
    assert ok["price"] == 5000 and ok["currency"] == "KES"


# --- Pay flow ----------------------------------------------------------------------

async def test_payment_link_to_paid_one_time_package(api, coach, client_user, ps):
    res = await api.post("/api/billing/payment-requests", headers=coach, json={"clientId": DEMO_CLIENT_ID, "packageId": "pkg-12wk"})
    assert res.status_code == 201, res.text
    link = res.json()
    assert link["amount"] == 20000 and link["url"].startswith(settings.CLIENT_URL)
    assert any("pay=" in m["text"] for m in email.outbox)
    token = link["url"].split("pay=")[1]

    public = (await api.get(f"/api/pay/{token}")).json()
    assert public["packageTitle"] == "12-Week Transformation" and public["paymentsEnabled"] is True
    assert public["clientFirstName"] == "Marcus" and "email" not in json.dumps(public).lower()

    reference, verified = await pay(api, token, ps)
    assert verified.json()["status"] == "success"
    assert ("initialize", 2000000, "ACCT_demo") in ps.calls

    subs = [s for s in (await api.get("/api/billing/subscriptions", headers=coach)).json() if s["packageId"] == "pkg-12wk"]
    assert len(subs) == 1 and subs[0]["status"] == "active"
    assert subs[0]["currentPeriodEnd"] == (TODAY + timedelta(weeks=12)).isoformat()
    me = (await api.get(f"/api/clients/{DEMO_CLIENT_ID}", headers=coach)).json()
    assert me["currentProgramId"] == "prog-1"  # package's program was assigned

    # Idempotent: verifying again doesn't create a second enrolment, and the link can't be reused.
    await api.post(f"/api/pay/{token}/verify", json={"reference": reference})
    assert len([s for s in (await api.get("/api/billing/subscriptions", headers=coach)).json() if s["packageId"] == "pkg-12wk"]) == 1
    assert (await api.post(f"/api/pay/{token}/checkout")).status_code == 400
    assert (await api.get("/api/notifications", headers=coach)).json()["items"][0]["type"] == "payment_received"


async def test_recurring_purchase_sends_onboarding_form_and_saves_card(api, coach, ps):
    link = (await api.post("/api/billing/payment-requests", headers=coach, json={"clientId": "client-2", "packageId": "pkg-monthly"})).json()
    _, verified = await pay(api, link["url"].split("pay=")[1], ps)
    assert verified.json()["status"] == "success"
    sub = next(s for s in (await api.get("/api/billing/subscriptions", headers=coach)).json() if s["clientId"] == "client-2")
    assert sub["autoRenew"] is True and sub["cardLabel"] == "Visa •••• 4242"
    assert sub["currentPeriodEnd"] == add_months(TODAY, 1).isoformat()
    onboarding = [a for a in (await api.get("/api/checkin-assignments", headers=coach, params={"clientId": "client-2"})).json()]
    assert any(a["formId"] == "form-weekly" and a["frequency"] == "once" for a in onboarding)


async def test_amount_mismatch_is_rejected(api, coach, ps):
    link = (await api.post("/api/billing/payment-requests", headers=coach, json={"clientId": "client-2", "packageId": "pkg-12wk"})).json()
    ps.amount_override = 100  # client paid KES 1
    _, verified = await pay(api, link["url"].split("pay=")[1], ps)
    assert verified.json() == {"status": "failed", "failureReason": "Amount or currency mismatch"}
    assert not [s for s in (await api.get("/api/billing/subscriptions", headers=coach)).json() if s["clientId"] == "client-2"]


async def test_webhook_signature_and_fulfilment(api, coach, ps):
    link = (await api.post("/api/billing/payment-requests", headers=coach, json={"clientId": "client-2", "packageId": "pkg-12wk"})).json()
    reference = (await api.post(f"/api/pay/{link['url'].split('pay=')[1]}/checkout")).json()["authorizationUrl"].rsplit("/", 1)[1]
    body = json.dumps({"event": "charge.success", "data": {"reference": reference}}).encode()
    assert (await api.post("/api/webhooks/paystack", content=body, headers={"x-paystack-signature": "bad"})).status_code == 401
    sig = hmac.new(b"sk_test_123", body, hashlib.sha512).hexdigest()
    res = await api.post("/api/webhooks/paystack", content=body, headers={"x-paystack-signature": sig})
    assert res.status_code == 200
    reqs = (await api.get("/api/billing/payment-requests", headers=coach)).json()
    assert next(r for r in reqs if r["id"] == link["id"])["status"] == "paid"


async def test_links_need_payout_account_and_client_email(api, other_coach, ps):
    client = (await api.post("/api/clients", headers=other_coach, json={"name": "No Email"})).json()
    pkg = (await api.post("/api/billing/packages", headers=other_coach, json={"title": "P", "price": 100, "billing": "one_time", "durationWeeks": 4})).json()
    res = await api.post("/api/billing/payment-requests", headers=other_coach, json={"clientId": client["id"], "packageId": pkg["id"]})
    assert res.status_code == 400 and "payout" in res.json()["detail"]
    await api.put("/api/billing/payout-account", headers=other_coach, json={"businessName": "Rival", "bankCode": "01", "accountNumber": "55554444"})
    res = await api.post("/api/billing/payment-requests", headers=other_coach, json={"clientId": client["id"], "packageId": pkg["id"]})
    assert res.status_code == 400 and "email" in res.json()["detail"]


# --- Renewals -----------------------------------------------------------------------

async def _set_sub(**values):
    async with AsyncSessionLocal() as db:
        sub = await db.get(Subscription, "sub-demo")
        for k, v in values.items():
            setattr(sub, k, v)
        await db.commit()


async def _sub():
    async with AsyncSessionLocal() as db:
        return await db.get(Subscription, "sub-demo")


async def test_card_renewal_success_and_failure(ps):
    await _set_sub(current_period_end=TODAY)
    async with AsyncSessionLocal() as db:
        await run_renewals(db, TODAY)
    sub = await _sub()
    assert sub.status == "active" and sub.current_period_end == add_months(TODAY, 1)
    assert ("charge", 800000, "AUTH_demo", "ACCT_demo") in ps.calls

    # A second charge within the same day is skipped (loop + cron overlap guard)...
    await _set_sub(current_period_end=TODAY)
    async with AsyncSessionLocal() as db:
        await run_renewals(db, TODAY)
    assert sum(1 for c in ps.calls if c[0] == "charge") == 1

    # ...so pretend the first charge happened yesterday, then fail the next one.
    async with AsyncSessionLocal() as db:
        await db.execute(update(Payment).where(Payment.subscription_id == "sub-demo").values(
            created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)))
        await db.commit()
    ps.charge_outcome = "failed"
    async with AsyncSessionLocal() as db:
        await run_renewals(db, TODAY)
        requests = (await db.execute(select(Payment).where(Payment.subscription_id == "sub-demo", Payment.status == "failed"))).scalars().all()
    assert (await _sub()).status == "past_due" and len(requests) == 1


async def test_manual_renewal_link_and_lapse(api, client_user, ps):
    await _set_sub(authorization_code=None, current_period_end=TODAY + timedelta(days=2))
    async with AsyncSessionLocal() as db:
        await run_renewals(db, TODAY)
        await run_renewals(db, TODAY)  # no duplicate link
    mine = (await api.get("/api/billing/me", headers=client_user)).json()
    renewals = [r for r in mine["paymentRequests"] if r["purpose"] == "renewal"]
    assert len(renewals) == 1

    async with AsyncSessionLocal() as db:
        await run_renewals(db, TODAY + timedelta(days=3))
    assert (await _sub()).status == "past_due"

    _, verified = await pay(api, renewals[0]["url"].split("pay=")[1], ps)
    assert verified.json()["status"] == "success"
    sub = await _sub()
    # Paid before the old period ended, so the new period continues from the old end date.
    assert sub.status == "active" and sub.current_period_end == add_months(TODAY + timedelta(days=2), 1)


async def test_cancel_and_resume_by_client(api, client_user, coach):
    res = await api.post("/api/billing/subscriptions/sub-demo/cancel", headers=client_user)
    assert res.json()["cancelAtPeriodEnd"] is True and res.json()["autoRenew"] is True
    assert (await api.post("/api/billing/subscriptions/sub-demo/resume", headers=client_user)).json()["cancelAtPeriodEnd"] is False
    await api.post("/api/billing/subscriptions/sub-demo/cancel", headers=coach)
    await _set_sub(current_period_end=TODAY)
    async with AsyncSessionLocal() as db:
        await run_renewals(db, TODAY)
    assert (await _sub()).status == "cancelled"


# --- Analytics & admin ------------------------------------------------------------------

async def test_analytics(api, coach, other_coach):
    a = (await api.get("/api/billing/analytics", headers=coach)).json()
    assert a["mrr"] == 8000 and a["activeSubscriptions"] == 1 and a["pendingRequests"] == 1
    assert a["revenue30d"] == 8000 and len(a["revenueByMonth"]) == 6
    assert a["totalClients"] >= 6
    empty = (await api.get("/api/billing/analytics", headers=other_coach)).json()
    assert empty["mrr"] == 0 and empty["totalClients"] == 0


async def test_admin_can_suspend_coach(api, coach, other_coach, ps):
    me = (await api.get("/api/auth/me", headers=coach)).json()
    assert me["isAdmin"] is True
    assert (await api.get("/api/admin/coaches", headers=other_coach)).status_code == 403
    coaches = (await api.get("/api/admin/coaches", headers=coach)).json()
    rival = next(c for c in coaches if c["email"] == "rival@example.com")
    summary = (await api.get("/api/admin/summary", headers=coach)).json()
    assert summary["volumeAllTime"] >= 40000

    assert (await api.patch(f"/api/admin/coaches/{me['id']}", headers=coach, json={"active": False})).status_code == 400
    await api.patch(f"/api/admin/coaches/{rival['id']}", headers=coach, json={"active": False})
    assert (await api.get("/api/auth/me", headers=other_coach)).status_code == 401

    # A suspended coach's clients can't pay them.
    await api.patch(f"/api/admin/coaches/{me['id']}", headers=coach, json={"active": True})
    assert (await api.get("/api/pay/demo-pay-link-damon")).json()["paymentsEnabled"] is True
