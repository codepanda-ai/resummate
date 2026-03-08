"""
Shared context utilities for building agent inputs.

Provides helpers for fetching message history and Gemini file references,
shared across multiple agents.
"""

from typing import Any, Dict, List, Optional, Tuple

from google import genai
from google.genai.types import File as GeminiFile
from supabase import Client

from api.db.service import get_messages


async def build_chat_history(
    supabase: Client,
    thread_id: str,
    limit: int = 100,
    exclude_latest: bool = False,
) -> List[Dict[str, Any]]:
    """
    Build a Gemini-compatible chat history list from stored messages.

    Args:
        supabase: Supabase client instance
        thread_id: Thread/session identifier
        limit: Maximum number of messages to fetch
        exclude_latest: If True, skip the most recent message (useful when
            the caller already saved the current user message before building
            history, to avoid sending it twice)

    Returns:
        List[Dict[str, Any]]: History in Gemini chat format (chronological order)
    """
    all_messages = await get_messages(supabase, thread_id, limit=limit)
    messages = all_messages[1:] if exclude_latest else all_messages

    history: List[Dict[str, Any]] = []
    for msg in messages[::-1]:  # reverse to chronological order
        history.append(
            {
                "role": msg["sender"],  # "user" or "model"
                "parts": [{"text": msg["content"]}],
            }
        )
    return history


async def fetch_gemini_files(
    gemini_client: genai.Client,
    resume_reference: str,
    job_description_reference: Optional[str] = None,
) -> Tuple[GeminiFile, Optional[GeminiFile]]:
    """
    Fetch uploaded Gemini file references by name.

    Args:
        gemini_client: Gemini client instance
        resume_reference: Gemini file name for the resume
        job_description_reference: Optional Gemini file name for the job description

    Returns:
        Tuple[GeminiFile, Optional[GeminiFile]]: Resume file and optional job
            description file
    """
    resume_file = gemini_client.files.get(name=resume_reference)
    job_description_file: Optional[GeminiFile] = None
    if job_description_reference:
        job_description_file = gemini_client.files.get(name=job_description_reference)
    return resume_file, job_description_file
