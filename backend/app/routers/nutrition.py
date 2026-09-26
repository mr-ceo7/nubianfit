"""
Food diary, client goals, daily water/steps, and meal plans.
"""

from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_accessible_client, get_current_user, get_db, require_coach, resolve_client_filter
from app.models.client import Client
from app.models.nutrition import ClientGoals, DailyMetric, FoodLogEntry, MealPlan, MealPlanAssignment
from app.models.user import User
from app.schemas.nutrition import (
    DailyMetricResponse, DailyMetricUpsert, FoodLogCreate, FoodLogResponse, FoodLogUpdate, GoalsBody, GoalsResponse,
    MealPlanAssign, MealPlanAssignmentResponse, MealPlanBody, MealPlanResponse,
)
from app.services.activity import new_id

router = APIRouter(tags=["Nutrition"])

DEFAULT_HISTORY_DAYS = 35


def _date_range(date_from: Optional[date], date_to: Optional[date]) -> tuple[date, date]:
    to = date_to or date.today() + timedelta(days=1)
    frm = date_from or to - timedelta(days=DEFAULT_HISTORY_DAYS)
    if (to - frm).days > 366:
        raise HTTPException(status_code=400, detail="Date range can't exceed one year")
    return frm, to


# --- Goals -------------------------------------------------------------------

