"""
Exercise Pydantic Schemas
"""

from typing import List, Optional
from pydantic import Field
from app.schemas.common import CamelModel


class ExerciseBase(CamelModel):
    name: str
    primary_muscle: str
    secondary_muscles: List[str] = Field(default_factory=list)
    equipment: str
    difficulty: str = "Intermediate"
    category: str = "Strength"
    description: str = ""
    instructions: List[str] = Field(default_factory=list)
    form_cues: List[str] = Field(default_factory=list)
    demo_video_placeholder_url: Optional[str] = None
    thumbnail_url: str = ""
    is_custom: bool = False


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(CamelModel):
    name: Optional[str] = None
    primary_muscle: Optional[str] = None
    secondary_muscles: Optional[List[str]] = None
    equipment: Optional[str] = None
    difficulty: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[List[str]] = None
    form_cues: Optional[List[str]] = None
    demo_video_placeholder_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_custom: Optional[bool] = None


class ExerciseResponse(ExerciseBase):
    id: str
