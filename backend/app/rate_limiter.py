"""
In-memory sliding-window rate limiting for auth endpoints.
Single-instance only; move to Redis if the API is ever scaled horizontally.
"""

import asyncio
import time
from typing import Dict, List
from fastapi import HTTPException, Request, status

from app.config import settings


class InMemoryRateLimiter:
    def __init__(self):
        self._hits: Dict[str, List[float]] = {}
        self._lock = asyncio.Lock()

    async def allow(self, key: str, limit: int, window_seconds: int, peek: bool = False) -> bool:
        """True if under the limit. Records a hit unless `peek` (check only)."""
        now = time.monotonic()
        async with self._lock:
            recent = [t for t in self._hits.get(key, []) if t > now - window_seconds]
            allowed = len(recent) < limit
            if allowed and not peek:
                recent.append(now)
            self._hits[key] = recent
            return allowed

    def reset(self):
        self._hits.clear()


rate_limiter = InMemoryRateLimiter()


def client_ip(request: Request) -> str:
    # Render terminates TLS at its proxy and sets X-Forwarded-For; the first entry is the caller.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(limit: int, window_seconds: int, key_prefix: str):
    """Dependency factory limiting requests per client IP."""
    async def dependency(request: Request):
        if settings.TESTING:
            return
        if not await rate_limiter.allow(f"{key_prefix}:{client_ip(request)}", limit, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait a minute and try again.",
            )
    return dependency
