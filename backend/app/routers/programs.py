"""
Training Programs Router

Programs belong to a coach. A client can read only the program currently assigned to them.
"""

from datetime import date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db, get_current_user, require_coach, get_accessible_client
from app.models.client import Client
from app.models.program import TrainingProgram
from app.models.user import User
from app.models.workout import ScheduledWorkout
from app.schemas.program import ProgramCreate, ProgramUpdate, ProgramResponse, AssignProgramRequest
from app.services.activity import new_id, log_activity

router = APIRouter(prefix="/programs", tags=["Programs"])


async def _get_own_program(program_id: str, coach: User, db: AsyncSession) -> TrainingProgram:
    prog = await db.get(TrainingProgram, program_id)
    if not prog or prog.coach_id != coach.id:
        raise HTTPException(status_code=404, detail="Program not found")
    return prog


async def _client_program_id(user: User, db: AsyncSession) -> Optional[str]:
    client = await db.get(Client, user.client_id) if user.client_id else None
    return client.current_program_id if client else None


@router.get("", response_model=List[ProgramResponse])
async def list_programs(
    goal: Optional[str] = None,
    difficulty: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "client":
        query = select(TrainingProgram).where(TrainingProgram.id == await _client_program_id(user, db))
    else:
        query = select(TrainingProgram).where(TrainingProgram.coach_id == user.id)
    if goal:
        query = query.where(TrainingProgram.goal == goal)
    if difficulty:
        query = query.where(TrainingProgram.difficulty == difficulty)
    result = await db.execute(query.order_by(TrainingProgram.title))
    return result.scalars().all()


@router.get("/{program_id}", response_model=ProgramResponse)
async def get_program(program_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role == "client":
        prog = await db.get(TrainingProgram, program_id) if program_id == await _client_program_id(user, db) else None
        if not prog:
            raise HTTPException(status_code=404, detail="Program not found")
        return prog
    return await _get_own_program(program_id, user, db)


@router.post("", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED)
async def save_or_create_program(
    program_in: ProgramCreate,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
):
    """Create a program, or update it when an ID the coach owns is supplied."""
    today = date.today().isoformat()
    existing = await db.get(TrainingProgram, program_in.id) if program_in.id else None
    if existing and existing.coach_id != coach.id:
        raise HTTPException(status_code=404, detail="Program not found")

    if existing:
        for k, v in program_in.model_dump(exclude_unset=True, exclude={"id"}).items():
            setattr(existing, k, v)
        existing.updated_at = today
        await db.commit()
        await db.refresh(existing)
        return existing

    data = program_in.model_dump(exclude={"id"})
    prog = TrainingProgram(
        **{**data, "created_at": data.get("created_at") or today, "updated_at": today},
        id=new_id("prog"),
        coach_id=coach.id,
    )
    db.add(prog)
    await db.commit()
    await db.refresh(prog)
    return prog


@router.patch("/{program_id}", response_model=ProgramResponse)
@router.put("/{program_id}", response_model=ProgramResponse)
async def update_program(
    program_id: str,
    program_in: ProgramUpdate,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
):
    prog = await _get_own_program(program_id, coach, db)
    for field, val in program_in.model_dump(exclude_unset=True).items():
        setattr(prog, field, val)
    prog.updated_at = date.today().isoformat()
    await db.commit()
    await db.refresh(prog)
    return prog


@router.post("/{program_id}/assign")
async def assign_program(
    program_id: str,
    req: AssignProgramRequest,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_db),
):
    """Assign a program to a client and schedule its training days, every other day from today."""
    program = await _get_own_program(program_id, coach, db)
    client = await get_accessible_client(req.client_id, coach, db)

    client.current_program_id = program.id
    client.current_program_name = program.title
    program.assigned_client_count = (program.assigned_client_count or 0) + 1

    today = date.today()
    days = program.days or []
    for idx, day in enumerate(days):
        db.add(ScheduledWorkout(
            id=new_id("sched"),
            client_id=client.id,
            client_name=client.name,
            client_avatar=client.avatar,
            program_id=program.id,
            program_name=program.title,
            workout_day_id=day.get("id", f"day-{idx + 1}"),
            workout_title=day.get("name", f"Day {idx + 1} Workout"),
            date=(today + timedelta(days=idx * 2)).isoformat(),
            time="09:00 AM",
            status="Scheduled",
            exercises=day.get("exercises", []),
        ))
    client.total_workouts_assigned = (client.total_workouts_assigned or 0) + len(days)

    log_activity(db, client, "check_in_submitted", f"Assigned: {program.title}",
                 f"Program assigned with {len(days)} training days", {"program_id": program.id})
    await db.commit()
    return {
        "message": f"Assigned '{program.title}' to {client.name}",
        "client_id": client.id,
        "program_id": program.id,
        "scheduled_count": len(days),
    }


@router.delete("/{program_id}")
async def delete_program(program_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    prog = await _get_own_program(program_id, coach, db)
    await db.delete(prog)
    await db.commit()
    return {"message": "Program deleted successfully", "id": program_id}
