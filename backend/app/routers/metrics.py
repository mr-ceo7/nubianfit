"""
Biometrics & Metrics Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db, get_current_user, get_accessible_client, resolve_client_filter
from app.models.metric import MetricEntry
from app.models.user import User
from app.schemas.metric import MetricEntryCreate, MetricEntryResponse
from app.services.activity import new_id, log_activity

router = APIRouter(prefix="/metrics", tags=["Metrics"])


@router.get("", response_model=List[MetricEntryResponse])
async def list_metrics(
    client_id: Optional[str] = Query(None, alias="clientId"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client_ids = await resolve_client_filter(client_id, user, db)
    result = await db.execute(
        select(MetricEntry).where(MetricEntry.client_id.in_(client_ids)).order_by(MetricEntry.date.desc())
    )
    return result.scalars().all()


@router.post("", response_model=MetricEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_metric_entry(
    metric_in: MetricEntryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a check-in and update the client's current weight / body fat."""
    client = await get_accessible_client(metric_in.client_id, user, db)
    entry = MetricEntry(**metric_in.model_dump(exclude_unset=True, exclude={"id"}), id=new_id("m"))
    db.add(entry)

    client.current_weight_kg = metric_in.weight_kg
    if metric_in.body_fat_percentage:
        client.body_fat_percentage = metric_in.body_fat_percentage
    log_activity(db, client, "check_in_submitted", "Biometrics Check-In",
                 f"Logged weight: {metric_in.weight_kg} kg", {"weightKg": metric_in.weight_kg})

    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{metric_id}")
async def delete_metric_entry(metric_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    entry = await db.get(MetricEntry, metric_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Metric entry not found")
    await get_accessible_client(entry.client_id, user, db)
    await db.delete(entry)
    await db.commit()
    return {"message": "Metric entry deleted", "id": metric_id}
