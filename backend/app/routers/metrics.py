"""
Biometrics & Metrics Router
"""

import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db
from app.models.metric import MetricEntry
from app.models.client import Client
from app.models.activity import ActivityFeedItem
from app.schemas.metric import MetricEntryCreate, MetricEntryResponse

router = APIRouter(prefix="/metrics", tags=["Metrics"])


@router.get("", response_model=List[MetricEntryResponse])
async def list_metrics(
    client_id: Optional[str] = Query(None, alias="clientId"),
    db: AsyncSession = Depends(get_db)
):
    """List biometric metric entries, optionally filtered by client."""
    query = select(MetricEntry)
    if client_id:
        query = query.where(MetricEntry.client_id == client_id)
    
    result = await db.execute(query.order_by(MetricEntry.date.desc()))
    return result.scalars().all()


@router.post("", response_model=MetricEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_metric_entry(
    metric_in: MetricEntryCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add a new biometric entry and update client current weight."""
    m_id = metric_in.id or f"m-{int(time.time() * 1000)}"
    m_dict = metric_in.model_dump(exclude_unset=True)
    m_dict["id"] = m_id
    
    new_metric = MetricEntry(**m_dict)
    db.add(new_metric)
    
    # Update client profile
    client_res = await db.execute(select(Client).where(Client.id == metric_in.client_id))
    client = client_res.scalar_one_or_none()
    if client:
        client.current_weight_kg = metric_in.weight_kg
        if metric_in.body_fat_percentage:
            client.body_fat_percentage = metric_in.body_fat_percentage
            
        # Activity log
        activity = ActivityFeedItem(
            id=f"act-{int(time.time() * 1000)}",
            type="check_in_submitted",
            client_id=client.id,
            client_name=client.name,
            client_avatar=client.avatar,
            title="Biometrics Check-In",
            description=f"Logged weight: {metric_in.weight_kg} kg",
            timestamp="Just now",
            metadata_json={"weightKg": metric_in.weight_kg}
        )
        db.add(activity)
        
    await db.commit()
    await db.refresh(new_metric)
    return new_metric


@router.delete("/{metric_id}")
async def delete_metric_entry(metric_id: str, db: AsyncSession = Depends(get_db)):
    """Delete metric entry."""
    result = await db.execute(select(MetricEntry).where(MetricEntry.id == metric_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Metric entry not found")
    
    await db.delete(m)
    await db.commit()
    return {"message": "Metric entry deleted", "id": metric_id}
