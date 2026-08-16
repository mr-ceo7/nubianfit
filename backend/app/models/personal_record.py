"""
Personal Record (PR) ORM Model
"""

from typing import Optional
from sqlalchemy import String, Integer, Float
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PersonalRecord(Base):
    __tablename__ = "personal_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    exercise_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, default=1)
    estimated_1rm_kg: Mapped[float] = mapped_column(Float, nullable=False)
    date: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    previous_weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
