"""
Authentication Pydantic Schemas
"""

from typing import Optional
from pydantic import Field
from app.schemas.common import CamelModel


class LoginRequest(CamelModel):
    email: str
    password: str


class CoachRegisterRequest(CamelModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1)
    invite_code: str


class ClientRegisterRequest(CamelModel):
    email: str
    full_name: str = Field(min_length=1)
    password: Optional[str] = None
    goal: Optional[str] = "Strength & Strategy"
    experience_level: Optional[str] = "Intermediate"
    starting_weight_kg: Optional[float] = None
    target_weight_kg: Optional[float] = None
    age: Optional[int] = None
    gender: Optional[str] = None


class OtpRequest(CamelModel):
    email: str


class OtpVerifyRequest(CamelModel):
    email: str
    code: str


class GoogleAuthRequest(CamelModel):
    credential: str


class ChangePasswordRequest(CamelModel):
    current_password: Optional[str] = None
    new_password: str = Field(min_length=8)


class UserResponse(CamelModel):
    id: str
    email: str
    full_name: str
    role: str
    client_id: Optional[str] = None
    avatar: str
    is_active: bool
    has_password: bool = False
    is_admin: bool = False


class TokenResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
