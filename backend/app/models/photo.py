"""
Progress Photo ORM Model
"""

from typing import Optional
from sqlalchemy import String, Float, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProgressPhoto(Base):
    __tablename__ = "progress_photos"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    date: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    view: Mapped[str] = mapped_column(String(32), default="Front")
    photo_url: Mapped[str] = mapped_column(String(512), nullable=False)
    weight_kg: Mapped[float] = mapped_column(Float, default=70.0)
    body_fat_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
