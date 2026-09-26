"""
Pydantic Schemas Package
"""

from app.schemas.auth import LoginRequest, CoachRegisterRequest, UserResponse, TokenResponse
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse, AddCoachNoteRequest
from app.schemas.exercise import ExerciseCreate, ExerciseUpdate, ExerciseResponse
from app.schemas.program import ProgramCreate, ProgramUpdate, ProgramResponse, AssignProgramRequest
from app.schemas.workout import ScheduledWorkoutCreate, ScheduledWorkoutUpdate, ScheduledWorkoutResponse, CompleteWorkoutRequest
from app.schemas.metric import MetricEntryCreate, MetricEntryResponse
from app.schemas.personal_record import PersonalRecordCreate, PersonalRecordResponse
from app.schemas.habit import HabitCreate, HabitResponse, HabitCheckinUpsert, HabitCheckinResponse
from app.schemas.photo import ProgressPhotoCreate, ProgressPhotoResponse
from app.schemas.message import ChatMessageCreate, ChatMessageResponse
from app.schemas.activity import ActivityFeedItemCreate, ActivityFeedItemResponse

__all__ = [
    "LoginRequest",
    "CoachRegisterRequest",
    "UserResponse",
    "TokenResponse",
    "ClientCreate",
    "ClientUpdate",
    "ClientResponse",
    "AddCoachNoteRequest",
    "ExerciseCreate",
    "ExerciseUpdate",
    "ExerciseResponse",
    "ProgramCreate",
    "ProgramUpdate",
    "ProgramResponse",
    "AssignProgramRequest",
    "ScheduledWorkoutCreate",
    "ScheduledWorkoutUpdate",
    "ScheduledWorkoutResponse",
    "CompleteWorkoutRequest",
    "MetricEntryCreate",
    "MetricEntryResponse",
    "PersonalRecordCreate",
    "PersonalRecordResponse",
    "HabitCreate",
    "HabitResponse",
    "HabitCheckinUpsert",
    "HabitCheckinResponse",
    "ProgressPhotoCreate",
    "ProgressPhotoResponse",
    "ChatMessageCreate",
    "ChatMessageResponse",
    "ActivityFeedItemCreate",
    "ActivityFeedItemResponse",
]
