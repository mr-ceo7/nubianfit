"""
Clients Management Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.dependencies import get_db, get_current_user, require_coach, get_accessible_client
from app.models.client import Client
from app.models.activity import ActivityFeedItem
from app.models.habit import Habit, HabitCheckin
from app.models.nutrition import ClientGoals, DailyMetric, FoodLogEntry, MealPlanAssignment
from app.models.engagement import AutoflowAssignment, CheckinAssignment, CheckinResponse, GroupMember, StoredFile
from app.models.message import ChatMessage
from app.models.metric import MetricEntry
from app.models.personal_record import PersonalRecord
from app.models.photo import ProgressPhoto
from app.models.workout import ScheduledWorkout
from app.models.user import User
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse, AddCoachNoteRequest
from app.services.activity import new_id, log_activity
from app.services.email import EmailDeliveryError, send_client_invite

# Tables holding per-client data, removed together with the client.
CLIENT_OWNED_MODELS = (
    ScheduledWorkout, MetricEntry, PersonalRecord, Habit, HabitCheckin,
    ProgressPhoto, ChatMessage, ActivityFeedItem, FoodLogEntry, DailyMetric, ClientGoals, MealPlanAssignment,
    GroupMember, CheckinAssignment, CheckinResponse, StoredFile, AutoflowAssignment,
)

router = APIRouter(prefix="/clients", tags=["Clients"])


def _for_viewer(client: Client, user: User) -> ClientResponse:
    """Clients never see their coach's private notes."""
    data = ClientResponse.model_validate(client)
    if user.role == "client":
        data.custom_coach_notes = []
    return data


async def _ensure_email_free(db: AsyncSession, coach_id: str, email: str, exclude_id: Optional[str] = None):
    if not email:
        return
    query = select(Client.id).where(Client.coach_id == coach_id, func.lower(Client.email) == email)
    if exclude_id:
        query = query.where(Client.id != exclude_id)
    if (await db.execute(query)).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already have a client with this email")


@router.get("", response_model=List[ClientResponse])
async def list_clients(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Coaches get their roster; a client gets a list containing only themselves."""
    if user.role == "client":
        client = await get_accessible_client(user.client_id, user, db)
        return [_for_viewer(client, user)]

    query = select(Client).where(Client.coach_id == user.id)
    if status_filter:
        query = query.where(Client.status == status_filter)
    if search:
        pattern = f"%{search.lower()}%"
        query = query.where(Client.name.ilike(pattern) | Client.email.ilike(pattern) | Client.goal.ilike(pattern))
    result = await db.execute(query.order_by(Client.name))
    return result.scalars().all()


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return _for_viewer(await get_accessible_client(client_id, user, db), user)


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_in: ClientCreate,
    send_invite: bool = Query(False, alias="sendInvite"),
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
):
    data = client_in.model_dump()
    data["email"] = (data.get("email") or "").strip().lower()
    await _ensure_email_free(db, coach.id, data["email"])

    client = Client(
        id=new_id("client"),
        coach_id=coach.id,
        workouts_completed=0,
        total_workouts_assigned=0,
        compliance_rate=100.0,
        last_active="Just registered",
        **data,
    )
    db.add(client)
    log_activity(db, client, "check_in_submitted", "New Client Onboarded",
                 f"Enrolled for {client.goal} coaching", {"goal": client.goal})
    await db.commit()
    await db.refresh(client)

    if send_invite and client.email:
        try:
            await send_client_invite(client.email, client.name, coach.full_name)
        except EmailDeliveryError:
            pass  # the client exists; the coach can resend from the profile
    return client


@router.post("/{client_id}/invite")
async def invite_client(client_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    """Email the client a link to the client app."""
    client = await get_accessible_client(client_id, coach, db)
    if not client.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Add an email address for this client first")
    try:
        await send_client_invite(client.email, client.name, coach.full_name)
    except EmailDeliveryError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="We couldn't send the invite. Try again shortly.")
    return {"message": f"Invite sent to {client.email}"}


@router.patch("/{client_id}", response_model=ClientResponse)
@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: str,
    client_in: ClientUpdate,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
):
    client = await get_accessible_client(client_id, coach, db)
    update_data = client_in.model_dump(exclude_unset=True)
    if "email" in update_data:
        update_data["email"] = (update_data["email"] or "").strip().lower()
        await _ensure_email_free(db, coach.id, update_data["email"], exclude_id=client.id)
    for field, val in update_data.items():
        setattr(client, field, val)
    await db.commit()
    await db.refresh(client)
    return client


@router.post("/{client_id}/notes", response_model=ClientResponse)
async def add_coach_note(
    client_id: str,
    note_req: AddCoachNoteRequest,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
):
    client = await get_accessible_client(client_id, coach, db)
    client.custom_coach_notes = [note_req.note, *(client.custom_coach_notes or [])]
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/{client_id}")
async def delete_client(client_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    client = await get_accessible_client(client_id, coach, db)
    # Revoke the client's login along with the profile.
    logins = await db.execute(select(User).where(User.client_id == client.id))
    for login in logins.scalars():
        login.is_active = False
        login.client_id = None
    for model in CLIENT_OWNED_MODELS:
        await db.execute(delete(model).where(model.client_id == client.id))
    await db.delete(client)
    await db.commit()
    return {"message": "Client deleted successfully", "id": client_id}
