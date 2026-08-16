"""
Scheduled Workout / Workout Log ORM Model
"""

from typing import List, Dict, Any, Optional
from sqlalchemy import String, Integer, Float, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScheduledWorkout(Base):
    __tablename__ = "scheduled_workouts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    client_name: Mapped[str] = mapped_column(String(255), default="")
    client_avatar: Mapped[str] = mapped_column(String(512), default="")
    program_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    program_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    workout_day_id: Mapped[str] = mapped_column(String(64), default="")
    workout_title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    time: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="Scheduled", index=True)
    duration_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    client_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    coach_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    total_volume_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pr_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    exercises: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
