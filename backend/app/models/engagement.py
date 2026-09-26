"""
Engagement ORM models: notifications, web push, community groups, check-in forms, uploaded
photos and Autoflow sequences.
"""

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean, Date, DateTime, Integer, JSON, LargeBinary, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- Notifications -----------------------------------------------------------

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(48), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="")
    # Where tapping it should go, e.g. {"tab": "messenger", "clientId": "…"}
    link: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    emailed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True, default=_now)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    endpoint: Mapped[str] = mapped_column(String(1024), unique=True, nullable=False)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# --- Community ---------------------------------------------------------------

class CommunityGroup(Base):
    __tablename__ = "community_groups"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("group_id", "client_id", name="uq_group_members"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class GroupPost(Base):
    __tablename__ = "group_posts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    author_user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    author_name: Mapped[str] = mapped_column(String(255), nullable=False)
    author_role: Mapped[str] = mapped_column(String(16), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True, default=_now)


class PostComment(Base):
    __tablename__ = "post_comments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    post_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    author_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    author_name: Mapped[str] = mapped_column(String(255), nullable=False)
    author_role: Mapped[str] = mapped_column(String(16), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_likes"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    post_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False)


class GroupMessage(Base):
    __tablename__ = "group_messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    author_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    author_name: Mapped[str] = mapped_column(String(255), nullable=False)
    author_role: Mapped[str] = mapped_column(String(16), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True, default=_now)


# --- Check-in forms ------------------------------------------------------------

class CheckinForm(Base):
    __tablename__ = "checkin_forms"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    # [{id, type, label, required, options?, min?, max?}]
    questions: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class CheckinAssignment(Base):
    """A form scheduled for a client: once on start_date, or weekly on start_date's weekday."""
    __tablename__ = "checkin_assignments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    form_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    frequency: Mapped[str] = mapped_column(String(16), default="weekly")  # once | weekly
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Last due date a "check-in due" notification went out for.
    last_notified_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class CheckinResponse(Base):
    __tablename__ = "checkin_responses"
    __table_args__ = (UniqueConstraint("assignment_id", "due_date", name="uq_checkin_responses_due"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    assignment_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    form_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Snapshot of the questions answered, so later form edits don't garble old responses.
    questions: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    answers: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)  # {questionId: value}
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    coach_comment: Mapped[str] = mapped_column(Text, default="")
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class StoredFile(Base):
    """Small uploaded images (check-in / progress photos), kept in the database for now."""
    __tablename__ = "stored_files"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(64), nullable=False)
    content_type: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# --- Autoflow -------------------------------------------------------------------

class Autoflow(Base):
    """A reusable sequence of steps, each run N days after the client's start date."""
    __tablename__ = "autoflows"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    # [{id, day, type: message|checkin|habit, text?, formId?, habit?}]
    steps: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class AutoflowAssignment(Base):
    __tablename__ = "autoflow_assignments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    autoflow_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    completed_step_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
