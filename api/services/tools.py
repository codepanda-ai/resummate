"""
Tool definitions and implementations for AI function calling.
"""

from typing import Any, Dict, List

from google.genai import types
from supabase import Client

from api.db.service import get_messages


def get_message_history_function() -> Dict[str, Any]:
    """
    Get the function declaration for message history retrieval.

    Returns:
        Dict[str, Any]: Function declaration for the model
    """
    return {
        "name": "get_message_history",
        "description": "Gets the message history for a given thread.",
        "parameters": {
            "type": "object",
            "properties": {
                "session_id": {
                    "type": "string",
                    "description": "The thread ID",
                },
            },
            "required": ["session_id"],
        },
    }


async def get_message_history(supabase: Client, session_id: str) -> List[str]:
    """
    Get the message history for a given thread.

    Args:
        supabase: Supabase client instance
        session_id: Thread identifier

    Returns:
        List[str]: List of message contents
    """
    data = await get_messages(supabase, session_id)
    return [message["content"] for message in data]


def get_tools() -> types.Tool:
    """
    Get the tool definitions for Gemini API.

    Returns:
        types.Tool: Tool configuration for the model
    """
    return types.Tool(function_declarations=[get_message_history_function()])
