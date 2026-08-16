"""
Database Seeding Script for NubianFit Platform
Populates SQLite / Postgres database with initial clients, exercises, programs, workouts, metrics, PRs, habits, photos, messages, and default coach account.
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone

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


async def seed_database(force: bool = False):
    """Seed the database from seed_data.json."""
    # 1. Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Check if already seeded
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Client).limit(1))
        has_clients = result.scalar_one_or_none() is not None
        
        user_res = await session.execute(select(User).limit(1))
        has_users = user_res.scalar_one_or_none() is not None

        if not force and has_clients and has_users:
            print("Database already contains data. Skipping seed.")
            return

        print("Seeding NubianFit database...")

        # 3. Seed Default Coach User
        if not has_users or force:
            coach_user = User(
                id="coach-1",
                email=settings.DEFAULT_COACH_EMAIL.lower(),
                hashed_password=get_password_hash(settings.DEFAULT_COACH_PASSWORD),
                full_name=settings.DEFAULT_COACH_NAME,
                role="coach",
                avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                is_active=True,
                created_at=datetime.now(timezone.utc),
            )
            session.add(coach_user)
            print(f"-> Seeded Coach user: {settings.DEFAULT_COACH_EMAIL}")

        # 4. Load seed_data.json
        json_path = os.path.join(os.path.dirname(__file__), "seed_data.json")
        if not os.path.exists(json_path):
            print(f"Warning: {json_path} not found.")
            await session.commit()
            return

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Clients
        for item in data.get("clients", []):
            c = Client(
                id=item["id"],
                name=item["name"],
                avatar=item.get("avatar", ""),
                email=item.get("email", ""),
                phone=item.get("phone", ""),
                age=item.get("age", 25),
                gender=item.get("gender", "Male"),
                status=item.get("status", "Active"),
                goal=item.get("goal", "Hypertrophy"),
                experience_level=item.get("experienceLevel", "Intermediate"),
                start_date=item.get("startDate", ""),
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

        # Exercises
        for item in data.get("exercises", []):
            ex = Exercise(
                id=item["id"],
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
                is_custom=item.get("isCustom", False),
            )
            session.add(ex)
        print(f"-> Seeded {len(data.get('exercises', []))} exercises")

        # Programs
        for item in data.get("programs", []):
            prog = TrainingProgram(
                id=item["id"],
                title=item["title"],
                subtitle=item.get("subtitle", ""),
                description=item.get("description", ""),
                difficulty=item.get("difficulty", "Intermediate"),
                goal=item.get("goal", "Hypertrophy"),
                duration_weeks=int(item.get("durationWeeks", 8)),
                days_per_week=int(item.get("daysPerWeek", 4)),
                days=item.get("days", []),
                tags=item.get("tags", []),
                assigned_client_count=int(item.get("assignedClientCount", 0)),
                created_at=item.get("createdAt", ""),
                updated_at=item.get("updatedAt", ""),
            )
            session.add(prog)
        print(f"-> Seeded {len(data.get('programs', []))} programs")

        # Scheduled Workouts
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
                date=item.get("date", ""),
                time=item.get("time"),
                status=item.get("status", "Scheduled"),
                duration_min=item.get("durationMin"),
                rating=item.get("rating"),
                client_feedback=item.get("clientFeedback"),
                coach_feedback=item.get("coachFeedback"),
                total_volume_kg=item.get("totalVolumeKg"),
                pr_count=item.get("prCount"),
                exercises=item.get("exercises", []),
            )
            session.add(sw)
        print(f"-> Seeded {len(data.get('scheduledWorkouts', []))} scheduled workouts")

        # Metrics
        for item in data.get("metrics", []):
            m = MetricEntry(
                id=item["id"],
                client_id=item["clientId"],
                date=item.get("date", ""),
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
                date=item.get("date", ""),
                previous_weight_kg=item.get("previousWeightKg"),
            )
            session.add(pr)
        print(f"-> Seeded {len(data.get('personalRecords', []))} personal records")

        # Habits
        for item in data.get("habitLogs", []):
            h = ClientDailyHabitLog(
                id=item["id"],
                client_id=item["clientId"],
                date=item.get("date", ""),
                habits=item.get("habits", []),
            )
            session.add(h)
        print(f"-> Seeded {len(data.get('habitLogs', []))} habit logs")

        # Photos
        for item in data.get("photos", []):
            p = ProgressPhoto(
                id=item["id"],
                client_id=item["clientId"],
                date=item.get("date", ""),
                view=item.get("view", "Front"),
                photo_url=item.get("photoUrl", ""),
                weight_kg=float(item.get("weightKg", 70.0)),
                body_fat_percentage=item.get("bodyFatPercentage"),
                notes=item.get("notes"),
            )
            session.add(p)
        print(f"-> Seeded {len(data.get('photos', []))} progress photos")

        # Messages
        for item in data.get("messages", []):
            msg = ChatMessage(
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
        for item in data.get("activityFeed", []):
            act = ActivityFeedItem(
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
