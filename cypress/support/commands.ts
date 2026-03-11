/// <reference types="cypress" />

// Mock user returned by Stack Auth
const MOCK_USER = {
  id: "user_test_123",
  primary_email: "test@example.com",
  display_name: "Test User",
  profile_image_url: null,
  signed_up_at_millis: Date.now(),
  has_password: false,
  auth_with_email: true,
  requires_totp_mfa: false,
  client_metadata: {},
  client_read_only_metadata: {},
  server_metadata: {},
  selected_team_id: null,
  selected_team: null,
};

const MOCK_SESSION = {
  id: "sess_test_123",
  user_id: "user_test_123",
  created_at_millis: Date.now(),
  access_token: "test-access-token-mock",
  refresh_token: "test-refresh-token-mock",
  expires_at_millis: Date.now() + 3600 * 1000,
  is_impersonation: false,
};

// AI SDK v5 data stream format for a mock interview question
const MOCK_CHAT_STREAM =
  '0:"Hello! I\'ve reviewed your resume and the job description.\\n\\n"' +
  '\n0:"Let\'s start the interview. Tell me about yourself and your experience.\\n"' +
  '\ne:{"finishReason":"stop","usage":{"promptTokens":50,"completionTokens":30},"isContinued":false}' +
  '\nd:{"finishReason":"stop","usage":{"promptTokens":50,"completionTokens":30}}\n';

const MOCK_FOLLOW_UP_STREAM =
  '0:"Great answer! "' +
  '\n0:"Can you tell me more about a specific project you worked on?\\n"' +
  '\ne:{"finishReason":"stop","usage":{"promptTokens":80,"completionTokens":20},"isContinued":false}' +
  '\nd:{"finishReason":"stop","usage":{"promptTokens":80,"completionTokens":20}}\n';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Stub Stack Auth client-side API calls so useUser() sees a valid session.
       */
      stubAuth(): Chainable<void>;

      /**
       * Stub all backend /api/* endpoints for a given chat session.
       */
      stubBackend(chatId: string): Chainable<void>;

      /**
       * Stub backend with uploaded documents already present (simulates post-upload state).
       */
      stubBackendWithDocs(chatId: string): Chainable<void>;

      /**
       * Stub backend in IN_PROGRESS session state with chat history.
       */
      stubBackendInProgress(chatId: string): Chainable<void>;

      /**
       * Stub backend in ENDED session state.
       */
      stubBackendEnded(chatId: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add("stubAuth", () => {
  // Stack Auth uses /_stack/ routes handled by Next.js for client-side auth.
  // Intercept all Stack Auth internal API calls and return a mock session.

  // Current session check
  cy.intercept("GET", "/_stack/client/v1/sessions/current", {
    statusCode: 200,
    body: MOCK_SESSION,
  }).as("getSession");

  // Current user info
  cy.intercept("GET", "/_stack/client/v1/users/me", {
    statusCode: 200,
    body: MOCK_USER,
  }).as("getUser");

  // Token refresh
  cy.intercept("POST", "/_stack/client/v1/sessions/*/access-token", {
    statusCode: 200,
    body: { access_token: "test-access-token-mock" },
  }).as("refreshToken");

  cy.intercept("POST", "/_stack/client/v1/sessions/*/refresh", {
    statusCode: 200,
    body: MOCK_SESSION,
  }).as("refreshSession");

  // Fallback for any other Stack Auth calls
  cy.intercept("GET", "/_stack/**", { statusCode: 200, body: {} }).as(
    "stackFallbackGet"
  );
  cy.intercept("POST", "/_stack/**", { statusCode: 200, body: {} }).as(
    "stackFallbackPost"
  );
});

Cypress.Commands.add("stubBackend", (chatId: string) => {
  // User registration on first load
  cy.intercept("POST", "/api/users/register", {
    statusCode: 200,
    body: { id: "user_test_123" },
  }).as("registerUser");

  // Session status — NOT_STARTED
  cy.intercept("GET", `/api/session/${chatId}`, {
    statusCode: 200,
    body: { status: "NOT_STARTED" },
  }).as("getSession");

  // Chat history — empty
  cy.intercept("GET", `/api/chat/history/${chatId}`, {
    statusCode: 200,
    body: { messages: [] },
  }).as("getChatHistory");

  // Resume — not uploaded yet
  cy.intercept("GET", `/api/resume/${chatId}`, {
    statusCode: 200,
    body: { resume: null },
  }).as("getResume");

  // Resume upload
  cy.intercept("POST", "/api/resume/upload", {
    statusCode: 200,
    body: { id: "res_1", name: "resume.pdf", type: "PDF" },
  }).as("uploadResume");

  // Job description — not uploaded yet
  cy.intercept("GET", `/api/job-description/${chatId}`, {
    statusCode: 200,
    body: { job_description: null },
  }).as("getJobDescription");

  // Job description upload
  cy.intercept("POST", "/api/job-description/upload", {
    statusCode: 200,
    body: { id: "jd_1", name: "job-description.pdf", type: "PDF" },
  }).as("uploadJobDescription");

  // Start session
  cy.intercept("PATCH", `/api/session/${chatId}/start`, {
    statusCode: 200,
    body: { status: "IN_PROGRESS" },
  }).as("startSession");

  // Chat streaming
  cy.intercept("POST", "/api/chat", {
    statusCode: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "x-vercel-ai-data-stream": "v1" },
    body: MOCK_CHAT_STREAM,
  }).as("postChat");

  // End session
  cy.intercept("PATCH", `/api/session/${chatId}/end`, {
    statusCode: 200,
    body: { status: "ENDED" },
  }).as("endSession");

  // Report — 404 initially so the UI generates it via POST
  cy.intercept("GET", `/api/session/${chatId}/report`, {
    statusCode: 404,
    body: { detail: "Report not found" },
  }).as("getReport");

  // Report generation
  cy.intercept("POST", `/api/session/${chatId}/report`, {
    statusCode: 200,
    body: { report: "# Interview Report\n\nGreat job! Here is your feedback." },
  }).as("generateReport");
});

