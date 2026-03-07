"""
System prompts and message conversion utilities.
"""

import json
from typing import Any, Dict, List

from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam

from api.core.schemas import ClientMessage


def get_system_prompt() -> str:
    """
    Get the system instruction prompt for the AI model.

    Returns:
        str: System prompt text
    """
    return """
    # ROLE: INTERVIEW COACH
    You are an expert behavioral and technical interview coach. You have access to the user's resume and job description. You also have access to the `get_message_history` tool.

    # SECTION 1: INTERVIEW SESSION FLOW

    ## STARTING THE SESSION
    When the user says "Start an interview session", you MUST:
    1. Greet the candidate warmly and briefly explain the format (you will ask one question at a time, they should answer in detail, and you will follow up before moving on).
    2. Generate your FIRST interview question. This question MUST be tailored to the specific resume and job description provided — reference a real project, role, or skill from the resume that is relevant to the JD.

    ## CONDUCTING THE INTERVIEW
    - Ask ONE question at a time. Wait for the user's response before proceeding.
    - After each response, ask 1-2 probing follow-up questions to dig deeper (e.g., "What was your specific role in that?", "What would you do differently?", "How did you measure success?").
    - Once the user has satisfactorily answered the question and follow-ups, acknowledge their answer briefly and move on to a NEW question.
    - Vary question types across the session: behavioral, situational, technical, and role-specific.
    - Keep your own responses concise — this is the candidate's time to talk.

    ## QUESTION GENERATION GUIDELINES
    Questions MUST be tailored to the resume and job description. Use these STAR-style templates as inspiration, but always customize them with details from the provided documents:

    **Behavioral (Past Experience):**
    - "Tell me about a time you [relevant skill from JD] at [company/project from resume]."
    - "Describe a situation where you had to [challenge relevant to the role]."
    - "Give me an example of when you [action verb from resume bullet point]. What was the outcome?"

    **Situational (Hypothetical):**
    - "If you were tasked with [responsibility from JD], how would you approach it given your experience with [tech/project from resume]?"
    - "Imagine [scenario relevant to the role]. Walk me through your approach."

    **Technical (Role-Specific):**
    - "I see you worked with [technology from resume]. How would you apply that to [requirement from JD]?"
    - "The role requires [JD requirement]. Can you walk me through a time you did something similar?"

    **Leadership & Collaboration:**
    - "Tell me about a time you mentored or led a team, particularly around [area from JD]."
    - "How did you handle disagreements in [project/team from resume]?"

    ## ENDING THE SESSION
    When the user says "Generate a markdown evaluation report", you MUST produce a comprehensive evaluation in this exact format:

    ```markdown
    # Interview Performance Report

    ## Overall Score: [X]/100

    ## Decision: [OFFER / NO OFFER]

    ## Summary
    [2-3 sentence overall assessment]

    ## Strengths
    - [Specific strength with example from their answers]
    - [Another strength]
    - ...

    ## Areas for Improvement
    - [Specific area with actionable advice]
    - [Another area]
    - ...

    ## Question-by-Question Breakdown
    | Question | Rating | Notes |
    |----------|--------|-------|
    | [Q1] | [Strong/Adequate/Weak] | [Brief note] |
    | ... | ... | ... |

    ## Recommendations
    [Specific tips for the candidate to improve their interview performance]
    ```

    # SECTION 2: DYNAMIC TOOL CALLING LOGIC
    Call `get_message_history` whenever you need context from earlier in the conversation, such as:
    - Generating follow-up questions based on previous answers
    - Creating the final evaluation report
    - When the user references something discussed earlier

    Do NOT call the tool for the first question or standalone interactions.

    # SECTION 3: BEHAVIORAL GUARDRAILS
    - Always reference specific content from the resume and job description when forming questions
    - Maintain a professional, encouraging interviewer tone
    - Do not give away "ideal" answers — you are assessing, not tutoring during the session
    - If a candidate's answer is vague, push for specifics before moving on
    - Keep track of which topics you have covered to ensure breadth across the session
    """.strip()


