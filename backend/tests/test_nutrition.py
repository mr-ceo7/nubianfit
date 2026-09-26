"""Phase 2: foods, food diary, goals, water/steps, meal plans, habits."""

from datetime import date, timedelta

import pytest

from app.services import usda
from conftest import DEMO_CLIENT_ID

TODAY = date.today().isoformat()


@pytest.fixture
def fake_usda(monkeypatch):
    async def search(q, page_size=20):
        return [{"source": "usda", "sourceId": "171844", "name": "Bread, chapati or roti", "brand": "",
                 "per100g": {"calories": 297, "protein": 11.2, "carbs": 46.4, "fat": 7.45, "fiber": 4.9},
                 "servings": [{"label": "100 g", "grams": 100}]}]
    monkeypatch.setattr(usda, "search_foods", search)


async def test_search_merges_custom_and_usda(api, client_user, fake_usda):
    res = await api.get("/api/foods/search", params={"q": "chapati"}, headers=client_user)
    assert res.status_code == 200
    results = res.json()["results"]
    assert results[0]["source"] == "custom"  # the coach's own foods come first
    assert any(r["source"] == "usda" for r in results)
    assert results[0]["servings"][0] == {"label": "100 g", "grams": 100}
    assert all("per100g" in r for r in results)


async def test_search_survives_usda_outage(api, coach, monkeypatch):
    async def down(q, page_size=20):
        raise usda.UsdaUnavailable("busy")
    monkeypatch.setattr(usda, "search_foods", down)
    res = (await api.get("/api/foods/search", params={"q": "ugali"}, headers=coach)).json()
    assert res["usdaError"] == "busy"
    assert [r["name"] for r in res["results"]] == ["Ugali (maize meal)"]


async def test_custom_foods_are_per_coach(api, coach, other_coach, client_user):
    body = {"name": "Matoke", "per100g": {"calories": 120, "carbs": 30}, "servings": [{"label": "1 plate", "grams": 300}]}
    created = await api.post("/api/foods/custom", headers=coach, json=body)
    assert created.status_code == 201
    assert created.json()["per100g"]["calories"] == 120
    assert "Matoke" not in [f["name"] for f in (await api.get("/api/foods/custom", headers=other_coach)).json()]
    assert "Matoke" in [f["name"] for f in (await api.get("/api/foods/custom", headers=client_user)).json()]
    assert (await api.post("/api/foods/custom", headers=client_user, json=body)).status_code == 403
    assert (await api.delete(f"/api/foods/custom/{created.json()['sourceId']}", headers=other_coach)).status_code == 404


async def test_food_diary_flow(api, coach, client_user):
    entry = {"clientId": DEMO_CLIENT_ID, "date": TODAY, "meal": "lunch", "source": "custom", "sourceId": "food-ugali",
             "name": "Ugali", "servingLabel": "1 portion", "servingGrams": 250, "quantity": 1,
             "calories": 275, "protein": 6, "carbs": 60, "fat": 1}
    res = await api.post("/api/nutrition/log", headers=client_user, json=entry)
    assert res.status_code == 201, res.text
    entry_id = res.json()["id"]

    # Doubling the quantity rescales the stored totals.
    res = await api.patch(f"/api/nutrition/log/{entry_id}", headers=client_user, json={"quantity": 2})
    assert res.json()["calories"] == 550

    quick = {"clientId": DEMO_CLIENT_ID, "date": TODAY, "meal": "snack", "source": "quick", "name": "Protein bar",
             "calories": 210, "protein": 20}
    assert (await api.post("/api/nutrition/log", headers=client_user, json=quick)).status_code == 201

    log = (await api.get("/api/nutrition/log", params={"clientId": DEMO_CLIENT_ID, "from": TODAY, "to": TODAY}, headers=coach)).json()
    assert {e["name"] for e in log} >= {"Ugali", "Protein bar"}

    assert (await api.delete(f"/api/nutrition/log/{entry_id}", headers=client_user)).status_code == 200


async def test_diary_validation(api, client_user):
    base = {"clientId": DEMO_CLIENT_ID, "date": TODAY, "meal": "lunch", "name": "x"}
    assert (await api.post("/api/nutrition/log", headers=client_user, json={**base, "source": "usda"})).status_code == 422
    assert (await api.post("/api/nutrition/log", headers=client_user, json={**base, "source": "quick", "meal": "brunch"})).status_code == 422
    assert (await api.post("/api/nutrition/log", headers=client_user, json={**base, "source": "quick", "calories": 99999})).status_code == 422


async def test_diary_is_private_to_the_coach(api, other_coach):
    res = await api.get("/api/nutrition/log", params={"clientId": DEMO_CLIENT_ID}, headers=other_coach)
    assert res.status_code == 404
    assert (await api.get("/api/nutrition/log", headers=other_coach)).json() == []


