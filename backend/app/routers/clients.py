"""
Clients Management Router
"""

import time
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.dependencies import get_db, get_optional_user
from app.models.client import Client
from app.models.activity import ActivityFeedItem
from app.models.user import User
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse, AddCoachNoteRequest

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.get("", response_model=List[ClientResponse])
async def list_clients(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all clients with optional filtering."""
    query = select(Client)
    if status_filter:
        query = query.where(Client.status == status_filter)
    if search:
        search_pattern = f"%{search.lower()}%"
        query = query.where(
            (Client.name.ilike(search_pattern)) | 
            (Client.email.ilike(search_pattern)) | 
            (Client.goal.ilike(search_pattern))
        )
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve single client details."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_in: ClientCreate,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user)
):
    """Create a new client and log activity."""
    client_id = f"client-{int(time.time() * 1000)}"
    
    client_dict = client_in.model_dump()
    new_client = Client(
        id=client_id,
        workouts_completed=0,
        total_workouts_assigned=0,
        compliance_rate=100.0,
        last_active="Just registered",
        **client_dict
    )
    db.add(new_client)
    
    # Log activity feed
    activity = ActivityFeedItem(
        id=f"act-{int(time.time() * 1000)}",
        type="check_in_submitted",
        client_id=new_client.id,
        client_name=new_client.name,
        client_avatar=new_client.avatar,
        title="New Client Onboarded",
        description=f"Enrolled for {new_client.goal} coaching protocol",
        timestamp="Just now",
        metadata_json={"goal": new_client.goal, "weight": new_client.current_weight_kg}
    )
    db.add(activity)
    
    await db.commit()
    await db.refresh(new_client)
    return new_client


@router.patch("/{client_id}", response_model=ClientResponse)
@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: str,
    client_in: ClientUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update client information."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    update_data = client_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(client, field, val)
        
    await db.commit()
    await db.refresh(client)
    return client


@router.post("/{client_id}/notes", response_model=ClientResponse)
async def add_coach_note(
    client_id: str,
    note_req: AddCoachNoteRequest,
    db: AsyncSession = Depends(get_db)
):
    """Add a coach note to client profile."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    notes = list(client.custom_coach_notes or [])
    notes.insert(0, note_req.note)
    client.custom_coach_notes = notes
    
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/{client_id}")
async def delete_client(client_id: str, db: AsyncSession = Depends(get_db)):
    """Delete client."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    await db.delete(client)
    await db.commit()
    return {"message": "Client deleted successfully", "id": client_id}
