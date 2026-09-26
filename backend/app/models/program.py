"""
Training Program ORM Model
"""

from typing import List, Dict, Any
from sqlalchemy import String, Integer, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TrainingProgram(Base):
    __tablename__ = "programs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    subtitle: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[str] = mapped_column(String(32), default="Intermediate")
    goal: Mapped[str] = mapped_column(String(64), default="Hypertrophy")
    duration_weeks: Mapped[int] = mapped_column(Integer, default=8)
    days_per_week: Mapped[int] = mapped_column(Integer, default=4)
    days: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    assigned_client_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(String(32), default="")
    updated_at: Mapped[str] = mapped_column(String(32), default="")
