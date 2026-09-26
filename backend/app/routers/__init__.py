"""
API Routers Package
"""

from app.routers.auth import router as auth_router
from app.routers.clients import router as clients_router
from app.routers.exercises import router as exercises_router
from app.routers.programs import router as programs_router
from app.routers.workouts import router as workouts_router
from app.routers.metrics import router as metrics_router
from app.routers.prs import router as prs_router
from app.routers.habits import router as habits_router
from app.routers.photos import router as photos_router
from app.routers.messages import router as messages_router
from app.routers.activity import router as activity_router
from app.routers.workout_templates import router as workout_templates_router

__all__ = [
    "auth_router",
    "clients_router",
    "exercises_router",
    "programs_router",
    "workouts_router",
    "metrics_router",
    "prs_router",
    "habits_router",
    "photos_router",
    "messages_router",
    "activity_router",
    "workout_templates_router",
]
