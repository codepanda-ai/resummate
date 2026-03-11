/**
 * Full Interview Flow E2E Tests
 *
 * Tests the end-to-end user journey in two test cases:
 *
 * Test 1 — Landing through end of interview:
 *   1. Open landing page -> redirects to UUID chat route
 *   2. Upload resume and job description
 *   3. Start interview session
 *   4. Reply to interview question with text
 *   5. End interview session
 *
 * Test 2 — View feedback report:
 *   6. Navigate to ended session and view the generated report
 *
 * All backend API calls and Stack Auth are stubbed — only the Next.js
 * frontend needs to be running (pnpm next-dev).
 */

// AI SDK v5 uses SSE-based data stream protocol (not the old v4 "0:text" format).
// Each event is `data: <JSON>\n\n`. The sequence is:
//   start → text-start → text-delta(s) → text-end → finish → [DONE]
function buildSSEStream(messageId: string, text: string): string {
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

const MOCK_CHAT_STREAM = buildSSEStream(
  "msg_mock_greeting",
  "Hello! I've reviewed your resume and the job description.\n\nLet's start the interview. Tell me about yourself and your experience.\n",
);

const MOCK_FOLLOW_UP_STREAM = buildSSEStream(
  "msg_mock_followup",
  "Great answer! Can you tell me more about a specific project you worked on?\n",
);

const TEST_CHAT_ID = "aaaabbbb-cccc-dddd-eeee-ffffffffffff";

describe("Full Interview Flow", () => {
  beforeEach(() => {
    cy.login();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Landing page through end of interview
  // ─────────────────────────────────────────────────────────────────────────
  it("completes the interview from landing through ending the session", () => {
    // ── Phase 1: Landing page redirects to a UUID chat route ──────────

    cy.intercept("GET", "/api/session/*", {
      statusCode: 200,
      body: { status: "NOT_STARTED" },
    }).as("getSessionWildcard");
    cy.intercept("GET", "/api/resume/*", {
      statusCode: 404,
      body: { detail: "Resume not found" },
    }).as("getResumeWildcard");
    cy.intercept("GET", "/api/job-description/*", {
      statusCode: 404,
      body: { detail: "Job description not found" },
    }).as("getJobDescriptionWildcard");
    cy.intercept("GET", "/api/chat/history/*", {
      statusCode: 200,
      body: { messages: [] },
    }).as("getChatHistoryWildcard");
    cy.intercept("POST", "/api/users/register", {
      statusCode: 200,
      body: { id: "user_test_123" },
    });

    cy.visit("/");

    cy.url().should("match", /\/[0-9a-f-]{36}$/);
    cy.get("[data-testid='start-interview-btn']").should("exist");

    cy.url().then((url) => {
      const chatId = url.split("/").pop()!;

      // ── Phase 2: Upload resume and job description ────────────────

      cy.intercept("POST", "/api/resume/upload", {
        statusCode: 200,
        body: { message: "Resume uploaded successfully!" },
      }).as("uploadResume");
      cy.intercept("POST", "/api/job-description/upload", {
        statusCode: 200,
        body: { message: "Job description uploaded successfully!" },
      }).as("uploadJobDescription");

      cy.get("[data-testid='start-interview-btn']").should("be.disabled");

      cy.get("[data-testid='resume-file-input']").selectFile(
        "cypress/fixtures/resume.pdf",
        { force: true },
      );
      cy.wait("@uploadResume");
      cy.contains("resume.pdf").should("be.visible");

      cy.get("[data-testid='job-description-file-input']").selectFile(
        "cypress/fixtures/job-description.pdf",
        { force: true },
      );
      cy.wait("@uploadJobDescription");
      cy.contains("job-description.pdf").should("be.visible");

      cy.get("[data-testid='start-interview-btn']").should("not.be.disabled");

      // ── Phase 3: Start interview session ──────────────────────────

      cy.intercept("PATCH", `/api/session/${chatId}/start`, {
        statusCode: 200,
        body: {
          id: chatId,
          user_id: "user_test_123",
          status: "IN_PROGRESS",
          created_at: new Date().toISOString(),
        },
      }).as("startSession");

      cy.intercept("POST", "/api/chat", {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
        body: MOCK_CHAT_STREAM,
      }).as("postChat");

      cy.get("[data-testid='start-interview-btn']").click();
      cy.wait("@startSession");

      cy.contains("Tell me about yourself").should("be.visible");
      cy.get("[data-testid='end-interview-btn']").should("be.visible");

      // ── Phase 4: Reply to interview question ──────────────────────

      cy.intercept("POST", "/api/chat", {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
        body: MOCK_FOLLOW_UP_STREAM,
      }).as("postChatFollowUp");

      cy.get("textarea").should("not.be.disabled");
      cy.get("textarea").type(
        "I have 5 years of experience in software development.",
      );
      cy.get("textarea").type("{enter}");

      cy.wait("@postChatFollowUp");
      cy.contains("Can you tell me more about a specific project").should(
        "be.visible",
      );

      // ── Phase 5: End interview session ────────────────────────────

      cy.intercept("PATCH", `/api/session/${chatId}/end`, {
        statusCode: 200,
        body: {
          id: chatId,
          user_id: "user_test_123",
          status: "ENDED",
          created_at: new Date().toISOString(),
        },
      }).as("endSession");

      cy.get("[data-testid='end-interview-btn']").click();

      cy.contains("End interview session?").should("be.visible");
      cy.contains("won't be able to continue answering questions").should(
        "be.visible",
      );

      cy.get("[data-testid='end-interview-confirm-btn']").click();
      cy.wait("@endSession");

      cy.get("[data-testid='view-report-btn']").should("be.visible");
      cy.contains("View feedback report").should("be.visible");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: View feedback report (visit report page directly)
  // ─────────────────────────────────────────────────────────────────────────
  it("displays the feedback report for an ended session", () => {
    cy.intercept("GET", `/api/session/${TEST_CHAT_ID}/report`, {
      statusCode: 200,
      body: {
        report: "# Interview Report\n\nGreat job! Here is your feedback.",
      },
    }).as("getReport");

    cy.visit(`/${TEST_CHAT_ID}/report`);

    cy.wait("@getReport");

    cy.get("[data-testid='report-content']").should("be.visible");
    cy.contains("Interview Report").should("be.visible");
    cy.contains("Great job").should("be.visible");
  });
});
