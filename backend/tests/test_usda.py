"""USDA response parsing, using shapes captured from real FoodData Central responses."""

import pytest

from app.services import usda

SEARCH_RESPONSE = {"foods": [{
    "fdcId": 171844, "description": "Bread, chapati or roti, plain, commercially prepared", "dataType": "SR Legacy",
    "foodNutrients": [
        {"nutrientNumber": "204", "value": 7.45}, {"nutrientNumber": "205", "value": 46.4},
        {"nutrientNumber": "208", "value": 297}, {"nutrientNumber": "203", "value": 11.2},
        {"nutrientNumber": "291", "value": 4.9},
    ],
    "foodMeasures": [],
}]}

DETAIL_RESPONSE = {
    "fdcId": 171844, "description": "Bread, chapati or roti, plain, commercially prepared", "dataType": "SR Legacy",
    "foodNutrients": [
        {"nutrient": {"number": "208"}, "amount": 297.0}, {"nutrient": {"number": "203"}, "amount": 11.25},
        {"nutrient": {"number": "204"}, "amount": 7.45}, {"nutrient": {"number": "205"}, "amount": 46.36},
        {"nutrient": {"number": "291"}, "amount": 4.9},
    ],
    "foodPortions": [{"amount": 1.0, "modifier": "piece", "measureUnit": {"name": "undetermined"}, "gramWeight": 68.0}],
}


@pytest.fixture(autouse=True)
def clear_cache():
    usda._cache.clear()
    yield
    usda._cache.clear()


async def test_search_parsing(monkeypatch):
    async def fake_get(path, params):
        assert params["dataType"] == usda.DATA_TYPES
        return SEARCH_RESPONSE
    monkeypatch.setattr(usda, "_get", fake_get)
    [food] = await usda.search_foods("chapati")
    assert food == {
        "source": "usda", "sourceId": "171844", "name": "Bread, chapati or roti, plain, commercially prepared", "brand": "",
        "per100g": {"calories": 297.0, "protein": 11.2, "fat": 7.45, "carbs": 46.4, "fiber": 4.9},
        "servings": [{"label": "100 g", "grams": 100.0}],
    }


async def test_detail_parsing_includes_household_portions(monkeypatch):
    calls = []

    async def fake_get(path, params):
        calls.append(path)
        return DETAIL_RESPONSE
    monkeypatch.setattr(usda, "_get", fake_get)
    food = await usda.get_food("171844")
    assert food["per100g"]["calories"] == 297.0
    assert food["servings"] == [{"label": "100 g", "grams": 100.0}, {"label": "1 piece", "grams": 68.0}]
    await usda.get_food("171844")
    assert calls == ["/food/171844"]  # second call served from cache


def test_foundation_foods_fall_back_to_atwater_energy():
    nutrients = usda._nutrients_from_search({"foodNutrients": [{"nutrientNumber": "958", "value": 143}]})
    assert nutrients["calories"] == 143
