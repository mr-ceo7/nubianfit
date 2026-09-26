"""
Exercise ORM Model
"""

from typing import List, Optional
from sqlalchemy import String, Text, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    # None = shared global library; otherwise a coach's custom exercise.
    coach_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    primary_muscle: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    secondary_muscles: Mapped[List[str]] = mapped_column(JSON, default=list)
    equipment: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    difficulty: Mapped[str] = mapped_column(String(32), default="Intermediate")
    category: Mapped[str] = mapped_column(String(64), default="Strength")
    description: Mapped[str] = mapped_column(Text, default="")
    instructions: Mapped[List[str]] = mapped_column(JSON, default=list)
    form_cues: Mapped[List[str]] = mapped_column(JSON, default=list)
    demo_video_placeholder_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    thumbnail_url: Mapped[str] = mapped_column(String(512), default="")
    # YouTube or Vimeo link played in the exercise library and workout logger.
    video_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    # Default tracking type when the exercise is added to a workout.
    tracking_type: Mapped[str] = mapped_column(String(32), default="reps_weight", server_default="reps_weight")
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
