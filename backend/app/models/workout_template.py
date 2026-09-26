"""
Workout library: reusable workouts a coach can drop into programs or assign directly.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List
from sqlalchemy import DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WorkoutTemplate(Base):
    __tablename__ = "workout_templates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    estimated_duration_min: Mapped[int] = mapped_column(Integer, default=60)
    tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    exercises: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    groups: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
