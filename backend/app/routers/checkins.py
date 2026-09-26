"""
Check-in forms: coaches build questionnaires and schedule them per client; clients answer
when due; coaches review and comment. Also stores and serves check-in photos.
"""

from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_accessible_client, get_current_user, get_db, require_coach, resolve_client_filter
from app.models.client import Client
from app.models.engagement import CheckinAssignment, CheckinForm, CheckinResponse, StoredFile
from app.models.metric import MetricEntry
from app.models.photo import ProgressPhoto
from app.models.user import User
from app.schemas.engagement import (
    CheckinAssignBody, CheckinAssignmentResponse, CheckinFormBody, CheckinFormResponse, CheckinResponseOut,
    CheckinSubmit, ReviewBody,
)
from app.services.activity import log_activity, new_id
from app.services.checkins import (
    due_dates, next_due_date, pending_due_date, sign_file, validate_answers, verify_file_signature,
)
from app.services.notify import client_user_ids, notify

router = APIRouter(tags=["Check-ins"])

MAX_UPLOAD_BYTES = 2 * 1024 * 1024
IMAGE_SIGNATURES = {"image/jpeg": (b"\xff\xd8\xff",), "image/png": (b"\x89PNG",), "image/webp": (b"RIFF",)}


# --- Forms -------------------------------------------------------------------------

async def _get_form(form_id: str, coach: User, db: AsyncSession) -> CheckinForm:
    form = await db.get(CheckinForm, form_id)
    if not form or form.coach_id != coach.id:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


