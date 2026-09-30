"""
Chat Message ORM Model
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ChatMessage(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sender: Mapped[str] = mapped_column(String(32), nullable=False)  # 'coach' or 'client'
    text: Mapped[str] = mapped_column(Text, default="")
    timestamp: Mapped[str] = mapped_column(String(64), default="")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    attachment: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    scheduled_for: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    is_delivered: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True, default=lambda: datetime.now(timezone.utc))


class CannedResponse(Base):
    """Coach's reusable quick reply templates (e.g. /checkin, /welcome)."""
    __tablename__ = "canned_responses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    shortcut: Mapped[str] = mapped_column(String(64), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True, default=lambda: datetime.now(timezone.utc))

