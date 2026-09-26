"""
Live events (SSE), notifications, web push subscriptions, preferences and the cron tick.
"""

import asyncio
import hmac
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.engagement import Notification, PushSubscription
from app.models.user import User
from app.schemas.engagement import MarkReadRequest, NotificationResponse, PreferencesBody, PushSubscribeRequest
from app.services.activity import new_id
from app.services.events import broker
from app.services.push import push_enabled
from app.services.scheduler import run_tick

router = APIRouter(tags=["Engagement"])

HEARTBEAT_SECONDS = 20


# --- Live events ---------------------------------------------------------------

@router.post("/events/ticket")
async def events_ticket(user: User = Depends(get_current_user)):
    """One-time ticket (valid 60 s) for opening the event stream."""
    return {"ticket": broker.issue_ticket(user.id)}


@router.get("/events/stream")
async def events_stream(request: Request, ticket: str = Query(...)):
    user_id = broker.redeem_ticket(ticket)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired ticket")

    queue = broker.subscribe(user_id)

    async def stream():
        try:
            yield "event: ready\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    yield await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            broker.unsubscribe(user_id, queue)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# --- Notifications -------------------------------------------------------------

@router.get("/notifications")
async def list_notifications(
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(limit)
    )).scalars().all()
    unread = (await db.execute(
        select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
    )).scalar_one()
    return {
        "items": [NotificationResponse.model_validate(r).model_dump(by_alias=True) for r in rows],
        "unreadCount": unread,
    }


@router.post("/notifications/read")
async def mark_read(body: MarkReadRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    query = update(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
    if body.ids is not None:
        query = query.where(Notification.id.in_(body.ids))
    await db.execute(query.values(read_at=datetime.now(timezone.utc).replace(tzinfo=None)))
    await db.commit()
    return {"message": "Marked as read"}


# --- Web push --------------------------------------------------------------------

@router.get("/push/public-key")
async def push_public_key():
    return {"publicKey": settings.VAPID_PUBLIC_KEY if push_enabled() else None}


@router.post("/push/subscribe", status_code=status.HTTP_201_CREATED)
async def push_subscribe(body: PushSubscribeRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint))).scalar_one_or_none()
    if existing:
        existing.user_id = user.id  # device changed hands (e.g. coach logged out, client logged in)
        existing.p256dh = body.keys["p256dh"]
        existing.auth = body.keys["auth"]
    else:
        db.add(PushSubscription(id=new_id("push"), user_id=user.id, endpoint=body.endpoint,
                                p256dh=body.keys["p256dh"], auth=body.keys["auth"]))
    await db.commit()
    return {"message": "Subscribed"}


@router.post("/push/unsubscribe")
async def push_unsubscribe(body: PushSubscribeRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(PushSubscription).where(PushSubscription.endpoint == body.endpoint, PushSubscription.user_id == user.id))
    await db.commit()
    return {"message": "Unsubscribed"}


# --- Preferences -----------------------------------------------------------------

@router.get("/preferences", response_model=PreferencesBody)
async def get_preferences(user: User = Depends(get_current_user)):
    return PreferencesBody(email_digest=user.email_digest)


@router.put("/preferences", response_model=PreferencesBody)
async def set_preferences(body: PreferencesBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user.email_digest = body.email_digest
    await db.commit()
    return PreferencesBody(email_digest=user.email_digest)


# --- Cron --------------------------------------------------------------------------

@router.post("/internal/tick")
async def cron_tick(x_cron_token: str = Header(default="")):
    """Run scheduled jobs now. Protected by CRON_TOKEN; disabled when it isn't set."""
    if not settings.CRON_TOKEN or not hmac.compare_digest(x_cron_token, settings.CRON_TOKEN):
        raise HTTPException(status_code=404, detail="Not Found")
    return await run_tick()
