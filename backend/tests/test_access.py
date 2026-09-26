"""Data isolation between coaches, and what a client may do with their own data."""

from app.services import email
from conftest import DEMO_CLIENT_ID, client_login


async def test_coach_sees_only_own_clients(api, coach, other_coach):
    assert len((await api.get("/api/clients", headers=coach)).json()) >= 6
    assert (await api.get("/api/clients", headers=other_coach)).json() == []
    assert (await api.get(f"/api/clients/{DEMO_CLIENT_ID}", headers=other_coach)).status_code == 404


async def test_other_coach_cannot_touch_foreign_data(api, other_coach):
    for path in ("/api/workouts", "/api/metrics", "/api/messages", "/api/prs", "/api/photos", "/api/habits",
                 "/api/nutrition/log", "/api/nutrition/daily", "/api/habits/checkins", "/api/nutrition/goals"):
        assert (await api.get(path, headers=other_coach)).json() == [], path
        res = await api.get(path, params={"clientId": DEMO_CLIENT_ID}, headers=other_coach)
        assert res.status_code == 404, path
    assert (await api.get("/api/activity", headers=other_coach)).json() == []
    assert (await api.get("/api/programs", headers=other_coach)).json() == []
    res = await api.patch(f"/api/clients/{DEMO_CLIENT_ID}", headers=other_coach, json={"name": "Hijacked"})
    assert res.status_code == 404
    res = await api.post("/api/messages", headers=other_coach, json={"clientId": DEMO_CLIENT_ID, "text": "hi"})
    assert res.status_code == 404


async def test_exercise_library_scoping(api, coach, other_coach):
    library = (await api.get("/api/exercises", headers=other_coach)).json()
    assert len(library) >= 15

    custom = (await api.post("/api/exercises", headers=coach, json={
        "name": "Secret Move", "primaryMuscle": "Chest", "equipment": "Bodyweight",
    })).json()
    assert custom["isCustom"] is True
    names = [e["name"] for e in (await api.get("/api/exercises", headers=other_coach)).json()]
    assert "Secret Move" not in names
    assert (await api.delete(f"/api/exercises/{custom['id']}", headers=other_coach)).status_code == 404

    res = await api.patch(f"/api/exercises/{library[0]['id']}", headers=coach, json={"name": "Renamed"})
    assert res.status_code == 403


async def test_assign_program_schedules_workouts(api, coach):
    program = (await api.get("/api/programs", headers=coach)).json()[0]
    client = (await api.post("/api/clients", headers=coach, json={"name": "Fresh", "email": "fresh@example.com"})).json()
    res = await api.post(f"/api/programs/{program['id']}/assign", headers=coach, json={"clientId": client["id"]})
    assert res.status_code == 200
    workouts = (await api.get("/api/workouts", params={"clientId": client["id"]}, headers=coach)).json()
    assert len(workouts) == len(program["days"]) == res.json()["scheduled_count"]
    refreshed = (await api.get(f"/api/clients/{client['id']}", headers=coach)).json()
    assert refreshed["currentProgramId"] == program["id"]
    assert refreshed["totalWorkoutsAssigned"] == len(program["days"])


async def test_duplicate_client_email_rejected(api, coach, demo_client_email):
    res = await api.post("/api/clients", headers=coach, json={"name": "Dup", "email": demo_client_email.upper()})
    assert res.status_code == 400


async def test_client_sees_only_self_without_coach_notes(api, coach, client_user):
    await api.post(f"/api/clients/{DEMO_CLIENT_ID}/notes", headers=coach, json={"note": "private"})
    clients = (await api.get("/api/clients", headers=client_user)).json()
    assert [c["id"] for c in clients] == [DEMO_CLIENT_ID]
    assert clients[0]["customCoachNotes"] == []
    assert (await api.get("/api/clients/client-2", headers=client_user)).status_code == 404
    workouts = (await api.get("/api/workouts", headers=client_user)).json()
    assert workouts and all(w["clientId"] == DEMO_CLIENT_ID for w in workouts)


async def test_client_cannot_use_coach_actions(api, client_user):
    assert (await api.post("/api/clients", headers=client_user, json={"name": "x"})).status_code == 403
    assert (await api.post("/api/exercises", headers=client_user, json={
        "name": "x", "primaryMuscle": "Chest", "equipment": "Bodyweight",
    })).status_code == 403
    assert (await api.post("/api/programs", headers=client_user, json={"title": "x"})).status_code == 403


async def test_client_logs_own_workout(api, client_user):
    workouts = (await api.get("/api/workouts", headers=client_user)).json()
    target = next(w for w in workouts if w["status"] != "Completed")

    res = await api.patch(f"/api/workouts/{target['id']}", headers=client_user, json={"date": "2030-01-01"})
    assert res.status_code == 403

    res = await api.post(f"/api/workouts/{target['id']}/complete", headers=client_user,
                         json={"rating": 4, "durationMin": 50, "clientFeedback": "Felt strong", "coachFeedback": "sneaky"})
    assert res.status_code == 200
    done = res.json()
    assert done["status"] == "Completed"
    assert done["clientFeedback"] == "Felt strong"
    assert done["coachFeedback"] != "sneaky"


async def test_message_sender_comes_from_role(api, coach, client_user):
    res = await api.post("/api/messages", headers=client_user,
                         json={"clientId": DEMO_CLIENT_ID, "sender": "coach", "text": "from client"})
    assert res.status_code == 201
    assert res.json()["sender"] == "client"
    thread = (await api.get("/api/messages", params={"clientId": DEMO_CLIENT_ID}, headers=coach)).json()
    assert thread[-1]["text"] == "from client"
    await api.post("/api/messages/read", params={"clientId": DEMO_CLIENT_ID}, headers=coach)
    thread = (await api.get("/api/messages", params={"clientId": DEMO_CLIENT_ID}, headers=coach)).json()
    assert all(m["isRead"] for m in thread if m["sender"] == "client")


async def test_client_checkin_updates_profile(api, client_user):
    res = await api.post("/api/metrics", headers=client_user,
                         json={"clientId": DEMO_CLIENT_ID, "date": "2026-09-26", "weightKg": 81.5})
    assert res.status_code == 201
    me = (await api.get(f"/api/clients/{DEMO_CLIENT_ID}", headers=client_user)).json()
    assert me["currentWeightKg"] == 81.5


async def test_deleting_client_revokes_login_and_data(api, coach, demo_client_email):
    headers = await client_login(api, demo_client_email)
    assert (await api.delete(f"/api/clients/{DEMO_CLIENT_ID}", headers=coach)).status_code == 200
    assert (await api.get("/api/auth/me", headers=headers)).status_code == 401
    workouts = (await api.get("/api/workouts", headers=coach)).json()
    assert all(w["clientId"] != DEMO_CLIENT_ID for w in workouts)
    email.outbox.clear()


async def test_feed_and_messages_carry_utc_timestamps(api, coach):
    feed = (await api.get("/api/activity", headers=coach)).json()
    assert feed and feed[0]["createdAt"].endswith(("Z", "+00:00"))
    assert "metadata" in feed[0] and "metadataJson" not in feed[0]
    created = [item["createdAt"] for item in feed]
    assert created == sorted(created, reverse=True)
    thread = (await api.get("/api/messages", params={"clientId": DEMO_CLIENT_ID}, headers=coach)).json()
    assert thread[0]["createdAt"].endswith(("Z", "+00:00"))
