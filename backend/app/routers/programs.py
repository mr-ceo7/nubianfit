"""
Training Programs Router
"""

import time
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db
from app.models.program import TrainingProgram
from app.models.client import Client
from app.models.workout import ScheduledWorkout
from app.models.activity import ActivityFeedItem
from app.schemas.program import (
    ProgramCreate,
    ProgramUpdate,
    ProgramResponse,
    AssignProgramRequest
)

router = APIRouter(prefix="/programs", tags=["Programs"])


@router.get("", response_model=List[ProgramResponse])
async def list_programs(
    goal: Optional[str] = None,
    difficulty: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all training programs."""
    query = select(TrainingProgram)
    if goal:
        query = query.where(TrainingProgram.goal == goal)
    if difficulty:
        query = query.where(TrainingProgram.difficulty == difficulty)
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{program_id}", response_model=ProgramResponse)
async def get_program(program_id: str, db: AsyncSession = Depends(get_db)):
    """Get single program details."""
    result = await db.execute(select(TrainingProgram).where(TrainingProgram.id == program_id))
    prog = result.scalar_one_or_none()
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    return prog


@router.post("", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED)
async def save_or_create_program(program_in: ProgramCreate, db: AsyncSession = Depends(get_db)):
    """Create or update a training program."""
    now_str = date.today().isoformat()
    prog_id = program_in.id or f"prog-{int(time.time() * 1000)}"
    
    # Check if program exists
    result = await db.execute(select(TrainingProgram).where(TrainingProgram.id == prog_id))
    existing = result.scalar_one_or_none()
    
    if existing:
        update_dict = program_in.model_dump(exclude_unset=True)
        update_dict["updated_at"] = now_str
        for k, v in update_dict.items():
            setattr(existing, k, v)
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        new_prog = TrainingProgram(
            id=prog_id,
            title=program_in.title,
            subtitle=program_in.subtitle,
            description=program_in.description,
            difficulty=program_in.difficulty,
            goal=program_in.goal,
            duration_weeks=program_in.duration_weeks,
            days_per_week=program_in.days_per_week,
            days=program_in.days,
            tags=program_in.tags,
            assigned_client_count=program_in.assigned_client_count,
            created_at=program_in.created_at or now_str,
            updated_at=now_str
        )
        db.add(new_prog)
        await db.commit()
        await db.refresh(new_prog)
        return new_prog


@router.patch("/{program_id}", response_model=ProgramResponse)
@router.put("/{program_id}", response_model=ProgramResponse)
async def update_program(
    program_id: str,
    program_in: ProgramUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update program details."""
    result = await db.execute(select(TrainingProgram).where(TrainingProgram.id == program_id))
    prog = result.scalar_one_or_none()
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    
    update_data = program_in.model_dump(exclude_unset=True)
    update_data["updated_at"] = date.today().isoformat()
    for field, val in update_data.items():
        setattr(prog, field, val)
        
    await db.commit()
    await db.refresh(prog)
    return prog


@router.post("/{program_id}/assign")
async def assign_program(
    program_id: str,
    req: AssignProgramRequest,
    db: AsyncSession = Depends(get_db)
):
    """Assign training program to a client and auto-schedule upcoming workouts."""
    prog_res = await db.execute(select(TrainingProgram).where(TrainingProgram.id == program_id))
    program = prog_res.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
        
    client_res = await db.execute(select(Client).where(Client.id == req.client_id))
    client = client_res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
        
    # Update client
    client.current_program_id = program.id
    client.current_program_name = program.title
    
    # Update program assigned count
    program.assigned_client_count = (program.assigned_client_count or 0) + 1
    
    # Auto-schedule workouts
    today = date.today()
    scheduled_workouts: List[ScheduledWorkout] = []
    
    for idx, day in enumerate(program.days or []):
        workout_date = today + timedelta(days=idx * 2)
        sched_id = f"sched-{int(time.time() * 1000)}-{idx}"
        
        sw = ScheduledWorkout(
            id=sched_id,
            client_id=client.id,
            client_name=client.name,
            client_avatar=client.avatar,
            program_id=program.id,
            program_name=program.title,
            workout_day_id=day.get("id", f"day-{idx+1}"),
            workout_title=day.get("name", f"Day {idx+1} Workout"),
            date=workout_date.isoformat(),
            time="09:00 AM",
            status="Scheduled",
            exercises=day.get("exercises", [])
        )
        db.add(sw)
        scheduled_workouts.append(sw)
        
    # Activity feed
    activity = ActivityFeedItem(
        id=f"act-{int(time.time() * 1000)}",
        type="check_in_submitted",
        client_id=client.id,
        client_name=client.name,
        client_avatar=client.avatar,
        title=f"Assigned: {program.title}",
        description=f"Program assigned with {len(program.days or [])} training days",
        timestamp="Just now",
        metadata_json={"program_id": program.id}
    )
    db.add(activity)
    
    await db.commit()
    return {
        "message": f"Assigned '{program.title}' to {client.name}",
        "client_id": client.id,
        "program_id": program.id,
        "scheduled_count": len(scheduled_workouts)
    }


@router.delete("/{program_id}")
async def delete_program(program_id: str, db: AsyncSession = Depends(get_db)):
    """Delete training program."""
    result = await db.execute(select(TrainingProgram).where(TrainingProgram.id == program_id))
    prog = result.scalar_one_or_none()
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    
    await db.delete(prog)
    await db.commit()
    return {"message": "Program deleted successfully", "id": program_id}
