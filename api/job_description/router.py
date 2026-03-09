"""
Job description router for handling job description upload, retrieval, and deletion.
"""

import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status

from api.auth.stack_auth import verify_stack_token
from api.core.dependencies import GeminiClient, SessionOwner, SupabaseClient
from api.core.schemas import FileUploadResponse, FileInfoResponse
from api.db.service import (
    get_session_user_id,
    save_job_description,
    get_job_description as fetch_job_description,
    delete_job_description as remove_job_description,
)
from api.services.gemini import upload_file

router = APIRouter(
    prefix="/api/job-description",
    tags=["job-description"],
    dependencies=[Depends(verify_stack_token)],
)


@router.post(
    "/upload", response_model=FileUploadResponse, status_code=status.HTTP_200_OK
)
async def upload_job_description(
    supabase: SupabaseClient,
    gemini: GeminiClient,
    file: UploadFile = File(...),
    uuid: str = Form(None),
    auth_user: dict = Depends(verify_stack_token),
) -> FileUploadResponse:
    """
    Upload a job description file.

    If a session UUID is provided, verifies the authenticated user owns that session.

    Args:
        supabase: Supabase client dependency
        gemini: Gemini client dependency
        file: Job description file to upload
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

        file_name = file.filename or "job_description.pdf"
        await save_job_description(
            supabase=supabase,
            session_id=session_id,
            file_name=file_name,
            job_description_file=gemini_file,
        )

        return FileUploadResponse(message="Job description uploaded successfully!")
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
async def get_job_description(
    session_id: str, supabase: SupabaseClient, auth_user: SessionOwner
) -> FileInfoResponse:
    """
    Get job description information for a thread.

    Args:
        session_id: Thread identifier
        supabase: Supabase client dependency
        auth_user: Authenticated user data (ownership verified)

    Returns:
        FileInfoResponse: Job description file information

    Raises:
        HTTPException: If job description not found
    """
    job_description = await fetch_job_description(supabase, session_id)
    if not job_description:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job description not found"
        )

    return FileInfoResponse(
        name=job_description[0]["file_name"],
        contentType=job_description[0]["mime_type"],
    )


@router.delete(
    "/{session_id}", response_model=FileUploadResponse, status_code=status.HTTP_200_OK
)
async def delete_job_description(
    session_id: str, supabase: SupabaseClient, auth_user: SessionOwner
) -> FileUploadResponse:
    """
    Delete a job description for a thread.

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
        await remove_job_description(supabase, session_id)
        return FileUploadResponse(message="Job description deleted successfully!")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting job description: {e}",
        )
