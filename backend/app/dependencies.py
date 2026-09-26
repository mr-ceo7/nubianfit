"""
FastAPI Dependencies: database sessions, authentication and data-access scoping.

Access rules:
- A coach sees and manages only their own clients (Client.coach_id) and everything tied to them.
- A client sees only their own Client record and its data (User.client_id).
"""

from typing import AsyncGenerator, List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.client import Client
from app.security import decode_access_token

security = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide an asynchronous database session to request handlers."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate the JWT bearer token and load the active user."""
    if not credentials or not credentials.credentials:
        raise _unauthorized("Authentication required")

    user_id = decode_access_token(credentials.credentials)
    if not user_id:
        raise _unauthorized("Invalid or expired authentication token")

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise _unauthorized("User not found or inactive")
    return user


async def require_coach(user: User = Depends(get_current_user)) -> User:
    if user.role != "coach":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coach access required")
    return user


async def require_client(user: User = Depends(get_current_user)) -> User:
    if user.role != "client" or not user.client_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Client access required")
    return user


async def accessible_client_ids(user: User, db: AsyncSession) -> List[str]:
    """IDs of every client whose data this user may read or write."""
    if user.role == "client":
        return [user.client_id] if user.client_id else []
    result = await db.execute(select(Client.id).where(Client.coach_id == user.id))
    return list(result.scalars().all())


async def get_accessible_client(client_id: str, user: User, db: AsyncSession) -> Client:
    """Load a client the user is allowed to access, or 404 (never reveal other coaches' clients)."""
    client = await db.get(Client, client_id)
    allowed = client is not None and (
        (user.role == "coach" and client.coach_id == user.id)
        or (user.role == "client" and user.client_id == client.id)
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


async def resolve_client_filter(
    requested_client_id: Optional[str], user: User, db: AsyncSession
) -> List[str]:
    """Turn an optional ?clientId= filter into the list of client IDs a query may touch."""
    if requested_client_id:
        await get_accessible_client(requested_client_id, user, db)
        return [requested_client_id]
    return await accessible_client_ids(user, db)