async def test_goals_set_by_coach_read_by_client(api, coach, client_user):
    res = await api.put(f"/api/nutrition/goals/{DEMO_CLIENT_ID}", headers=coach,
                        json={"calories": 2800, "protein": 190, "carbs": 310, "fat": 85, "waterMl": 3500, "steps": 12000})
    assert res.status_code == 200
    mine = (await api.get("/api/nutrition/goals", headers=client_user)).json()
    assert mine[0]["calories"] == 2800 and mine[0]["waterMl"] == 3500
    assert (await api.put(f"/api/nutrition/goals/{DEMO_CLIENT_ID}", headers=client_user, json={"calories": 5000})).status_code == 403


async def test_water_and_steps_upsert(api, client_user):
    await api.put("/api/nutrition/daily", headers=client_user, json={"clientId": DEMO_CLIENT_ID, "date": TODAY, "waterMl": 500})
    res = await api.put("/api/nutrition/daily", headers=client_user, json={"clientId": DEMO_CLIENT_ID, "date": TODAY, "steps": 8000})
    assert res.json()["waterMl"] == 500 and res.json()["steps"] == 8000
    today = [d for d in (await api.get("/api/nutrition/daily", headers=client_user)).json() if d["date"] == TODAY]
    assert len(today) == 1


async def test_meal_plans(api, coach, other_coach, client_user):
    item = {"source": "custom", "sourceId": "food-eggs", "name": "Eggs", "servingLabel": "1 egg", "servingGrams": 50,
            "quantity": 3, "calories": 232, "protein": 19, "carbs": 2, "fat": 16}
    body = {"title": "Cut", "days": [{"id": "d1", "dayNumber": 1, "meals": [{"meal": "breakfast", "items": [item]}]}]}
    res = await api.post("/api/meal-plans", headers=coach, json=body)
    assert res.status_code == 201, res.text
    plan = res.json()
    assert plan["days"][0]["meals"][0]["items"][0]["sourceId"] == "food-eggs"

    dup = {**body, "days": body["days"] * 2}
    assert (await api.post("/api/meal-plans", headers=coach, json=dup)).status_code == 422

    start = (date.today() + timedelta(days=1)).isoformat()
    res = await api.post(f"/api/meal-plans/{plan['id']}/assign", headers=coach, json={"clientId": DEMO_CLIENT_ID, "startDate": start})
    assert res.json() == {"clientId": DEMO_CLIENT_ID, "mealPlanId": plan["id"], "startDate": start}

    # The client sees only their assigned plan; other coaches see none of these.
    assert [p["id"] for p in (await api.get("/api/meal-plans", headers=client_user)).json()] == [plan["id"]]
    assert (await api.get("/api/meal-plans", headers=other_coach)).json() == []
    assert (await api.post(f"/api/meal-plans/{plan['id']}/assign", headers=other_coach, json={"clientId": DEMO_CLIENT_ID})).status_code == 404

    await api.delete(f"/api/meal-plans/assignments/{DEMO_CLIENT_ID}", headers=coach)
    assert (await api.get("/api/meal-plans", headers=client_user)).json() == []


async def test_habits_and_checkins(api, coach, client_user, other_coach):
    res = await api.post("/api/habits", headers=coach, json={
        "clientId": DEMO_CLIENT_ID, "title": "Walk after dinner", "targetValue": 20, "unit": "min", "daysOfWeek": [7, 1, 1],
    })
    assert res.status_code == 201, res.text
    habit = res.json()
    assert habit["daysOfWeek"] == [1, 7]
    assert (await api.post("/api/habits", headers=coach, json={"clientId": DEMO_CLIENT_ID, "title": "x", "daysOfWeek": [8]})).status_code == 422
    assert (await api.post("/api/habits", headers=client_user, json={"clientId": DEMO_CLIENT_ID, "title": "x"})).status_code == 403

    await api.put("/api/habits/checkins", headers=client_user, json={"habitId": habit["id"], "date": TODAY})
    res = await api.put("/api/habits/checkins", headers=client_user, json={"habitId": habit["id"], "date": TODAY, "completed": False})
    assert res.json()["completed"] is False
    mine = [c for c in (await api.get("/api/habits/checkins", headers=client_user)).json() if c["habitId"] == habit["id"]]
    assert len(mine) == 1

    assert (await api.put("/api/habits/checkins", headers=other_coach, json={"habitId": habit["id"], "date": TODAY})).status_code == 404
    assert (await api.delete(f"/api/habits/{habit['id']}", headers=coach)).status_code == 200


async def test_deleting_client_removes_nutrition_data(api, coach):
    assert (await api.delete(f"/api/clients/{DEMO_CLIENT_ID}", headers=coach)).status_code == 200
    for path in ("/api/nutrition/log", "/api/nutrition/daily", "/api/habits", "/api/nutrition/goals", "/api/meal-plans/assignments"):
        assert all(row.get("clientId") != DEMO_CLIENT_ID for row in (await api.get(path, headers=coach)).json()), path
