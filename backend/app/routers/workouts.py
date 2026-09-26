"""
Scheduled Workouts & Logging Router

Coaches schedule and edit workouts for their clients. Clients may log their own
workouts (sets, feedback, completion) but not reschedule or delete them.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import (
    get_db, get_current_user, require_coach, get_accessible_client, resolve_client_filter,
)
from app.models.user import User
from app.models.workout import ScheduledWorkout
from app.schemas.workout import (
    ScheduledWorkoutCreate, ScheduledWorkoutUpdate, ScheduledWorkoutResponse, CompleteWorkoutRequest,
)
from app.services.activity import new_id, log_activity

router = APIRouter(prefix="/workouts", tags=["Workouts"])

# Fields a client may change when logging their own workout.
CLIENT_EDITABLE_FIELDS = {"status", "duration_min", "rating", "client_feedback", "total_volume_kg", "pr_count", "exercises"}


async def _get_workout(workout_id: str, user: User, db: AsyncSession) -> ScheduledWorkout:
    w = await db.get(ScheduledWorkout, workout_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")
    await get_accessible_client(w.client_id, user, db)
    return w


@router.get("", response_model=List[ScheduledWorkoutResponse])
async def list_workouts(
    client_id: Optional[str] = Query(None, alias="clientId"),
    date: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client_ids = await resolve_client_filter(client_id, user, db)
    query = select(ScheduledWorkout).where(ScheduledWorkout.client_id.in_(client_ids))
    if date:
        query = query.where(ScheduledWorkout.date == date)
    if status_filter:
        query = query.where(ScheduledWorkout.status == status_filter)
    result = await db.execute(query.order_by(ScheduledWorkout.date.desc()))
    return result.scalars().all()


@router.get("/{workout_id}", response_model=ScheduledWorkoutResponse)
async def get_workout(workout_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _get_workout(workout_id, user, db)


@router.post("", response_model=ScheduledWorkoutResponse, status_code=status.HTTP_201_CREATED)
async def schedule_workout(
    workout_in: ScheduledWorkoutCreate,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
):
    client = await get_accessible_client(workout_in.client_id, coach, db)
    data = workout_in.model_dump(exclude_unset=True, exclude={"id"})
    w = ScheduledWorkout(**{**data, "client_name": client.name, "client_avatar": client.avatar}, id=new_id("sched"))
    db.add(w)
    client.total_workouts_assigned = (client.total_workouts_assigned or 0) + 1
    await db.commit()
    await db.refresh(w)
    return w


@router.patch("/{workout_id}", response_model=ScheduledWorkoutResponse)
@router.put("/{workout_id}", response_model=ScheduledWorkoutResponse)
async def update_workout(
    workout_id: str,
    workout_in: ScheduledWorkoutUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    w = await _get_workout(workout_id, user, db)
    update_data = workout_in.model_dump(exclude_unset=True)

    if user.role == "client":
        forbidden = set(update_data) - CLIENT_EDITABLE_FIELDS
        if forbidden:
            raise HTTPException(status_code=403, detail=f"Clients can't change: {', '.join(sorted(forbidden))}")
    elif "client_id" in update_data and update_data["client_id"] != w.client_id:
        await get_accessible_client(update_data["client_id"], user, db)

    for field, val in update_data.items():
        setattr(w, field, val)
    await db.commit()
    await db.refresh(w)
    return w


@router.post("/{workout_id}/complete", response_model=ScheduledWorkoutResponse)
async def complete_workout(
    workout_id: str,
    req: CompleteWorkoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a workout completed, update the client's stats and post to the coach's feed."""
    w = await _get_workout(workout_id, user, db)
    client = await get_accessible_client(w.client_id, user, db)
    already_completed = w.status == "Completed"

    w.status = "Completed"
    w.duration_min = req.duration_min or w.duration_min or 55
    w.rating = req.rating or 5
    if req.client_feedback:
        w.client_feedback = req.client_feedback
    if req.coach_feedback and user.role == "coach":
        w.coach_feedback = req.coach_feedback
    if req.exercises:
        w.exercises = req.exercises
    if req.total_volume_kg is not None:
        w.total_volume_kg = req.total_volume_kg
    if req.pr_count is not None:
        w.pr_count = req.pr_count

    if not already_completed:
        client.workouts_completed = (client.workouts_completed or 0) + 1
        client.last_active = "Just now"
        if client.total_workouts_assigned:
            client.compliance_rate = round(min(100.0, client.workouts_completed / client.total_workouts_assigned * 100), 1)
        log_activity(db, client, "workout_completed", f"Logged: {w.workout_title}",
                     f"Completed {w.duration_min} min session with {w.rating}/5 rating",
                     {"workout_id": w.id, "rating": w.rating})

    await db.commit()
    await db.refresh(w)
    return w


@router.delete("/{workout_id}")
async def delete_workout(workout_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    w = await _get_workout(workout_id, coach, db)
    client = await get_accessible_client(w.client_id, coach, db)
    if w.status != "Completed" and client.total_workouts_assigned:
        client.total_workouts_assigned -= 1
    await db.delete(w)
    await db.commit()
    return {"message": "Workout deleted successfully", "id": workout_id}
