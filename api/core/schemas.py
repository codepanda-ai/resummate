"""
Shared Pydantic schemas used across the application.
"""

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict


class ClientAttachment(BaseModel):
    """Client attachment model for file uploads."""

    name: str
    contentType: str
    url: str


class MessagePart(BaseModel):
    """Message part model for chat messages."""

    type: Literal["text", "tool-call", "tool-result"]
    text: str | None = None


class UIMessage(BaseModel):
    """UI message model for chat interface."""

    id: str
    role: Literal["user", "assistant"]
    parts: List[MessagePart]


class ChatHistoryResponse(BaseModel):
    """Response model for chat history."""

    messages: List[UIMessage]


class ClientMessagePart(BaseModel):
    """Client message part with flexible schema."""

    type: str
    text: Optional[str] = None
    contentType: Optional[str] = None
    url: Optional[str] = None
    data: Optional[Any] = None
    toolCallId: Optional[str] = None
    toolName: Optional[str] = None
    state: Optional[str] = None
    input: Optional[Any] = None
    output: Optional[Any] = None
    args: Optional[Any] = None

    model_config = ConfigDict(extra="allow")


class ToolInvocation(BaseModel):
    """Tool invocation model for function calls."""

    state: Literal["call", "partial-call", "result"]
    toolCallId: str
    toolName: str
    args: Any
    result: Any


class ClientMessage(BaseModel):
    """Client message model for chat requests."""

    role: str
    content: Optional[str] = None
    parts: Optional[List[ClientMessagePart]] = None
    experimental_attachments: Optional[List[ClientAttachment]] = None
    toolInvocations: Optional[List[ToolInvocation]] = None


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""

    messages: List[ClientMessage]
    id: Optional[str] = None


class PromptRequest(BaseModel):
    """Request model for generate endpoint."""

    prompt: str


class Message(BaseModel):
    """Database message model."""

    session_id: str
    sender: str
    content: str


class HealthCheckResponse(BaseModel):
    """Response model for health check endpoint."""

    status: str


class FileUploadResponse(BaseModel):
    """Response model for file upload endpoints."""

    message: str


class FileInfoResponse(BaseModel):
    """Response model for file info endpoints."""

    name: str
    contentType: str


class GenerateResponse(BaseModel):
    """Response model for generate endpoint."""

    response: str


class User(BaseModel):
    """User model for user registration."""

    id: str
    displayName: str | None = None
    primaryEmail: str | None = None
    primaryEmailVerified: bool = False
    profileImageUrl: str | None = None
