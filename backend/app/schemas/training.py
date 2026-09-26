"""
Workout content shared by workout templates, program days and scheduled workouts.

Content is stored as JSON in camelCase (the frontend's shape):
  exercises: [{id, exerciseId, exerciseName, section, trackingType, groupId?, sets: [...], ...}]
  groups:    [{id, kind, rounds?, timeCapMin?, intervalSec?, notes?}]
Exercises stay one ordered list; `section` places them in warm-up / main / cool-down and
`groupId` links consecutive exercises into a superset, circuit, AMRAP or EMOM block.
"""

from typing import Any, Dict, List

SECTIONS = {"warmup", "main", "cooldown"}
TRACKING_TYPES = {"reps_weight", "reps", "time", "distance", "time_distance"}
GROUP_KINDS = {"superset", "circuit", "amrap", "emom"}


def validate_workout_content(exercises: List[Dict[str, Any]], groups: List[Dict[str, Any]]) -> None:
    """Raise ValueError when the content is malformed. Missing optional fields get defaults later in the UI."""
    group_ids = set()
    for g in groups:
        if not isinstance(g, dict) or not g.get("id"):
            raise ValueError("Every group needs an id")
        if g.get("kind") not in GROUP_KINDS:
            raise ValueError(f"Unknown group kind: {g.get('kind')!r}")
        for field in ("rounds", "timeCapMin", "intervalSec"):
            value = g.get(field)
            if value is not None and (not isinstance(value, (int, float)) or value < 0):
                raise ValueError(f"Group {field} must be a positive number")
        group_ids.add(g["id"])

    for ex in exercises:
        if not isinstance(ex, dict):
            raise ValueError("Exercises must be objects")
        if ex.get("section", "main") not in SECTIONS:
            raise ValueError(f"Unknown section: {ex.get('section')!r}")
        if ex.get("trackingType", "reps_weight") not in TRACKING_TYPES:
            raise ValueError(f"Unknown tracking type: {ex.get('trackingType')!r}")
        if ex.get("groupId") and ex["groupId"] not in group_ids:
            raise ValueError("An exercise refers to a group that doesn't exist")
        if not isinstance(ex.get("sets", []), list):
            raise ValueError("Exercise sets must be a list")


def validate_program_days(days: List[Dict[str, Any]], duration_weeks: int) -> None:
    """Program days are workouts placed on an absolute day number (1 = first day of week 1)."""
    last_day = duration_weeks * 7
    for day in days:
        number = day.get("dayNumber")
        if not isinstance(number, int) or not 1 <= number <= last_day:
            raise ValueError(f"Each program workout needs a dayNumber between 1 and {last_day}")
        validate_workout_content(day.get("exercises", []), day.get("groups", []))
