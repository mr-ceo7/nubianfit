"""
Marketplace billing: coach payout accounts (Paystack subaccounts), packages, payment links,
subscriptions and payments. Money is stored in the currency's subunit (KES cents).
"""

from datetime import date, datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import Boolean, Date, DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class PayoutAccount(Base):
    """Where a coach's share of payments settles (a Paystack subaccount)."""
    __tablename__ = "payout_accounts"

    coach_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    bank_code: Mapped[str] = mapped_column(String(32), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(255), default="")
    # Only the last digits are kept; Paystack holds the full number.
    account_last4: Mapped[str] = mapped_column(String(8), default="")
    subaccount_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Package(Base):
    __tablename__ = "packages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    price_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="KES")
    billing: Mapped[str] = mapped_column(String(16), nullable=False)  # one_time | recurring
    interval: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # monthly | quarterly | yearly
    # One-time packages give access for this many weeks.
    duration_weeks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Applied when a client pays for the first time.
    program_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    autoflow_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    onboarding_form_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Subscription(Base):
    """A client's enrolment in a package. One-time packages are a single, non-renewing period."""
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    package_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | past_due | cancelled | completed
    current_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    current_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    # Reusable card authorisation for automatic renewals (absent for M-Pesa etc.).
    authorization_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    card_label: Mapped[str] = mapped_column(String(64), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class PaymentRequest(Base):
    """A pay link a coach sends (or a renewal link the system sends)."""
    __tablename__ = "payment_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    package_id: Mapped[str] = mapped_column(String(64), nullable=False)
    subscription_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    purpose: Mapped[str] = mapped_column(String(16), default="purchase")  # purchase | renewal
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="KES")
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | paid | cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    reference: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    package_id: Mapped[str] = mapped_column(String(64), nullable=False)
    subscription_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    payment_request_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    fees_minor: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(8), default="KES")
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | success | failed
    channel: Mapped[str] = mapped_column(String(32), default="")
    # Set once the payment's effects (enrolment, program, notifications) have been applied.
    fulfilled: Mapped[bool] = mapped_column(Boolean, default=False)
    failure_reason: Mapped[str] = mapped_column(String(255), default="")
    raw: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True, default=_now)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
