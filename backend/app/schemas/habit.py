"""
Habit Log Pydantic Schemas
"""

from typing import List, Dict, Any, Optional
from pydantic import Field
from app.schemas.common import CamelModel


class HabitItemSchema(CamelModel):
    id: str
    title: str
    target_value: str
    unit: str
    icon_name: str
    category: str


class ClientDailyHabitLogBase(CamelModel):
    client_id: str
    date: str
    habits: List[Dict[str, Any]] = Field(default_factory=list)


class ClientDailyHabitLogCreate(ClientDailyHabitLogBase):
    id: Optional[str] = None


class ToggleHabitRequest(CamelModel):
    client_id: str
    date: str
    habit_id: str


class ClientDailyHabitLogResponse(ClientDailyHabitLogBase):
    id: str
