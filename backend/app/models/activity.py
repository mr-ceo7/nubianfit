"""
Activity Feed Item ORM Model
"""

from typing import Dict, Any, Optional
from sqlalchemy import String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ActivityFeedItem(Base):
    __tablename__ = "activity_feed"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), index=True, default="")
    client_name: Mapped[str] = mapped_column(String(255), default="")
    client_avatar: Mapped[str] = mapped_column(String(512), default="")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    timestamp: Mapped[str] = mapped_column(String(64), default="")
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
