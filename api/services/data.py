"""
Cache-aware data access functions.

Each function checks Redis before falling back to Supabase, and populates
the cache on a miss. Routers call these instead of touching the cache directly.
"""

from typing import Optional

from supabase import Client

from api.core.cache import delete_cached, get_cached, jd_key, report_key, resume_key, set_cached
from api.db.service import (
    get_job_description,
    get_resume,
    get_session_report,
    save_session_report,
)


async def get_resume_reference(redis, supabase: Client, session_id: str) -> Optional[str]:
    """
    Return the resume's Gemini file reference, checking cache before Supabase.

    Args:
        redis: Upstash Redis client (may be None)
        supabase: Supabase client
        session_id: Session identifier

    Returns:
        str | None: Gemini file name, or None if no resume has been uploaded
    """
    cached = await get_cached(redis, resume_key(session_id))
    if cached:
        return cached
    resume = await get_resume(supabase, session_id)
    if not resume:
        return None
    reference = resume[0]["name"]
    await set_cached(redis, resume_key(session_id), reference)
    return reference


async def get_jd_reference(redis, supabase: Client, session_id: str) -> Optional[str]:
    """
    Return the job description's Gemini file reference, checking cache before Supabase.

    Only caches when a JD exists — absence is not cached so a later upload is
    picked up immediately.

    Args:
        redis: Upstash Redis client (may be None)
        supabase: Supabase client
        session_id: Session identifier

    Returns:
        str | None: Gemini file name, or None if no JD has been uploaded
    """
    cached = await get_cached(redis, jd_key(session_id))
    if cached:
        return cached
    job_description = await get_job_description(supabase, session_id)
    if not job_description:
        return None
    reference = job_description[0]["name"]
    await set_cached(redis, jd_key(session_id), reference)
    return reference


async def get_report(redis, supabase: Client, session_id: str) -> Optional[str]:
    """
    Return the session report, checking cache before Supabase.

    Args:
        redis: Upstash Redis client (may be None)
        supabase: Supabase client
        session_id: Session identifier

    Returns:
        str | None: Markdown report text, or None if not yet generated
    """
    cached = await get_cached(redis, report_key(session_id))
    if cached:
        return cached
    return await get_session_report(supabase, session_id)


async def cache_resume(redis, session_id: str, file_reference: str) -> None:
    """
    Store the resume Gemini file reference in the cache on upload.

    Args:
        redis: Upstash Redis client (may be None)
        session_id: Session identifier
        file_reference: Gemini file name to cache
    """
    await set_cached(redis, resume_key(session_id), file_reference)


async def cache_jd(redis, session_id: str, file_reference: str) -> None:
    """
    Store the job description Gemini file reference in the cache on upload.

    Args:
        redis: Upstash Redis client (may be None)
        session_id: Session identifier
        file_reference: Gemini file name to cache
    """
    await set_cached(redis, jd_key(session_id), file_reference)


async def invalidate_resume(redis, session_id: str) -> None:
    """
    Remove the resume cache entry for a session after deletion.

    Args:
        redis: Upstash Redis client (may be None)
        session_id: Session identifier
    """
    await delete_cached(redis, resume_key(session_id))


async def invalidate_jd(redis, session_id: str) -> None:
    """
    Remove the job description cache entry for a session after deletion.

    Args:
        redis: Upstash Redis client (may be None)
        session_id: Session identifier
    """
    await delete_cached(redis, jd_key(session_id))


async def save_report(redis, supabase: Client, session_id: str, report: str) -> None:
    """
    Persist the report to both Supabase and the cache.

    Args:
        redis: Upstash Redis client (may be None)
        supabase: Supabase client
        session_id: Session identifier
        report: Markdown report text
    """
    await save_session_report(supabase, session_id, report)
    await set_cached(redis, report_key(session_id), report)
