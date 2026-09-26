"""
Habits Router: coaches set each client's habits; clients (or their coach) check in daily.
"""

from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_accessible_client, get_current_user, get_db, require_coach, resolve_client_filter
from app.models.habit import Habit, HabitCheckin
from app.models.user import User
from app.routers.nutrition import _date_range
from app.schemas.habit import HabitCheckinResponse, HabitCheckinUpsert, HabitCreate, HabitResponse, HabitUpdate
from app.services.activity import new_id

router = APIRouter(prefix="/habits", tags=["Habits"])


async def _get_habit(habit_id: str, user: User, db: AsyncSession) -> Habit:
    habit = await db.get(Habit, habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    await get_accessible_client(habit.client_id, user, db)
    return habit


@router.get("", response_model=List[HabitResponse])
async def list_habits(
    client_id: Optional[str] = Query(None, alias="clientId"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = await resolve_client_filter(client_id, user, db)
    result = await db.execute(select(Habit).where(Habit.client_id.in_(ids)).order_by(Habit.sort_order, Habit.created_at))
    return result.scalars().all()


@router.post("", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
async def create_habit(body: HabitCreate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    await get_accessible_client(body.client_id, coach, db)
    habit = Habit(id=new_id("habit"), active=True, **body.model_dump())
    db.add(habit)
    await db.commit()
    await db.refresh(habit)
    return habit


@router.patch("/{habit_id}", response_model=HabitResponse)
async def update_habit(habit_id: str, body: HabitUpdate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    habit = await _get_habit(habit_id, coach, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(habit, field, value)
    await db.commit()
    await db.refresh(habit)
    return habit


@router.delete("/{habit_id}")
async def delete_habit(habit_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    habit = await _get_habit(habit_id, coach, db)
    await db.execute(delete(HabitCheckin).where(HabitCheckin.habit_id == habit.id))
    await db.delete(habit)
    await db.commit()
    return {"message": "Habit deleted", "id": habit_id}


@router.get("/checkins", response_model=List[HabitCheckinResponse])
async def list_checkins(
    client_id: Optional[str] = Query(None, alias="clientId"),
    date_from: Optional[date] = Query(None, alias="from"),
    date_to: Optional[date] = Query(None, alias="to"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = await resolve_client_filter(client_id, user, db)
    frm, to = _date_range(date_from, date_to)
    result = await db.execute(
        select(HabitCheckin).where(HabitCheckin.client_id.in_(ids), HabitCheckin.date >= frm, HabitCheckin.date <= to)
    )
    return result.scalars().all()


@router.put("/checkins", response_model=HabitCheckinResponse)
async def upsert_checkin(body: HabitCheckinUpsert, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    habit = await _get_habit(body.habit_id, user, db)
    checkin = (await db.execute(
        select(HabitCheckin).where(HabitCheckin.habit_id == habit.id, HabitCheckin.date == body.date)
    )).scalar_one_or_none()
    if not checkin:
        checkin = HabitCheckin(id=new_id("checkin"), habit_id=habit.id, client_id=habit.client_id, date=body.date)
        db.add(checkin)
    checkin.completed = body.completed
    checkin.value = body.value
    await db.commit()
    await db.refresh(checkin)
    return checkin
