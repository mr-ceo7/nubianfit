"""
Helpers shared by routers: ID generation and coach activity-feed entries.
"""

import uuid
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityFeedItem
from app.models.client import Client


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:16]}"


def log_activity(
    db: AsyncSession,
    client: Client,
    type_: str,
    title: str,
    description: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Add an entry to the owning coach's activity feed (caller commits)."""
    db.add(ActivityFeedItem(
        id=new_id("act"),
        coach_id=client.coach_id,
        type=type_,
        client_id=client.id,
        client_name=client.name,
        client_avatar=client.avatar,
        title=title,
        description=description,
        timestamp="Just now",
        metadata_json=metadata,
    ))
