"""Phase 1: workout library, structured workout content, weekly programs."""

from datetime import date, timedelta

from conftest import DEMO_CLIENT_ID

SUPERSET_WORKOUT = {
    "title": "Push A",
    "estimatedDurationMin": 50,
    "groups": [{"id": "g1", "kind": "superset", "rounds": 3}],
    "exercises": [
        {"id": "e0", "exerciseId": "ex-1", "exerciseName": "Band pull-apart", "section": "warmup",
         "trackingType": "reps", "sets": [{"id": "s0", "setNumber": 1, "targetReps": "15"}]},
        {"id": "e1", "exerciseId": "ex-1", "exerciseName": "Bench", "section": "main", "groupId": "g1",
         "trackingType": "reps_weight", "sets": [{"id": "s1", "setNumber": 1, "targetReps": "8", "targetWeightKg": 60}]},
        {"id": "e2", "exerciseId": "ex-2", "exerciseName": "Row", "section": "main", "groupId": "g1",
         "trackingType": "reps_weight", "sets": [{"id": "s2", "setNumber": 1, "targetReps": "10"}]},
        {"id": "e3", "exerciseId": "ex-3", "exerciseName": "Bike", "section": "cooldown",
         "trackingType": "time_distance", "sets": [{"id": "s3", "setNumber": 1, "targetDurationSec": 600, "targetDistanceM": 4000}]},
    ],
}


async def test_workout_library_crud_and_isolation(api, coach, other_coach, client_user):
    created = await api.post("/api/workout-templates", headers=coach, json=SUPERSET_WORKOUT)
    assert created.status_code == 201, created.text
    wt = created.json()
    assert wt["groups"][0]["kind"] == "superset"
    assert [e["section"] for e in wt["exercises"]] == ["warmup", "main", "main", "cooldown"]

    assert (await api.get("/api/workout-templates", headers=other_coach)).json() == []
    assert (await api.patch(f"/api/workout-templates/{wt['id']}", headers=other_coach, json={"title": "x"})).status_code == 404
    assert (await api.get("/api/workout-templates", headers=client_user)).status_code == 403

    res = await api.patch(f"/api/workout-templates/{wt['id']}", headers=coach, json={"title": "Push A v2"})
    assert res.json()["title"] == "Push A v2"
    assert (await api.delete(f"/api/workout-templates/{wt['id']}", headers=coach)).status_code == 200


async def test_malformed_workout_content_is_rejected(api, coach):
    bad_group_ref = {**SUPERSET_WORKOUT, "groups": []}
    assert (await api.post("/api/workout-templates", headers=coach, json=bad_group_ref)).status_code == 422
    bad_kind = {**SUPERSET_WORKOUT, "groups": [{"id": "g1", "kind": "tabata"}]}
    assert (await api.post("/api/workout-templates", headers=coach, json=bad_kind)).status_code == 422
    bad_tracking = {**SUPERSET_WORKOUT, "groups": [], "exercises": [{"id": "e", "trackingType": "vibes", "sets": []}]}
    assert (await api.post("/api/workout-templates", headers=coach, json=bad_tracking)).status_code == 422


async def test_exercise_video_must_be_youtube_or_vimeo(api, coach):
    base = {"name": "Goblet Squat", "primaryMuscle": "Quads", "equipment": "Kettlebell", "trackingType": "reps"}
    ok = await api.post("/api/exercises", headers=coach, json={**base, "videoUrl": "https://www.youtube.com/watch?v=abc123"})
    assert ok.status_code == 201 and ok.json()["videoUrl"].startswith("https://www.youtube.com")
    assert ok.json()["trackingType"] == "reps"
    bad = await api.post("/api/exercises", headers=coach, json={**base, "videoUrl": "https://evil.example.com/x.mp4"})
    assert bad.status_code == 422


def weekly_program(weeks=2, days=((1, "Mon"), (3, "Wed"), (8, "Next Mon"))):
    return {
        "title": "Two Week Test",
        "durationWeeks": weeks,
        "days": [
            {"id": f"d{n}", "dayNumber": n, "name": name, "exercises": SUPERSET_WORKOUT["exercises"], "groups": SUPERSET_WORKOUT["groups"]}
            for n, name in days
        ],
    }


async def test_program_days_must_fit_the_program(api, coach):
    too_late = weekly_program(weeks=1)  # day 8 doesn't exist in a 1-week program
    assert (await api.post("/api/programs", headers=coach, json=too_late)).status_code == 422
    prog = (await api.post("/api/programs", headers=coach, json=weekly_program())).json()
    res = await api.patch(f"/api/programs/{prog['id']}", headers=coach, json={"durationWeeks": 1})
    assert res.status_code == 422


async def test_assign_places_workouts_by_day_number_and_unassign_keeps_history(api, coach):
    prog = (await api.post("/api/programs", headers=coach, json=weekly_program())).json()
    start = date.today()
    res = await api.post(f"/api/programs/{prog['id']}/assign", headers=coach,
                         json={"clientId": DEMO_CLIENT_ID, "startDate": start.isoformat()})
    assert res.status_code == 200, res.text

    workouts = (await api.get("/api/workouts", params={"clientId": DEMO_CLIENT_ID}, headers=coach)).json()
    mine = sorted((w for w in workouts if w["programId"] == prog["id"]), key=lambda w: w["date"])
    assert [w["date"] for w in mine] == [(start + timedelta(days=n - 1)).isoformat() for n in (1, 3, 8)]
    assert [w["workoutTitle"] for w in mine] == ["Mon", "Wed", "Next Mon"]
    assert mine[0]["groups"][0]["kind"] == "superset"

    # Complete today's workout, then unassign: the completed one stays, upcoming ones go.
    await api.post(f"/api/workouts/{mine[0]['id']}/complete", headers=coach, json={"rating": 5})
    res = await api.delete(f"/api/programs/{prog['id']}/assign/{DEMO_CLIENT_ID}", headers=coach)
    assert res.json()["removed"] == 2
    left = [w for w in (await api.get("/api/workouts", params={"clientId": DEMO_CLIENT_ID}, headers=coach)).json()
            if w["programId"] == prog["id"]]
    assert [w["status"] for w in left] == ["Completed"]
    client = (await api.get(f"/api/clients/{DEMO_CLIENT_ID}", headers=coach)).json()
    assert client["currentProgramId"] is None


async def test_client_logs_rounds_on_groups(api, coach, client_user):
    scheduled = await api.post("/api/workouts", headers=coach, json={
        "clientId": DEMO_CLIENT_ID, "workoutTitle": "Finisher", "date": date.today().isoformat(),
        "groups": [{"id": "g1", "kind": "amrap", "timeCapMin": 12}],
        "exercises": [{"id": "e1", "exerciseName": "Burpee", "groupId": "g1", "trackingType": "reps", "sets": []}],
    })
    assert scheduled.status_code == 201, scheduled.text
    wid = scheduled.json()["id"]
    res = await api.post(f"/api/workouts/{wid}/complete", headers=client_user,
                         json={"groups": [{"id": "g1", "kind": "amrap", "timeCapMin": 12, "completedRounds": 7}]})
    assert res.status_code == 200, res.text
    assert res.json()["groups"][0]["completedRounds"] == 7
