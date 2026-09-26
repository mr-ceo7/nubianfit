"""
Autoflow: reusable sequences of messages, check-ins and habits that run on set days after a
client's start date. The scheduler executes due steps; assigning runs anything due today at once.
"""

from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_accessible_client, get_db, require_coach, resolve_client_filter
from app.models.engagement import Autoflow, AutoflowAssignment, CheckinForm
from app.models.user import User
from app.schemas.engagement import AutoflowAssignBody, AutoflowAssignmentResponse, AutoflowBody, AutoflowResponse
from app.services.activity import new_id
from app.services.scheduler import run_autoflow_assignment

router = APIRouter(prefix="/autoflows", tags=["Autoflow"])


async def _get_own(flow_id: str, coach: User, db: AsyncSession) -> Autoflow:
    flow = await db.get(Autoflow, flow_id)
    if not flow or flow.coach_id != coach.id:
        raise HTTPException(status_code=404, detail="Autoflow not found")
    return flow


async def _steps(body: AutoflowBody, coach: User, db: AsyncSession) -> list:
    form_ids = {s.form_id for s in body.steps if s.type == "checkin"}
    if form_ids:
        owned = set((await db.execute(
            select(CheckinForm.id).where(CheckinForm.id.in_(form_ids), CheckinForm.coach_id == coach.id)
        )).scalars().all())
        if owned != form_ids:
            raise HTTPException(status_code=422, detail="A step refers to a check-in form that doesn't exist")
    return [s.model_dump(by_alias=True, exclude_none=True) for s in sorted(body.steps, key=lambda s: s.day)]


@router.get("", response_model=List[AutoflowResponse])
async def list_autoflows(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(Autoflow).where(Autoflow.coach_id == coach.id).order_by(Autoflow.title))).scalars().all()


@router.post("", response_model=AutoflowResponse, status_code=status.HTTP_201_CREATED)
async def create_autoflow(body: AutoflowBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    flow = Autoflow(id=new_id("flow"), coach_id=coach.id, title=body.title.strip(), description=body.description,
                    steps=await _steps(body, coach, db))
    db.add(flow)
    await db.commit()
    await db.refresh(flow)
    return flow


@router.put("/{flow_id}", response_model=AutoflowResponse)
async def update_autoflow(flow_id: str, body: AutoflowBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    flow = await _get_own(flow_id, coach, db)
    flow.title = body.title.strip()
    flow.description = body.description
    flow.steps = await _steps(body, coach, db)
    flow.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(flow)
    return flow


@router.delete("/{flow_id}")
async def delete_autoflow(flow_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    flow = await _get_own(flow_id, coach, db)
    await db.execute(delete(AutoflowAssignment).where(AutoflowAssignment.autoflow_id == flow.id))
    await db.delete(flow)
    await db.commit()
    return {"message": "Autoflow deleted", "id": flow_id}


@router.get("/assignments", response_model=List[AutoflowAssignmentResponse])
async def list_assignments(
    client_id: Optional[str] = Query(None, alias="clientId"),
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
):
    ids = await resolve_client_filter(client_id, coach, db)
    return (await db.execute(
        select(AutoflowAssignment).where(AutoflowAssignment.client_id.in_(ids)).order_by(AutoflowAssignment.created_at.desc())
    )).scalars().all()


@router.post("/{flow_id}/assign", response_model=AutoflowAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_autoflow(flow_id: str, body: AutoflowAssignBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    flow = await _get_own(flow_id, coach, db)
    await get_accessible_client(body.client_id, coach, db)
    assignment = AutoflowAssignment(id=new_id("flow-assign"), autoflow_id=flow.id, client_id=body.client_id,
                                    start_date=body.start_date or date.today(), active=True, completed_step_ids=[])
    db.add(assignment)
    await db.commit()
    await run_autoflow_assignment(db, assignment, date.today())
    await db.refresh(assignment)
    return assignment


@router.delete("/assignments/{assignment_id}")
async def cancel_assignment(assignment_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    assignment = await db.get(AutoflowAssignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await get_accessible_client(assignment.client_id, coach, db)
    assignment.active = False
    await db.commit()
    return {"message": "Autoflow stopped", "id": assignment_id}
