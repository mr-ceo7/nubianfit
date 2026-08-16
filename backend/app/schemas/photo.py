"""
Progress Photo Pydantic Schemas
"""

from typing import Optional
from app.schemas.common import CamelModel


class ProgressPhotoBase(CamelModel):
    client_id: str
    date: str
    view: str = "Front"
    photo_url: str
    weight_kg: float = 70.0
    body_fat_percentage: Optional[float] = None
    notes: Optional[str] = None


class ProgressPhotoCreate(ProgressPhotoBase):
    id: Optional[str] = None


class ProgressPhotoResponse(ProgressPhotoBase):
    id: str
