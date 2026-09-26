"""
Progress Photos Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db, get_current_user, get_accessible_client, resolve_client_filter
from app.models.photo import ProgressPhoto
from app.models.user import User
from app.schemas.photo import ProgressPhotoCreate, ProgressPhotoResponse
from app.services.activity import new_id

router = APIRouter(prefix="/photos", tags=["Photos"])


@router.get("", response_model=List[ProgressPhotoResponse])
async def list_photos(
    client_id: Optional[str] = Query(None, alias="clientId"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client_ids = await resolve_client_filter(client_id, user, db)
    result = await db.execute(
        select(ProgressPhoto).where(ProgressPhoto.client_id.in_(client_ids)).order_by(ProgressPhoto.date.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ProgressPhotoResponse, status_code=status.HTTP_201_CREATED)
async def create_photo(
    photo_in: ProgressPhotoCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_accessible_client(photo_in.client_id, user, db)
    photo = ProgressPhoto(**photo_in.model_dump(exclude_unset=True, exclude={"id"}), id=new_id("photo"))
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return photo


@router.delete("/{photo_id}")
async def delete_photo(photo_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    photo = await db.get(ProgressPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    await get_accessible_client(photo.client_id, user, db)
    await db.delete(photo)
    await db.commit()
    return {"message": "Photo deleted", "id": photo_id}
