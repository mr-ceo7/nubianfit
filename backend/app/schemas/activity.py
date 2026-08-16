"""
Activity Feed Pydantic Schemas
"""

from typing import Dict, Any, Optional
from app.schemas.common import CamelModel


class ActivityFeedItemBase(CamelModel):
    type: str
    client_id: str = ""
    client_name: str = ""
    client_avatar: str = ""
    title: str
    description: str = ""
    timestamp: str = ""
    metadata_json: Optional[Dict[str, Any]] = None


class ActivityFeedItemCreate(ActivityFeedItemBase):
    id: Optional[str] = None


class ActivityFeedItemResponse(ActivityFeedItemBase):
    id: str
