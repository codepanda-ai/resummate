"""
Session router for handling session initialization and status transitions.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from api.auth.stack_auth import verify_stack_token
from api.core.dependencies import ReportAgentDep, SupabaseClient
from api.db.service import (
    get_or_create_session,
    update_session_status,
    save_session_report,
    get_session_report,
)


router = APIRouter(prefix="/api/session", tags=["session"])


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

    Args:
        session_id: Session identifier from URL path
        supabase: Supabase client dependency
        auth_user: Authenticated user data from JWT token

    Returns:
        SessionResponse: Session data
    """
    user_id = auth_user["id"]
    session = await get_or_create_session(supabase, session_id, user_id)
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
    auth_user: dict = Depends(verify_stack_token),
) -> SessionResponse:
    """
    Mark a session as in progress.

    Args:
        session_id: Session identifier from URL path
        supabase: Supabase client dependency
        auth_user: Authenticated user data from JWT token

    Returns:
        SessionResponse: Updated session data
    """
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
    auth_user: dict = Depends(verify_stack_token),
) -> SessionResponse:
    """
    Mark a session as finished.

    Args:
        session_id: Session identifier from URL path
        supabase: Supabase client dependency
        auth_user: Authenticated user data from JWT token

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
    x_test_mode: Optional[str] = Header(None),
    auth_user: dict = Depends(verify_stack_token),
) -> ReportResponse:
    """
    Generate a markdown feedback report for a completed interview session.

    Args:
        session_id: Session identifier from URL path
        supabase: Supabase client dependency
        agent: ReportAgent dependency
        x_test_mode: Test mode header flag
        auth_user: Authenticated user data from JWT token

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
    auth_user: dict = Depends(verify_stack_token),
) -> ReportResponse:
    """
    Retrieve the generated feedback report for a session.

    Args:
        session_id: Session identifier from URL path
        supabase: Supabase client dependency
        auth_user: Authenticated user data from JWT token

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
