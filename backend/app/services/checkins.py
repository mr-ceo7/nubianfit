"""
Check-in scheduling, answer validation, and signed URLs for uploaded photos.
"""

import hashlib
import hmac
import time
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Set

from app.config import settings
from app.models.engagement import CheckinAssignment

FILE_URL_TTL_SECONDS = 24 * 3600


def due_dates(assignment: CheckinAssignment, up_to: date) -> List[date]:
    """Every due date from the start up to `up_to` (inclusive)."""
    if assignment.start_date > up_to:
        return []
    if assignment.frequency == "once":
        return [assignment.start_date]
    weeks = (up_to - assignment.start_date).days // 7
    return [assignment.start_date + timedelta(weeks=i) for i in range(weeks + 1)]


def pending_due_date(assignment: CheckinAssignment, answered: Set[date], today: date) -> Optional[date]:
    """The most recent due date on or before today that hasn't been answered."""
    if not assignment.active:
        return None
    dates = due_dates(assignment, today)
    latest = dates[-1] if dates else None
    return latest if latest and latest not in answered else None


def next_due_date(assignment: CheckinAssignment, today: date) -> Optional[date]:
    if not assignment.active:
        return None
    if assignment.start_date > today:
        return assignment.start_date
    if assignment.frequency == "once":
        return None
    weeks = (today - assignment.start_date).days // 7 + 1
    return assignment.start_date + timedelta(weeks=weeks)


def validate_answers(questions: List[Dict[str, Any]], answers: Dict[str, Any]) -> Dict[str, Any]:
    """Check answers against question types; returns the cleaned answers (unknown ids dropped)."""
    cleaned: Dict[str, Any] = {}
    for q in questions:
        qid, qtype, label = q["id"], q["type"], q["label"]
        value = answers.get(qid)
        empty = value is None or value == "" or value == []
        if empty:
            if q.get("required"):
                raise ValueError(f'"{label}" is required')
            continue
        if qtype in ("text", "long_text"):
            if not isinstance(value, str) or len(value) > (500 if qtype == "text" else 5000):
                raise ValueError(f'"{label}" is too long')
            cleaned[qid] = value.strip()
        elif qtype in ("number", "scale", "weight"):
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f'"{label}" must be a number')
            lo = q.get("min") if q.get("min") is not None else (1 if qtype == "scale" else 20 if qtype == "weight" else None)
            hi = q.get("max") if q.get("max") is not None else (10 if qtype == "scale" else 400 if qtype == "weight" else None)
            if (lo is not None and value < lo) or (hi is not None and value > hi):
                raise ValueError(f'"{label}" must be between {lo} and {hi}')
            cleaned[qid] = value
        elif qtype == "yes_no":
            if not isinstance(value, bool):
                raise ValueError(f'"{label}" must be yes or no')
            cleaned[qid] = value
        elif qtype == "single_choice":
            if value not in q.get("options", []):
                raise ValueError(f'"{label}": choose one of the options')
            cleaned[qid] = value
        elif qtype == "multi_choice":
            if not isinstance(value, list) or not set(value) <= set(q.get("options", [])):
                raise ValueError(f'"{label}": choose from the options')
            cleaned[qid] = value
        elif qtype == "photo":
            if not isinstance(value, dict) or not isinstance(value.get("fileId"), str):
                raise ValueError(f'"{label}": upload a photo')
            cleaned[qid] = {"fileId": value["fileId"]}
    return cleaned


def sign_file(file_id: str, now: Optional[float] = None) -> str:
    exp = int((now or time.time()) + FILE_URL_TTL_SECONDS)
    sig = hmac.new(settings.SECRET_KEY.encode(), f"{file_id}:{exp}".encode(), hashlib.sha256).hexdigest()[:32]
    return f"{settings.API_PREFIX}/files/{file_id}?exp={exp}&sig={sig}"


def verify_file_signature(file_id: str, exp: int, sig: str) -> bool:
    if exp < time.time():
        return False
    expected = hmac.new(settings.SECRET_KEY.encode(), f"{file_id}:{exp}".encode(), hashlib.sha256).hexdigest()[:32]
    return hmac.compare_digest(expected, sig)


def photo_url(stored: str) -> str:
    """ProgressPhoto.photo_url may be an external URL or 'file:<id>' for an uploaded photo."""
    return sign_file(stored[5:]) if stored.startswith("file:") else stored
