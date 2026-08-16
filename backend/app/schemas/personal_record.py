"""
Personal Record Pydantic Schemas
"""

from typing import Optional
from app.schemas.common import CamelModel


class PersonalRecordBase(CamelModel):
    client_id: str
    exercise_name: str
    weight_kg: float
    reps: int = 1
    estimated_1rm_kg: float
    date: str
    previous_weight_kg: Optional[float] = None


class PersonalRecordCreate(PersonalRecordBase):
    id: Optional[str] = None


class PersonalRecordResponse(PersonalRecordBase):
    id: str
