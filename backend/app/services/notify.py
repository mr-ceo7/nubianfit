"""
Create notifications and deliver them: in-app (stored + live event) and web push.
Email digests of unread notifications are sent later by the scheduler.
"""

import logging
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.engagement import Notification
from app.models.user import User
from app.services.activity import new_id
from app.services.events import broker
from app.services.push import send_push

logger = logging.getLogger("nubianfit.notify")


def iso_utc(dt) -> str:
    """ISO timestamp with an explicit UTC offset (stored datetimes may be naive UTC)."""
    from datetime import timezone
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


async def client_user_ids(db: AsyncSession, client_id: str) -> List[str]:
    """Active logins belonging to a client profile (usually one)."""
    result = await db.execute(select(User.id).where(User.client_id == client_id, User.is_active == True))  # noqa: E712
    return list(result.scalars().all())


async def coach_user_id(db: AsyncSession, client_id: str) -> Optional[str]:
    client = await db.get(Client, client_id)
    return client.coach_id if client else None


async def notify(
    db: AsyncSession,
    user_ids: Iterable[str],
    type_: str,
    title: str,
    body: str = "",
    link: Optional[Dict[str, Any]] = None,
) -> None:
    """Store a notification per user, commit, then push it live and via web push.
    Commits the session, so call it after the triggering change has been added."""
    recipients = [u for u in dict.fromkeys(user_ids) if u]
    rows = [
        Notification(id=new_id("ntf"), user_id=u, type=type_, title=title, body=body, link=link or {})
        for u in recipients
    ]
    db.add_all(rows)
    await db.commit()

    for row in rows:
        payload = {
            "id": row.id, "type": row.type, "title": row.title, "body": row.body, "link": row.link,
            "createdAt": iso_utc(row.created_at), "readAt": None,
        }
        broker.publish([row.user_id], "notification", payload)
        try:
            await send_push(db, row.user_id, {"title": title, "body": body, "link": row.link, "tag": type_})
        except Exception:  # push is best-effort
            logger.exception("Web push failed for %s", row.user_id)
