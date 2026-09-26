"""
Program assignment, shared by the Program Builder endpoint and paid packages.
"""

from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.program import TrainingProgram
from app.models.workout import ScheduledWorkout
from app.services.activity import log_activity, new_id


def assign_program_to_client(db: AsyncSession, program: TrainingProgram, client: Client, start: date) -> int:
    """Copy every program workout onto the client's calendar (day N on start + N - 1).
    Adds rows to the session; the caller commits. Returns the number of workouts scheduled."""
    client.current_program_id = program.id
    client.current_program_name = program.title
    program.assigned_client_count = (program.assigned_client_count or 0) + 1

    days = sorted(program.days or [], key=lambda d: d.get("dayNumber", 1))
    for idx, day in enumerate(days):
        db.add(ScheduledWorkout(
            id=new_id("sched"),
            client_id=client.id,
            client_name=client.name,
            client_avatar=client.avatar,
            program_id=program.id,
            program_name=program.title,
            workout_day_id=day.get("id", f"day-{idx + 1}"),
            workout_title=day.get("name") or f"Day {day.get('dayNumber', idx + 1)}",
            description=day.get("description", ""),
            date=(start + timedelta(days=day.get("dayNumber", idx + 1) - 1)).isoformat(),
            time=None,
            status="Scheduled",
            exercises=day.get("exercises", []),
            groups=day.get("groups", []),
        ))
    client.total_workouts_assigned = (client.total_workouts_assigned or 0) + len(days)
    log_activity(db, client, "check_in_submitted", f"Assigned: {program.title}",
                 f"{program.duration_weeks}-week program starting {start.isoformat()}", {"program_id": program.id})
    return len(days)
