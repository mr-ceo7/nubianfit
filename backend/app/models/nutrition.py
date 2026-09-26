"""
Nutrition ORM models: custom foods, food diary, client goals, daily water/steps, meal plans.

Diary entries and meal-plan items store a snapshot of the food's nutrition, so editing a
custom food (or USDA revising theirs) never rewrites a client's history.
"""

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import Date, DateTime, Float, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CustomFood(Base):
    """A coach-created food (e.g. local dishes). Nutrition is stored per 100 g."""
    __tablename__ = "custom_foods"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[str] = mapped_column(String(255), default="")
    calories: Mapped[float] = mapped_column(Float, default=0)
    protein: Mapped[float] = mapped_column(Float, default=0)
    carbs: Mapped[float] = mapped_column(Float, default=0)
    fat: Mapped[float] = mapped_column(Float, default=0)
    fiber: Mapped[float] = mapped_column(Float, default=0)
    # [{label, grams}], e.g. [{"label": "1 piece", "grams": 60}]
    servings: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class FoodLogEntry(Base):
    __tablename__ = "food_log_entries"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    meal: Mapped[str] = mapped_column(String(16), nullable=False)  # breakfast | lunch | dinner | snack
    source: Mapped[str] = mapped_column(String(16), nullable=False)  # usda | custom | quick
    source_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    serving_label: Mapped[str] = mapped_column(String(64), default="")
    serving_grams: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    quantity: Mapped[float] = mapped_column(Float, default=1)
    # Totals for this entry (quantity already applied).
    calories: Mapped[float] = mapped_column(Float, default=0)
    protein: Mapped[float] = mapped_column(Float, default=0)
    carbs: Mapped[float] = mapped_column(Float, default=0)
    fat: Mapped[float] = mapped_column(Float, default=0)
    fiber: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class ClientGoals(Base):
    """Daily targets a coach sets for a client. Rest-day macros are optional overrides."""
    __tablename__ = "client_goals"

    client_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    calories: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    protein: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    carbs: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rest_day_calories: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rest_day_protein: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rest_day_carbs: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rest_day_fat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    water_ml: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    steps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class DailyMetric(Base):
    """Water and steps for one client-day."""
    __tablename__ = "daily_metrics"
    __table_args__ = (UniqueConstraint("client_id", "date", name="uq_daily_metrics_client_date"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    water_ml: Mapped[int] = mapped_column(Integer, default=0)
    steps: Mapped[int] = mapped_column(Integer, default=0)


class MealPlan(Base):
    """Sample meal plan: days[] of meals[] of food snapshots, assigned like a program."""
    __tablename__ = "meal_plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    # [{id, dayNumber, meals: [{meal, items: [FoodItem]}]}]
    days: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class MealPlanAssignment(Base):
    """The meal plan a client is currently following. Day 1 falls on start_date and the plan repeats."""
    __tablename__ = "meal_plan_assignments"

    client_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    meal_plan_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
