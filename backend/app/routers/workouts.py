"""
Scheduled Workouts & Logging Router
"""

import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db
from app.models.workout import ScheduledWorkout
from app.models.client import Client
from app.models.activity import ActivityFeedItem
from app.schemas.workout import (
    ScheduledWorkoutCreate,
    ScheduledWorkoutUpdate,
    ScheduledWorkoutResponse,
    CompleteWorkoutRequest
)

router = APIRouter(prefix="/workouts", tags=["Workouts"])


@router.get("", response_model=List[ScheduledWorkoutResponse])
async def list_workouts(
    client_id: Optional[str] = Query(None, alias="clientId"),
    date: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db)
):
    """List scheduled workouts with optional filtering."""
    query = select(ScheduledWorkout)
    if client_id:
        query = query.where(ScheduledWorkout.client_id == client_id)
    if date:
        query = query.where(ScheduledWorkout.date == date)
    if status_filter:
        query = query.where(ScheduledWorkout.status == status_filter)
    
    result = await db.execute(query.order_by(ScheduledWorkout.date.desc()))
    return result.scalars().all()


@router.get("/{workout_id}", response_model=ScheduledWorkoutResponse)
async def get_workout(workout_id: str, db: AsyncSession = Depends(get_db)):
    """Get single workout details."""
    result = await db.execute(select(ScheduledWorkout).where(ScheduledWorkout.id == workout_id))
    w = result.scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")
    return w


@router.post("", response_model=ScheduledWorkoutResponse, status_code=status.HTTP_201_CREATED)
async def create_or_schedule_workout(
    workout_in: ScheduledWorkoutCreate,
    db: AsyncSession = Depends(get_db)
):
    """Schedule a workout."""
    w_id = workout_in.id or f"sched-{int(time.time() * 1000)}"
    w_dict = workout_in.model_dump(exclude_unset=True)
    w_dict["id"] = w_id
    
    new_w = ScheduledWorkout(**w_dict)
    db.add(new_w)
    await db.commit()
    await db.refresh(new_w)
    return new_w


@router.patch("/{workout_id}", response_model=ScheduledWorkoutResponse)
@router.put("/{workout_id}", response_model=ScheduledWorkoutResponse)
async def update_workout_log(
    workout_id: str,
    workout_in: ScheduledWorkoutUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update workout details or live log data."""
    result = await db.execute(select(ScheduledWorkout).where(ScheduledWorkout.id == workout_id))
    w = result.scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    update_data = workout_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(w, field, val)
        
    await db.commit()
    await db.refresh(w)
    return w


@router.post("/{workout_id}/complete", response_model=ScheduledWorkoutResponse)
async def complete_workout(
    workout_id: str,
    req: CompleteWorkoutRequest,
    db: AsyncSession = Depends(get_db)
):
    """Complete a workout, update client statistics, and broadcast to activity feed."""
    result = await db.execute(select(ScheduledWorkout).where(ScheduledWorkout.id == workout_id))
    w = result.scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    w.status = "Completed"
    w.duration_min = req.duration_min or w.duration_min or 55
    w.rating = req.rating or 5
    if req.client_feedback:
        w.client_feedback = req.client_feedback
    if req.coach_feedback:
        w.coach_feedback = req.coach_feedback
    if req.exercises:
        w.exercises = req.exercises
        
    # Update client stats
    client_res = await db.execute(select(Client).where(Client.id == w.client_id))
    client = client_res.scalar_one_or_none()
    if client:
        client.workouts_completed = (client.workouts_completed or 0) + 1
        client.last_active = "Just now"
        if client.total_workouts_assigned and client.total_workouts_assigned > 0:
            client.compliance_rate = round(min(100.0, (client.workouts_completed / client.total_workouts_assigned) * 100), 1)
            
    # Activity feed
    activity = ActivityFeedItem(
        id=f"act-{int(time.time() * 1000)}",
        type="workout_completed",
        client_id=w.client_id,
        client_name=w.client_name or (client.name if client else "Client"),
        client_avatar=w.client_avatar or (client.avatar if client else ""),
        title=f"Logged: {w.workout_title}",
        description=f"Completed {w.duration_min} min session with {w.rating}/5 rating",
        timestamp="Just now",
        metadata_json={"workout_id": w.id, "rating": w.rating}
    )
    db.add(activity)
    
    await db.commit()
    await db.refresh(w)
    return w


@router.delete("/{workout_id}")
async def delete_workout(workout_id: str, db: AsyncSession = Depends(get_db)):
    """Delete scheduled workout."""
    result = await db.execute(select(ScheduledWorkout).where(ScheduledWorkout.id == workout_id))
    w = result.scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    await db.delete(w)
    await db.commit()
    return {"message": "Workout deleted successfully", "id": workout_id}
