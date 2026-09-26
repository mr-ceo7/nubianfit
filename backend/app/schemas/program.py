"""
Program Pydantic Schemas
"""

from typing import List, Dict, Any, Optional
from datetime import date
from pydantic import Field, model_validator
from app.schemas.common import CamelModel
from app.schemas.training import validate_program_days


class ProgramBase(CamelModel):
    title: str
    subtitle: str = ""
    description: str = ""
    difficulty: str = "Intermediate"
    goal: str = "Hypertrophy"
    duration_weeks: int = 8
    days_per_week: int = 4
    days: List[Dict[str, Any]] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    assigned_client_count: int = 0
    created_at: str = ""
    updated_at: str = ""


class ProgramCreate(CamelModel):
    id: Optional[str] = None
    title: str
    subtitle: str = ""
    description: str = ""
    difficulty: str = "Intermediate"
    goal: str = "Hypertrophy"
    duration_weeks: int = Field(default=8, ge=1, le=52)
    days_per_week: int = 4
    days: List[Dict[str, Any]] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    assigned_client_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @model_validator(mode="after")
    def check_days(self):
        validate_program_days(self.days, self.duration_weeks)
        return self


class ProgramUpdate(CamelModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    goal: Optional[str] = None
    duration_weeks: Optional[int] = Field(default=None, ge=1, le=52)
    days_per_week: Optional[int] = None
    days: Optional[List[Dict[str, Any]]] = None
    tags: Optional[List[str]] = None
    assigned_client_count: Optional[int] = None
    updated_at: Optional[str] = None


class ProgramResponse(ProgramBase):
    id: str


class AssignProgramRequest(CamelModel):
    client_id: str
    # First day of week 1 on the client's calendar. Defaults to today.
    start_date: Optional[date] = None