Cypress.Commands.add("stubBackendWithDocs", (chatId: string) => {
  cy.stubBackend(chatId);

  // Override resume and JD to show as already uploaded
  cy.intercept("GET", `/api/resume/${chatId}`, {
    statusCode: 200,
    body: { resume: { id: "res_1", name: "resume.pdf", type: "PDF" } },
  }).as("getResume");

  cy.intercept("GET", `/api/job-description/${chatId}`, {
    statusCode: 200,
    body: {
      job_description: { id: "jd_1", name: "job-description.pdf", type: "PDF" },
    },
  }).as("getJobDescription");
});

Cypress.Commands.add("stubBackendInProgress", (chatId: string) => {
  cy.stubBackend(chatId);

  // Override session to be IN_PROGRESS
  cy.intercept("GET", `/api/session/${chatId}`, {
    statusCode: 200,
    body: { status: "IN_PROGRESS" },
  }).as("getSession");

  // Override resume and JD to show as uploaded
  cy.intercept("GET", `/api/resume/${chatId}`, {
    statusCode: 200,
    body: { resume: { id: "res_1", name: "resume.pdf", type: "PDF" } },
  }).as("getResume");

  cy.intercept("GET", `/api/job-description/${chatId}`, {
    statusCode: 200,
    body: {
      job_description: { id: "jd_1", name: "job-description.pdf", type: "PDF" },
    },
  }).as("getJobDescription");

  // Chat history with one exchange
  cy.intercept("GET", `/api/chat/history/${chatId}`, {
    statusCode: 200,
    body: {
      messages: [
        {
          id: "msg_1",
          role: "assistant",
          content:
            "Hello! I've reviewed your resume. Tell me about yourself and your experience.",
          created_at: new Date().toISOString(),
        },
      ],
    },
  }).as("getChatHistory");

  // Follow-up chat response
  cy.intercept("POST", "/api/chat", {
    statusCode: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "x-vercel-ai-data-stream": "v1" },
    body: MOCK_FOLLOW_UP_STREAM,
  }).as("postChat");
});

Cypress.Commands.add("stubBackendEnded", (chatId: string) => {
  cy.stubBackend(chatId);

  // Override session to ENDED
  cy.intercept("GET", `/api/session/${chatId}`, {
    statusCode: 200,
    body: { status: "ENDED" },
  }).as("getSession");

  cy.intercept("GET", `/api/resume/${chatId}`, {
    statusCode: 200,
    body: { resume: { id: "res_1", name: "resume.pdf", type: "PDF" } },
  }).as("getResume");

  cy.intercept("GET", `/api/job-description/${chatId}`, {
    statusCode: 200,
    body: {
      job_description: { id: "jd_1", name: "job-description.pdf", type: "PDF" },
    },
  }).as("getJobDescription");

  cy.intercept("GET", `/api/chat/history/${chatId}`, {
    statusCode: 200,
    body: {
      messages: [
        {
          id: "msg_1",
          role: "assistant",
          content:
            "Hello! I've reviewed your resume. Tell me about yourself and your experience.",
          created_at: new Date().toISOString(),
        },
        {
          id: "msg_2",
          role: "user",
          content: "I have 5 years of experience in software development.",
          created_at: new Date().toISOString(),
        },
      ],
    },
  }).as("getChatHistory");
});
