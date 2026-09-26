"""
Activity Feed Router
"""

from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db, get_current_user
from app.models.activity import ActivityFeedItem
from app.models.user import User
from app.schemas.activity import ActivityFeedItemResponse

router = APIRouter(prefix="/activity", tags=["Activity Feed"])


@router.get("", response_model=List[ActivityFeedItemResponse])
async def list_activity(
    limit: int = Query(25, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """A coach's feed across their clients, or a client's own activity."""
    if user.role == "client":
        scope = ActivityFeedItem.client_id == user.client_id
    else:
        scope = ActivityFeedItem.coach_id == user.id
    result = await db.execute(select(ActivityFeedItem).where(scope).order_by(ActivityFeedItem.created_at.desc()).limit(limit))
    return result.scalars().all()
