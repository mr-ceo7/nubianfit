"""
USDA FoodData Central client.

Foods are normalised to the shape the app uses everywhere:
  {source, sourceId, name, brand, per100g: {calories, protein, carbs, fat, fiber}, servings: [{label, grams}]}
Responses are cached in memory because the API is rate limited.
"""

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from urllib.parse import quote, urlencode

import httpx

from app.config import settings

logger = logging.getLogger("nubianfit.usda")

BASE_URL = "https://api.nal.usda.gov/fdc/v1"
# Generic foods only: Branded is dominated by US packaged products.
DATA_TYPES = "Foundation,SR Legacy,Survey (FNDDS)"
CACHE_TTL_SECONDS = 24 * 3600
CACHE_MAX_ENTRIES = 2000

# FDC nutrient numbers. Foundation foods sometimes report energy only as Atwater factors (957/958).
ENERGY_NUMBERS = ("208", "957", "958")
MACRO_NUMBERS = {"protein": "203", "fat": "204", "carbs": "205", "fiber": "291"}

_cache: Dict[str, Tuple[float, Any]] = {}


class UsdaUnavailable(Exception):
    pass


def _cached(key: str):
    hit = _cache.get(key)
    if hit and hit[0] > time.monotonic():
        return hit[1]
    return None


def _store(key: str, value: Any) -> None:
    if len(_cache) >= CACHE_MAX_ENTRIES:
        _cache.pop(next(iter(_cache)))
    _cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, value)


async def _get(path: str, params: Dict[str, Any]) -> Any:
    try:
        # FDC rejects percent-encoded parentheses (as in "Survey (FNDDS)"), so keep them literal.
        query = urlencode({**params, "api_key": settings.FDC_API_KEY}, safe="(),", quote_via=quote)
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(f"{BASE_URL}{path}?{query}")
        if res.status_code == 429:
            raise UsdaUnavailable("The food database is busy. Try again in a minute, or use your custom foods.")
        res.raise_for_status()
        return res.json()
    except httpx.HTTPError as e:
        logger.warning("USDA request %s failed: %s", path, e)
        raise UsdaUnavailable("The food database is unavailable right now.") from e


def _round(value: Optional[float]) -> float:
    return round(float(value or 0), 2)


def _nutrients_from_search(food: Dict[str, Any]) -> Dict[str, float]:
    by_number = {n.get("nutrientNumber"): n.get("value") for n in food.get("foodNutrients", [])}
    energy = next((by_number[n] for n in ENERGY_NUMBERS if by_number.get(n) is not None), 0)
    return {"calories": _round(energy), **{k: _round(by_number.get(num)) for k, num in MACRO_NUMBERS.items()}}


def _nutrients_from_detail(food: Dict[str, Any]) -> Dict[str, float]:
    by_number = {
        (n.get("nutrient") or {}).get("number"): n.get("amount")
        for n in food.get("foodNutrients", [])
    }
    energy = next((by_number[n] for n in ENERGY_NUMBERS if by_number.get(n) is not None), 0)
    return {"calories": _round(energy), **{k: _round(by_number.get(num)) for k, num in MACRO_NUMBERS.items()}}


def _portion_label(p: Dict[str, Any]) -> Optional[str]:
    if p.get("portionDescription") and p["portionDescription"] != "Quantity not specified":
        return p["portionDescription"]
    amount = p.get("amount")
    unit = p.get("modifier") or (p.get("measureUnit") or {}).get("name")
    if unit in (None, "", "undetermined"):
        return None
    amount_text = f"{amount:g} " if isinstance(amount, (int, float)) else ""
    return f"{amount_text}{unit}".strip()


def _servings(portions: List[Tuple[Optional[str], Optional[float]]]) -> List[Dict[str, Any]]:
    servings = [{"label": "100 g", "grams": 100.0}]
    seen = {"100 g"}
    for label, grams in portions:
        if label and grams and label not in seen:
            servings.append({"label": label, "grams": _round(grams)})
            seen.add(label)
    return servings


def _normalise(food: Dict[str, Any], nutrients: Dict[str, float], servings: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "source": "usda",
        "sourceId": str(food["fdcId"]),
        "name": food.get("description", "").strip(),
        "brand": food.get("brandOwner") or "",
        "per100g": nutrients,
        "servings": servings,
    }


async def search_foods(query: str, page_size: int = 20) -> List[Dict[str, Any]]:
    key = f"search:{query.lower()}:{page_size}"
    if (hit := _cached(key)) is not None:
        return hit
    data = await _get("/foods/search", {"query": query, "pageSize": page_size, "dataType": DATA_TYPES})
    results = []
    for food in data.get("foods", []):
        measures = [(m.get("disseminationText"), m.get("gramWeight")) for m in food.get("foodMeasures", [])]
        results.append(_normalise(food, _nutrients_from_search(food), _servings(measures)))
    _store(key, results)
    return results


async def get_food(fdc_id: str) -> Dict[str, Any]:
    key = f"food:{fdc_id}"
    if (hit := _cached(key)) is not None:
        return hit
    food = await _get(f"/food/{fdc_id}", {})
    portions = [(_portion_label(p), p.get("gramWeight")) for p in food.get("foodPortions", [])]
    result = _normalise(food, _nutrients_from_detail(food), _servings(portions))
    _store(key, result)
    return result
