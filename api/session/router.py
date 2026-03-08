"""
Session router for handling session initialization and status transitions.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from api.auth.stack_auth import verify_stack_token
from api.core.dependencies import SupabaseClient, GeminiClient
from api.db.service import (
    get_or_create_session,
    update_session_status,
    get_messages,
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


MOCK_FEEDBACK_REPORT = """# Interview Performance Report

## Overall Score: 82/100

## Decision: OFFER

## Summary
The candidate demonstrated strong communication skills and relevant technical experience throughout the session. Answers were generally well-structured using the STAR method, with clear outcomes described. Some areas could benefit from more quantitative impact data.

## Strengths
- **Clear communication**: Answers were organized and easy to follow
- **Relevant experience**: Effectively referenced past projects aligned to the role
- **Problem-solving approach**: Articulated a methodical process for debugging and technical challenges

## Areas for Improvement
- **Quantify impact**: Add specific metrics (e.g., "reduced latency by 40%") to strengthen answers
- **Leadership depth**: Provide more examples of driving team decisions or mentoring others
- **Edge case thinking**: When discussing system design, proactively address failure modes

## Question-by-Question Breakdown
| Question | Rating | Notes |
|----------|--------|-------|
| Technical challenge question | Strong | Good detail on root cause analysis |
| Leadership/collaboration question | Adequate | Could include more specific outcomes |
| System design question | Strong | Solid fundamentals, missing scalability discussion |
| Behavioral question | Adequate | Answer was relevant but lacked measurable results |

## Recommendations
- Practice answering with the STAR framework and always end with a quantifiable result
- Prepare 2-3 stories that can be adapted across behavioral, leadership, and technical questions
- Review common system design patterns and practice explaining trade-offs out loud
"""


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
    gemini: GeminiClient,
    x_test_mode: Optional[str] = Header(None),
    auth_user: dict = Depends(verify_stack_token),
) -> ReportResponse:
    """
    Generate a markdown feedback report for a completed interview session.

    Args:
        session_id: Session identifier from URL path
        supabase: Supabase client dependency
        gemini: Gemini client dependency
        x_test_mode: Test mode header flag
        auth_user: Authenticated user data from JWT token

    Returns:
        ReportResponse: Generated markdown report

    Raises:
        HTTPException: If report generation fails
    """
    if x_test_mode == "true":
        await save_session_report(supabase, session_id, MOCK_FEEDBACK_REPORT)
        return ReportResponse(report=MOCK_FEEDBACK_REPORT)

    try:
        stored_messages = await get_messages(supabase, session_id, limit=100)
        if not stored_messages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No messages found for this session",
            )

        history = []
        for msg in stored_messages[::-1]:
            role = "model" if msg["sender"] == "model" else "user"
            history.append({"role": role, "parts": [{"text": msg["content"]}]})

        from api.services.prompts import get_system_prompt
        from api.core.config import settings

        chat = gemini.chats.create(
            model=settings.GEMINI_MODEL,
            config={
                "system_instruction": get_system_prompt(),
                "max_output_tokens": 4096,
                "temperature": 0.3,
            },
            history=history,
        )

        response = chat.send_message("Generate a markdown evaluation report")
        report = response.text

        await save_session_report(supabase, session_id, report)
        return ReportResponse(report=report)
    except HTTPException:
        raise
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
