"""Phase 3: notifications, live events, community, check-ins, photos, Autoflow, digests."""

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import update

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.engagement import Notification
from app.services import email
from app.services.events import broker
from app.services.scheduler import run_tick, send_email_digests
from conftest import DEMO_CLIENT_ID

TODAY = date.today()
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


# --- Notifications & live events ----------------------------------------------

async def test_message_notifies_the_other_side(api, coach, client_user):
    await api.post("/api/messages", headers=client_user, json={"clientId": DEMO_CLIENT_ID, "text": "Quick question"})
    data = (await api.get("/api/notifications", headers=coach)).json()
    assert data["unreadCount"] >= 1
    latest = data["items"][0]
    assert latest["type"] == "message" and latest["link"]["clientId"] == DEMO_CLIENT_ID
    assert latest["createdAt"].endswith(("Z", "+00:00"))

    await api.post("/api/notifications/read", headers=coach, json={"ids": [latest["id"]]})
    assert (await api.get("/api/notifications", headers=coach)).json()["unreadCount"] == data["unreadCount"] - 1
    await api.post("/api/notifications/read", headers=coach, json={})
    assert (await api.get("/api/notifications", headers=coach)).json()["unreadCount"] == 0


async def test_event_tickets_are_single_use(api, coach):
    ticket = (await api.post("/api/events/ticket", headers=coach)).json()["ticket"]
    assert broker.redeem_ticket(ticket) is not None
    assert broker.redeem_ticket(ticket) is None
    assert (await api.get("/api/events/stream", params={"ticket": "bogus"})).status_code == 401


async def test_broker_delivers_only_to_recipients():
    q1, q2 = broker.subscribe("u1"), broker.subscribe("u2")
    broker.publish(["u1"], "notification", {"x": 1})
    assert q1.get_nowait().startswith("event: notification")
    assert q2.empty()
    broker.unsubscribe("u1", q1)
    broker.unsubscribe("u2", q2)
    assert not broker.is_online("u1")


async def test_preferences_and_push_endpoints(api, client_user):
    assert (await api.get("/api/preferences", headers=client_user)).json() == {"emailDigest": True}
    assert (await api.put("/api/preferences", headers=client_user, json={"emailDigest": False})).json() == {"emailDigest": False}
    assert (await api.get("/api/push/public-key")).json() == {"publicKey": None}  # off in tests
    sub = {"endpoint": "https://push.example.com/abc123", "keys": {"p256dh": "k", "auth": "a"}}
    assert (await api.post("/api/push/subscribe", headers=client_user, json=sub)).status_code == 201
    assert (await api.post("/api/push/subscribe", headers=client_user, json={**sub, "endpoint": "http://x"})).status_code == 422
    assert (await api.post("/api/push/unsubscribe", headers=client_user, json=sub)).status_code == 200


# --- Community ----------------------------------------------------------------

async def test_group_membership_controls_access(api, coach, client_user, other_coach):
    groups = (await api.get("/api/community/groups", headers=client_user)).json()
    assert [g["name"] for g in groups] == ["Fall Shred Challenge"]
    gid = groups[0]["id"]

    post = (await api.post(f"/api/community/groups/{gid}/posts", headers=client_user, json={"body": "Day 1 done!"})).json()
    assert post["authorName"] == "Marcus Vance" and post["authorRole"] == "client"
    liked = (await api.post(f"/api/community/posts/{post['id']}/like", headers=coach)).json()
    assert liked["likeCount"] == 1 and liked["likedByMe"] is True

    # The coach's comment notifies the post author.
    await api.post(f"/api/community/posts/{post['id']}/comments", headers=coach, json={"body": "Proud of you"})
    notes = (await api.get("/api/notifications", headers=client_user)).json()["items"]
    assert notes[0]["type"] == "community_comment"

    # Remove Marcus from the group: he loses access.
    await api.patch(f"/api/community/groups/{gid}", headers=coach, json={"clientIds": ["client-2"]})
    assert (await api.get(f"/api/community/groups/{gid}/posts", headers=client_user)).status_code == 404
    assert (await api.get(f"/api/community/groups/{gid}/posts", headers=other_coach)).status_code == 404
    assert (await api.post("/api/community/groups", headers=other_coach, json={"name": "x", "clientIds": [DEMO_CLIENT_ID]})).status_code == 404


