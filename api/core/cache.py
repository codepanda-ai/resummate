"""
Redis response cache backed by Upstash.

Caching is optional — all functions silently no-op when the client is None,
so the app works without any Redis configuration.
"""

from typing import Optional

from api.core.config import settings
from api.core.logging import log_info, log_error
from upstash_redis.asyncio import Redis


def get_redis_client():
    """
    Create an Upstash Redis client if env vars are configured.

    Returns:
        Redis | None: Configured client, or None if env vars are absent
    """
    if not settings.UPSTASH_REDIS_REST_URL or not settings.UPSTASH_REDIS_REST_TOKEN:
        return None

    return Redis(
        url=settings.UPSTASH_REDIS_REST_URL,
        token=settings.UPSTASH_REDIS_REST_TOKEN,
    )



async def get_cached(client, key: str) -> Optional[str]:
    """
    Retrieve a cached response string.

    Args:
        client: Upstash Redis client (may be None)
        key: Cache key

    Returns:
        str | None: Cached text, or None on miss or error
    """
    if client is None:
        return None
    try:
        value = await client.get(key)
        if value is not None:
            log_info(f"Cache HIT: {key}")
        else:
            log_info(f"Cache MISS: {key}")
        return value
    except Exception as e:
        log_error(f"Cache get error for key {key}: {e}")
        return None


def resume_key(session_id: str) -> str:
    """Cache key for a session's resume Gemini file reference."""
    return f"resummate:resume:{session_id}"


def jd_key(session_id: str) -> str:
    """Cache key for a session's job description Gemini file reference."""
    return f"resummate:jd:{session_id}"


def report_key(session_id: str) -> str:
    """Cache key for a session's generated report."""
    return f"resummate:report:{session_id}"


async def delete_cached(client, key: str) -> None:
    """
    Remove a key from the cache.

    Args:
        client: Upstash Redis client (may be None)
        key: Cache key to delete
    """
    if client is None:
        return
    try:
        await client.delete(key)
        log_info(f"Cache DELETE: {key}")
    except Exception as e:
        log_error(f"Cache delete error for key {key}: {e}")


async def set_cached(client, key: str, value: str) -> None:
    """
    Store a response string in the cache, evicted by LRU when memory is full.

    Args:
        client: Upstash Redis client (may be None)
        key: Cache key
        value: Response text to cache
    """
    if client is None:
        return
    try:
        await client.set(key, value)
        log_info(f"Cache SET: {key}")
    except Exception as e:
        log_error(f"Cache set error for key {key}: {e}")
