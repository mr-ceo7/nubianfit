"""
Workout Library Router (coach-only)
"""

from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_coach
from app.models.user import User
from app.models.workout_template import WorkoutTemplate
from app.schemas.training import validate_workout_content
from app.schemas.workout_template import WorkoutTemplateCreate, WorkoutTemplateResponse, WorkoutTemplateUpdate
from app.services.activity import new_id

router = APIRouter(prefix="/workout-templates", tags=["Workout Library"])


async def _get_own(template_id: str, coach: User, db: AsyncSession) -> WorkoutTemplate:
    template = await db.get(WorkoutTemplate, template_id)
    if not template or template.coach_id != coach.id:
        raise HTTPException(status_code=404, detail="Workout not found")
    return template


@router.get("", response_model=List[WorkoutTemplateResponse])
async def list_templates(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WorkoutTemplate).where(WorkoutTemplate.coach_id == coach.id).order_by(WorkoutTemplate.title)
    )
    return result.scalars().all()


@router.post("", response_model=WorkoutTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(body: WorkoutTemplateCreate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    template = WorkoutTemplate(id=new_id("wt"), coach_id=coach.id, **body.model_dump())
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.patch("/{template_id}", response_model=WorkoutTemplateResponse)
async def update_template(
    template_id: str,
    body: WorkoutTemplateUpdate,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
):
    template = await _get_own(template_id, coach, db)
    changes = body.model_dump(exclude_unset=True)
    try:
        validate_workout_content(changes.get("exercises", template.exercises), changes.get("groups", template.groups))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    for field, value in changes.items():
        setattr(template, field, value)
    template.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/{template_id}")
async def delete_template(template_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    template = await _get_own(template_id, coach, db)
    await db.delete(template)
    await db.commit()
    return {"message": "Workout deleted", "id": template_id}
