"""
Authentication Pydantic Schemas
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    avatar: Optional[str] = None
    role: Optional[str] = "coach"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    avatar: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
