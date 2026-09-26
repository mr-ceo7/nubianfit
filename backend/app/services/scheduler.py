"""
Periodic jobs: Autoflow steps, "check-in due" reminders and email digests.

`run_tick()` is idempotent; it runs from a background loop while the server is awake and can
also be triggered by an external cron via POST /api/internal/tick.
"""

import asyncio
import html
import logging
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.client import Client
from app.models.engagement import (
    Autoflow, AutoflowAssignment, CheckinAssignment, CheckinForm, CheckinResponse, Notification,
)
from app.models.habit import Habit
from app.models.message import ChatMessage
from app.models.user import User
from app.services.activity import new_id
from app.services.checkins import pending_due_date
from app.services.email import EmailDeliveryError, layout, send_email
from app.services.events import broker
from app.services.notify import client_user_ids, notify

logger = logging.getLogger("nubianfit.scheduler")


async def run_autoflow_assignment(db: AsyncSession, assignment: AutoflowAssignment, today: date) -> int:
    """Execute every step that is due and not yet done. Returns how many ran."""
    flow = await db.get(Autoflow, assignment.autoflow_id)
    client = await db.get(Client, assignment.client_id)
    if not flow or not client or not assignment.active:
        return 0
    done = set(assignment.completed_step_ids or [])
    ran = 0
    for step in sorted(flow.steps or [], key=lambda s: s.get("day", 1)):
        if step["id"] in done:
            continue
        step_date = assignment.start_date + timedelta(days=step.get("day", 1) - 1)
        if step_date > today:
            continue
        users = await client_user_ids(db, client.id)
        if step["type"] == "message":
            msg = ChatMessage(
                id=new_id("msg"), client_id=client.id, sender="coach", text=step["text"],
                timestamp=datetime.now().strftime("%I:%M %p"), is_read=False,
            )
            db.add(msg)
            await db.flush()
            broker.publish(users + [client.coach_id], "message", {"clientId": client.id, "id": msg.id})
            await notify(db, users, "message", "New message from your coach", step["text"][:140], {"tab": "chat"})
        elif step["type"] == "checkin":
            form = await db.get(CheckinForm, step.get("formId"))
            if form and form.coach_id == client.coach_id:
                db.add(CheckinAssignment(
                    id=new_id("chk-assign"), form_id=form.id, client_id=client.id, frequency="once",
                    start_date=step_date, active=True, last_notified_date=step_date,
                ))
                await notify(db, users, "checkin_due", f"Check-in: {form.title}", "Your coach asked for a check-in.", {"tab": "today"})
        elif step["type"] == "habit":
            spec = step.get("habit") or {}
            db.add(Habit(
                id=new_id("habit"), client_id=client.id, title=spec.get("title", "New habit"),
                target_value=spec.get("targetValue"), unit=spec.get("unit", ""),
                days_of_week=spec.get("daysOfWeek", []), active=True, sort_order=99,
            ))
            await notify(db, users, "habit", "New habit", spec.get("title", ""), {"tab": "today"})
        done.add(step["id"])
        ran += 1
    assignment.completed_step_ids = list(done)
    if {s["id"] for s in flow.steps or []} <= done:
        assignment.active = False
    await db.commit()
    return ran


async def run_autoflows(db: AsyncSession, today: date) -> int:
    assignments = (await db.execute(select(AutoflowAssignment).where(AutoflowAssignment.active == True))).scalars().all()  # noqa: E712
    return sum([await run_autoflow_assignment(db, a, today) for a in assignments])


async def send_checkin_reminders(db: AsyncSession, today: date) -> int:
    """Notify clients once per due date when a check-in becomes due."""
    sent = 0
    assignments = (await db.execute(select(CheckinAssignment).where(CheckinAssignment.active == True))).scalars().all()  # noqa: E712
    for a in assignments:
        answered = set((await db.execute(
            select(CheckinResponse.due_date).where(CheckinResponse.assignment_id == a.id)
        )).scalars().all())
        due = pending_due_date(a, answered, today)
        if not due or a.last_notified_date == due:
            continue
        form = await db.get(CheckinForm, a.form_id)
        a.last_notified_date = due
        await notify(db, await client_user_ids(db, a.client_id), "checkin_due",
                     f"Check-in due: {form.title if form else 'weekly check-in'}", "Tap to fill it in.", {"tab": "today"})
        sent += 1
    return sent


async def send_email_digests(db: AsyncSession, now: Optional[datetime] = None) -> int:
    """One email per user summarising unread, un-emailed notifications older than the delay."""
    now = now or datetime.now(timezone.utc)
    cutoff = (now - timedelta(minutes=settings.DIGEST_DELAY_MINUTES)).replace(tzinfo=None)
    rows = (await db.execute(
        select(Notification).where(
            Notification.read_at.is_(None), Notification.emailed_at.is_(None), Notification.created_at <= cutoff,
        ).order_by(Notification.created_at)
    )).scalars().all()
    by_user: Dict[str, List[Notification]] = defaultdict(list)
    for n in rows:
        by_user[n.user_id].append(n)

    sent = 0
    for user_id, items in by_user.items():
        user = await db.get(User, user_id)
        stamp = now.replace(tzinfo=None)
        if not user or not user.is_active or not user.email_digest or broker.is_online(user_id):
            # Don't email people who are in the app right now, or who opted out.
            for n in items:
                n.emailed_at = stamp
            continue
        portal = settings.COACH_URL if user.role == "coach" else settings.CLIENT_URL
        lines = "".join(
            f"<li style='margin-bottom:8px'><strong>{html.escape(n.title)}</strong><br>{html.escape(n.body)}</li>"
            for n in items[:8]
        )
        more = f"<p>…and {len(items) - 8} more.</p>" if len(items) > 8 else ""
        try:
            await send_email(
                user.email,
                f"You have {len(items)} update{'s' if len(items) != 1 else ''} on NubianFit",
                layout("While you were away", f"<ul style='padding-left:18px'>{lines}</ul>{more}"
                        f'<p><a href="{portal}" style="color:#22d3ee">Open NubianFit</a></p>'
                        "<p style='font-size:12px;color:#94a3b8'>You can turn these emails off in your profile.</p>"),
                "\n".join(f"- {n.title}: {n.body}" for n in items[:8]) + f"\n\nOpen NubianFit: {portal}",
            )
            sent += 1
        except EmailDeliveryError:
            continue  # retry next tick
        for n in items:
            n.emailed_at = stamp
    await db.commit()
    return sent


async def run_tick(today: Optional[date] = None) -> Dict[str, int]:
    today = today or date.today()
    async with AsyncSessionLocal() as db:
        return {
            "autoflowSteps": await run_autoflows(db, today),
            "checkinReminders": await send_checkin_reminders(db, today),
            "digests": await send_email_digests(db),
        }


async def scheduler_loop() -> None:
    while True:
        try:
            result = await run_tick()
            if any(result.values()):
                logger.info("Scheduler tick: %s", result)
        except Exception:
            logger.exception("Scheduler tick failed")
        await asyncio.sleep(settings.SCHEDULER_INTERVAL_SECONDS)
