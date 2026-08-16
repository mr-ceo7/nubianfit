"""
Chat Messages Router
"""

import time
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db
from app.models.message import ChatMessage
from app.schemas.message import ChatMessageCreate, ChatMessageResponse

router = APIRouter(prefix="/messages", tags=["Messages"])


@router.get("", response_model=List[ChatMessageResponse])
async def list_messages(
    client_id: Optional[str] = Query(None, alias="clientId"),
    db: AsyncSession = Depends(get_db)
):
    """List chat messages, optionally filtered by client."""
    query = select(ChatMessage)
    if client_id:
        query = query.where(ChatMessage.client_id == client_id)
    
    result = await db.execute(query.order_by(ChatMessage.id.asc()))
    return result.scalars().all()


@router.post("", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    msg_in: ChatMessageCreate,
    db: AsyncSession = Depends(get_db)
):
    """Send a new message."""
    now_str = datetime.now().strftime("%I:%M %p")
    msg_id = f"msg-{int(time.time() * 1000)}"
    
    new_msg = ChatMessage(
        id=msg_id,
        client_id=msg_in.client_id,
        sender=msg_in.sender,
        text=msg_in.text,
        timestamp=now_str,
        is_read=True,
        attachment=msg_in.attachment
    )
    db.add(new_msg)
    await db.commit()
    await db.refresh(new_msg)
    return new_msg
