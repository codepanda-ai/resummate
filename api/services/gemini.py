"""
Gemini AI service for handling AI operations.
"""

import json
import os
import tempfile
import time
import traceback
import uuid
from typing import Any, AsyncGenerator, Dict

from fastapi import HTTPException, UploadFile
from google import genai
from google.genai import types
from google.genai.types import File as GeminiFile
from supabase import Client

from api.core.config import settings
from api.core.logging import log_error
from api.core.schemas import Message
from api.db.service import create_message


async def generate_response(gemini_client: genai.Client, prompt: str) -> str:
    """
    Generate a text response from Gemini API.

    Args:
        gemini_client: Gemini client instance
        prompt: Input prompt text

    Returns:
        str: Generated response text
    """
    from api.services.prompts import get_system_prompt

    response = gemini_client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=get_system_prompt(),
            max_output_tokens=settings.MAX_OUTPUT_TOKENS,
            temperature=settings.DEFAULT_TEMPERATURE,
        ),
    )
    return response.text


async def upload_file(gemini_client: genai.Client, file: UploadFile) -> GeminiFile:
    """
    Upload a file to Gemini API.

    Args:
        gemini_client: Gemini client instance
        file: File to upload

    Returns:
        GeminiFile: Uploaded file reference

    Raises:
        HTTPException: If file size exceeds limit or upload fails
    """
    if file.size and file.size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413, detail="File size exceeds the allowed limit"
        )

    suffix = os.path.splitext(file.filename)[1] if file.filename else ""

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name

    try:
        gemini_file = gemini_client.files.upload(file=temp_path)

        while gemini_file.state.name == "PROCESSING":
            time.sleep(1)
            gemini_file = gemini_client.files.get(name=gemini_file.name)

        return gemini_file
    except Exception as e:
        log_error(f"Error uploading file to Gemini: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error uploading file: {e}")
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


async def stream_resume_required_message(
    supabase: Client, thread_id: str
) -> AsyncGenerator[str, None]:
    """
    Stream a message requesting resume upload.

    Args:
        supabase: Supabase client instance
        thread_id: Thread identifier

    Yields:
        str: SSE formatted response chunks
    """

    def format_sse(payload: Dict[str, Any]) -> str:
        return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"

    message_id = f"msg-{uuid.uuid4().hex}"
    text_stream_id = "text-1"
    message_text = "Please upload a resume before chatting with Resummate."

    yield format_sse({"type": "start", "messageId": message_id})
    yield format_sse({"type": "text-start", "id": text_stream_id})
    yield format_sse(
        {"type": "text-delta", "id": text_stream_id, "delta": message_text}
    )
    yield format_sse({"type": "text-end", "id": text_stream_id})

    await create_message(
        supabase, Message(thread_id=thread_id, sender="model", content=message_text)
    )

    yield format_sse({"type": "finish"})
    yield "data: [DONE]\n\n"
