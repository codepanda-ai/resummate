// AI SDK v5 uses SSE-based data stream protocol (not the old v4 "0:text" format).
// Each event is `data: <JSON>\n\n`. The sequence is:
//   start → text-start → text-delta(s) → text-end → finish → [DONE]
export function buildSSEStream(messageId: string, text: string): string {
  const textId = "text-1";
  return [
    `data: {"type":"start","messageId":"${messageId}"}`,
    `data: {"type":"text-start","id":"${textId}"}`,
    `data: {"type":"text-delta","id":"${textId}","delta":${JSON.stringify(text)}}`,
    `data: {"type":"text-end","id":"${textId}"}`,
    `data: {"type":"finish"}`,
    `data: [DONE]`,
  ]
    .map((line) => line + "\n\n")
    .join("");
}

export const MOCK_CHAT_STREAM = buildSSEStream(
  "msg_mock_greeting",
  "Hello! I've reviewed your resume and the job description.\n\nLet's start the interview. Tell me about yourself and your experience.\n",
);

export const MOCK_FOLLOW_UP_STREAM = buildSSEStream(
  "msg_mock_followup",
  "Great answer! Can you tell me more about a specific project you worked on?\n",
);