@router.get("/nutrition/goals", response_model=List[GoalsResponse])
async def list_goals(
    client_id: Optional[str] = Query(None, alias="clientId"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = await resolve_client_filter(client_id, user, db)
    return (await db.execute(select(ClientGoals).where(ClientGoals.client_id.in_(ids)))).scalars().all()


@router.put("/nutrition/goals/{client_id}", response_model=GoalsResponse)
async def set_goals(client_id: str, body: GoalsBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    await get_accessible_client(client_id, coach, db)
    goals = await db.get(ClientGoals, client_id)
    if not goals:
        goals = ClientGoals(client_id=client_id)
        db.add(goals)
    for field, value in body.model_dump().items():
        setattr(goals, field, value)
    goals.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return goals


# --- Food diary --------------------------------------------------------------

@router.get("/nutrition/log", response_model=List[FoodLogResponse])
async def list_food_log(
    client_id: Optional[str] = Query(None, alias="clientId"),
    date_from: Optional[date] = Query(None, alias="from"),
    date_to: Optional[date] = Query(None, alias="to"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = await resolve_client_filter(client_id, user, db)
    frm, to = _date_range(date_from, date_to)
    result = await db.execute(
        select(FoodLogEntry)
        .where(FoodLogEntry.client_id.in_(ids), FoodLogEntry.date >= frm, FoodLogEntry.date <= to)
        .order_by(FoodLogEntry.date, FoodLogEntry.created_at)
    )
    return result.scalars().all()


@router.post("/nutrition/log", response_model=FoodLogResponse, status_code=status.HTTP_201_CREATED)
async def add_food(body: FoodLogCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await get_accessible_client(body.client_id, user, db)
    entry = FoodLogEntry(id=new_id("food-log"), **body.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def _get_entry(entry_id: str, user: User, db: AsyncSession) -> FoodLogEntry:
    entry = await db.get(FoodLogEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await get_accessible_client(entry.client_id, user, db)
    return entry


@router.patch("/nutrition/log/{entry_id}", response_model=FoodLogResponse)
async def update_food(entry_id: str, body: FoodLogUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    entry = await _get_entry(entry_id, user, db)
    changes = body.model_dump(exclude_unset=True)
    # Changing the quantity rescales the stored totals unless new totals were sent explicitly.
    if "quantity" in changes and not {"calories", "protein", "carbs", "fat", "fiber"} & changes.keys():
        factor = changes["quantity"] / (entry.quantity or 1)
        for field in ("calories", "protein", "carbs", "fat", "fiber"):
            setattr(entry, field, round(getattr(entry, field) * factor, 2))
    for field, value in changes.items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/nutrition/log/{entry_id}")
async def delete_food(entry_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    entry = await _get_entry(entry_id, user, db)
    await db.delete(entry)
    await db.commit()
    return {"message": "Entry deleted", "id": entry_id}


# --- Water & steps -----------------------------------------------------------

@router.get("/nutrition/daily", response_model=List[DailyMetricResponse])
async def list_daily(
    client_id: Optional[str] = Query(None, alias="clientId"),
    date_from: Optional[date] = Query(None, alias="from"),
    date_to: Optional[date] = Query(None, alias="to"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = await resolve_client_filter(client_id, user, db)
    frm, to = _date_range(date_from, date_to)
    result = await db.execute(
        select(DailyMetric).where(DailyMetric.client_id.in_(ids), DailyMetric.date >= frm, DailyMetric.date <= to).order_by(DailyMetric.date)
    )
    return result.scalars().all()


@router.put("/nutrition/daily", response_model=DailyMetricResponse)
async def upsert_daily(body: DailyMetricUpsert, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await get_accessible_client(body.client_id, user, db)
    metric = (await db.execute(
        select(DailyMetric).where(DailyMetric.client_id == body.client_id, DailyMetric.date == body.date)
    )).scalar_one_or_none()
    if not metric:
        metric = DailyMetric(id=new_id("daily"), client_id=body.client_id, date=body.date, water_ml=0, steps=0)
        db.add(metric)
    if body.water_ml is not None:
        metric.water_ml = body.water_ml
    if body.steps is not None:
        metric.steps = body.steps
    await db.commit()
    await db.refresh(metric)
    return metric


# --- Meal plans --------------------------------------------------------------

def _plan_days(body: MealPlanBody) -> list:
    return [d.model_dump(by_alias=True, exclude_none=True) for d in sorted(body.days, key=lambda d: d.day_number)]


async def _get_own_plan(plan_id: str, coach: User, db: AsyncSession) -> MealPlan:
    plan = await db.get(MealPlan, plan_id)
    if not plan or plan.coach_id != coach.id:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    return plan


@router.get("/meal-plans", response_model=List[MealPlanResponse])
async def list_meal_plans(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Coaches get their plans; a client gets only the plan assigned to them."""
    if user.role == "coach":
        query = select(MealPlan).where(MealPlan.coach_id == user.id).order_by(MealPlan.title)
    else:
        assignment = await db.get(MealPlanAssignment, user.client_id) if user.client_id else None
        if not assignment:
            return []
        query = select(MealPlan).where(MealPlan.id == assignment.meal_plan_id)
    return (await db.execute(query)).scalars().all()


@router.post("/meal-plans", response_model=MealPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_meal_plan(body: MealPlanBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    plan = MealPlan(id=new_id("mealplan"), coach_id=coach.id, title=body.title.strip(), description=body.description, days=_plan_days(body))
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.put("/meal-plans/{plan_id}", response_model=MealPlanResponse)
async def update_meal_plan(plan_id: str, body: MealPlanBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    plan = await _get_own_plan(plan_id, coach, db)
    plan.title = body.title.strip()
    plan.description = body.description
    plan.days = _plan_days(body)
    plan.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.delete("/meal-plans/{plan_id}")
async def delete_meal_plan(plan_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    plan = await _get_own_plan(plan_id, coach, db)
    await db.execute(delete(MealPlanAssignment).where(MealPlanAssignment.meal_plan_id == plan.id))
    await db.delete(plan)
    await db.commit()
    return {"message": "Meal plan deleted", "id": plan_id}


@router.get("/meal-plans/assignments", response_model=List[MealPlanAssignmentResponse])
async def list_assignments(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ids = await resolve_client_filter(None, user, db)
    return (await db.execute(select(MealPlanAssignment).where(MealPlanAssignment.client_id.in_(ids)))).scalars().all()


@router.post("/meal-plans/{plan_id}/assign", response_model=MealPlanAssignmentResponse)
async def assign_meal_plan(plan_id: str, body: MealPlanAssign, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    plan = await _get_own_plan(plan_id, coach, db)
    await get_accessible_client(body.client_id, coach, db)
    assignment = await db.get(MealPlanAssignment, body.client_id)
    if not assignment:
        assignment = MealPlanAssignment(client_id=body.client_id, meal_plan_id=plan.id, start_date=body.start_date or date.today())
        db.add(assignment)
    else:
        assignment.meal_plan_id = plan.id
        assignment.start_date = body.start_date or date.today()
    await db.commit()
    return assignment


@router.delete("/meal-plans/assignments/{client_id}")
async def unassign_meal_plan(client_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    await get_accessible_client(client_id, coach, db)
    await db.execute(delete(MealPlanAssignment).where(MealPlanAssignment.client_id == client_id))
    await db.commit()
    return {"message": "Meal plan removed"}