async def test_group_chat_and_post_permissions(api, coach, client_user):
    gid = (await api.get("/api/community/groups", headers=client_user)).json()[0]["id"]
    res = await api.post(f"/api/community/groups/{gid}/messages", headers=client_user, json={"text": "Morning team"})
    assert res.status_code == 201
    msgs = (await api.get(f"/api/community/groups/{gid}/messages", headers=coach)).json()
    assert msgs[-1]["text"] == "Morning team"

    coach_post = (await api.post(f"/api/community/groups/{gid}/posts", headers=coach, json={"body": "Rules"})).json()
    assert (await api.delete(f"/api/community/posts/{coach_post['id']}", headers=client_user)).status_code == 403
    assert (await api.post(f"/api/community/posts/{coach_post['id']}/pin", headers=client_user)).status_code == 403
    assert (await api.delete(f"/api/community/posts/{coach_post['id']}", headers=coach)).status_code == 200


# --- Check-ins & photos ---------------------------------------------------------

async def upload(api, headers, client_id=DEMO_CLIENT_ID, data=PNG):
    return await api.post("/api/files", headers=headers, data={"clientId": client_id}, files={"file": ("p.png", data, "image/png")})


async def test_checkin_due_and_submit(api, coach, client_user):
    [assignment] = (await api.get("/api/checkin-assignments", headers=client_user)).json()
    assert assignment["pendingDueDate"] == TODAY.isoformat()
    assert assignment["nextDueDate"] == (TODAY + timedelta(days=7)).isoformat()

    photo = (await upload(api, client_user)).json()
    answers = {"q-weight": 80.4, "q-energy": 8, "q-adherence": "Nailed it", "q-photo": {"fileId": photo["id"]}}
    body = {"assignmentId": assignment["id"], "dueDate": TODAY.isoformat(), "answers": answers}

    missing = await api.post("/api/checkin-responses", headers=client_user, json={**body, "answers": {"q-energy": 8}})
    assert missing.status_code == 422
    bad_choice = await api.post("/api/checkin-responses", headers=client_user, json={**body, "answers": {**answers, "q-adherence": "Meh"}})
    assert bad_choice.status_code == 422
    not_due = await api.post("/api/checkin-responses", headers=client_user, json={**body, "dueDate": (TODAY - timedelta(days=3)).isoformat()})
    assert not_due.status_code == 400
    assert (await api.post("/api/checkin-responses", headers=coach, json=body)).status_code == 403

    res = await api.post("/api/checkin-responses", headers=client_user, json=body)
    assert res.status_code == 201, res.text
    response = res.json()
    assert response["photoUrls"][photo["id"]].startswith("/api/files/")
    assert (await api.post("/api/checkin-responses", headers=client_user, json=body)).status_code == 400

    # Side effects: weight recorded, progress photo added, coach notified.
    me = (await api.get(f"/api/clients/{DEMO_CLIENT_ID}", headers=client_user)).json()
    assert me["currentWeightKg"] == 80.4
    photos = (await api.get("/api/photos", headers=coach, params={"clientId": DEMO_CLIENT_ID})).json()
    assert any(p["photoUrl"].startswith("/api/files/") for p in photos)
    assert (await api.get("/api/notifications", headers=coach)).json()["items"][0]["type"] == "checkin_submitted"
    [assignment] = (await api.get("/api/checkin-assignments", headers=client_user)).json()
    assert assignment["pendingDueDate"] is None

    reviewed = (await api.post(f"/api/checkin-responses/{response['id']}/review", headers=coach, json={"comment": "Great work"})).json()
    assert reviewed["coachComment"] == "Great work" and reviewed["reviewedAt"]
    assert (await api.get("/api/notifications", headers=client_user)).json()["items"][0]["type"] == "checkin_reviewed"


async def test_form_validation(api, coach):
    base = {"title": "x", "questions": [{"id": "a", "type": "single_choice", "label": "Pick", "options": ["only one"]}]}
    assert (await api.post("/api/checkin-forms", headers=coach, json=base)).status_code == 422
    dup = {"title": "x", "questions": [{"id": "a", "type": "text", "label": "A"}, {"id": "a", "type": "text", "label": "B"}]}
    assert (await api.post("/api/checkin-forms", headers=coach, json=dup)).status_code == 422
    ok = {"title": "Mood", "questions": [{"id": "m", "type": "scale", "label": "Mood", "min": 1, "max": 5, "required": True}]}
    assert (await api.post("/api/checkin-forms", headers=coach, json=ok)).status_code == 201


