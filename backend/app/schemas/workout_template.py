"""
Workout library schemas
"""

from typing import Any, Dict, List, Optional
from pydantic import Field, model_validator

from app.schemas.common import CamelModel, UtcDatetime
from app.schemas.training import validate_workout_content


class WorkoutTemplateBase(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    estimated_duration_min: int = Field(default=60, ge=0, le=600)
    tags: List[str] = Field(default_factory=list)
    exercises: List[Dict[str, Any]] = Field(default_factory=list)
    groups: List[Dict[str, Any]] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_content(self):
        validate_workout_content(self.exercises, self.groups)
        return self


class WorkoutTemplateCreate(WorkoutTemplateBase):
    pass


class WorkoutTemplateUpdate(CamelModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    estimated_duration_min: Optional[int] = Field(default=None, ge=0, le=600)
    tags: Optional[List[str]] = None
    exercises: Optional[List[Dict[str, Any]]] = None
    groups: Optional[List[Dict[str, Any]]] = None


class WorkoutTemplateResponse(WorkoutTemplateBase):
    id: str
    created_at: UtcDatetime
    updated_at: UtcDatetime
