"""
Nutrition schemas
"""

from datetime import date
from typing import List, Literal, Optional
from pydantic import Field, model_validator

from app.schemas.common import CamelModel, UtcDatetime

Meal = Literal["breakfast", "lunch", "dinner", "snack"]
Source = Literal["usda", "custom", "quick"]

# Generous upper bounds that still catch typos (e.g. 20000 kcal for one entry).
MAX_KCAL = 10000
MAX_GRAMS = 5000


class Serving(CamelModel):
    label: str = Field(min_length=1, max_length=64)
    grams: float = Field(gt=0, le=MAX_GRAMS)


class Nutrients(CamelModel):
    calories: float = Field(default=0, ge=0, le=MAX_KCAL)
    protein: float = Field(default=0, ge=0, le=1000)
    carbs: float = Field(default=0, ge=0, le=1000)
    fat: float = Field(default=0, ge=0, le=1000)
    fiber: float = Field(default=0, ge=0, le=500)


class FoodResult(CamelModel):
    """A searchable food from USDA or the coach's custom list, normalised per 100 g."""
    source: Literal["usda", "custom"]
    source_id: str
    name: str
    brand: str = ""
    # Explicit alias: the camelCase generator would produce "per100G".
    per100g: Nutrients = Field(alias="per100g")
    servings: List[Serving]


class CustomFoodCreate(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    brand: str = Field(default="", max_length=255)
    per100g: Nutrients = Field(alias="per100g")
    servings: List[Serving] = Field(default_factory=list)


class CustomFoodUpdate(CamelModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    brand: Optional[str] = Field(default=None, max_length=255)
    per100g: Optional[Nutrients] = Field(default=None, alias="per100g")
    servings: Optional[List[Serving]] = None


class FoodItem(Nutrients):
    """A food with a portion and the totals for that portion (used in the diary and meal plans)."""
    source: Source
    source_id: Optional[str] = None
    name: str = Field(min_length=1, max_length=255)
    serving_label: str = Field(default="", max_length=64)
    serving_grams: Optional[float] = Field(default=None, gt=0, le=MAX_GRAMS)
    quantity: float = Field(default=1, gt=0, le=100)

    @model_validator(mode="after")
    def check_reference(self):
        if self.source in ("usda", "custom") and not self.source_id:
            raise ValueError("Foods from the database need a sourceId")
        return self


class FoodLogCreate(FoodItem):
    client_id: str
    date: date
    meal: Meal


class FoodLogUpdate(CamelModel):
    meal: Optional[Meal] = None
    quantity: Optional[float] = Field(default=None, gt=0, le=100)
    calories: Optional[float] = Field(default=None, ge=0, le=MAX_KCAL)
    protein: Optional[float] = Field(default=None, ge=0, le=1000)
    carbs: Optional[float] = Field(default=None, ge=0, le=1000)
    fat: Optional[float] = Field(default=None, ge=0, le=1000)
    fiber: Optional[float] = Field(default=None, ge=0, le=500)


class FoodLogResponse(FoodItem):
    id: str
    client_id: str
    date: date
    meal: Meal
    created_at: UtcDatetime


class GoalsBody(CamelModel):
    calories: Optional[float] = Field(default=None, ge=0, le=MAX_KCAL)
    protein: Optional[float] = Field(default=None, ge=0, le=1000)
    carbs: Optional[float] = Field(default=None, ge=0, le=1000)
    fat: Optional[float] = Field(default=None, ge=0, le=1000)
    rest_day_calories: Optional[float] = Field(default=None, ge=0, le=MAX_KCAL)
    rest_day_protein: Optional[float] = Field(default=None, ge=0, le=1000)
    rest_day_carbs: Optional[float] = Field(default=None, ge=0, le=1000)
    rest_day_fat: Optional[float] = Field(default=None, ge=0, le=1000)
    water_ml: Optional[int] = Field(default=None, ge=0, le=20000)
    steps: Optional[int] = Field(default=None, ge=0, le=200000)
    notes: str = Field(default="", max_length=2000)


class GoalsResponse(GoalsBody):
    client_id: str


class DailyMetricUpsert(CamelModel):
    client_id: str
    date: date
    water_ml: Optional[int] = Field(default=None, ge=0, le=20000)
    steps: Optional[int] = Field(default=None, ge=0, le=200000)


class DailyMetricResponse(CamelModel):
    id: str
    client_id: str
    date: date
    water_ml: int
    steps: int


class MealPlanMeal(CamelModel):
    meal: Meal
    items: List[FoodItem] = Field(default_factory=list)


class MealPlanDay(CamelModel):
    id: str
    day_number: int = Field(ge=1, le=28)
    meals: List[MealPlanMeal] = Field(default_factory=list)


class MealPlanBody(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    days: List[MealPlanDay] = Field(default_factory=list)

    @model_validator(mode="after")
    def unique_days(self):
        numbers = [d.day_number for d in self.days]
        if len(numbers) != len(set(numbers)):
            raise ValueError("Each meal plan day number can appear only once")
        return self


class MealPlanResponse(MealPlanBody):
    id: str
    created_at: UtcDatetime
    updated_at: UtcDatetime


class MealPlanAssign(CamelModel):
    client_id: str
    start_date: Optional[date] = None


class MealPlanAssignmentResponse(CamelModel):
    client_id: str
    meal_plan_id: str
    start_date: date
