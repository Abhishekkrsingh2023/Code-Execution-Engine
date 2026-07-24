"""
Router for problem templates.

Two nested resources:
  /problem-templates/                              -> CommonProblemTemplate
  /problem-templates/{problem_id}/languages/{lang}  -> ProblemTemplate

Assumption: app.database exposes an async `get_db` dependency yielding an
AsyncSession. If your project uses a sync Session instead, drop every
`async`/`await` below and swap AsyncSession for Session — the logic (the
*order* of checks) doesn't change, only the syntax does.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import CommonProblemTemplate, ProblemTemplate
from app.schemas.problem import (
    CommonProblemTemplateCreate,
    CommonProblemTemplateUpdate,
    CommonProblemTemplateOut,
    CommonProblemTemplateDetailOut,
    ProblemTemplateCreate,
    ProblemTemplateUpdate,
    ProblemTemplateOut,
)

router = APIRouter(prefix="/problem-templates", tags=["problem-templates"])


# ---------------------------------------------------------------------------
# Shared lookup helper
# ---------------------------------------------------------------------------
# Every route below needs "fetch or 404" at least once. Pulling it out means
# that behavior (which status code, which message) is defined in one place.

async def _get_common_or_404(db: AsyncSession, problem_id: str) -> CommonProblemTemplate:
    obj = await db.get(CommonProblemTemplate, problem_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Problem '{problem_id}' not found")
    return obj


async def _get_template_or_404(db: AsyncSession, problem_id: str, language: str) -> ProblemTemplate:
    obj = await db.get(ProblemTemplate, (problem_id, language))
    if obj is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"No '{language}' template for problem '{problem_id}'",
        )
    return obj


# ---------------------------------------------------------------------------
# CommonProblemTemplate CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=CommonProblemTemplateOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_common_template(
    payload: CommonProblemTemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    # problem_id is client-supplied, so the only thing we control is
    # rejecting a duplicate cleanly (409) instead of letting the DB's
    # PK constraint throw an IntegrityError that surfaces as a 500.
    existing = await db.get(CommonProblemTemplate, payload.problem_id)
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Problem '{payload.problem_id}' already exists",
        )

    obj = CommonProblemTemplate(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.get("/", response_model=list[CommonProblemTemplateOut])
async def list_common_templates(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CommonProblemTemplate).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.get("/{problem_id}", response_model=CommonProblemTemplateDetailOut)
async def get_common_template(
    problem_id: str,
    db: AsyncSession = Depends(get_db),
):
    # selectinload here because the response includes nested `templates`;
    # without it, accessing obj.templates would trigger a lazy load that
    # doesn't work in an async context (implicit IO on attribute access).
    result = await db.execute(
        select(CommonProblemTemplate)
        .where(CommonProblemTemplate.problem_id == problem_id)
        .options(selectinload(CommonProblemTemplate.templates))
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Problem '{problem_id}' not found")
    return obj


@router.patch("/{problem_id}", response_model=CommonProblemTemplateOut)
async def update_common_template(
    problem_id: str,
    payload: CommonProblemTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await _get_common_or_404(db, problem_id)
    # exclude_unset: only fields the client actually sent get overwritten.
    # Without this, an omitted field would be reset to its Pydantic default
    # (e.g. time_limit silently reset to whatever the schema's default is).
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(obj, field, value)
    obj.updated_at = datetime.now()
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_common_template(
    problem_id: str,
    db: AsyncSession = Depends(get_db),
):
    obj = await _get_common_or_404(db, problem_id)
    # passive_deletes=True on the relationship means we do NOT touch
    # obj.templates here — the DB's ON DELETE CASCADE removes the
    # child rows itself when this row is deleted.
    await db.delete(obj)
    await db.commit()
    return None


# ---------------------------------------------------------------------------
# ProblemTemplate (per-language) CRUD, nested under a problem_id
# ---------------------------------------------------------------------------

@router.post(
    "/{problem_id}/languages/{language}",
    response_model=ProblemTemplateOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_language_template(
    problem_id: str,
    language: str,
    payload: ProblemTemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    # Parent must exist — otherwise the FK insert would fail anyway,
    # but checking first lets us return a clear 404 instead of a raw
    # IntegrityError bubbling up as a 500.
    await _get_common_or_404(db, problem_id)

    existing = await db.get(ProblemTemplate, (problem_id, language))
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A '{language}' template already exists for problem '{problem_id}'",
        )

    obj = ProblemTemplate(problem_id=problem_id, language=language, **payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.get("/{problem_id}/languages", response_model=list[ProblemTemplateOut])
async def list_language_templates(
    problem_id: str,
    db: AsyncSession = Depends(get_db),
):
    await _get_common_or_404(db, problem_id)
    result = await db.execute(
        select(ProblemTemplate).where(ProblemTemplate.problem_id == problem_id)
    )
    return result.scalars().all()


@router.get("/{problem_id}/languages/{language}", response_model=ProblemTemplateOut)
async def get_language_template(
    problem_id: str,
    language: str,
    db: AsyncSession = Depends(get_db),
):
    return await _get_template_or_404(db, problem_id, language)


@router.patch("/{problem_id}/languages/{language}", response_model=ProblemTemplateOut)
async def update_language_template(
    problem_id: str,
    language: str,
    payload: ProblemTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await _get_template_or_404(db, problem_id, language)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(obj, field, value)
    obj.updated_at = datetime.now()
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{problem_id}/languages/{language}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_language_template(
    problem_id: str,
    language: str,
    db: AsyncSession = Depends(get_db),
):
    obj = await _get_template_or_404(db, problem_id, language)
    await db.delete(obj)
    await db.commit()
    return None