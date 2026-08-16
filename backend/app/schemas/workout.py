"""
Workout / Scheduled Workout Pydantic Schemas
"""

from typing import List, Dict, Any, Optional
from pydantic import Field
from app.schemas.common import CamelModel


class ScheduledWorkoutBase(CamelModel):
    client_id: str
    client_name: str = ""
    client_avatar: str = ""
    program_id: Optional[str] = None
    program_name: Optional[str] = None
    workout_day_id: str = ""
    workout_title: str
    date: str
    time: Optional[str] = None
    status: str = "Scheduled"
    duration_min: Optional[int] = None
    rating: Optional[int] = None
    client_feedback: Optional[str] = None
    coach_feedback: Optional[str] = None
    total_volume_kg: Optional[float] = None
    pr_count: Optional[int] = None
    exercises: List[Dict[str, Any]] = Field(default_factory=list)


class ScheduledWorkoutCreate(ScheduledWorkoutBase):
    id: Optional[str] = None


class ScheduledWorkoutUpdate(CamelModel):
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    client_avatar: Optional[str] = None
    program_id: Optional[str] = None
    program_name: Optional[str] = None
    workout_day_id: Optional[str] = None
    workout_title: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = None
    duration_min: Optional[int] = None
    rating: Optional[int] = None
    client_feedback: Optional[str] = None
    coach_feedback: Optional[str] = None
    total_volume_kg: Optional[float] = None
    pr_count: Optional[int] = None
    exercises: Optional[List[Dict[str, Any]]] = None


class CompleteWorkoutRequest(CamelModel):
    client_feedback: Optional[str] = None
    coach_feedback: Optional[str] = None
    rating: Optional[int] = 5
    duration_min: Optional[int] = None
    exercises: Optional[List[Dict[str, Any]]] = None


class ScheduledWorkoutResponse(ScheduledWorkoutBase):
    id: str