@router.get("/checkin-forms", response_model=List[CheckinFormResponse])
async def list_forms(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Coaches get their forms; clients get the forms scheduled for them."""
    if user.role == "coach":
        query = select(CheckinForm).where(CheckinForm.coach_id == user.id)
    else:
        assigned = select(CheckinAssignment.form_id).where(CheckinAssignment.client_id == user.client_id)
        query = select(CheckinForm).where(CheckinForm.id.in_(assigned))
    return (await db.execute(query.order_by(CheckinForm.title))).scalars().all()


@router.post("/checkin-forms", response_model=CheckinFormResponse, status_code=status.HTTP_201_CREATED)
async def create_form(body: CheckinFormBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    form = CheckinForm(id=new_id("form"), coach_id=coach.id, title=body.title.strip(), description=body.description,
                       questions=[q.model_dump(by_alias=True) for q in body.questions])
    db.add(form)
    await db.commit()
    await db.refresh(form)
    return form


@router.put("/checkin-forms/{form_id}", response_model=CheckinFormResponse)
async def update_form(form_id: str, body: CheckinFormBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    form = await _get_form(form_id, coach, db)
    form.title = body.title.strip()
    form.description = body.description
    form.questions = [q.model_dump(by_alias=True) for q in body.questions]
    form.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(form)
    return form


@router.delete("/checkin-forms/{form_id}")
async def delete_form(form_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    """Stops the schedules; past responses keep their own copy of the questions."""
    form = await _get_form(form_id, coach, db)
    await db.execute(delete(CheckinAssignment).where(CheckinAssignment.form_id == form.id))
    await db.delete(form)
    await db.commit()
    return {"message": "Form deleted", "id": form_id}


# --- Assignments ---------------------------------------------------------------------

async def _assignment_response(db: AsyncSession, a: CheckinAssignment, today: date) -> CheckinAssignmentResponse:
    answered = set((await db.execute(select(CheckinResponse.due_date).where(CheckinResponse.assignment_id == a.id))).scalars().all())
    return CheckinAssignmentResponse(
        id=a.id, form_id=a.form_id, client_id=a.client_id, frequency=a.frequency, start_date=a.start_date, active=a.active,
        pending_due_date=pending_due_date(a, answered, today), next_due_date=next_due_date(a, today),
    )


@router.get("/checkin-assignments", response_model=List[CheckinAssignmentResponse])
async def list_assignments(
    client_id: Optional[str] = Query(None, alias="clientId"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = await resolve_client_filter(client_id, user, db)
    rows = (await db.execute(select(CheckinAssignment).where(CheckinAssignment.client_id.in_(ids)))).scalars().all()
    today = date.today()
    return [await _assignment_response(db, a, today) for a in rows]


@router.post("/checkin-assignments", response_model=CheckinAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_form(body: CheckinAssignBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    form = await _get_form(body.form_id, coach, db)
    await get_accessible_client(body.client_id, coach, db)
    a = CheckinAssignment(id=new_id("chk-assign"), form_id=form.id, client_id=body.client_id, frequency=body.frequency,
                          start_date=body.start_date or date.today(), active=True)
    db.add(a)
    await db.commit()
    return await _assignment_response(db, a, date.today())


async def _get_assignment(assignment_id: str, user: User, db: AsyncSession) -> CheckinAssignment:
    a = await db.get(CheckinAssignment, assignment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Check-in not found")
    await get_accessible_client(a.client_id, user, db)
    return a


@router.patch("/checkin-assignments/{assignment_id}", response_model=CheckinAssignmentResponse)
async def set_assignment_active(assignment_id: str, active: bool = Query(...), coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    a = await _get_assignment(assignment_id, coach, db)
    a.active = active
    await db.commit()
    return await _assignment_response(db, a, date.today())


@router.delete("/checkin-assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    a = await _get_assignment(assignment_id, coach, db)
    await db.delete(a)
    await db.commit()
    return {"message": "Check-in schedule removed", "id": assignment_id}


# --- Responses -----------------------------------------------------------------------

def _response_out(r: CheckinResponse) -> CheckinResponseOut:
    urls = {v["fileId"]: sign_file(v["fileId"]) for v in (r.answers or {}).values() if isinstance(v, dict) and v.get("fileId")}
    return CheckinResponseOut(**CheckinResponseOut.model_validate(r).model_dump(exclude={"photo_urls"}), photo_urls=urls)


@router.get("/checkin-responses", response_model=List[CheckinResponseOut])
async def list_responses(
    client_id: Optional[str] = Query(None, alias="clientId"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = await resolve_client_filter(client_id, user, db)
    rows = (await db.execute(
        select(CheckinResponse).where(CheckinResponse.client_id.in_(ids)).order_by(CheckinResponse.submitted_at.desc()).limit(200)
    )).scalars().all()
    return [_response_out(r) for r in rows]


@router.post("/checkin-responses", response_model=CheckinResponseOut, status_code=status.HTTP_201_CREATED)
async def submit_checkin(body: CheckinSubmit, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role != "client":
        raise HTTPException(status_code=403, detail="Only the client can submit their check-in")
    a = await _get_assignment(body.assignment_id, user, db)
    today = date.today()
    if not a.active or body.due_date > today or body.due_date not in due_dates(a, today):
        raise HTTPException(status_code=400, detail="This check-in isn't due on that date")
    already = (await db.execute(
        select(CheckinResponse.id).where(CheckinResponse.assignment_id == a.id, CheckinResponse.due_date == body.due_date)
    )).first()
    if already:
        raise HTTPException(status_code=400, detail="You've already submitted this check-in")

    form = await db.get(CheckinForm, a.form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    try:
        answers = validate_answers(form.questions, body.answers)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    client = await db.get(Client, a.client_id)
    questions = {q["id"]: q for q in form.questions}
    for qid, value in answers.items():
        q = questions[qid]
        if q["type"] == "photo":
            f = await db.get(StoredFile, value["fileId"])
            if not f or f.client_id != client.id:
                raise HTTPException(status_code=422, detail=f'"{q["label"]}": photo not found')
            db.add(ProgressPhoto(id=new_id("photo"), client_id=client.id, date=today.isoformat(), view=q.get("view") or "Front",
                                 photo_url=f"file:{f.id}", weight_kg=client.current_weight_kg, notes=f"Check-in: {form.title}"))
        elif q["type"] == "weight":
            db.add(MetricEntry(id=new_id("m"), client_id=client.id, date=today.isoformat(), weight_kg=value, notes=f"Check-in: {form.title}"))
            client.current_weight_kg = value

    response = CheckinResponse(id=new_id("chk-resp"), assignment_id=a.id, form_id=form.id, client_id=client.id,
                               due_date=body.due_date, questions=form.questions, answers=answers)
    db.add(response)
    log_activity(db, client, "check_in_submitted", f"Check-in: {form.title}", "Submitted a check-in form", {"responseId": response.id})
    await db.commit()
    await db.refresh(response)
    await notify(db, [client.coach_id], "checkin_submitted", f"{client.name} submitted a check-in", form.title,
                 {"tab": "checkins", "clientId": client.id, "responseId": response.id})
    return _response_out(response)


@router.post("/checkin-responses/{response_id}/review", response_model=CheckinResponseOut)
async def review_checkin(response_id: str, body: ReviewBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    r = await db.get(CheckinResponse, response_id)
    if not r:
        raise HTTPException(status_code=404, detail="Check-in not found")
    await get_accessible_client(r.client_id, coach, db)
    r.coach_comment = body.comment.strip()
    r.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(r)
    if r.coach_comment:
        await notify(db, await client_user_ids(db, r.client_id), "checkin_reviewed", "Your coach reviewed your check-in",
                     r.coach_comment[:140], {"tab": "progress"})
    return _response_out(r)


# --- Files -------------------------------------------------------------------------

@router.post("/files", status_code=status.HTTP_201_CREATED)
async def upload_file(
    client_id: str = Form(..., alias="clientId"),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_accessible_client(client_id, user, db)
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Photo is too large (max 2 MB)")
    content_type = next((t for t, sigs in IMAGE_SIGNATURES.items() if any(data.startswith(s) for s in sigs)), None)
    if content_type == "image/webp" and data[8:12] != b"WEBP":
        content_type = None
    if not content_type:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG or WebP image")
    stored = StoredFile(id=new_id("file"), client_id=client_id, uploaded_by=user.id, content_type=content_type,
                        size_bytes=len(data), data=data)
    db.add(stored)
    await db.commit()
    return {"id": stored.id, "url": sign_file(stored.id)}


@router.get("/files/{file_id}")
async def get_file(file_id: str, exp: int = Query(...), sig: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Served by signed URL (valid 24 h) so <img> tags work without an Authorization header."""
    if not verify_file_signature(file_id, exp, sig):
        raise HTTPException(status_code=404, detail="File not found")
    stored = await db.get(StoredFile, file_id)
    if not stored:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=stored.data, media_type=stored.content_type,
                    headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"})
