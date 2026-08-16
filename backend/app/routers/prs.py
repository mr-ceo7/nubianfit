"""
Personal Records (PRs) Router
"""

import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db
from app.models.personal_record import PersonalRecord
from app.models.client import Client
from app.models.activity import ActivityFeedItem
from app.schemas.personal_record import PersonalRecordCreate, PersonalRecordResponse

router = APIRouter(prefix="/prs", tags=["Personal Records"])


@router.get("", response_model=List[PersonalRecordResponse])
async def list_prs(
    client_id: Optional[str] = Query(None, alias="clientId"),
    db: AsyncSession = Depends(get_db)
):
    """List personal records, optionally filtered by client."""
    query = select(PersonalRecord)
    if client_id:
        query = query.where(PersonalRecord.client_id == client_id)
    
    result = await db.execute(query.order_by(PersonalRecord.date.desc()))
    return result.scalars().all()


@router.post("", response_model=PersonalRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_pr(
    pr_in: PersonalRecordCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add a new personal record and create activity."""
    pr_id = pr_in.id or f"pr-{int(time.time() * 1000)}"
    pr_dict = pr_in.model_dump(exclude_unset=True)
    pr_dict["id"] = pr_id
    
    new_pr = PersonalRecord(**pr_dict)
    db.add(new_pr)
    
    # Activity log
    client_res = await db.execute(select(Client).where(Client.id == pr_in.client_id))
    client = client_res.scalar_one_or_none()
    if client:
        activity = ActivityFeedItem(
            id=f"act-{int(time.time() * 1000)}",
            type="pr_achieved",
            client_id=client.id,
            client_name=client.name,
            client_avatar=client.avatar,
            title="New Personal Record! 🔥",
            description=f"{pr_in.exercise_name}: {pr_in.weight_kg}kg x {pr_in.reps} reps (1RM: {pr_in.estimated_1rm_kg}kg)",
            timestamp="Just now",
            metadata_json={"exerciseName": pr_in.exercise_name, "weightKg": pr_in.weight_kg}
        )
        db.add(activity)
        
    await db.commit()
    await db.refresh(new_pr)
    return new_pr
