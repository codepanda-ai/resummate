"""
Resume router for handling resume upload, retrieval, and deletion.
"""

import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status

from api.auth.stack_auth import verify_stack_token
from api.core.dependencies import GeminiClient, SessionOwner, SupabaseClient
from api.core.schemas import FileUploadResponse, FileInfoResponse
from api.db.service import (
    get_session_user_id,
    save_resume,
    get_resume as fetch_resume,
    delete_resume as remove_resume,
)
from api.services.gemini import upload_file

router = APIRouter(
    prefix="/api/resume", tags=["resume"], dependencies=[Depends(verify_stack_token)]
)


@router.post(
    "/upload", response_model=FileUploadResponse, status_code=status.HTTP_200_OK
)
async def upload_resume(
    supabase: SupabaseClient,
    gemini: GeminiClient,
    file: UploadFile = File(...),
    uuid: str = Form(None),
    auth_user: dict = Depends(verify_stack_token),
) -> FileUploadResponse:
    """
    Upload a resume file.

    If a session UUID is provided, verifies the authenticated user owns that session.

    Args:
        supabase: Supabase client dependency
        gemini: Gemini client dependency
        file: Resume file to upload
        uuid: Optional thread UUID
        auth_user: Authenticated user data from JWT token

    Returns:
        FileUploadResponse: Success message

    Raises:
        HTTPException: 403 if uuid belongs to another user
        HTTPException: If upload fails
    """
    if uuid:
        owner_id = await get_session_user_id(supabase, uuid)
        if owner_id is None or owner_id != auth_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    try:
        gemini_file = await upload_file(gemini, file)

        session_id = uuid if uuid else str(uuid_lib.uuid4())

        file_name = file.filename or "resume.pdf"
        await save_resume(
            supabase=supabase,
            session_id=session_id,
            file_name=file_name,
            resume_file=gemini_file,
        )

        return FileUploadResponse(message="Resume uploaded successfully!")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading file: {e}",
        )


@router.get(
    "/{session_id}", response_model=FileInfoResponse, status_code=status.HTTP_200_OK
)
async def get_resume(
    session_id: str, supabase: SupabaseClient, auth_user: SessionOwner
) -> FileInfoResponse:
    """
    Get resume information for a thread.

    Args:
        session_id: Thread identifier
        supabase: Supabase client dependency
        auth_user: Authenticated user data (ownership verified)

    Returns:
        FileInfoResponse: Resume file information

    Raises:
        HTTPException: If resume not found
    """
    resume = await fetch_resume(supabase, session_id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found"
        )

    return FileInfoResponse(
        name=resume[0]["file_name"], contentType=resume[0]["mime_type"]
    )


@router.delete(
    "/{session_id}", response_model=FileUploadResponse, status_code=status.HTTP_200_OK
)
async def delete_resume(
    session_id: str, supabase: SupabaseClient, auth_user: SessionOwner
) -> FileUploadResponse:
    """
    Delete a resume for a thread.

    Args:
        session_id: Thread identifier
        supabase: Supabase client dependency
        auth_user: Authenticated user data (ownership verified)

    Returns:
        FileUploadResponse: Success message

    Raises:
        HTTPException: If deletion fails
    """
    try:
        await remove_resume(supabase, session_id)
        return FileUploadResponse(message="Resume deleted successfully!")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting resume: {e}",
        )
