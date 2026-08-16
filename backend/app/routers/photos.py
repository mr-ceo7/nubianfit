"""
Progress Photos Router
"""

import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db
from app.models.photo import ProgressPhoto
from app.schemas.photo import ProgressPhotoCreate, ProgressPhotoResponse

router = APIRouter(prefix="/photos", tags=["Photos"])


@router.get("", response_model=List[ProgressPhotoResponse])
async def list_photos(
    client_id: Optional[str] = Query(None, alias="clientId"),
    db: AsyncSession = Depends(get_db)
):
    """List progress photos, optionally filtered by client."""
    query = select(ProgressPhoto)
    if client_id:
        query = query.where(ProgressPhoto.client_id == client_id)
    
    result = await db.execute(query.order_by(ProgressPhoto.date.desc()))
    return result.scalars().all()


@router.post("", response_model=ProgressPhotoResponse, status_code=status.HTTP_201_CREATED)
async def create_photo(
    photo_in: ProgressPhotoCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add a progress photo entry."""
    p_id = photo_in.id or f"photo-{int(time.time() * 1000)}"
    p_dict = photo_in.model_dump(exclude_unset=True)
    p_dict["id"] = p_id
    
    new_photo = ProgressPhoto(**p_dict)
    db.add(new_photo)
    await db.commit()
    await db.refresh(new_photo)
    return new_photo


@router.delete("/{photo_id}")
async def delete_photo(photo_id: str, db: AsyncSession = Depends(get_db)):
    """Delete progress photo."""
    result = await db.execute(select(ProgressPhoto).where(ProgressPhoto.id == photo_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    await db.delete(p)
    await db.commit()
    return {"message": "Photo deleted", "id": photo_id}
