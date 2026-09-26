"""
Exercise Pydantic Schemas
"""

from typing import List, Literal, Optional
from pydantic import Field, field_validator
from urllib.parse import urlparse

from app.schemas.common import CamelModel


TrackingType = Literal["reps_weight", "reps", "time", "distance", "time_distance"]

VIDEO_HOSTS = ("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com", "player.vimeo.com")


def check_video_url(url: Optional[str]) -> Optional[str]:
    """Only YouTube and Vimeo links are accepted (the frontend embeds them)."""
    if not url:
        return None
    parsed = urlparse(url.strip())
    if parsed.scheme != "https" or parsed.hostname not in VIDEO_HOSTS:
        raise ValueError("Video must be an https YouTube or Vimeo link")
    return url.strip()


class ExerciseBase(CamelModel):
    name: str
    primary_muscle: str
    secondary_muscles: List[str] = Field(default_factory=list)
    equipment: str
    difficulty: str = "Intermediate"
    category: str = "Strength"
    description: str = ""
    instructions: List[str] = Field(default_factory=list)
    form_cues: List[str] = Field(default_factory=list)
    demo_video_placeholder_url: Optional[str] = None
    thumbnail_url: str = ""
    video_url: Optional[str] = None
    tracking_type: TrackingType = "reps_weight"
    is_custom: bool = False

    @field_validator("video_url")
    @classmethod
    def check_video(cls, v: Optional[str]) -> Optional[str]:
        return check_video_url(v)


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(CamelModel):
    name: Optional[str] = None
    primary_muscle: Optional[str] = None
    secondary_muscles: Optional[List[str]] = None
    equipment: Optional[str] = None
    difficulty: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[List[str]] = None
    form_cues: Optional[List[str]] = None
    demo_video_placeholder_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    tracking_type: Optional[TrackingType] = None
    is_custom: Optional[bool] = None

    @field_validator("video_url")
    @classmethod
    def check_video(cls, v: Optional[str]) -> Optional[str]:
        return check_video_url(v)


class ExerciseResponse(ExerciseBase):
    id: str
