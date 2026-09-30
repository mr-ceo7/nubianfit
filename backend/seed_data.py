"""
Database Seeding Script for NubianFit Platform
Populates SQLite / Postgres database with initial clients, exercises, programs, workouts, metrics, PRs, habits, photos, messages, and default coach account.
"""

import asyncio
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from app.database import engine, AsyncSessionLocal, Base
from app.config import settings
from app.security import get_password_hash
from app.models import (
    User,
    Client,
    Exercise,
    TrainingProgram,
    ScheduledWorkout,
    MetricEntry,
    PersonalRecord,
    Habit,
    HabitCheckin,
    CustomFood,
    FoodLogEntry,
    ClientGoals,
    DailyMetric,
    MealPlan,
    MealPlanAssignment,
    ProgressPhoto,
    ChatMessage,
    ActivityFeedItem,
    CheckinForm,
    CheckinAssignment,
    CheckinResponse,
    CommunityGroup,
    GroupMember,
    GroupPost,
    PostComment,
    GroupMessage,
    Autoflow,
    PayoutAccount,
    Package,
    Subscription,
    Payment,
    PaymentRequest,
)


SEED_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_data.json")
DEMO_COACH_ID = "coach-1"

# seed_data.json was written as if "today" were this date. Demo dates are shifted by
# (real today - anchor) so scheduled workouts are always upcoming and history stays recent.
SEED_ANCHOR_DATE = date(2026, 8, 16)


# Weekday slots (1 = Monday) used to spread a program's training days across each week.
WEEKLY_PATTERNS = {1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6]}


def _weekly_program_days(program: dict) -> list:
    """seed_data.json lists one week's training days; lay them out on the calendar for every week."""
    templates = program.get("days", [])
    weeks = int(program.get("durationWeeks", 8))
    slots = WEEKLY_PATTERNS.get(len(templates), list(range(1, len(templates) + 1)))
    days = []
    for week in range(weeks):
        for template, weekday in zip(templates, slots):
            days.append({
                **template,
                "id": f"{template['id']}-w{week + 1}",
                "dayNumber": week * 7 + weekday,
                "exercises": [{"section": "main", "trackingType": "reps_weight", **ex} for ex in template.get("exercises", [])],
                "groups": template.get("groups", []),
            })
    return days


def _shift(value: str, offset: timedelta) -> str:
    """Shift a YYYY-MM-DD string by offset; leave anything else untouched."""
    try:
        return (date.fromisoformat(value) + offset).isoformat()
    except (TypeError, ValueError):
        return value


