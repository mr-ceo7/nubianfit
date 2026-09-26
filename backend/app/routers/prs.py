"""
Personal Records (PRs) Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db, get_current_user, get_accessible_client, resolve_client_filter
from app.models.personal_record import PersonalRecord
from app.models.user import User
from app.schemas.personal_record import PersonalRecordCreate, PersonalRecordResponse
from app.services.activity import new_id, log_activity

router = APIRouter(prefix="/prs", tags=["Personal Records"])


@router.get("", response_model=List[PersonalRecordResponse])
async def list_prs(
    client_id: Optional[str] = Query(None, alias="clientId"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client_ids = await resolve_client_filter(client_id, user, db)
    result = await db.execute(
        select(PersonalRecord).where(PersonalRecord.client_id.in_(client_ids)).order_by(PersonalRecord.date.desc())
    )
    return result.scalars().all()


@router.post("", response_model=PersonalRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_pr(
    pr_in: PersonalRecordCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await get_accessible_client(pr_in.client_id, user, db)
    pr = PersonalRecord(**pr_in.model_dump(exclude_unset=True, exclude={"id"}), id=new_id("pr"))
    db.add(pr)
    log_activity(db, client, "pr_achieved", "New Personal Record! 🔥",
                 f"{pr_in.exercise_name}: {pr_in.weight_kg}kg x {pr_in.reps} reps (1RM: {pr_in.estimated_1rm_kg}kg)",
                 {"exerciseName": pr_in.exercise_name, "weightKg": pr_in.weight_kg})
    await db.commit()
    await db.refresh(pr)
    return pr
