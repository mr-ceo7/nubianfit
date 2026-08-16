"""
Client Biometric Metric Entry ORM Model
"""

from typing import Optional
from sqlalchemy import String, Float, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MetricEntry(Base):
    __tablename__ = "metrics"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    date: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    body_fat_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    chest_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    waist_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    arms_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    thighs_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
