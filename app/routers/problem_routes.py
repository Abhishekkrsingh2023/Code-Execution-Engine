from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.problem_controller import (
    handle_create_full_problem,
    handle_create_or_update_common_template,
    handle_create_problem,
    handle_delete_problem,
    handle_get_common_template,
    handle_get_full_problem,
    handle_get_problem,
    handle_get_problem_test_cases,
    handle_list_common_templates,
    handle_list_problems,
    handle_update_problem,
    handle_update_problem_status,
)
from app.database import get_db
from app.dependencies import require_moderator_or_admin
from app.models.problem import ProblemDifficulty, ProblemStatus
from app.models.user import User
from app.schemas.problem import (
    CommonProblemTemplateCreateRequest,
    CommonProblemTemplateResponse,
    FullProblemCreateRequest,
    FullProblemResponse,
    ProblemCreateRequest,
    ProblemListResponse,
    ProblemResponse,
    ProblemStatusUpdateRequest,
    ProblemUpdateRequest,
    TestCaseResponse,
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
    difficulty: ProblemDifficulty | None = Query(default=None, description="Difficulty filter."),
    category: str | None = Query(default=None, description="Category filter."),
    topic: str | None = Query(
        default=None, description="Topic tag filter (e.g. array, tree, linkedlist, recursion)."
    ),
    problem_status: ProblemStatus | None = Query(
        default=None, alias="status", description="Status filter."
    ),
    search: str | None = Query(
        default=None, description="Search term across title, description, and topic."
    ),
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


@router.post(
    "/full",
    response_model=FullProblemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create full problem with templates and test cases (Moderator or Admin)",
)
async def create_full_problem(
    payload: FullProblemCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_moderator_or_admin),
) -> FullProblemResponse:
    """Creates a problem, common problem template, language templates, and test cases atomically."""
    return await handle_create_full_problem(
        user=current_user,
        payload=payload,
        request=request,
        db=db,
    )


@router.get(
    "/templates/common",
    response_model=list[CommonProblemTemplateResponse],
    status_code=status.HTTP_200_OK,
    summary="List all common problem templates",
)
async def list_common_templates(
    db: AsyncSession = Depends(get_db),
) -> list[CommonProblemTemplateResponse]:
    """Retrieves all common problem templates with run and submit test cases."""
    return await handle_list_common_templates(db=db)


@router.get(
    "/templates/common/{problem_id}",
    response_model=CommonProblemTemplateResponse,
    status_code=status.HTTP_200_OK,
    summary="Get common problem template by integer problem ID",
)
async def get_common_template(
    problem_id: int,
    db: AsyncSession = Depends(get_db),
) -> CommonProblemTemplateResponse:
    """Retrieves a common problem template by its integer problem identifier."""
    return await handle_get_common_template(problem_id=problem_id, db=db)



@router.post(
    "/templates/common",
    response_model=CommonProblemTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or update common problem template (Moderator or Admin)",
)
async def create_or_update_common_template(
    payload: CommonProblemTemplateCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_moderator_or_admin),
) -> CommonProblemTemplateResponse:
    """Creates or updates common problem template with run/submit test cases."""
    return await handle_create_or_update_common_template(
        payload=payload,
        user=current_user,
        request=request,
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


@router.get(
    "/{problem_id}/full",
    response_model=FullProblemResponse,
    status_code=status.HTTP_200_OK,
    summary="Get full problem with templates and test cases",
)
async def get_full_problem(
    problem_id: int,
    db: AsyncSession = Depends(get_db),
) -> FullProblemResponse:
    """Retrieves complete problem definition including run/submit test cases and templates."""
    return await handle_get_full_problem(problem_id=problem_id, db=db)


@router.get(
    "/{problem_id}/test-cases",
    response_model=list[TestCaseResponse],
    status_code=status.HTTP_200_OK,
    summary="Get test cases for a problem",
)
async def get_problem_test_cases(
    problem_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[TestCaseResponse]:
    """Retrieves test cases associated with a problem."""
    return await handle_get_problem_test_cases(problem_id=problem_id, db=db)


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
