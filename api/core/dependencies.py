"""
Dependency injection providers for the application.
"""

from typing import TYPE_CHECKING, Annotated

from fastapi import Depends
from google import genai
from supabase import Client, create_client

from .config import settings

if TYPE_CHECKING:
    from api.agents.interview_agent import InterviewAgent
    from api.agents.report_agent import ReportAgent


def get_supabase_client() -> Client:
    """
    Dependency provider for Supabase client.

    Returns:
        Client: Configured Supabase client instance
    """
    return create_client(
        settings.SUPABASE_URL, settings.SUPABASE_PUBLISHABLE_DEFAULT_KEY
    )


def get_gemini_client() -> genai.Client:
    """
    Dependency provider for Google Gemini client.

    Returns:
        genai.Client: Configured Gemini client instance
    """
    return genai.Client(api_key=settings.GOOGLE_GENERATIVE_AI_API_KEY)


# Primitive client type aliases
SupabaseClient = Annotated[Client, Depends(get_supabase_client)]
GeminiClient = Annotated[genai.Client, Depends(get_gemini_client)]


def get_interview_agent(
    gemini: GeminiClient,
    supabase: SupabaseClient,
) -> "InterviewAgent":
    """
    Dependency provider for InterviewAgent.

    Returns:
        InterviewAgent: Agent instance with injected clients
    """
    # Local import avoids module-level circular dependencies if the
    # agent graph grows to include dependencies that reference this module.
    from api.agents.interview_agent import InterviewAgent

    return InterviewAgent(gemini=gemini, supabase=supabase)


def get_report_agent(
    gemini: GeminiClient,
    supabase: SupabaseClient,
) -> "ReportAgent":
    """
    Dependency provider for ReportAgent.

    Returns:
        ReportAgent: Agent instance with injected clients
    """
    from api.agents.report_agent import ReportAgent

    return ReportAgent(gemini=gemini, supabase=supabase)


# Agent type aliases — FastAPI caches GeminiClient/SupabaseClient within the
# same request, so the agent and the router share the same client instances.
InterviewAgentDep = Annotated["InterviewAgent", Depends(get_interview_agent)]
ReportAgentDep = Annotated["ReportAgent", Depends(get_report_agent)]
