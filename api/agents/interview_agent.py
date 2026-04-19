"""
Interview agent for conducting AI-powered mock interview sessions.
"""

import json
import random
import traceback
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional

from google import genai
from supabase import Client

from api.agents.context import build_chat_history, fetch_gemini_files
from api.core.logging import log_error, log_info
from api.core.schemas import Message
from api.db.service import create_message


class InterviewAgent:
    """
    Agent for conducting mock interview sessions via streaming.

    Tune MODEL, MAX_OUTPUT_TOKENS, TEMPERATURE, and SYSTEM_PROMPT as class
    attributes to adjust the agent's behavior without touching call sites.

    Dependencies (gemini, supabase) are injected at construction time via
    FastAPI's Depends() system, keeping the agent compatible with DI-managed
    dependencies added in the future.
    """

    MODEL: str = "gemini-2.5-flash-lite"
    MAX_OUTPUT_TOKENS: int = 512
    TEMPERATURE: float = 0.5

    SYSTEM_PROMPT: str = """
# ROLE: INTERVIEW COACH
You are an expert behavioral and technical interview coach. You have access to the user's resume and job description.

# SECTION 1: INTERVIEW SESSION FLOW

## STARTING THE SESSION
When the user says "Start an interview session", you MUST:
1. Greet the candidate warmly and briefly explain the format (you will ask one question at a time, they should answer in detail, and you will follow up before moving on).
2. Generate your FIRST interview question. This question MUST be tailored to the specific resume and job description provided — reference a real project, role, or skill from the resume that is relevant to the JD.

## CONDUCTING THE INTERVIEW
- Ask ONE question at a time. Wait for the user's response before proceeding.
- After each response, you may ask up to a maximum of 3 follow-up questions on the same topic to dig deeper (e.g., "What was your specific role in that?", "What would you do differently?", "How did you measure success?").
- If a candidate's answer is vague or lacks specifics, push for detail — but still cap at 3 follow-ups total for that topic regardless of answer quality.
- After 3 follow-ups on a topic (or sooner if the answer is thorough), acknowledge their response briefly and move on to a NEW question on a different topic.
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

# SECTION 2: BEHAVIORAL GUARDRAILS
- Always reference specific content from the resume and job description when forming questions
- Maintain a professional, encouraging interviewer tone
- Do not give away "ideal" answers — you are assessing, not tutoring during the session
- Keep track of which topics you have covered and how many follow-ups you have asked per topic to ensure breadth across the session
    """.strip()

    MOCK_RESPONSES: List[str] = [
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

    def __init__(self, gemini: genai.Client, supabase: Client) -> None:
        """
        Initialize the agent with injected dependencies.

        Args:
            gemini: Gemini client instance
            supabase: Supabase client instance
        """
        self.gemini = gemini
        self.supabase = supabase

    async def run(
        self,
        prompt: str,
        session_id: str,
        file_reference: str,
        job_description_reference: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream an interview response using full chat history as context.

        The current user message must already be saved to the DB before calling
        this method (exclude_latest=True skips it when building history).

        Args:
            prompt: Current user message text
            session_id: Thread/session identifier
            file_reference: Gemini file name for the resume
            job_description_reference: Optional Gemini file name for the job description

        Yields:
            str: SSE-formatted response chunks
        """

        def format_sse(payload: Dict[str, Any]) -> str:
            return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"

        message_id = f"msg-{uuid.uuid4().hex}"
        text_stream_id = "text-1"
        text_started = False

        yield format_sse({"type": "start", "messageId": message_id})

        resume_file, job_description_file = await fetch_gemini_files(
            self.gemini, file_reference, job_description_reference
        )
        log_info(f"InterviewAgent: retrieved resume {resume_file.name}")
        if job_description_file:
            log_info(
                f"InterviewAgent: retrieved job description {job_description_file.name}"
            )

        history = await build_chat_history(
            self.supabase, session_id, limit=100, exclude_latest=True
        )

        chat = self.gemini.chats.create(
            model=self.MODEL,
            config={
                "system_instruction": self.SYSTEM_PROMPT,
                "max_output_tokens": self.MAX_OUTPUT_TOKENS,
                "temperature": self.TEMPERATURE,
            },
            history=history,
        )

        message_content: List[Any] = [prompt, resume_file]
        if job_description_file:
            message_content.append(job_description_file)

        try:
            accumulated_content = ""

            stream = chat.send_message_stream(message_content)

            for chunk in stream:
                if chunk.text:
                    if not text_started:
                        yield format_sse({"type": "text-start", "id": text_stream_id})
                        text_started = True
                    yield format_sse(
                        {
                            "type": "text-delta",
                            "id": text_stream_id,
                            "delta": chunk.text,
                        }
                    )
                    accumulated_content += chunk.text

            if text_started:
                yield format_sse({"type": "text-end", "id": text_stream_id})

            if accumulated_content:
                await create_message(
                    self.supabase,
                    Message(
                        session_id=session_id,
                        sender="model",
                        content=accumulated_content,
                    ),
                )
            yield format_sse({"type": "finish"})
            yield "data: [DONE]\n\n"

        except Exception as e:
            log_error(f"InterviewAgent error: {e}")
            traceback.print_exc()
            if text_started:
                yield format_sse({"type": "text-end", "id": text_stream_id})
            yield format_sse({"type": "finish"})
            yield "data: [DONE]\n\n"
            raise

    async def run_mock(self, session_id: str, prompt: str) -> AsyncGenerator[str, None]:
        """
        Stream a mock response for test mode, using cache for consistency.

        Args:
            session_id: Thread/session identifier
            prompt: User message text (used as cache key)

        Yields:
            str: SSE-formatted response chunks
        """

        def format_sse(payload: Dict[str, Any]) -> str:
            return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"

        message_id = f"msg-{uuid.uuid4().hex}"
        text_stream_id = "text-1"

        message_text = random.choice(self.MOCK_RESPONSES)

        yield format_sse({"type": "start", "messageId": message_id})
        yield format_sse({"type": "text-start", "id": text_stream_id})
        yield format_sse(
            {"type": "text-delta", "id": text_stream_id, "delta": message_text}
        )
        yield format_sse({"type": "text-end", "id": text_stream_id})

        await create_message(
            self.supabase,
            Message(session_id=session_id, sender="model", content=message_text),
        )

        yield format_sse({"type": "finish"})
        yield "data: [DONE]\n\n"
