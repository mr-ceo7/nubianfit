"""
NubianFit ORM Models
"""

from app.models.user import User
from app.models.client import Client
from app.models.exercise import Exercise
from app.models.program import TrainingProgram
from app.models.workout import ScheduledWorkout
from app.models.metric import MetricEntry
from app.models.personal_record import PersonalRecord
from app.models.habit import Habit, HabitCheckin
from app.models.nutrition import (
    ClientGoals, CustomFood, DailyMetric, FoodLogEntry, MealPlan, MealPlanAssignment,
)
from app.models.photo import ProgressPhoto
from app.models.message import ChatMessage
from app.models.activity import ActivityFeedItem
from app.models.otp import EmailOTP
from app.models.workout_template import WorkoutTemplate

__all__ = [
    "User",
    "Client",
    "Exercise",
    "TrainingProgram",
    "ScheduledWorkout",
    "MetricEntry",
    "PersonalRecord",
    "Habit",
    "HabitCheckin",
    "CustomFood",
    "FoodLogEntry",
    "ClientGoals",
    "DailyMetric",
    "MealPlan",
    "MealPlanAssignment",
    "ProgressPhoto",
    "ChatMessage",
    "ActivityFeedItem",
    "EmailOTP",
    "WorkoutTemplate",
]
