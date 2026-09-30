"""
Media Upload Router

Handles audio voice notes, workout check-in videos, and photos.
Files are stored securely in settings.MEDIA_DIR and served statically.
"""

import os
import re
import uuid
import logging
from typing import Set
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_current_user
from app.models.user import User

logger = logging.getLogger("nubianfit")

router = APIRouter(prefix="/media", tags=["Media"])

ALLOWED_MIME_PREFIXES = ("audio/", "video/", "image/")

ALLOWED_EXTENSIONS: Set[str] = {
    # Audio
    ".webm", ".mp3", ".m4a", ".mp4", ".ogg", ".wav", ".aac",
    # Video
    ".mov", ".quicktime",
    # Image
    ".jpg", ".jpeg", ".png", ".webp", ".heic",
}


class MediaUploadResponse(BaseModel):
    url: str
    filename: str
    content_type: str
    size: int


@router.post("/upload", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """
    Upload a voice memo, form-check video, or photo.
    Enforces maximum upload size and allowable media MIME types.
    """
    # Verify directory exists
    os.makedirs(settings.MEDIA_DIR, exist_ok=True)

    content_type = file.content_type or "application/octet-stream"
    original_ext = os.path.splitext(file.filename or "")[1].lower()

    # Normalize webm/mp4 audio
    if not any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES) and original_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported media type '{content_type}'. Allowed types: audio, video, image.",
        )

    # Clean filename
    clean_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", file.filename or "media")
    unique_name = f"{uuid.uuid4().hex[:12]}_{clean_name}"
    target_path = os.path.join(settings.MEDIA_DIR, unique_name)

    # Read and enforce size limit
    content = await file.read()
    size = len(content)

    if size > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )

    if size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    try:
        with open(target_path, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.exception("Failed to write uploaded media to disk")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save media file.",
        ) from e

    relative_url = f"/api/media/{unique_name}"
    return MediaUploadResponse(
        url=relative_url,
        filename=unique_name,
        content_type=content_type,
        size=size,
    )
