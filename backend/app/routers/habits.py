"""
Habit Logs Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db, get_current_user, get_accessible_client, resolve_client_filter
from app.models.habit import ClientDailyHabitLog
from app.models.user import User
from app.schemas.habit import ClientDailyHabitLogCreate, ClientDailyHabitLogResponse, ToggleHabitRequest
from app.services.activity import new_id

router = APIRouter(prefix="/habits", tags=["Habits"])

DEFAULT_HABITS = [
    {"habitId": "h-1", "title": "Hit 180g+ Protein", "targetValue": "180", "unit": "g"},
    {"habitId": "h-2", "title": "Drink 3.5L Water", "targetValue": "3.5", "unit": "L"},
    {"habitId": "h-3", "title": "10,000 Steps", "targetValue": "10000", "unit": "steps"},
    {"habitId": "h-4", "title": "8 Hours Sleep", "targetValue": "8", "unit": "hrs"},
    {"habitId": "h-5", "title": "Post-Workout Mobility", "targetValue": "15", "unit": "min"},
]


async def _get_log(db: AsyncSession, client_id: str, date: str) -> Optional[ClientDailyHabitLog]:
    result = await db.execute(
        select(ClientDailyHabitLog).where(ClientDailyHabitLog.client_id == client_id, ClientDailyHabitLog.date == date)
    )
    return result.scalars().first()


@router.get("", response_model=List[ClientDailyHabitLogResponse])
async def list_habit_logs(
    client_id: Optional[str] = Query(None, alias="clientId"),
    date_val: Optional[str] = Query(None, alias="date"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client_ids = await resolve_client_filter(client_id, user, db)
    query = select(ClientDailyHabitLog).where(ClientDailyHabitLog.client_id.in_(client_ids))
    if date_val:
        query = query.where(ClientDailyHabitLog.date == date_val)
    result = await db.execute(query.order_by(ClientDailyHabitLog.date.desc()))
    return result.scalars().all()


@router.post("", response_model=ClientDailyHabitLogResponse, status_code=status.HTTP_201_CREATED)
async def save_habit_log(
    log_in: ClientDailyHabitLogCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or replace the habit log for a client's day."""
    await get_accessible_client(log_in.client_id, user, db)
    log = await _get_log(db, log_in.client_id, log_in.date)
    if log:
        log.habits = log_in.habits
    else:
        log = ClientDailyHabitLog(id=new_id("habit"), client_id=log_in.client_id, date=log_in.date, habits=log_in.habits)
        db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


@router.post("/toggle", response_model=ClientDailyHabitLogResponse)
async def toggle_habit(req: ToggleHabitRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Toggle one habit for a client's day, creating the day's log from the defaults if needed."""
    await get_accessible_client(req.client_id, user, db)
    log = await _get_log(db, req.client_id, req.date)
    if not log:
        log = ClientDailyHabitLog(
            id=new_id("habit"),
            client_id=req.client_id,
            date=req.date,
            habits=[{**h, "completed": False} for h in DEFAULT_HABITS],
        )
        db.add(log)

    habits = [dict(h) for h in (log.habits or [])]
    for h in habits:
        if h.get("habitId") == req.habit_id:
            h["completed"] = not h.get("completed", False)
            break
    else:
        habits.append({"habitId": req.habit_id, "title": "Daily Habit", "completed": True, "targetValue": "1", "unit": "check"})
    log.habits = habits

    await db.commit()
    await db.refresh(log)
    return log
