"""
Chat Message Pydantic Schemas
"""

from typing import Dict, Any, Optional
from app.schemas.common import CamelModel, UtcDatetime


class ChatAttachmentSchema(CamelModel):
    type: str
    title: str
    url: Optional[str] = None
    workout_id: Optional[str] = None
    duration_seconds: Optional[int] = None
    feedback_given: Optional[bool] = None


class ChatMessageBase(CamelModel):
    client_id: str
    sender: str
    text: str = ""
    timestamp: str = ""
    is_read: bool = False
    attachment: Optional[Dict[str, Any]] = None
    scheduled_for: Optional[UtcDatetime] = None
    is_delivered: bool = True


class ChatMessageCreate(CamelModel):
    client_id: str
    sender: str = "coach"
    text: str = ""
    attachment: Optional[Dict[str, Any]] = None
    scheduled_for: Optional[UtcDatetime] = None


class ChatMessageResponse(ChatMessageBase):
    id: str
    created_at: UtcDatetime


class CannedResponseCreate(CamelModel):
    title: str
    shortcut: str
    text: str


class CannedResponseResponse(CamelModel):
    id: str
    coach_id: str
    title: str
    shortcut: str
    text: str
    created_at: UtcDatetime

