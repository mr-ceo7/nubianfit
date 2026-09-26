"""
Chat Messages Router

Each client has one thread with their coach. The sender is taken from the caller's role.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.dependencies import get_db, get_current_user, get_accessible_client, resolve_client_filter
from app.models.message import ChatMessage
from app.models.user import User
from app.schemas.message import ChatMessageCreate, ChatMessageResponse
from app.services.activity import new_id
from app.services.events import broker
from app.services.notify import client_user_ids, notify

router = APIRouter(prefix="/messages", tags=["Messages"])


@router.get("", response_model=List[ChatMessageResponse])
async def list_messages(
    client_id: Optional[str] = Query(None, alias="clientId"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client_ids = await resolve_client_filter(client_id, user, db)
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.client_id.in_(client_ids)).order_by(ChatMessage.created_at.asc())
    )
    return result.scalars().all()


@router.post("", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    msg_in: ChatMessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_accessible_client(msg_in.client_id, user, db)
    msg = ChatMessage(
        id=new_id("msg"),
        client_id=msg_in.client_id,
        sender=user.role,
        text=msg_in.text,
        timestamp=datetime.now().strftime("%I:%M %p"),
        is_read=False,
        attachment=msg_in.attachment,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    client = await get_accessible_client(msg_in.client_id, user, db)
    client_users = await client_user_ids(db, client.id)
    out = ChatMessageResponse.model_validate(msg)
    broker.publish([client.coach_id, *client_users], "message", out.model_dump(by_alias=True, mode="json"))
    if user.role == "coach":
        await notify(db, client_users, "message", "New message from your coach", msg.text[:140], {"tab": "chat"})
    else:
        await notify(db, [client.coach_id], "message", f"New message from {client.name}", msg.text[:140],
                     {"tab": "messenger", "clientId": client.id})
    return out


@router.post("/read")
async def mark_thread_read(
    client_id: str = Query(..., alias="clientId"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark the other party's messages in a thread as read."""
    await get_accessible_client(client_id, user, db)
    other = "client" if user.role == "coach" else "coach"
    await db.execute(
        update(ChatMessage)
        .where(ChatMessage.client_id == client_id, ChatMessage.sender == other, ChatMessage.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "Thread marked as read"}
