"""
Billing / marketplace schemas
"""

from datetime import date
from typing import List, Literal, Optional
from pydantic import Field, model_validator

from app.schemas.common import CamelModel, UtcDatetime


class PayoutAccountBody(CamelModel):
    business_name: str = Field(min_length=2, max_length=255)
    bank_code: str = Field(min_length=1, max_length=32)
    account_number: str = Field(min_length=4, max_length=34, pattern=r"^[0-9A-Za-z]+$")


class PayoutAccountResponse(CamelModel):
    business_name: str
    bank_code: str
    bank_name: str
    account_last4: str
    subaccount_code: str
    active: bool


class PackageBody(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=4000)
    # Major units in the API; stored in cents.
    price: float = Field(gt=0, le=10_000_000)
    currency: Optional[str] = Field(default="KES", min_length=2, max_length=8)
    billing: Literal["one_time", "recurring"]
    interval: Optional[Literal["monthly", "quarterly", "yearly"]] = None
    duration_weeks: Optional[int] = Field(default=None, ge=1, le=104)
    program_id: Optional[str] = None
    autoflow_id: Optional[str] = None
    onboarding_form_id: Optional[str] = None
    active: bool = True

    @model_validator(mode="after")
    def check_billing(self):
        if self.currency:
            self.currency = self.currency.strip().upper()
        if self.billing == "recurring" and not self.interval:
            raise ValueError("Recurring packages need an interval")
        if self.billing == "one_time" and not self.duration_weeks:
            raise ValueError("One-time packages need a duration in weeks")
        return self


class PackageResponse(CamelModel):
    id: str
    title: str
    description: str
    price: float
    currency: str
    billing: str
    interval: Optional[str] = None
    duration_weeks: Optional[int] = None
    program_id: Optional[str] = None
    autoflow_id: Optional[str] = None
    onboarding_form_id: Optional[str] = None
    active: bool
    created_at: UtcDatetime


class PaymentRequestBody(CamelModel):
    client_id: str
    package_id: str


class PaymentRequestResponse(CamelModel):
    id: str
    client_id: str
    package_id: str
    subscription_id: Optional[str] = None
    purpose: str
    amount: float
    currency: str
    status: str
    url: str
    created_at: UtcDatetime
    paid_at: Optional[UtcDatetime] = None


class SubscriptionResponse(CamelModel):
    id: str
    client_id: str
    package_id: str
    status: str
    current_period_start: date
    current_period_end: date
    cancel_at_period_end: bool
    auto_renew: bool
    card_label: str


class PaymentResponse(CamelModel):
    id: str
    reference: str
    client_id: str
    package_id: str
    subscription_id: Optional[str] = None
    amount: float
    fees: float
    currency: str
    status: str
    channel: str
    failure_reason: str
    created_at: UtcDatetime
    paid_at: Optional[UtcDatetime] = None


class PublicPaymentRequest(CamelModel):
    """What the pay page shows (no auth: only non-sensitive details)."""
    status: str
    purpose: str
    coach_name: str
    client_first_name: str
    package_title: str
    package_description: str
    billing: str
    interval: Optional[str] = None
    duration_weeks: Optional[int] = None
    amount: float
    currency: str
    payments_enabled: bool


class VerifyBody(CamelModel):
    reference: str = Field(min_length=4, max_length=100)


class SuspendBody(CamelModel):
    active: bool


class Analytics(CamelModel):
    # Explicit aliases: the camelCase generator would turn "30d" into "30D".
    revenue_30d: float = Field(alias="revenue30d")
    revenue_prev_30d: float = Field(alias="revenuePrev30d")
    mrr: float
    active_subscriptions: int
    past_due_subscriptions: int
    cancelled_30d: int = Field(alias="cancelled30d")
    pending_requests: int
    revenue_by_month: List[dict]
    active_clients: int
    total_clients: int
    avg_compliance: float
    workouts_completed_30d: int = Field(alias="workoutsCompleted30d")
    checkins_submitted_30d: int = Field(alias="checkinsSubmitted30d")
