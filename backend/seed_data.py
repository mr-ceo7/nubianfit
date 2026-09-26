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
    ClientDailyHabitLog,
    ProgressPhoto,
    ChatMessage,
    ActivityFeedItem,
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

        # Habits
        for item in data.get("habitLogs", []):
            h = ClientDailyHabitLog(
                id=item["id"],
                client_id=item["clientId"],
                date=_shift(item.get("date", ""), offset),
                habits=item.get("habits", []),
            )
            session.add(h)
        print(f"-> Seeded {len(data.get('habitLogs', []))} habit logs")

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
