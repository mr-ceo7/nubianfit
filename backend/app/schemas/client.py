"""
Client Pydantic Schemas
"""

from typing import List, Dict, Any, Optional
from pydantic import Field
from app.schemas.common import CamelModel


class OnboardingSurveySchema(CamelModel):
    gym_access: str = ""
    weekly_availability_days: int = 4
    dietary_restrictions: str = ""
    sleep_avg_hours: float = 7.0
    stress_level: str = "Moderate"
    favorite_exercises: str = ""
    least_favorite_exercises: str = ""


class ClientBase(CamelModel):
    name: str
    avatar: str = ""
    email: str = ""
    phone: str = ""
    age: int = 25
    gender: str = "Male"
    status: str = "Active"
    goal: str = "Hypertrophy"
    experience_level: str = "Intermediate"
    start_date: str = ""
    current_program_id: Optional[str] = None
    current_program_name: Optional[str] = None
    compliance_rate: float = 100.0
    workouts_completed: int = 0
    total_workouts_assigned: int = 0
    last_active: str = "Recently"
    target_weight_kg: float = 70.0
    current_weight_kg: float = 75.0
    starting_weight_kg: float = 75.0
    height_cm: float = 175.0
    body_fat_percentage: float = 15.0
    target_body_fat: float = 12.0
    injuries_and_health: List[str] = Field(default_factory=list)
    medical_alerts: Optional[str] = None
    custom_coach_notes: List[str] = Field(default_factory=list)
    onboarding_survey: Dict[str, Any] = Field(default_factory=dict)


class ClientCreate(CamelModel):
    name: str
    avatar: str = ""
    email: str = ""
    phone: str = ""
    age: int = 25
    gender: str = "Male"
    status: str = "Active"
    goal: str = "Hypertrophy"
    experience_level: str = "Intermediate"
    start_date: str = ""
    current_program_id: Optional[str] = None
    current_program_name: Optional[str] = None
    target_weight_kg: float = 70.0
    current_weight_kg: float = 75.0
    starting_weight_kg: float = 75.0
    height_cm: float = 175.0
    body_fat_percentage: float = 15.0
    target_body_fat: float = 12.0
    injuries_and_health: List[str] = Field(default_factory=list)
    medical_alerts: Optional[str] = None
    custom_coach_notes: List[str] = Field(default_factory=list)
    onboarding_survey: Dict[str, Any] = Field(default_factory=dict)


class ClientUpdate(CamelModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    status: Optional[str] = None
    goal: Optional[str] = None
    experience_level: Optional[str] = None
    start_date: Optional[str] = None
    current_program_id: Optional[str] = None
    current_program_name: Optional[str] = None
    compliance_rate: Optional[float] = None
    workouts_completed: Optional[int] = None
    total_workouts_assigned: Optional[int] = None
    last_active: Optional[str] = None
    target_weight_kg: Optional[float] = None
    current_weight_kg: Optional[float] = None
    starting_weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    target_body_fat: Optional[float] = None
    injuries_and_health: Optional[List[str]] = None
    medical_alerts: Optional[str] = None
    custom_coach_notes: Optional[List[str]] = None
    onboarding_survey: Optional[Dict[str, Any]] = None


class ClientResponse(ClientBase):
    id: str


class AddCoachNoteRequest(CamelModel):
    note: str
