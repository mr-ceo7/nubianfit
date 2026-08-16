"""
Client ORM Model
"""

from typing import List, Dict, Any, Optional
from sqlalchemy import String, Integer, Float, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    avatar: Mapped[str] = mapped_column(String(512), default="")
    email: Mapped[str] = mapped_column(String(255), index=True, default="")
    phone: Mapped[str] = mapped_column(String(64), default="")
    age: Mapped[int] = mapped_column(Integer, default=25)
    gender: Mapped[str] = mapped_column(String(32), default="Male")
    status: Mapped[str] = mapped_column(String(64), default="Active", index=True)
    goal: Mapped[str] = mapped_column(String(64), default="Hypertrophy")
    experience_level: Mapped[str] = mapped_column(String(64), default="Intermediate")
    start_date: Mapped[str] = mapped_column(String(32), default="")
    
    current_program_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    current_program_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    compliance_rate: Mapped[float] = mapped_column(Float, default=100.0)
    workouts_completed: Mapped[int] = mapped_column(Integer, default=0)
    total_workouts_assigned: Mapped[int] = mapped_column(Integer, default=0)
    last_active: Mapped[str] = mapped_column(String(64), default="Recently")
    
    starting_weight_kg: Mapped[float] = mapped_column(Float, default=75.0)
    current_weight_kg: Mapped[float] = mapped_column(Float, default=75.0)
    target_weight_kg: Mapped[float] = mapped_column(Float, default=70.0)
    height_cm: Mapped[float] = mapped_column(Float, default=175.0)
    body_fat_percentage: Mapped[float] = mapped_column(Float, default=15.0)
    target_body_fat: Mapped[float] = mapped_column(Float, default=12.0)
    
    injuries_and_health: Mapped[List[str]] = mapped_column(JSON, default=list)
    medical_alerts: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    custom_coach_notes: Mapped[List[str]] = mapped_column(JSON, default=list)
    onboarding_survey: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
