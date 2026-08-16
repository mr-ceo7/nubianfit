"""
Base CamelModel schema helper for automatic snake_case <-> camelCase mapping.
"""

from pydantic import BaseModel, ConfigDict
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
