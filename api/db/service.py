"""
Database service layer for Supabase operations.
"""

import traceback
from typing import Any, Dict, List, Optional

from google.genai.types import File
from supabase import Client

from api.core.logging import log_error
from api.core.schemas import Message, User


async def create_message(supabase: Client, message: Message) -> List[Dict[str, Any]]:
    """
    Create a new message in the database.

    Args:
        supabase: Supabase client instance
        message: Message data to create

    Returns:
        List[Dict[str, Any]]: Created message data

    Raises:
        Exception: If message creation fails
    """
    try:
        data = (
            supabase.table("message")
            .insert(
                {
                    "thread_id": message.thread_id,
                    "sender": message.sender,
                    "content": message.content,
                }
            )
            .execute()
        )
        return data.data
    except Exception as e:
        log_error(f"Error creating message: {e}")
        traceback.print_exc()
        raise Exception(f"Error creating message: {e}")


async def get_messages(
    supabase: Client, thread_id: str, limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Retrieve messages for a specific thread.

    Args:
        supabase: Supabase client instance
        thread_id: Thread identifier
        limit: Maximum number of messages to retrieve

    Returns:
        List[Dict[str, Any]]: List of messages

    Raises:
        Exception: If message retrieval fails
    """
    try:
        query = (
            supabase.table("message")
            .select("*")
            .eq("thread_id", thread_id)
            .order("sent_at", desc=True)
            .limit(limit)
        )
        data = query.execute()
        return data.data
    except Exception as e:
        log_error(f"Error getting messages: {e}")
        traceback.print_exc()
        raise Exception(f"Error getting messages: {e}")


async def save_resume(
    supabase: Client, thread_id: str, file_name: str, resume_file: File
) -> List[Dict[str, Any]]:
    """
    Save or update a resume file in the database.

    Args:
        supabase: Supabase client instance
        thread_id: Thread identifier
        file_name: Name of the file
        resume_file: Google GenAI File object

    Returns:
        List[Dict[str, Any]]: Saved resume data

    Raises:
        Exception: If resume save fails
    """
    file_data = _extract_file_data(thread_id, file_name, resume_file)

    try:
        existing_resume = (
            supabase.table("resume").select("*").eq("thread_id", thread_id).execute()
        )

        if existing_resume.data:
            data = (
                supabase.table("resume")
                .update(file_data)
                .eq("thread_id", thread_id)
                .execute()
            )
        else:
            data = supabase.table("resume").insert(file_data).execute()

        return data.data
    except Exception as e:
        log_error(f"Error saving resume: {e}")
        traceback.print_exc()
        raise Exception(f"Error saving resume: {e}")


async def get_resume(
    supabase: Client, thread_id: str
) -> Optional[List[Dict[str, Any]]]:
    """
    Retrieve resume for a specific thread.

    Args:
        supabase: Supabase client instance
        thread_id: Thread identifier

    Returns:
        Optional[List[Dict[str, Any]]]: Resume data or None if not found

    Raises:
        Exception: If resume retrieval fails
    """
    try:
        data = supabase.table("resume").select("*").eq("thread_id", thread_id).execute()
        if not data.data:
            return None
        return data.data
    except Exception as e:
        log_error(f"Error getting resume: {e}")
        traceback.print_exc()
        raise Exception(f"Error getting resume: {e}")


async def delete_resume(
    supabase: Client, thread_id: str
) -> Optional[List[Dict[str, Any]]]:
    """
    Delete resume for a specific thread.

    Args:
        supabase: Supabase client instance
        thread_id: Thread identifier

    Returns:
        Optional[List[Dict[str, Any]]]: Deleted resume data or None if not found

    Raises:
        Exception: If resume deletion fails
    """
    try:
        existing_resume = (
            supabase.table("resume").select("*").eq("thread_id", thread_id).execute()
        )
        if not existing_resume.data:
            return None

        data = supabase.table("resume").delete().eq("thread_id", thread_id).execute()
        return data.data
    except Exception as e:
        log_error(f"Error deleting resume: {e}")
        traceback.print_exc()
        raise Exception(f"Error deleting resume: {e}")


async def save_job_description(
    supabase: Client, thread_id: str, file_name: str, job_description_file: File
) -> List[Dict[str, Any]]:
    """
    Save or update a job description file in the database.

    Args:
        supabase: Supabase client instance
        thread_id: Thread identifier
        file_name: Name of the file
        job_description_file: Google GenAI File object

    Returns:
        List[Dict[str, Any]]: Saved job description data

    Raises:
        Exception: If job description save fails
    """
    file_data = _extract_file_data(thread_id, file_name, job_description_file)

    try:
        existing_job_description = (
            supabase.table("job_description")
            .select("*")
            .eq("thread_id", thread_id)
            .execute()
        )

        if existing_job_description.data:
            data = (
                supabase.table("job_description")
                .update(file_data)
                .eq("thread_id", thread_id)
                .execute()
            )
        else:
            data = supabase.table("job_description").insert(file_data).execute()

        return data.data
    except Exception as e:
        log_error(f"Error saving job description: {e}")
        traceback.print_exc()
        raise Exception(f"Error saving job description: {e}")


async def get_job_description(
    supabase: Client, thread_id: str
) -> Optional[List[Dict[str, Any]]]:
    """
    Retrieve job description for a specific thread.

    Args:
        supabase: Supabase client instance
        thread_id: Thread identifier

    Returns:
        Optional[List[Dict[str, Any]]]: Job description data or None if not found

    Raises:
        Exception: If job description retrieval fails
    """
    try:
        data = (
            supabase.table("job_description")
            .select("*")
            .eq("thread_id", thread_id)
            .execute()
        )
        if not data.data:
            return None
        return data.data
    except Exception as e:
        log_error(f"Error getting job description: {e}")
        traceback.print_exc()
        raise Exception(f"Error getting job description: {e}")


async def delete_job_description(
    supabase: Client, thread_id: str
) -> Optional[List[Dict[str, Any]]]:
    """
    Delete job description for a specific thread.

    Args:
        supabase: Supabase client instance
        thread_id: Thread identifier

    Returns:
        Optional[List[Dict[str, Any]]]: Deleted job description data or None if not found

    Raises:
        Exception: If job description deletion fails
    """
    try:
        existing_job_description = (
            supabase.table("job_description")
            .select("*")
            .eq("thread_id", thread_id)
            .execute()
        )
        if not existing_job_description.data:
            return None

        data = (
            supabase.table("job_description")
            .delete()
            .eq("thread_id", thread_id)
            .execute()
        )
        return data.data
    except Exception as e:
        log_error(f"Error deleting job description: {e}")
        traceback.print_exc()
        raise Exception(f"Error deleting job description: {e}")


def _extract_file_data(thread_id: str, file_name: str, file: File) -> Dict[str, Any]:
    """
    Extract file attributes from Google GenAI File object.

    Args:
        thread_id: Thread identifier
        file_name: Name of the file
        file: Google GenAI File object

    Returns:
        Dict[str, Any]: Extracted file data
    """
    return {
        "thread_id": thread_id,
        "file_name": file_name,
        "name": getattr(file, "name", None),
        "mime_type": getattr(file, "mime_type", None),
        "size_bytes": getattr(file, "size_bytes", None),
        "create_time": str(getattr(file, "create_time", None))
        if getattr(file, "create_time", None)
        else None,
        "expiration_time": str(getattr(file, "expiration_time", None))
        if getattr(file, "expiration_time", None)
        else None,
        "update_time": str(getattr(file, "update_time", None))
        if getattr(file, "update_time", None)
        else None,
        "sha256_hash": getattr(file, "sha256_hash", None),
        "uri": getattr(file, "uri", None),
        "state": getattr(file, "state", None),
        "source": getattr(file, "source", None),
    }


async def update_session_status(
    supabase: Client, session_id: str, new_status: str
) -> Dict[str, Any]:
    """
    Update the status of an existing session.

    Args:
        supabase: Supabase client instance
        session_id: Session identifier (UUID)
        new_status: New status value (IN_PROGRESS or FINISHED)

    Returns:
        Dict[str, Any]: Updated session data

    Raises:
        Exception: If session update fails
    """
    try:
        data = (
            supabase.table("session")
            .update({"status": new_status})
            .eq("id", session_id)
            .execute()
        )
        return data.data[0]
    except Exception as e:
        log_error(f"Error updating session status: {e}")
        traceback.print_exc()
        raise Exception(f"Error updating session status: {e}")


async def get_or_create_session(
    supabase: Client, session_id: str, user_id: str
) -> Dict[str, Any]:
    """
    Get an existing session or create a new one.

    Args:
        supabase: Supabase client instance
        session_id: Session identifier (UUID from URL)
        user_id: Authenticated user ID

    Returns:
        Dict[str, Any]: Session data

    Raises:
        Exception: If session retrieval or creation fails
    """
    try:
        existing = supabase.table("session").select("*").eq("id", session_id).execute()
        if existing.data:
            return existing.data[0]
        data = (
            supabase.table("session")
            .insert({"id": session_id, "user_id": user_id})
            .execute()
        )
        return data.data[0]
    except Exception as e:
        log_error(f"Error getting or creating session: {e}")
        traceback.print_exc()
        raise Exception(f"Error getting or creating session: {e}")


def create_or_update_user(supabase: Client, user: User) -> List[Dict[str, Any]]:
    """
    Create or update a user in the database.

    Args:
        supabase: Supabase client instance
        user: User data to create or update

    Returns:
        List[Dict[str, Any]]: Created or updated user data
    """
    try:
        existing_user = supabase.table("user").select("*").eq("id", user.id).execute()
        if existing_user.data:
            data = (
                supabase.table("user")
                .update(
                    {
                        "display_name": user.displayName,
                        "primary_email": user.primaryEmail,
                        "primary_email_verified": user.primaryEmailVerified,
                        "profile_image_url": user.profileImageUrl,
                    }
                )
                .eq("id", user.id)
                .execute()
            )
        else:
            data = (
                supabase.table("user")
                .insert(
                    {
                        "id": user.id,
                        "display_name": user.displayName,
                        "primary_email": user.primaryEmail,
                        "primary_email_verified": user.primaryEmailVerified,
                        "profile_image_url": user.profileImageUrl,
                    }
                )
                .execute()
            )
        return data.data
    except Exception as e:
        log_error(f"Error creating or updating user: {e}")
        traceback.print_exc()
        raise Exception(f"Error creating or updating user: {e}")
