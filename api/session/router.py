"""
Session router for handling session initialization.
"""

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from api.auth.stack_auth import verify_stack_token
from api.core.dependencies import SupabaseClient
from api.db.service import get_or_create_session


router = APIRouter(prefix="/api/session", tags=["session"])


class SessionResponse(BaseModel):
    """Response model for session data."""

    id: str
    user_id: str
    status: str
    created_at: str


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