async def test_file_upload_and_signed_urls(api, client_user, coach):
    assert (await upload(api, client_user, data=b"<svg onload=alert(1)>")).status_code == 415
    assert (await upload(api, client_user, data=PNG + b"\x00" * (2 * 1024 * 1024))).status_code == 413
    assert (await upload(api, client_user, client_id="client-2")).status_code == 404

    uploaded = (await upload(api, client_user)).json()
    res = await api.get(uploaded["url"])
    assert res.status_code == 200 and res.content == PNG and res.headers["content-type"] == "image/png"
    tampered = uploaded["url"].replace("sig=", "sig=0")
    assert (await api.get(tampered)).status_code == 404

    # A progress photo can't point at someone else's file.
    other = (await upload(api, coach, client_id="client-2")).json()
    res = await api.post("/api/photos", headers=client_user, json={
        "clientId": DEMO_CLIENT_ID, "date": TODAY.isoformat(), "photoUrl": f"file:{other['id']}", "weightKg": 80,
    })
    assert res.status_code == 404


# --- Autoflow -------------------------------------------------------------------

async def test_autoflow_runs_steps_on_schedule(api, coach, client_user):
    flow = (await api.post("/api/autoflows", headers=coach, json={"title": "Test flow", "steps": [
        {"id": "a", "day": 1, "type": "message", "text": "Welcome!"},
        {"id": "b", "day": 2, "type": "habit", "habit": {"title": "Walk 8k steps"}},
        {"id": "c", "day": 3, "type": "checkin", "formId": "form-weekly"},
    ]})).json()

    # Started yesterday: day 1 and day 2 run immediately, day 3 waits for tomorrow.
    start = (TODAY - timedelta(days=1)).isoformat()
    assignment = (await api.post(f"/api/autoflows/{flow['id']}/assign", headers=coach, json={"clientId": DEMO_CLIENT_ID, "startDate": start})).json()
    assert sorted(assignment["completedStepIds"]) == ["a", "b"] and assignment["active"] is True

    thread = (await api.get("/api/messages", headers=client_user)).json()
    assert thread[-1]["text"] == "Welcome!" and thread[-1]["sender"] == "coach"
    assert "Walk 8k steps" in [h["title"] for h in (await api.get("/api/habits", headers=client_user)).json()]

    await run_tick(TODAY + timedelta(days=1))
    [done] = [a for a in (await api.get("/api/autoflows/assignments", headers=coach)).json() if a["id"] == assignment["id"]]
    assert sorted(done["completedStepIds"]) == ["a", "b", "c"] and done["active"] is False
    once = [a for a in (await api.get("/api/checkin-assignments", headers=client_user)).json() if a["frequency"] == "once"]
    assert len(once) == 1


async def test_autoflow_validation(api, coach, other_coach):
    bad = {"title": "x", "steps": [{"id": "a", "day": 1, "type": "message", "text": " "}]}
    assert (await api.post("/api/autoflows", headers=coach, json=bad)).status_code == 422
    foreign_form = {"title": "x", "steps": [{"id": "a", "day": 1, "type": "checkin", "formId": "form-weekly"}]}
    assert (await api.post("/api/autoflows", headers=other_coach, json=foreign_form)).status_code == 422
    assert (await api.get("/api/autoflows", headers=other_coach)).json() == []


# --- Scheduler & digests -----------------------------------------------------------

async def test_email_digest_batches_old_unread_notifications(api, coach, client_user):
    await api.post("/api/messages", headers=client_user, json={"clientId": DEMO_CLIENT_ID, "text": "One"})
    await api.post("/api/messages", headers=client_user, json={"clientId": DEMO_CLIENT_ID, "text": "Two"})
    async with AsyncSessionLocal() as db:
        old = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=2)
        await db.execute(update(Notification).values(created_at=old))
        await db.commit()
        email.outbox.clear()
        assert await send_email_digests(db) >= 1
        assert await send_email_digests(db) == 0  # nothing new to send
    digest = next(m for m in email.outbox if m["to"] == [settings.DEFAULT_COACH_EMAIL])
    assert "2 updates" in digest["subject"]


async def test_cron_endpoint_requires_token(api, monkeypatch):
    assert (await api.post("/api/internal/tick")).status_code == 404
    monkeypatch.setattr(settings, "CRON_TOKEN", "secret-token")
    assert (await api.post("/api/internal/tick", headers={"X-Cron-Token": "wrong"})).status_code == 404
    res = await api.post("/api/internal/tick", headers={"X-Cron-Token": "secret-token"})
    assert res.status_code == 200 and set(res.json()) == {"autoflowSteps", "checkinReminders", "digests"}
