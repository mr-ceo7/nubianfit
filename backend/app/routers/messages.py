"""
Chat Messages Router

Each client has one thread with their coach.
Supports voice notes, attachments, scheduled future messages, and coach canned replies.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.dependencies import get_db, get_current_user, get_accessible_client, resolve_client_filter
from app.models.message import ChatMessage, CannedResponse
from app.models.user import User
from app.schemas.message import (
    ChatMessageCreate,
    ChatMessageResponse,
    CannedResponseCreate,
    CannedResponseResponse,
)
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
    query = select(ChatMessage).where(ChatMessage.client_id.in_(client_ids))

    # Clients should only see messages that are already delivered
    if user.role == "client":
        query = query.where(ChatMessage.is_delivered == True)  # noqa: E712

    result = await db.execute(query.order_by(ChatMessage.created_at.asc()))
    return result.scalars().all()


@router.post("", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    msg_in: ChatMessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_accessible_client(msg_in.client_id, user, db)

    now_utc = datetime.now(timezone.utc)
    is_scheduled = bool(msg_in.scheduled_for and msg_in.scheduled_for > now_utc)

    msg = ChatMessage(
        id=new_id("msg"),
        client_id=msg_in.client_id,
        sender=user.role,
        text=msg_in.text,
        timestamp=datetime.now().strftime("%I:%M %p"),
        is_read=False,
        attachment=msg_in.attachment,
        scheduled_for=msg_in.scheduled_for if is_scheduled else None,
        is_delivered=not is_scheduled,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    out = ChatMessageResponse.model_validate(msg)

    # Only publish SSE and push notification immediately if delivered right now
    if not is_scheduled:
        client = await get_accessible_client(msg_in.client_id, user, db)
        client_users = await client_user_ids(db, client.id)
        broker.publish([client.coach_id, *client_users], "message", out.model_dump(by_alias=True, mode="json"))
        preview = msg.text[:140] if msg.text else ("Voice note" if (msg.attachment and msg.attachment.get("type") == "voice") else "Attachment")
        if user.role == "coach":
            await notify(db, client_users, "message", "New message from your coach", preview, {"tab": "chat"})
        else:
            await notify(db, [client.coach_id], "message", f"New message from {client.name}", preview,
                         {"tab": "messenger", "clientId": client.id})

    return out


@router.delete("/{message_id}")
async def cancel_message(
    message_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Allows a sender/coach to cancel a scheduled, undelivered message."""
    result = await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    await get_accessible_client(msg.client_id, user, db)

    if not msg.is_delivered:
        await db.delete(msg)
        await db.commit()
        return {"message": "Scheduled message cancelled"}

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivered messages cannot be deleted.")


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


# --- Canned Responses (Coach Quick Replies) -----------------------------------

@router.get("/canned-responses", response_model=List[CannedResponseResponse])
async def list_canned_responses(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List coach's reusable quick reply snippets."""
    if user.role != "coach":
        return []
    result = await db.execute(
        select(CannedResponse).where(CannedResponse.coach_id == user.id).order_by(CannedResponse.title.asc())
    )
    return result.scalars().all()


@router.post("/canned-responses", response_model=CannedResponseResponse, status_code=status.HTTP_201_CREATED)
async def create_canned_response(
    item_in: CannedResponseCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new reusable quick reply snippet."""
    if user.role != "coach":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only coaches can create canned responses.")

    clean_shortcut = item_in.shortcut.strip().lstrip("/").lower()
    item = CannedResponse(
        id=new_id("cr"),
        coach_id=user.id,
        title=item_in.title.strip(),
        shortcut=clean_shortcut,
        text=item_in.text.strip(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/canned-responses/{response_id}")
async def delete_canned_response(
    response_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a canned response."""
    result = await db.execute(
        select(CannedResponse).where(CannedResponse.id == response_id, CannedResponse.coach_id == user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canned response not found")
    await db.delete(item)
    await db.commit()
    return {"message": "Canned response deleted"}