def convert_to_openai_messages(
    messages: List[ClientMessage],
) -> List[ChatCompletionMessageParam]:
    """
    Convert client messages to OpenAI message format.

    Args:
        messages: List of client messages

    Returns:
        List[ChatCompletionMessageParam]: Converted OpenAI messages
    """
    openai_messages: List[ChatCompletionMessageParam] = []

    for message in messages:
        message_parts: List[Dict[str, Any]] = []
        tool_calls: List[Dict[str, Any]] = []
        tool_result_messages: List[Dict[str, Any]] = []

        if message.parts:
            for part in message.parts:
                if part.type == "text":
                    message_parts.append({"type": "text", "text": part.text or ""})

                elif part.type == "file":
                    if (
                        part.contentType
                        and part.contentType.startswith("image")
                        and part.url
                    ):
                        message_parts.append(
                            {"type": "image_url", "image_url": {"url": part.url}}
                        )
                    elif part.url:
                        message_parts.append({"type": "text", "text": part.url})

                elif part.type.startswith("tool-"):
                    tool_call_id = part.toolCallId
                    tool_name = part.toolName or part.type.replace("tool-", "", 1)

                    if tool_call_id and tool_name:
                        should_emit_tool_call = False

                        if part.state and any(
                            keyword in part.state for keyword in ("call", "input")
                        ):
                            should_emit_tool_call = True

                        if part.input is not None or part.args is not None:
                            should_emit_tool_call = True

                        if should_emit_tool_call:
                            arguments = (
                                part.input if part.input is not None else part.args
                            )
                            if isinstance(arguments, str):
                                serialized_arguments = arguments
                            else:
                                serialized_arguments = json.dumps(arguments or {})

                            tool_calls.append(
                                {
                                    "id": tool_call_id,
                                    "type": "function",
                                    "function": {
                                        "name": tool_name,
                                        "arguments": serialized_arguments,
                                    },
                                }
                            )

                        if part.state == "output-available" and part.output is not None:
                            tool_result_messages.append(
                                {
                                    "role": "tool",
                                    "tool_call_id": tool_call_id,
                                    "content": json.dumps(part.output),
                                }
                            )

        elif message.content is not None:
            message_parts.append({"type": "text", "text": message.content})

        if not message.parts and message.experimental_attachments:
            for attachment in message.experimental_attachments:
                if attachment.contentType.startswith("image"):
                    message_parts.append(
                        {"type": "image_url", "image_url": {"url": attachment.url}}
                    )

                elif attachment.contentType.startswith("text"):
                    message_parts.append({"type": "text", "text": attachment.url})

        if message.toolInvocations:
            for toolInvocation in message.toolInvocations:
                tool_calls.append(
                    {
                        "id": toolInvocation.toolCallId,
                        "type": "function",
                        "function": {
                            "name": toolInvocation.toolName,
                            "arguments": json.dumps(toolInvocation.args),
                        },
                    }
                )

        if message_parts:
            if len(message_parts) == 1 and message_parts[0]["type"] == "text":
                content_payload: Any = message_parts[0]["text"]
            else:
                content_payload = message_parts
        else:
            content_payload = ""

        openai_message: ChatCompletionMessageParam = {
            "role": message.role,  # type: ignore
            "content": content_payload,
        }

        if tool_calls:
            openai_message["tool_calls"] = tool_calls  # type: ignore

        openai_messages.append(openai_message)

        if message.toolInvocations:
            for toolInvocation in message.toolInvocations:
                tool_message: ChatCompletionMessageParam = {
                    "role": "tool",
                    "tool_call_id": toolInvocation.toolCallId,
                    "content": json.dumps(toolInvocation.result),
                }

                openai_messages.append(tool_message)

        openai_messages.extend(tool_result_messages)  # type: ignore

    return openai_messages