def _load_seed_json() -> dict:
    with open(SEED_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


async def seed_exercise_library() -> None:
    """Insert any missing global library exercises. Safe to run in every environment."""
    data = _load_seed_json()
    async with AsyncSessionLocal() as session:
        existing = set((await session.execute(select(Exercise.id))).scalars().all())
        added = 0
        for item in data.get("exercises", []):
            if item["id"] in existing:
                continue
            session.add(Exercise(
                id=item["id"],
                coach_id=None,
                name=item["name"],
                primary_muscle=item["primaryMuscle"],
                secondary_muscles=item.get("secondaryMuscles", []),
                equipment=item["equipment"],
                difficulty=item.get("difficulty", "Intermediate"),
                category=item.get("category", "Strength"),
                description=item.get("description", ""),
                instructions=item.get("instructions", []),
                form_cues=item.get("formCues", []),
                demo_video_placeholder_url=item.get("demoVideoPlaceholderUrl"),
                thumbnail_url=item.get("thumbnailUrl", ""),
                is_custom=False,
            ))
            added += 1
        await session.commit()
        if added:
            print(f"-> Added {added} library exercises")


# Approximate values for common Kenyan dishes (per 100 g), for demo data only.
DEMO_FOODS = [
    ("food-ugali", "Ugali (maize meal)", 110, 2.4, 24.0, 0.4, 1.2, [("1 portion", 250)]),
    ("food-sukuma", "Sukuma wiki (sautéed kale)", 60, 2.9, 6.5, 3.0, 2.6, [("1 cup", 130)]),
    ("food-chapati", "Chapati", 300, 8.0, 46.0, 9.0, 3.0, [("1 piece", 70)]),
    ("food-githeri", "Githeri (maize & beans)", 130, 6.0, 22.0, 1.8, 5.0, [("1 cup", 200)]),
    ("food-nyama", "Nyama choma (grilled goat)", 230, 27.0, 0.0, 13.0, 0.0, [("1 portion", 200)]),
    ("food-mandazi", "Mandazi", 380, 6.5, 48.0, 18.0, 1.5, [("1 piece", 50)]),
    ("food-chai", "Chai (milk tea with sugar)", 55, 1.8, 8.0, 1.7, 0.0, [("1 cup", 250)]),
    ("food-eggs", "Boiled eggs", 155, 12.6, 1.1, 10.6, 0.0, [("1 egg", 50)]),
]

GOALS_BY_CLIENT_GOAL = {
    "Hypertrophy": (2700, 180, 300, 80),
    "Fat Loss": (1700, 130, 160, 55),
    "Strength & Power": (3100, 200, 340, 100),
    "Rehabilitation": (2000, 120, 220, 65),
    "Athletic Conditioning": (2600, 160, 310, 75),
    "Endurance": (2300, 110, 320, 65),
}

DEMO_HABITS = [
    ("Hit protein target", None, "g", []),
    ("Sleep 7.5+ hours", 7.5, "hrs", []),
    ("Mobility / foam rolling", 10, "min", [1, 3, 5]),
    ("No sugary drinks", None, "", []),
]


def _food_item(food_id: str, servings: float, serving_index: int = 0) -> dict:
    """Diary/meal-plan snapshot for `servings` of a DEMO_FOODS entry's serving."""
    fid, name, kcal, protein, carbs, fat, fiber, portions = next(f for f in DEMO_FOODS if f[0] == food_id)
    label, grams = portions[serving_index]
    factor = grams * servings / 100
    return {
        "source": "custom", "sourceId": fid, "name": name, "servingLabel": label, "servingGrams": grams,
        "quantity": servings, "calories": round(kcal * factor, 1), "protein": round(protein * factor, 1),
        "carbs": round(carbs * factor, 1), "fat": round(fat * factor, 1), "fiber": round(fiber * factor, 1),
    }


def _seed_nutrition_and_habits(session, clients: list, today: date) -> None:
    for fid, name, kcal, protein, carbs, fat, fiber, portions in DEMO_FOODS:
        session.add(CustomFood(
            id=fid, coach_id=DEMO_COACH_ID, name=name, calories=kcal, protein=protein, carbs=carbs, fat=fat,
            fiber=fiber, servings=[{"label": label, "grams": grams} for label, grams in portions],
        ))

    for c in clients:
        kcal, protein, carbs, fat = GOALS_BY_CLIENT_GOAL.get(c.get("goal"), (2200, 140, 250, 70))
        session.add(ClientGoals(
            client_id=c["id"], calories=kcal, protein=protein, carbs=carbs, fat=fat,
            rest_day_calories=kcal - 300, rest_day_carbs=carbs - 75, water_ml=3000, steps=10000,
        ))
        for order, (title, target, unit, days) in enumerate(DEMO_HABITS):
            habit_id = f"habit-{c['id']}-{order}"
            session.add(Habit(id=habit_id, client_id=c["id"], title=title, target_value=target, unit=unit,
                              days_of_week=days, active=True, sort_order=order))
            # A believable streak: most habits done on most of the last 6 days.
            for back in range(1, 7):
                d = today - timedelta(days=back)
                if days and d.isoweekday() not in days:
                    continue
                if (back + order) % 4 != 0:
                    session.add(HabitCheckin(id=f"chk-{habit_id}-{back}", habit_id=habit_id, client_id=c["id"],
                                             date=d, completed=True))

    # Marcus (client-1): a few days of diary, water and steps, and a meal plan.
    days_of_food = {
        1: [("breakfast", "food-chai", 1), ("breakfast", "food-eggs", 3), ("lunch", "food-ugali", 1), ("lunch", "food-sukuma", 1),
            ("lunch", "food-nyama", 1), ("snack", "food-mandazi", 2), ("dinner", "food-githeri", 2)],
        0: [("breakfast", "food-chai", 1), ("breakfast", "food-chapati", 2), ("breakfast", "food-eggs", 2),
            ("lunch", "food-ugali", 1), ("lunch", "food-nyama", 1)],
    }
    for back, entries in days_of_food.items():
        for n, (meal, food_id, servings) in enumerate(entries):
            item = _food_item(food_id, servings)
            session.add(FoodLogEntry(
                id=f"food-log-demo-{back}-{n}", client_id="client-1", date=today - timedelta(days=back), meal=meal,
                source=item["source"], source_id=item["sourceId"], name=item["name"], serving_label=item["servingLabel"],
                serving_grams=item["servingGrams"], quantity=servings, calories=item["calories"], protein=item["protein"],
                carbs=item["carbs"], fat=item["fat"], fiber=item["fiber"],
            ))
    for back, (water, steps) in enumerate([(1500, 4200), (3250, 11800), (2750, 9100), (3500, 12400), (2000, 7600)]):
        session.add(DailyMetric(id=f"daily-demo-{back}", client_id="client-1", date=today - timedelta(days=back),
                                water_ml=water, steps=steps))

    plan_days = [
        {"id": "mp-day-1", "dayNumber": 1, "meals": [
            {"meal": "breakfast", "items": [_food_item("food-chai", 1), _food_item("food-eggs", 3), _food_item("food-chapati", 1)]},
            {"meal": "lunch", "items": [_food_item("food-ugali", 1), _food_item("food-sukuma", 1), _food_item("food-nyama", 1)]},
            {"meal": "dinner", "items": [_food_item("food-githeri", 2)]},
        ]},
        {"id": "mp-day-2", "dayNumber": 2, "meals": [
            {"meal": "breakfast", "items": [_food_item("food-chai", 1), _food_item("food-mandazi", 1), _food_item("food-eggs", 2)]},
            {"meal": "lunch", "items": [_food_item("food-githeri", 2), _food_item("food-sukuma", 1)]},
            {"meal": "dinner", "items": [_food_item("food-ugali", 1), _food_item("food-nyama", 1)]},
        ]},
    ]
    session.add(MealPlan(id="mealplan-demo", coach_id=DEMO_COACH_ID, title="Lean Bulk: Kenyan Staples",
                         description="Two alternating days built around local staples.", days=plan_days))
    session.add(MealPlanAssignment(client_id="client-1", meal_plan_id="mealplan-demo", start_date=today))
    print("-> Seeded custom foods, goals, habits, food diary and a meal plan")


WEEKLY_CHECKIN_QUESTIONS = [
    {"id": "q-weight", "type": "weight", "label": "Morning weight (kg)", "required": True, "options": []},
    {"id": "q-energy", "type": "scale", "label": "Energy this week", "required": True, "options": [], "min": 1, "max": 10},
    {"id": "q-sleep", "type": "number", "label": "Average sleep (hours)", "required": False, "options": [], "min": 0, "max": 14},
    {"id": "q-adherence", "type": "single_choice", "label": "How closely did you follow the plan?", "required": True,
     "options": ["Nailed it", "Mostly", "Struggled"]},
    {"id": "q-wins", "type": "long_text", "label": "Wins and struggles this week", "required": False, "options": []},
    {"id": "q-photo", "type": "photo", "label": "Front progress photo", "required": False, "options": [], "view": "Front"},
]


def _seed_engagement(session, today: date) -> None:
    session.add(CheckinForm(id="form-weekly", coach_id=DEMO_COACH_ID, title="Weekly check-in",
                            description="Takes two minutes. Be honest - it helps me adjust your plan.",
                            questions=WEEKLY_CHECKIN_QUESTIONS))
    # Started a week ago, so this week's check-in is due today.
    session.add(CheckinAssignment(id="chk-assign-demo", form_id="form-weekly", client_id="client-1", frequency="weekly",
                                  start_date=today - timedelta(days=7), active=True, last_notified_date=today))
    session.add(CheckinResponse(
        id="chk-resp-demo", assignment_id="chk-assign-demo", form_id="form-weekly", client_id="client-1",
        due_date=today - timedelta(days=7), questions=WEEKLY_CHECKIN_QUESTIONS,
        answers={"q-weight": 81.6, "q-energy": 7, "q-sleep": 7.2, "q-adherence": "Mostly", "q-wins": "Hit every session, weekends were harder."},
        submitted_at=datetime.now(timezone.utc) - timedelta(days=7),
        coach_comment="Great week. Let's plan Saturday meals ahead.", reviewed_at=datetime.now(timezone.utc) - timedelta(days=6),
    ))

    session.add(CommunityGroup(id="grp-challenge", coach_id=DEMO_COACH_ID, name="Fall Shred Challenge",
                               description="Six weeks, one team. Share wins, ask questions, keep each other honest."))
    for cid in ("client-1", "client-2", "client-3"):
        session.add(GroupMember(id=f"gm-{cid}", group_id="grp-challenge", client_id=cid))
    now = datetime.now(timezone.utc)
    session.add(GroupPost(id="post-welcome", group_id="grp-challenge", author_user_id=DEMO_COACH_ID,
                          author_name=settings.DEFAULT_COACH_NAME, author_role="coach", pinned=True, created_at=now - timedelta(days=2),
                          body="Welcome to the challenge! Post one win every Friday - big or small."))
    session.add(PostComment(id="cmt-demo-1", post_id="post-welcome", author_user_id="demo-client-2", author_name="Elena Rostova",
                            author_role="client", body="Win #1: meal prepped for the whole week!", created_at=now - timedelta(days=1)))
    for n, (name, text) in enumerate([("Damon Jackson", "Anyone else training at 6am tomorrow?"),
                                       ("Elena Rostova", "Me! Leg day"),
                                       (settings.DEFAULT_COACH_NAME, "Love it. Warm up properly, you two.")]):
        session.add(GroupMessage(id=f"gmsg-demo-{n}", group_id="grp-challenge", author_user_id=DEMO_COACH_ID if n == 2 else f"demo-{n}",
                                 author_name=name, author_role="coach" if n == 2 else "client", text=text,
                                 created_at=now - timedelta(hours=5 - n)))

    session.add(Autoflow(id="flow-onboarding", coach_id=DEMO_COACH_ID, title="New client onboarding",
                         description="First two weeks for every new client.", steps=[
        {"id": "s1", "day": 1, "type": "message", "text": "Welcome aboard! Your first workouts are on your calendar. Reply here any time."},
        {"id": "s2", "day": 2, "type": "habit", "habit": {"title": "Drink 3 L of water", "targetValue": 3, "unit": "L", "daysOfWeek": []}},
        {"id": "s3", "day": 7, "type": "checkin", "formId": "form-weekly"},
        {"id": "s4", "day": 14, "type": "message", "text": "Two weeks in - how are you finding the program? Anything to adjust?"},
    ]))
    print("-> Seeded a check-in form, community group and onboarding Autoflow")


def _seed_billing(session, today: date) -> None:
    """Demo packages, a subscription with payment history, and an open payment link.
    The payout account is fake: real checkouts need PAYSTACK_SECRET_KEY and a real subaccount."""
    session.add(PayoutAccount(coach_id=DEMO_COACH_ID, business_name="Yusuf Hassan Coaching", bank_code="DEMO",
                              bank_name="Demo Bank", account_last4="4321", subaccount_code="ACCT_demo", active=True))
    session.add(Package(id="pkg-monthly", coach_id=DEMO_COACH_ID, title="Monthly Coaching",
                        description="Custom program, weekly check-ins and unlimited messaging.",
                        price_minor=800000, currency="KES", billing="recurring", interval="monthly",
                        onboarding_form_id="form-weekly", active=True))
    session.add(Package(id="pkg-12wk", coach_id=DEMO_COACH_ID, title="12-Week Transformation",
                        description="A complete 12-week block with nutrition targets.",
                        price_minor=2000000, currency="KES", billing="one_time", duration_weeks=12, program_id="prog-1", active=True))
    session.add(Package(id="pkg-elite", coach_id=DEMO_COACH_ID, title="Elite 1-on-1 Performance",
                        description="Fully customized high-performance system, daily biofeedback analysis, video form audits and priority messaging.",
                        price_minor=3500000, currency="KES", billing="recurring", interval="quarterly", active=True))
    period_start = today - timedelta(days=10)
    session.add(Subscription(id="sub-demo", coach_id=DEMO_COACH_ID, client_id="client-1", package_id="pkg-monthly",
                             status="active", current_period_start=period_start,
                             current_period_end=period_start + timedelta(days=30), authorization_code="AUTH_demo",
                             card_label="Visa •••• 4081", email="marcus.vance@example.com"))
    for n in range(5):
        paid = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=10 + 30 * n)
        session.add(Payment(id=f"pay-demo-{n}", reference=f"nf_demo_{n}", coach_id=DEMO_COACH_ID, client_id="client-1",
                            package_id="pkg-monthly", subscription_id="sub-demo", amount_minor=800000, fees_minor=12000,
                            currency="KES", status="success", channel="card", fulfilled=True, paid_at=paid, created_at=paid))
    session.add(PaymentRequest(id="payreq-demo", token="demo-pay-link-damon", coach_id=DEMO_COACH_ID, client_id="client-3",
                               package_id="pkg-12wk", purpose="purchase", amount_minor=2000000, currency="KES", status="pending"))
    print("-> Seeded demo packages, a subscription with payment history and a payment link")


