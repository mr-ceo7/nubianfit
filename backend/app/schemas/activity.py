"""
Activity Feed Pydantic Schemas
"""

from typing import Dict, Any, Optional
from pydantic import Field
from app.schemas.common import CamelModel, UtcDatetime


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
    created_at: UtcDatetime
    # The frontend type calls this field `metadata`.
    metadata_json: Optional[Dict[str, Any]] = Field(default=None, serialization_alias="metadata")
