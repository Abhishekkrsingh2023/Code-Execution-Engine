from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.problem_controller import (
    handle_create_problem,
    handle_delete_problem,
    handle_get_problem,
    handle_list_problems,
    handle_update_problem,
    handle_update_problem_status,
)
from app.database import get_db
from app.dependencies import require_moderator_or_admin
from app.models.problem import ProblemDifficulty, ProblemStatus
from app.models.user import User
from app.schemas.problem import (
    ProblemCreateRequest,
    ProblemListResponse,
    ProblemResponse,
    ProblemStatusUpdateRequest,
    ProblemUpdateRequest,
)
from app.schemas.user import MessageResponse

router = APIRouter(
    prefix="/api-v1/problems",
    tags=["problems"],
)


@router.post(
    "",
    response_model=ProblemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new problem (Moderator or Admin)",
)
async def create_problem(
    payload: ProblemCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_moderator_or_admin),
) -> ProblemResponse:
    """Creates a new programming problem with topic support and records an audit log entry."""
    return await handle_create_problem(
        user=current_user,
        payload=payload,
        request=request,
        db=db,
    )


@router.get(
    "",
    response_model=ProblemListResponse,
    status_code=status.HTTP_200_OK,
    summary="List problems with filtering and search",
)
async def list_problems(
    skip: int = Query(default=0, ge=0, description="Offset."),
    limit: int = Query(default=20, ge=1, le=100, description="Page limit."),
    difficulty: Optional[ProblemDifficulty] = Query(default=None, description="Difficulty filter."),
    category: Optional[str] = Query(default=None, description="Category filter."),
    topic: Optional[str] = Query(default=None, description="Topic tag filter (e.g. array, tree, linkedlist, recursion)."),
    problem_status: Optional[ProblemStatus] = Query(default=None, alias="status", description="Status filter."),
    search: Optional[str] = Query(default=None, description="Search term across title, description, and topic."),
    db: AsyncSession = Depends(get_db),
) -> ProblemListResponse:
    """Lists problems with filtering by difficulty, category, topic, status, or search query."""
    return await handle_list_problems(
        skip=skip,
        limit=limit,
        difficulty=difficulty,
        category=category,
        topic=topic,
        problem_status=problem_status,
        search=search,
        db=db,
    )


@router.get(
    "/{problem_id}",
    response_model=ProblemResponse,
    status_code=status.HTTP_200_OK,
    summary="Get problem by ID",
)
async def get_problem(
    problem_id: int,
    db: AsyncSession = Depends(get_db),
) -> ProblemResponse:
    """Retrieves single problem details by ID."""
    return await handle_get_problem(problem_id=problem_id, db=db)


@router.patch(
    "/{problem_id}",
    response_model=ProblemResponse,
    status_code=status.HTTP_200_OK,
    summary="Update problem details (Moderator or Admin)",
)
async def update_problem(
    problem_id: int,
    payload: ProblemUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_moderator_or_admin),
) -> ProblemResponse:
    """Updates problem details and records an audit log entry."""
    return await handle_update_problem(
        user=current_user,
        problem_id=problem_id,
        payload=payload,
        request=request,
        db=db,
    )


@router.patch(
    "/{problem_id}/status",
    response_model=ProblemResponse,
    status_code=status.HTTP_200_OK,
    summary="Change problem publication status (Moderator or Admin)",
)
async def update_problem_status(
    problem_id: int,
    payload: ProblemStatusUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_moderator_or_admin),
) -> ProblemResponse:
    """Changes problem publication status (published, unpublished, draft, archived) and audit-logs."""
    return await handle_update_problem_status(
        user=current_user,
        problem_id=problem_id,
        payload=payload,
        request=request,
        db=db,
    )


@router.delete(
    "/{problem_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete problem (Moderator or Admin)",
)
async def delete_problem(
    problem_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_moderator_or_admin),
) -> MessageResponse:
    """Soft-deletes a problem and records an audit log entry."""
    return await handle_delete_problem(
        user=current_user,
        problem_id=problem_id,
        request=request,
        db=db,
    )
