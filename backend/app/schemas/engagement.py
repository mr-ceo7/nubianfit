"""
Engagement schemas: notifications, push, community, check-in forms, Autoflow.
"""

from datetime import date
from typing import Any, Dict, List, Literal, Optional
from pydantic import Field, model_validator

from app.schemas.common import CamelModel, UtcDatetime

# --- Notifications -----------------------------------------------------------


class NotificationResponse(CamelModel):
    id: str
    type: str
    title: str
    body: str
    link: Dict[str, Any]
    read_at: Optional[UtcDatetime] = None
    created_at: UtcDatetime


class MarkReadRequest(CamelModel):
    ids: Optional[List[str]] = None  # None = mark all read


class PushSubscribeRequest(CamelModel):
    endpoint: str = Field(min_length=10, max_length=1024)
    keys: Dict[str, str]

    @model_validator(mode="after")
    def check_keys(self):
        if not self.endpoint.startswith("https://") or not self.keys.get("p256dh") or not self.keys.get("auth"):
            raise ValueError("Invalid push subscription")
        return self


class PreferencesBody(CamelModel):
    email_digest: bool


# --- Community ---------------------------------------------------------------


class GroupBody(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    client_ids: List[str] = Field(default_factory=list)


class GroupUpdate(CamelModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    client_ids: Optional[List[str]] = None


class GroupResponse(CamelModel):
    id: str
    name: str
    description: str
    client_ids: List[str]
    created_at: UtcDatetime


class PostBody(CamelModel):
    body: str = Field(min_length=1, max_length=5000)


class CommentResponse(CamelModel):
    id: str
    post_id: str
    author_user_id: str
    author_name: str
    author_role: str
    body: str
    created_at: UtcDatetime


class PostResponse(CamelModel):
    id: str
    group_id: str
    author_user_id: str
    author_name: str
    author_role: str
    body: str
    pinned: bool
    created_at: UtcDatetime
    like_count: int = 0
    liked_by_me: bool = False
    comments: List[CommentResponse] = Field(default_factory=list)


class GroupMessageBody(CamelModel):
    text: str = Field(min_length=1, max_length=4000)


class GroupMessageResponse(CamelModel):
    id: str
    group_id: str
    author_user_id: str
    author_name: str
    author_role: str
    text: str
    created_at: UtcDatetime


# --- Check-in forms ------------------------------------------------------------

QuestionType = Literal["text", "long_text", "number", "scale", "single_choice", "multi_choice", "yes_no", "weight", "photo"]


class Question(CamelModel):
    id: str = Field(min_length=1, max_length=64)
    type: QuestionType
    label: str = Field(min_length=1, max_length=500)
    required: bool = False
    options: List[str] = Field(default_factory=list)
    min: Optional[float] = None
    max: Optional[float] = None
    # For photo questions: which progress-photo view it records.
    view: Optional[Literal["Front", "Side", "Back"]] = None

    @model_validator(mode="after")
    def check_options(self):
        if self.type in ("single_choice", "multi_choice") and len([o for o in self.options if o.strip()]) < 2:
            raise ValueError(f'"{self.label}" needs at least two options')
        if self.type == "scale" and self.min is not None and self.max is not None and self.min >= self.max:
            raise ValueError(f'"{self.label}": scale minimum must be below maximum')
        return self


class CheckinFormBody(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    questions: List[Question] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def unique_ids(self):
        ids = [q.id for q in self.questions]
        if len(ids) != len(set(ids)):
            raise ValueError("Question ids must be unique")
        return self


class CheckinFormResponse(CheckinFormBody):
    id: str
    created_at: UtcDatetime
    updated_at: UtcDatetime


class CheckinAssignBody(CamelModel):
    form_id: str
    client_id: str
    frequency: Literal["once", "weekly"] = "weekly"
    start_date: Optional[date] = None


class CheckinAssignmentResponse(CamelModel):
    id: str
    form_id: str
    client_id: str
    frequency: str
    start_date: date
    active: bool
    # Most recent due date without a response (on or before today), if any.
    pending_due_date: Optional[date] = None
    next_due_date: Optional[date] = None


class CheckinSubmit(CamelModel):
    assignment_id: str
    due_date: date
    answers: Dict[str, Any]


class CheckinResponseOut(CamelModel):
    id: str
    assignment_id: str
    form_id: str
    client_id: str
    due_date: date
    questions: List[Dict[str, Any]]
    answers: Dict[str, Any]
    submitted_at: UtcDatetime
    coach_comment: str
    reviewed_at: Optional[UtcDatetime] = None
    # Signed URLs for photo answers, keyed by file id.
    photo_urls: Dict[str, str] = Field(default_factory=dict)


class ReviewBody(CamelModel):
    comment: str = Field(default="", max_length=4000)


# --- Autoflow -------------------------------------------------------------------


class HabitSpec(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    target_value: Optional[float] = Field(default=None, ge=0)
    unit: str = Field(default="", max_length=32)
    days_of_week: List[int] = Field(default_factory=list)


class AutoflowStep(CamelModel):
    id: str = Field(min_length=1, max_length=64)
    day: int = Field(ge=1, le=365)
    type: Literal["message", "checkin", "habit"]
    text: Optional[str] = Field(default=None, max_length=4000)
    form_id: Optional[str] = None
    habit: Optional[HabitSpec] = None

    @model_validator(mode="after")
    def check_payload(self):
        if self.type == "message" and not (self.text or "").strip():
            raise ValueError(f"Day {self.day}: a message step needs text")
        if self.type == "checkin" and not self.form_id:
            raise ValueError(f"Day {self.day}: choose a check-in form")
        if self.type == "habit" and not self.habit:
            raise ValueError(f"Day {self.day}: describe the habit")
        return self


class AutoflowBody(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    steps: List[AutoflowStep] = Field(default_factory=list, max_length=100)


class AutoflowResponse(AutoflowBody):
    id: str
    created_at: UtcDatetime
    updated_at: UtcDatetime


class AutoflowAssignBody(CamelModel):
    client_id: str
    start_date: Optional[date] = None


class AutoflowAssignmentResponse(CamelModel):
    id: str
    autoflow_id: str
    client_id: str
    start_date: date
    active: bool
    completed_step_ids: List[str]
