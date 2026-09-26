"""
Exercise Library Router

The library is the shared global catalogue (coach_id NULL) plus each coach's custom exercises.
Clients see their own coach's library.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.dependencies import get_db, get_current_user, require_coach
from app.models.client import Client
from app.models.exercise import Exercise
from app.models.user import User
from app.schemas.exercise import ExerciseCreate, ExerciseUpdate, ExerciseResponse
from app.services.activity import new_id

router = APIRouter(prefix="/exercises", tags=["Exercises"])


async def _library_owner_id(user: User, db: AsyncSession) -> Optional[str]:
    if user.role == "coach":
        return user.id
    client = await db.get(Client, user.client_id) if user.client_id else None
    return client.coach_id if client else None


def _visible_to(owner_id: Optional[str]):
    return or_(Exercise.coach_id.is_(None), Exercise.coach_id == owner_id)


async def _get_own_exercise(exercise_id: str, coach: User, db: AsyncSession) -> Exercise:
    ex = await db.get(Exercise, exercise_id)
    if not ex or ex.coach_id not in (None, coach.id):
        raise HTTPException(status_code=404, detail="Exercise not found")
    if ex.coach_id is None:
        raise HTTPException(status_code=403, detail="Library exercises can't be changed; create a custom copy instead")
    return ex


@router.get("", response_model=List[ExerciseResponse])
async def list_exercises(
    muscle: Optional[str] = None,
    equipment: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Exercise).where(_visible_to(await _library_owner_id(user, db)))
    if muscle:
        query = query.where(Exercise.primary_muscle == muscle)
    if equipment:
        query = query.where(Exercise.equipment == equipment)
    if difficulty:
        query = query.where(Exercise.difficulty == difficulty)
    if search:
        query = query.where(Exercise.name.ilike(f"%{search.lower()}%"))
    result = await db.execute(query.order_by(Exercise.name))
    return result.scalars().all()


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(exercise_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ex = await db.get(Exercise, exercise_id)
    if not ex or ex.coach_id not in (None, await _library_owner_id(user, db)):
        raise HTTPException(status_code=404, detail="Exercise not found")
    return ex


@router.post("", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(exercise_in: ExerciseCreate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    ex = Exercise(id=new_id("ex"), coach_id=coach.id, **{**exercise_in.model_dump(), "is_custom": True})
    db.add(ex)
    await db.commit()
    await db.refresh(ex)
    return ex


@router.patch("/{exercise_id}", response_model=ExerciseResponse)
@router.put("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: str,
    exercise_in: ExerciseUpdate,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
):
    ex = await _get_own_exercise(exercise_id, coach, db)
    for field, val in exercise_in.model_dump(exclude_unset=True).items():
        setattr(ex, field, val)
    await db.commit()
    await db.refresh(ex)
    return ex


@router.delete("/{exercise_id}")
async def delete_exercise(exercise_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    ex = await _get_own_exercise(exercise_id, coach, db)
    await db.delete(ex)
    await db.commit()
    return {"message": "Exercise deleted successfully", "id": exercise_id}
