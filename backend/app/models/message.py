"""
Chat Message ORM Model
"""

from typing import Dict, Any, Optional
from sqlalchemy import String, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ChatMessage(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    sender: Mapped[str] = mapped_column(String(32), nullable=False)  # 'coach' or 'client'
    text: Mapped[str] = mapped_column(Text, default="")
    timestamp: Mapped[str] = mapped_column(String(64), default="")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    attachment: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
