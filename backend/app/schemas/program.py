"""
Program Pydantic Schemas
"""

from typing import List, Dict, Any, Optional
from pydantic import Field
from app.schemas.common import CamelModel


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
    duration_weeks: int = 8
    days_per_week: int = 4
    days: List[Dict[str, Any]] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    assigned_client_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProgramUpdate(CamelModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    goal: Optional[str] = None
    duration_weeks: Optional[int] = None
    days_per_week: Optional[int] = None
    days: Optional[List[Dict[str, Any]]] = None
    tags: Optional[List[str]] = None
    assigned_client_count: Optional[int] = None
    updated_at: Optional[str] = None


class ProgramResponse(ProgramBase):
    id: str


class AssignProgramRequest(CamelModel):
    client_id: str
