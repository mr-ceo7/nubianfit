"""
Metric Entry Pydantic Schemas
"""

from typing import Optional
from app.schemas.common import CamelModel


class MetricEntryBase(CamelModel):
    client_id: str
    date: str
    weight_kg: float
    body_fat_percentage: Optional[float] = None
    chest_cm: Optional[float] = None
    waist_cm: Optional[float] = None
    arms_cm: Optional[float] = None
    thighs_cm: Optional[float] = None
    notes: Optional[str] = None


class MetricEntryCreate(MetricEntryBase):
    id: Optional[str] = None


class MetricEntryResponse(MetricEntryBase):
    id: str
