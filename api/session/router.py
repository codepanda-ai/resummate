"""
Session router for handling session initialization and status transitions.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from api.auth.stack_auth import verify_stack_token
from api.core.dependencies import ReportAgentDep, SessionOwner, SupabaseClient
from api.db.service import (
    get_job_description,
    get_or_create_session,
    get_resume,
    get_session_report,
    list_user_sessions,
    save_session_report,
    update_session_status,
)


router = APIRouter(prefix="/api/session", tags=["session"])


class SessionListItem(BaseModel):
    """Response model for a session list item."""

    id: str
    status: str
    created_at: str


class SessionListResponse(BaseModel):
    """Response model for session list."""

    sessions: list[SessionListItem]


class SessionResponse(BaseModel):
    """Response model for session data."""

    id: str
    user_id: str
    status: str
    created_at: str


class ReportResponse(BaseModel):
    """Response model for session report."""

    report: str


@router.get(
    "",
    response_model=SessionListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_sessions(
    supabase: SupabaseClient,
    auth_user: dict = Depends(verify_stack_token),
) -> SessionListResponse:
    """
    List the most recent sessions for the authenticated user.

    Returns:
        SessionListResponse: Up to 20 most recent sessions sorted by creation date
    """
    user_id = auth_user["id"]
    sessions = await list_user_sessions(supabase, user_id)
    return SessionListResponse(
        sessions=[
            SessionListItem(
                id=s["id"],
                status=s["status"],
                created_at=str(s["created_at"]),
            )
            for s in sessions
        ]
    )


@router.get(
    "/{session_id}",
    response_model=SessionResponse,
    status_code=status.HTTP_200_OK,
)
async def get_or_init_session(
    session_id: str,
    supabase: SupabaseClient,
    auth_user: dict = Depends(verify_stack_token),
) -> SessionResponse:
    """
    Get an existing session or create a new one.

    If the session already exists, verifies the authenticated user owns it.

    Args:
        session_id: Session identifier from URL path
        supabase: Supabase client dependency
        auth_user: Authenticated user data from JWT token

    Returns:
        SessionResponse: Session data

    Raises:
        HTTPException: 403 if session exists and belongs to a different user
    """
    user_id = auth_user["id"]
    session = await get_or_create_session(supabase, session_id, user_id)
    if session["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return SessionResponse(
        id=session["id"],
        user_id=session["user_id"],
        status=session["status"],
        created_at=str(session["created_at"]),
    )


@router.patch(
    "/{session_id}/start",
    response_model=SessionResponse,
    status_code=status.HTTP_200_OK,
)
async def start_session(
    session_id: str,
    supabase: SupabaseClient,
    auth_user: SessionOwner,
) -> SessionResponse:
    """
    Mark a session as in progress.

    Validates that both a resume and job description have been uploaded before
    allowing the session to start.

    Args:
        session_id: Session identifier from URL path
        supabase: Supabase client dependency
        auth_user: Authenticated user data (ownership verified)

    Returns:
        SessionResponse: Updated session data

    Raises:
        HTTPException: If resume or job description is missing
    """
    resume = await get_resume(supabase, session_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A resume must be uploaded before starting the interview",
        )

    job_description = await get_job_description(supabase, session_id)
    if not job_description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A job description must be uploaded before starting the interview",
        )

    session = await update_session_status(supabase, session_id, "IN_PROGRESS")
    return SessionResponse(
        id=session["id"],
        user_id=session["user_id"],
        status=session["status"],
        created_at=str(session["created_at"]),
    )


@router.patch(
    "/{session_id}/end",
    response_model=SessionResponse,
    status_code=status.HTTP_200_OK,
)
async def end_session(
    session_id: str,
    supabase: SupabaseClient,
    auth_user: SessionOwner,
) -> SessionResponse:
    """
    Mark a session as finished.

    Args:
        session_id: Session identifier from URL path
        supabase: Supabase client dependency
        auth_user: Authenticated user data (ownership verified)

    Returns:
        SessionResponse: Updated session data
    """
    session = await update_session_status(supabase, session_id, "FINISHED")
    return SessionResponse(
        id=session["id"],
        user_id=session["user_id"],
        status=session["status"],
        created_at=str(session["created_at"]),
    )


@router.post(
    "/{session_id}/report",
    response_model=ReportResponse,
    status_code=status.HTTP_200_OK,
)
async def generate_report(
    session_id: str,
    supabase: SupabaseClient,
    agent: ReportAgentDep,
    auth_user: SessionOwner,
    x_test_mode: Optional[str] = Header(None),
) -> ReportResponse:
    """
    Generate a markdown feedback report for a completed interview session.

    Args:
        session_id: Session identifier from URL path
        supabase: Supabase client dependency
        agent: ReportAgent dependency
        auth_user: Authenticated user data (ownership verified)
        x_test_mode: Test mode header flag

    Returns:
        ReportResponse: Generated markdown report

    Raises:
        HTTPException: If report generation fails
    """
    if x_test_mode == "true":
        await save_session_report(supabase, session_id, agent.MOCK_REPORT)
        return ReportResponse(report=agent.MOCK_REPORT)

    try:
        report = await agent.run(session_id)
        await save_session_report(supabase, session_id, report)
        return ReportResponse(report=report)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating report: {e}",
        )


@router.get(
    "/{session_id}/report",
    response_model=ReportResponse,
    status_code=status.HTTP_200_OK,
)
async def get_report(
    session_id: str,
    supabase: SupabaseClient,
    auth_user: SessionOwner,
) -> ReportResponse:
    """
    Retrieve the generated feedback report for a session.

    Args:
        session_id: Session identifier from URL path
        supabase: Supabase client dependency
        auth_user: Authenticated user data (ownership verified)

    Returns:
        ReportResponse: Saved markdown report

    Raises:
        HTTPException: If report not found
    """
    report = await get_session_report(supabase, session_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found for this session",
        )
    return ReportResponse(report=report)
