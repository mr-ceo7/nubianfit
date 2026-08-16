"""
Habit Logs Router
"""

import time
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db
from app.models.habit import ClientDailyHabitLog
from app.schemas.habit import (
    ClientDailyHabitLogCreate,
    ClientDailyHabitLogResponse,
    ToggleHabitRequest
)

router = APIRouter(prefix="/habits", tags=["Habits"])


@router.get("", response_model=List[ClientDailyHabitLogResponse])
async def list_habit_logs(
    client_id: Optional[str] = Query(None, alias="clientId"),
    date_val: Optional[str] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db)
):
    """List habit logs."""
    query = select(ClientDailyHabitLog)
    if client_id:
        query = query.where(ClientDailyHabitLog.client_id == client_id)
    if date_val:
        query = query.where(ClientDailyHabitLog.date == date_val)
    
    result = await db.execute(query.order_by(ClientDailyHabitLog.date.desc()))
    return result.scalars().all()


@router.post("", response_model=ClientDailyHabitLogResponse, status_code=status.HTTP_201_CREATED)
async def create_habit_log(
    log_in: ClientDailyHabitLogCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create or save a daily habit log."""
    log_id = log_in.id or f"habit-{int(time.time() * 1000)}"
    log_dict = log_in.model_dump(exclude_unset=True)
    log_dict["id"] = log_id
    
    new_log = ClientDailyHabitLog(**log_dict)
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log


@router.post("/toggle", response_model=ClientDailyHabitLogResponse)
async def toggle_habit(
    req: ToggleHabitRequest,
    db: AsyncSession = Depends(get_db)
):
    """Toggle completion status of a specific habit for a client date."""
    result = await db.execute(
        select(ClientDailyHabitLog).where(
            (ClientDailyHabitLog.client_id == req.client_id) & 
            (ClientDailyHabitLog.date == req.date)
        )
    )
    log = result.scalar_one_or_none()
    
    if not log:
        # Create new log entry
        log_id = f"habit-{int(time.time() * 1000)}"
        new_habits = [
            {"habitId": "h-1", "title": "Hit 180g+ Protein", "completed": False, "targetValue": "180", "unit": "g"},
            {"habitId": "h-2", "title": "Drink 3.5L Water", "completed": False, "targetValue": "3.5", "unit": "L"},
            {"habitId": "h-3", "title": "10,000 Steps", "completed": False, "targetValue": "10000", "unit": "steps"},
            {"habitId": "h-4", "title": "8 Hours Sleep", "completed": False, "targetValue": "8", "unit": "hrs"},
            {"habitId": "h-5", "title": "Post-Workout Mobility", "completed": False, "targetValue": "15", "unit": "min"}
        ]
        # Update target habit
        for h in new_habits:
            if h["habitId"] == req.habit_id:
                h["completed"] = True
                
        log = ClientDailyHabitLog(
            id=log_id,
            client_id=req.client_id,
            date=req.date,
            habits=new_habits
        )
        db.add(log)
    else:
        # Update existing habit
        habits = list(log.habits or [])
        found = False
        for h in habits:
            if h.get("habitId") == req.habit_id:
                h["completed"] = not h.get("completed", False)
                found = True
                break
        if not found:
            habits.append({
                "habitId": req.habit_id,
                "title": "Daily Habit",
                "completed": True,
                "targetValue": "1",
                "unit": "check"
            })
        log.habits = habits
        
    await db.commit()
    await db.refresh(log)
    return log
