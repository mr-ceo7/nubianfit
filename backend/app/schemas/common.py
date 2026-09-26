"""
Base CamelModel schema helper for automatic snake_case <-> camelCase mapping.
"""

from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """
    Base Pydantic model with automatic camelCase aliases and ORM mode enabled.
    Accepts both snake_case and camelCase on input, and serializes as camelCase.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


def _as_utc(value: datetime) -> datetime:
    # Timestamps are stored as naive UTC; mark them so clients don't read them as local time.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


UtcDatetime = Annotated[datetime, AfterValidator(_as_utc)]
