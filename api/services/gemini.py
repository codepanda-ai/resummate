"""
Gemini AI service for handling AI operations.
"""

import json
import os
import random
import tempfile
import time
import traceback
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional

from fastapi import HTTPException, UploadFile
from google import genai
from google.genai import types
from google.genai.types import File as GeminiFile
from supabase import Client

from api.core.config import settings
from api.core.logging import log_info, log_error
from api.core.schemas import Message
from api.db.service import create_message, get_messages


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


async def handle_function_call(
    gemini_client: genai.Client,
    supabase: Client,
    thread_id: str,
    user_message: str,
    resume: GeminiFile,
    job_description: Optional[GeminiFile] = None,
) -> str:
    """
    Handle function calls from Gemini API with message history.

    Args:
        gemini_client: Gemini client instance
        supabase: Supabase client instance
        thread_id: Thread identifier
        user_message: User's message
        resume: Resume file reference
        job_description: Optional job description file reference

    Returns:
        str: Generated response text
    """
    from api.services.prompts import get_system_prompt

    retrieved_history = []
    past_messages = await get_messages(supabase, thread_id)
    for past_message in past_messages[::-1]:
        retrieved_history.append(
            {
                "role": past_message["sender"],
                "parts": [{"text": past_message["content"]}],
            }
        )

    chat = gemini_client.chats.create(
        model=settings.GEMINI_MODEL,
        config={
            "system_instruction": get_system_prompt(),
            "max_output_tokens": settings.MAX_OUTPUT_TOKENS,
            "temperature": settings.DEFAULT_TEMPERATURE,
        },
        history=retrieved_history,
    )

    message_content = [user_message, resume]
    if job_description:
        message_content.append(job_description)

    response = chat.send_message(message_content)
    return response.text


async def stream_response(
    gemini_client: genai.Client,
    supabase: Client,
    prompt: str,
    thread_id: str,
    file_reference: str,
    job_description_reference: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream a response from Gemini API with SSE format.

    Args:
        gemini_client: Gemini client instance
        supabase: Supabase client instance
        prompt: User prompt
        thread_id: Thread identifier
        file_reference: Resume file reference
        job_description_reference: Optional job description file reference

    Yields:
        str: SSE formatted response chunks
    """
    from api.services.prompts import get_system_prompt
    from api.services.tools import get_tools

    def format_sse(payload: Dict[str, Any]) -> str:
        return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"

    message_id = f"msg-{uuid.uuid4().hex}"
    text_stream_id = "text-1"
    text_started = False

    yield format_sse({"type": "start", "messageId": message_id})

    config = types.GenerateContentConfig(
        system_instruction=get_system_prompt(),
        max_output_tokens=settings.MAX_OUTPUT_TOKENS,
        temperature=settings.DEFAULT_TEMPERATURE,
        tools=[get_tools()],
    )

    retrieved_resume = gemini_client.files.get(name=file_reference)
    log_info(f"Retrieved resume: {retrieved_resume.name}")

    retrieved_job_description = None
    if job_description_reference:
        retrieved_job_description = gemini_client.files.get(
            name=job_description_reference
        )
        log_info(f"Retrieved job description: {retrieved_job_description.name}")

    try:
        accumulated_content = ""

        contents: List[Any] = [prompt, retrieved_resume]
        if retrieved_job_description:
            contents.append(retrieved_job_description)

        stream = gemini_client.models.generate_content_stream(
            model=settings.GEMINI_MODEL, contents=contents, config=config
        )

        for chunk in stream:
            function_call = chunk.candidates[0].content.parts[0].function_call
            if function_call:
                log_info("Making Gemini function call")
                response = await handle_function_call(
                    gemini_client,
                    supabase,
                    thread_id,
                    prompt,
                    retrieved_resume,
                    retrieved_job_description,
                )
                if response:
                    if not text_started:
                        yield format_sse({"type": "text-start", "id": text_stream_id})
                        text_started = True
                    yield format_sse(
                        {"type": "text-delta", "id": text_stream_id, "delta": response}
                    )
                    accumulated_content += response
            elif chunk.text:
                log_info("Skipping Gemini function call")
                if not text_started:
                    yield format_sse({"type": "text-start", "id": text_stream_id})
                    text_started = True
                yield format_sse(
                    {"type": "text-delta", "id": text_stream_id, "delta": chunk.text}
                )
                accumulated_content += chunk.text

        if text_started:
            yield format_sse({"type": "text-end", "id": text_stream_id})

        if accumulated_content:
            await create_message(
                supabase,
                Message(
                    thread_id=thread_id, sender="model", content=accumulated_content
                ),
            )

        yield format_sse({"type": "finish"})
        yield "data: [DONE]\n\n"
    except Exception as e:
        log_error(f"Error in stream_response: {e}")
        traceback.print_exc()
        if text_started:
            yield format_sse({"type": "text-end", "id": text_stream_id})
        yield format_sse({"type": "finish"})
        yield "data: [DONE]\n\n"
        raise


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


MOCK_RESPONSES = [
    "Great, let's get started! Tell me about a time you led a technical project from start to finish. What was the outcome?",
    "Can you walk me through a challenging bug or outage you resolved? How did you diagnose the root cause?",
    "That's a solid answer. Can you go deeper on what your specific contribution was versus the team's?",
    "Interesting. What would you do differently if you had to approach that problem again today?",
    "Tell me about a time you disagreed with a teammate on a technical decision. How did you resolve it?",
    "How did you measure success for that project? Were there any metrics you tracked?",
    "Good detail there. Now, describe a situation where you had to learn a new technology quickly to deliver on a deadline.",
    "Can you give me an example of a time you mentored a junior engineer? What was the impact?",
    "Let's shift gears. How do you prioritize tasks when you have multiple competing deadlines?",
    "Thanks for sharing that. Let's move on — tell me about your experience with system design at scale.",
]


async def stream_mock_response(
    supabase: Client, thread_id: str
) -> AsyncGenerator[str, None]:
    """
    Stream a random mock response for test mode.

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
    message_text = random.choice(MOCK_RESPONSES)

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
