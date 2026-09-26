"""
Habits a coach sets for a client, and the client's daily check-ins.
"""

from datetime import date, datetime, timezone
from typing import List, Optional
from sqlalchemy import Boolean, Date, DateTime, Float, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Habit(Base):
    __tablename__ = "habits"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Optional numeric goal, e.g. 8 (hours) or 3 (litres). Checking in marks the day done.
    target_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(32), default="")
    # ISO weekdays (1 = Monday … 7 = Sunday) the habit applies to; empty means every day.
    days_of_week: Mapped[List[int]] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class HabitCheckin(Base):
    __tablename__ = "habit_checkins"
    __table_args__ = (UniqueConstraint("habit_id", "date", name="uq_habit_checkins_habit_date"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    habit_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=True)
    value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
