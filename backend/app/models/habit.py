"""
Client Daily Habit Log ORM Model
"""

from typing import List, Dict, Any
from sqlalchemy import String, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ClientDailyHabitLog(Base):
    __tablename__ = "habit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    date: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    habits: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
