"""
Habit schemas
"""

from datetime import date
from typing import List, Optional
from pydantic import Field, field_validator

from app.schemas.common import CamelModel


def _check_days(days: Optional[List[int]]) -> Optional[List[int]]:
    if days is None:
        return None
    if any(d not in range(1, 8) for d in days):
        raise ValueError("daysOfWeek must contain ISO weekdays 1 (Mon) to 7 (Sun)")
    return sorted(set(days))


class HabitCreate(CamelModel):
    client_id: str
    title: str = Field(min_length=1, max_length=255)
    target_value: Optional[float] = Field(default=None, ge=0)
    unit: str = Field(default="", max_length=32)
    days_of_week: List[int] = Field(default_factory=list)
    sort_order: int = 0

    _days = field_validator("days_of_week")(_check_days)


class HabitUpdate(CamelModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    target_value: Optional[float] = Field(default=None, ge=0)
    unit: Optional[str] = Field(default=None, max_length=32)
    days_of_week: Optional[List[int]] = None
    active: Optional[bool] = None
    sort_order: Optional[int] = None

    _days = field_validator("days_of_week")(_check_days)


class HabitResponse(CamelModel):
    id: str
    client_id: str
    title: str
    target_value: Optional[float] = None
    unit: str
    days_of_week: List[int]
    active: bool
    sort_order: int


class HabitCheckinUpsert(CamelModel):
    habit_id: str
    date: date
    completed: bool = True
    value: Optional[float] = Field(default=None, ge=0)


class HabitCheckinResponse(CamelModel):
    id: str
    habit_id: str
    client_id: str
    date: date
    completed: bool
    value: Optional[float] = None
