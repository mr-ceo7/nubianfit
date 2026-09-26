"""
Food search (USDA FoodData Central + the coach's custom foods) and custom food management.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_coach
from app.models.client import Client
from app.models.nutrition import CustomFood
from app.models.user import User
from app.rate_limiter import rate_limit
from app.schemas.nutrition import CustomFoodCreate, CustomFoodUpdate, FoodResult
from app.services import usda
from app.services.activity import new_id

router = APIRouter(prefix="/foods", tags=["Foods"])


def to_result(food: CustomFood) -> FoodResult:
    return FoodResult(
        source="custom",
        source_id=food.id,
        name=food.name,
        brand=food.brand or "",
        per100g={"calories": food.calories, "protein": food.protein, "carbs": food.carbs, "fat": food.fat, "fiber": food.fiber},
        servings=[{"label": "100 g", "grams": 100}, *(food.servings or [])],
    )


async def _food_owner_id(user: User, db: AsyncSession) -> Optional[str]:
    """Coaches own their custom foods; clients see their coach's."""
    if user.role == "coach":
        return user.id
    client = await db.get(Client, user.client_id) if user.client_id else None
    return client.coach_id if client else None


async def _get_own(food_id: str, coach: User, db: AsyncSession) -> CustomFood:
    food = await db.get(CustomFood, food_id)
    if not food or food.coach_id != coach.id:
        raise HTTPException(status_code=404, detail="Food not found")
    return food


@router.get("/search", dependencies=[Depends(rate_limit(60, 60, "food-search"))])
async def search_foods(
    q: str = Query(min_length=2, max_length=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Custom foods first (they're usually what the coach wants), then USDA matches."""
    owner = await _food_owner_id(user, db)
    custom = (await db.execute(
        select(CustomFood).where(CustomFood.coach_id == owner, CustomFood.name.ilike(f"%{q}%")).order_by(CustomFood.name).limit(20)
    )).scalars().all()
    results = [to_result(f).model_dump(by_alias=True) for f in custom]
    usda_error = None
    try:
        results += await usda.search_foods(q)
    except usda.UsdaUnavailable as e:
        usda_error = str(e)
    return {"results": results, "usdaError": usda_error}


@router.get("/usda/{fdc_id}", response_model=FoodResult)
async def usda_food(fdc_id: str, user: User = Depends(get_current_user)):
    """Full USDA record, including household portions (e.g. '1 piece = 68 g')."""
    if not fdc_id.isdigit():
        raise HTTPException(status_code=404, detail="Food not found")
    try:
        return await usda.get_food(fdc_id)
    except usda.UsdaUnavailable as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@router.get("/custom", response_model=List[FoodResult])
async def list_custom_foods(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    owner = await _food_owner_id(user, db)
    foods = (await db.execute(select(CustomFood).where(CustomFood.coach_id == owner).order_by(CustomFood.name))).scalars().all()
    return [to_result(f) for f in foods]


@router.post("/custom", response_model=FoodResult, status_code=status.HTTP_201_CREATED)
async def create_custom_food(body: CustomFoodCreate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    food = CustomFood(
        id=new_id("food"),
        coach_id=coach.id,
        name=body.name.strip(),
        brand=body.brand.strip(),
        **body.per100g.model_dump(),
        servings=[s.model_dump(by_alias=True) for s in body.servings if s.label != "100 g"],
    )
    db.add(food)
    await db.commit()
    return to_result(food)


@router.patch("/custom/{food_id}", response_model=FoodResult)
async def update_custom_food(food_id: str, body: CustomFoodUpdate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    food = await _get_own(food_id, coach, db)
    if body.name is not None:
        food.name = body.name.strip()
    if body.brand is not None:
        food.brand = body.brand.strip()
    if body.per100g is not None:
        for k, v in body.per100g.model_dump().items():
            setattr(food, k, v)
    if body.servings is not None:
        food.servings = [s.model_dump(by_alias=True) for s in body.servings if s.label != "100 g"]
    await db.commit()
    return to_result(food)


@router.delete("/custom/{food_id}")
async def delete_custom_food(food_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    food = await _get_own(food_id, coach, db)
    await db.delete(food)
    await db.commit()
    return {"message": "Food deleted", "id": food_id}
