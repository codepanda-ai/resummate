"""
Report agent for generating AI-powered interview feedback reports.
"""

from datetime import datetime
from typing import Any, List, Optional

from google import genai
from supabase import Client

from api.agents.context import build_chat_history, fetch_gemini_files
from api.core.logging import log_info


def _format_duration(started_at: Optional[str], ended_at: Optional[str]) -> str:
    """
    Compute a human-readable duration string from two ISO timestamp strings.

    Args:
        started_at: ISO 8601 timestamp string for session start
        ended_at: ISO 8601 timestamp string for session end

    Returns:
        str: Formatted duration (e.g. "12 minutes 34 seconds") or "Unknown"
    """
    if not started_at or not ended_at:
        return "Unknown"
    try:
        start = datetime.fromisoformat(started_at)
        end = datetime.fromisoformat(ended_at)
        total_seconds = max(0, int((end - start).total_seconds()))
        minutes, seconds = divmod(total_seconds, 60)
        if minutes == 0:
            return f"{seconds} second{'s' if seconds != 1 else ''}"
        if seconds == 0:
            return f"{minutes} minute{'s' if minutes != 1 else ''}"
        return f"{minutes} minute{'s' if minutes != 1 else ''} {seconds} second{'s' if seconds != 1 else ''}"
    except Exception:
        return "Unknown"


class ReportAgent:
    """
    Agent for generating markdown interview feedback reports.

    Tune MODEL, MAX_OUTPUT_TOKENS, TEMPERATURE, and SYSTEM_PROMPT as class
    attributes to adjust the agent's behavior without touching call sites.

    Dependencies (gemini, supabase) are injected at construction time via
    FastAPI's Depends() system, keeping the agent compatible with DI-managed
    dependencies added in the future.
    """

    MODEL: str = "gemini-2.5-flash-lite"
    MAX_OUTPUT_TOKENS: int = 4096
    TEMPERATURE: float = 0.3

    SYSTEM_PROMPT: str = """
You are an expert interview evaluator. You will be given the full transcript of a mock interview session, along with the candidate's resume and the job description.

Your task is to produce a comprehensive, structured feedback report in the following exact markdown format:

# Interview Performance Report

## Session Overview

**Candidate Experience:** [2-3 sentence summary of the candidate's background and relevant experience, extracted from the resume]

**Role Summary:** [1-2 sentence summary of the target role and key requirements, extracted from the job description]

**Interview Duration:** [Duration provided in the prompt — copy it verbatim]

**Topics Covered:** [Comma-separated list of the main topics and themes discussed across the interview]

## Overall Score: [X]/100

## Decision: [OFFER / NO OFFER]

## Summary
[2-3 sentence overall assessment of the candidate's performance]

## Strengths
- [Specific strength with an example drawn from their actual answers]
- [Another strength with supporting evidence]
- [Additional strengths as warranted]

## Areas for Improvement
- [Specific area with concrete, actionable advice]
- [Another area with supporting evidence and next steps]
- [Additional areas as warranted]

## Question-by-Question Breakdown
| Question | Rating | Notes |
|----------|--------|-------|
| [Summarize Q1] | [Strong / Adequate / Weak] | [Brief note on the answer quality] |
| [Summarize Q2] | [Strong / Adequate / Weak] | [Brief note] |
| ... | ... | ... |

## Recommendations
- [Specific, actionable tip to improve interview performance]
- [Another recommendation]
- [Additional recommendations as warranted]

Evaluation criteria:
- Clarity and structure of answers (STAR method usage)
- Depth and specificity of examples
- Quantifiable impact and measurable outcomes
- Relevance to the role and job description
- Communication and professionalism
- Self-awareness and growth mindset
    """.strip()

    MOCK_REPORT: str = """# Interview Performance Report

## Session Overview

**Candidate Experience:** The candidate has 4 years of full-stack engineering experience, primarily at a B2B SaaS startup where they led backend development using Python and Node.js. They have hands-on experience with distributed systems, CI/CD pipelines, and mentoring junior engineers.

**Role Summary:** The target role is a Senior Software Engineer at a growth-stage fintech company, focused on building scalable payment infrastructure. Key requirements include strong backend fundamentals, experience with high-availability systems, and the ability to drive technical decisions independently.

**Interview Duration:** 18 minutes 42 seconds

**Topics Covered:** Technical problem-solving, system design, leadership and mentorship, conflict resolution, prioritization under pressure

## Overall Score: 82/100

## Decision: OFFER

## Summary
The candidate demonstrated strong communication skills and relevant technical experience throughout the session. Answers were generally well-structured using the STAR method, with clear outcomes described. Some areas could benefit from more quantitative impact data.

## Strengths
- **Clear communication**: Answers were organized and easy to follow
- **Relevant experience**: Effectively referenced past projects aligned to the role
- **Problem-solving approach**: Articulated a methodical process for debugging and technical challenges

## Areas for Improvement
- **Quantify impact**: Add specific metrics (e.g., "reduced latency by 40%") to strengthen answers
- **Leadership depth**: Provide more examples of driving team decisions or mentoring others
- **Edge case thinking**: When discussing system design, proactively address failure modes

## Question-by-Question Breakdown
| Question | Rating | Notes |
|----------|--------|-------|
| Technical challenge question | Strong | Good detail on root cause analysis |
| Leadership/collaboration question | Adequate | Could include more specific outcomes |
| System design question | Strong | Solid fundamentals, missing scalability discussion |
| Behavioral question | Adequate | Answer was relevant but lacked measurable results |

## Recommendations
- Practice answering with the STAR framework and always end with a quantifiable result
- Prepare 2-3 stories that can be adapted across behavioral, leadership, and technical questions
- Review common system design patterns and practice explaining trade-offs out loud
"""

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
        session_id: str,
        resume_reference: str,
        job_description_reference: Optional[str],
        started_at: Optional[str],
        ended_at: Optional[str],
    ) -> str:
        """
        Generate a markdown feedback report for a completed interview session.

        Fetches the full message history and the uploaded resume/JD files, then
        sends a single non-streaming request to produce the evaluation report.

        Args:
            session_id: Session/thread identifier
            resume_reference: Gemini file name for the resume
            job_description_reference: Optional Gemini file name for the job description
            started_at: ISO 8601 timestamp when the session started
            ended_at: ISO 8601 timestamp when the session ended

        Returns:
            str: Generated markdown report text

        Raises:
            ValueError: If no messages are found for the session
        """
        history = await build_chat_history(self.supabase, session_id, limit=100)

        if not history:
            raise ValueError(f"No messages found for session {session_id}")

        log_info(
            f"ReportAgent: generating report for session {session_id} "
            f"({len(history)} messages)"
        )

        resume_file, job_description_file = await fetch_gemini_files(
            self.gemini, resume_reference, job_description_reference
        )
        log_info(f"ReportAgent: retrieved resume {resume_file.name}")
        if job_description_file:
            log_info(
                f"ReportAgent: retrieved job description {job_description_file.name}"
            )

        duration = _format_duration(started_at, ended_at)

        chat = self.gemini.chats.create(
            model=self.MODEL,
            config={
                "system_instruction": self.SYSTEM_PROMPT,
                "max_output_tokens": self.MAX_OUTPUT_TOKENS,
                "temperature": self.TEMPERATURE,
            },
            history=history,
        )

        message_content: List[Any] = [
            f"Interview duration: {duration}\n\n"
            "Using the resume, job description, and interview transcript above, "
            "generate a comprehensive markdown evaluation report.",
            resume_file,
        ]
        if job_description_file:
            message_content.append(job_description_file)

        response = chat.send_message(message_content)
        return response.text
