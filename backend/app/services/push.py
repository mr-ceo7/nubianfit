"""
Web push delivery (VAPID). Disabled unless VAPID keys are configured.
"""

import asyncio
import json
import logging
from typing import Any, Dict

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.engagement import PushSubscription

logger = logging.getLogger("nubianfit.push")


def push_enabled() -> bool:
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY) and not settings.TESTING


def _send_one(sub: PushSubscription, payload: str) -> bool:
    """Returns False when the subscription is gone and should be deleted."""
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=24 * 3600,
        )
        return True
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        if status in (404, 410):
            return False
        logger.warning("Web push to %s failed: %s", sub.endpoint[:60], e)
        return True


async def send_push(db: AsyncSession, user_id: str, message: Dict[str, Any]) -> None:
    if not push_enabled():
        return
    subs = (await db.execute(select(PushSubscription).where(PushSubscription.user_id == user_id))).scalars().all()
    payload = json.dumps(message)
    for sub in subs:
        alive = await asyncio.to_thread(_send_one, sub, payload)
        if not alive:
            await db.execute(delete(PushSubscription).where(PushSubscription.id == sub.id))
    await db.commit()
