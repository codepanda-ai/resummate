"""
Report agent for generating AI-powered interview feedback reports.
"""

from google import genai
from supabase import Client

from api.agents.context import build_chat_history
from api.core.logging import log_info


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
You are an expert interview evaluator. You will be given the full transcript of a mock interview session.

Your task is to produce a comprehensive, structured feedback report in the following exact markdown format:

# Interview Performance Report

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

    async def run(self, session_id: str) -> str:
        """
        Generate a markdown feedback report for a completed interview session.

        Fetches the full message history and sends a single non-streaming
        request to produce the evaluation report.

        Args:
            session_id: Session/thread identifier

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

        chat = self.gemini.chats.create(
            model=self.MODEL,
            config={
                "system_instruction": self.SYSTEM_PROMPT,
                "max_output_tokens": self.MAX_OUTPUT_TOKENS,
                "temperature": self.TEMPERATURE,
            },
            history=history,
        )

        response = chat.send_message(
            "Generate a comprehensive markdown evaluation report for this interview session."
        )
        return response.text