async def seed_database(force: bool = False):
    """Seed demo data (dev and tests only): a demo coach, their clients and sample history.
    With force=True all tables are dropped and recreated first."""
    async with engine.begin() as conn:
        if force:
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    await seed_exercise_library()

    async with AsyncSessionLocal() as session:
        if (await session.execute(select(User).limit(1))).scalar_one_or_none():
            print("Database already contains users. Skipping demo seed.")
            return

        print("Seeding NubianFit demo data...")
        session.add(User(
            id=DEMO_COACH_ID,
            email=settings.DEFAULT_COACH_EMAIL.lower(),
            hashed_password=get_password_hash(settings.DEFAULT_COACH_PASSWORD),
            full_name=settings.DEFAULT_COACH_NAME,
            role="coach",
            is_active=True,
            is_admin=True,
            created_at=datetime.now(timezone.utc),
        ))
        print(f"-> Seeded demo coach: {settings.DEFAULT_COACH_EMAIL}")

        data = _load_seed_json()
        now = datetime.now(timezone.utc)
        offset = date.today() - SEED_ANCHOR_DATE

        # Clients
        for item in data.get("clients", []):
            c = Client(
                id=item["id"],
                coach_id=DEMO_COACH_ID,
                name=item["name"],
                avatar=item.get("avatar", ""),
                email=item.get("email", "").lower(),
                phone=item.get("phone", ""),
                age=item.get("age", 25),
                gender=item.get("gender", "Male"),
                status=item.get("status", "Active"),
                goal=item.get("goal", "Hypertrophy"),
                experience_level=item.get("experienceLevel", "Intermediate"),
                start_date=_shift(item.get("startDate", ""), offset),
                current_program_id=item.get("currentProgramId"),
                current_program_name=item.get("currentProgramName"),
                compliance_rate=float(item.get("complianceRate", 100.0)),
                workouts_completed=int(item.get("workoutsCompleted", 0)),
                total_workouts_assigned=int(item.get("totalWorkoutsAssigned", 0)),
                last_active=item.get("lastActive", "Recently"),
                starting_weight_kg=float(item.get("startingWeightKg", 75.0)),
                current_weight_kg=float(item.get("currentWeightKg", 75.0)),
                target_weight_kg=float(item.get("targetWeightKg", 70.0)),
                height_cm=float(item.get("heightCm", 175.0)),
                body_fat_percentage=float(item.get("bodyFatPercentage", 15.0)),
                target_body_fat=float(item.get("targetBodyFat", 12.0)),
                injuries_and_health=item.get("injuriesAndHealth", []),
                medical_alerts=item.get("medicalAlerts"),
                custom_coach_notes=item.get("customCoachNotes", []),
                onboarding_survey=item.get("onboardingSurvey", {}),
            )
            session.add(c)
        print(f"-> Seeded {len(data.get('clients', []))} clients")

        # Programs
        for item in data.get("programs", []):
            prog = TrainingProgram(
                id=item["id"],
                coach_id=DEMO_COACH_ID,
                title=item["title"],
                subtitle=item.get("subtitle", ""),
                description=item.get("description", ""),
                difficulty=item.get("difficulty", "Intermediate"),
                goal=item.get("goal", "Hypertrophy"),
                duration_weeks=int(item.get("durationWeeks", 8)),
                days_per_week=int(item.get("daysPerWeek", 4)),
                days=_weekly_program_days(item),
                tags=item.get("tags", []),
                assigned_client_count=int(item.get("assignedClientCount", 0)),
                created_at=_shift(item.get("createdAt", ""), offset),
                updated_at=_shift(item.get("updatedAt", ""), offset),
            )
            session.add(prog)
        print(f"-> Seeded {len(data.get('programs', []))} programs")

        # Scheduled Workouts (fill empty ones from their program day so they can be logged)
        program_days = {
            (prog["id"], day["id"]): day.get("exercises", [])
            for prog in data.get("programs", [])
            for day in _weekly_program_days(prog)
        }
        for item in data.get("scheduledWorkouts", []):
            sw = ScheduledWorkout(
                id=item["id"],
                client_id=item["clientId"],
                client_name=item.get("clientName", ""),
                client_avatar=item.get("clientAvatar", ""),
                program_id=item.get("programId"),
                program_name=item.get("programName"),
                workout_day_id=item.get("workoutDayId", ""),
                workout_title=item.get("workoutTitle", "Workout"),
                date=_shift(item.get("date", ""), offset),
                time=item.get("time"),
                status=item.get("status", "Scheduled"),
                duration_min=item.get("durationMin"),
                rating=item.get("rating"),
                client_feedback=item.get("clientFeedback"),
                coach_feedback=item.get("coachFeedback"),
                total_volume_kg=item.get("totalVolumeKg"),
                pr_count=item.get("prCount"),
                exercises=item.get("exercises") or program_days.get((item.get("programId"), f"{item.get('workoutDayId')}-w1"), []),
            )
            session.add(sw)
        print(f"-> Seeded {len(data.get('scheduledWorkouts', []))} scheduled workouts")

        # Metrics
        for item in data.get("metrics", []):
            m = MetricEntry(
                id=item["id"],
                client_id=item["clientId"],
                date=_shift(item.get("date", ""), offset),
                weight_kg=float(item.get("weightKg", 0.0)),
                body_fat_percentage=item.get("bodyFatPercentage"),
                chest_cm=item.get("chestCm"),
                waist_cm=item.get("waistCm"),
                arms_cm=item.get("armsCm"),
                thighs_cm=item.get("thighsCm"),
                notes=item.get("notes"),
            )
            session.add(m)
        print(f"-> Seeded {len(data.get('metrics', []))} biometric entries")

        # Personal Records
        for item in data.get("personalRecords", []):
            pr = PersonalRecord(
                id=item["id"],
                client_id=item["clientId"],
                exercise_name=item.get("exerciseName", ""),
                weight_kg=float(item.get("weightKg", 0.0)),
                reps=int(item.get("reps", 1)),
                estimated_1rm_kg=float(item.get("estimated1RmKg", 0.0)),
                date=_shift(item.get("date", ""), offset),
                previous_weight_kg=item.get("previousWeightKg"),
            )
            session.add(pr)
        print(f"-> Seeded {len(data.get('personalRecords', []))} personal records")

        _seed_nutrition_and_habits(session, data.get("clients", []), date.today())
        _seed_engagement(session, date.today())
        _seed_billing(session, date.today())

        # Photos
        for item in data.get("photos", []):
            p = ProgressPhoto(
                id=item["id"],
                client_id=item["clientId"],
                date=_shift(item.get("date", ""), offset),
                view=item.get("view", "Front"),
                photo_url=item.get("photoUrl", ""),
                weight_kg=float(item.get("weightKg", 70.0)),
                body_fat_percentage=item.get("bodyFatPercentage"),
                notes=item.get("notes"),
            )
            session.add(p)
        print(f"-> Seeded {len(data.get('photos', []))} progress photos")

        # Messages
        for idx, item in enumerate(data.get("messages", [])):
            msg = ChatMessage(
                created_at=now - timedelta(minutes=len(data["messages"]) - idx),
                id=item["id"],
                client_id=item["clientId"],
                sender=item.get("sender", "coach"),
                text=item.get("text", ""),
                timestamp=item.get("timestamp", ""),
                is_read=item.get("isRead", True),
                attachment=item.get("attachment"),
            )
            session.add(msg)
        print(f"-> Seeded {len(data.get('messages', []))} messages")

        # Activity Feed
        # The JSON lists the feed newest first.
        for idx, item in enumerate(data.get("activityFeed", [])):
            act = ActivityFeedItem(
                coach_id=DEMO_COACH_ID,
                created_at=now - timedelta(minutes=idx),
                id=item["id"],
                type=item.get("type", "check_in_submitted"),
                client_id=item.get("clientId", ""),
                client_name=item.get("clientName", ""),
                client_avatar=item.get("clientAvatar", ""),
                title=item.get("title", ""),
                description=item.get("description", ""),
                timestamp=item.get("timestamp", ""),
                metadata_json=item.get("metadata"),
            )
            session.add(act)
        print(f"-> Seeded {len(data.get('activityFeed', []))} activity feed items")

        await session.commit()
        print("Database seeding completed successfully! ✨")


if __name__ == "__main__":
    force_seed = "--force" in sys.argv
    asyncio.run(seed_database(force=force_seed))
