"""
User ORM Model (coaches and clients)
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, true
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # Clients sign in with email codes and may never set a password.
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="coach", nullable=False)  # 'coach' | 'client'
    # For role == 'client': the Client profile this login belongs to.
    client_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    avatar: Mapped[str] = mapped_column(String(512), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Email a summary of unread notifications the user hasn't seen in the app.
    email_digest: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
