"""
Chat router for handling chat conversations and message history.
"""

import uuid as uuid_lib

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from api.auth.stack_auth import verify_stack_token
from api.core.dependencies import (
    GeminiClient,
    InterviewAgentDep,
    SessionOwner,
    SupabaseClient,
)
from api.db.service import get_session_user_id
from api.core.logging import log_info
from api.core.schemas import (
    ChatRequest,
    ChatHistoryResponse,
    GenerateResponse,
    Message,
    MessagePart,
    PromptRequest,
    UIMessage,
)
from api.db.service import (
    create_message,
    get_job_description,
    get_messages,
    get_resume,
)
from api.services.gemini import (
    generate_response,
    stream_resume_required_message,
)


router = APIRouter(
    prefix="/api", tags=["chat"], dependencies=[Depends(verify_stack_token)]
)


def patch_response_with_headers(
    response: StreamingResponse,
    protocol: str = "data",
) -> StreamingResponse:
    """
    Apply standard streaming headers for Vercel AI SDK.

    Args:
        response: Streaming response to patch
        protocol: Protocol type

    Returns:
        StreamingResponse: Patched response with headers
    """
    response.headers["x-vercel-ai-ui-message-stream"] = "v1"
    response.headers["Cache-Control"] = "no-cache"
    response.headers["Connection"] = "keep-alive"
    response.headers["X-Accel-Buffering"] = "no"

    if protocol:
        response.headers.setdefault("x-vercel-ai-protocol", protocol)

    return response


@router.post(
    "/generate", response_model=GenerateResponse, status_code=status.HTTP_200_OK
)
async def generate(gemini: GeminiClient, request: PromptRequest) -> GenerateResponse:
    """
    Generate a response from Gemini API.

    Args:
        gemini: Gemini client dependency
        request: Prompt request

    Returns:
        GenerateResponse: Generated response

    Raises:
        HTTPException: If generation fails
    """
    try:
        response = await generate_response(gemini, request.prompt)
        return GenerateResponse(response=response)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calling Gemini API: {e}",
        )


@router.post("/chat", status_code=status.HTTP_200_OK)
async def handle_chat(
    supabase: SupabaseClient,
    agent: InterviewAgentDep,
    request: ChatRequest,
    protocol: str = Query("data"),
    x_test_mode: str | None = Header(None),
    auth_user: dict = Depends(verify_stack_token),
) -> StreamingResponse:
    """
    Handle chat conversation with streaming response.

    Args:
        supabase: Supabase client dependency
        agent: InterviewAgent dependency
        request: Chat request with messages
        protocol: Streaming protocol type
        x_test_mode: Test mode header flag
        auth_user: Authenticated user data from JWT token

    Returns:
        StreamingResponse: Streaming chat response

    Raises:
        HTTPException: If chat handling fails
    """
    if not request.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No messages provided"
        )

    last_message = request.messages[-1]
    prompt = last_message.content or ""

    if not prompt and last_message.parts:
        text_parts = [part.text for part in last_message.parts if part.text]
        prompt = " ".join(text_parts)

    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No message content found"
        )

    session_id = request.id if request.id else str(uuid_lib.uuid4())

    if request.id:
        owner_id = await get_session_user_id(supabase, session_id)
        if owner_id is None or owner_id != auth_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    await create_message(
        supabase=supabase,
        message=Message(session_id=session_id, sender="user", content=prompt),
    )

    if x_test_mode == "true":
        log_info("Test mode enabled, returning mock response")
        response = StreamingResponse(
            agent.run_mock(session_id),
            media_type="text/event-stream",
        )
        return patch_response_with_headers(response, protocol)

    resume = await get_resume(supabase, session_id)
    if not resume:
        log_info("Resume not found, requesting upload")
        response = StreamingResponse(
            stream_resume_required_message(supabase, session_id),
            media_type="text/event-stream",
        )
        return patch_response_with_headers(response, protocol)

    job_description = await get_job_description(supabase, session_id)
    job_description_reference = job_description[0]["name"] if job_description else None

    response = StreamingResponse(
        agent.run(
            prompt=prompt,
            session_id=session_id,
            file_reference=resume[0]["name"],
            job_description_reference=job_description_reference,
        ),
        media_type="text/event-stream",
    )
    return patch_response_with_headers(response, protocol)


@router.get(
    "/chat/history/{session_id}",
    response_model=ChatHistoryResponse,
    status_code=status.HTTP_200_OK,
)
async def get_chat_history(
    session_id: str, supabase: SupabaseClient, auth_user: SessionOwner
) -> ChatHistoryResponse:
    """
    Fetch message history for a specific chat thread.

    Args:
        session_id: Thread identifier
        supabase: Supabase client dependency
        auth_user: Authenticated user data (ownership verified)

    Returns:
        ChatHistoryResponse: Chat history with messages

    Raises:
        HTTPException: If history retrieval fails
    """
    try:
        ui_messages = []
        stored_messages = await get_messages(supabase, session_id)
        for message in stored_messages:
            sender = "assistant" if message["sender"] == "model" else "user"
            ui_messages.append(
                UIMessage(
                    id=str(message["id"]),
                    role=sender,  # type: ignore
                    parts=[MessagePart(type="text", text=message["content"])],
                )
            )
        return ChatHistoryResponse(messages=ui_messages[::-1])

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
