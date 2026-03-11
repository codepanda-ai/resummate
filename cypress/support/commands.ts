/// <reference types="cypress" />

// Stack Auth project config (from .env.local — test-runner constants, not app env vars)
const STACK_PROJECT_ID = "a3e0b84f-4033-40b0-8849-ab30fa6da61c";
const STACK_PUBLISHABLE_KEY = "pck_nsvvsrcx72esenxtgr3bf3amd1dxjvvf2p2x3bepdd2m0";
const TEST_USER_EMAIL = "cypress@test.com";
const TEST_USER_PASSWORD = "password";

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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Programmatically sign in as the test user via the Stack Auth REST API.
       * Uses cy.session() to cache the session — the network login only runs once
       * per test run. Subsequent tests restore cookies from the session cache.
       */
      login(): Chainable<void>;

      /** Stub all backend /api/* endpoints for a given chat session. */
      stubBackend(chatId: string): Chainable<void>;

      /** Stub backend with uploaded documents already present. */
      stubBackendWithDocs(chatId: string): Chainable<void>;

      /** Stub backend in IN_PROGRESS session state with chat history. */
      stubBackendInProgress(chatId: string): Chainable<void>;

      /** Stub backend in ENDED session state. */
      stubBackendEnded(chatId: string): Chainable<void>;
    }
  }
}

// ---------------------------------------------------------------------------
// cy.login()
// ---------------------------------------------------------------------------
// Strategy: call Stack Auth's password sign-in REST endpoint directly with
// cy.request() (no UI interaction). This returns real access_token +
// refresh_token. We write them into the two Stack Auth browser cookies so
// useUser({ or: 'redirect' }) sees a valid session the moment the page loads,
// without ever touching the sign-in page.
//
// Cookie formats (from Stack Auth SDK source):
//   stack-refresh-{projectId}  → plain refresh token string (legacy name,
//                                 checked first by the SDK)
//   stack-access               → JSON.stringify([refreshToken, accessToken])
//
// cy.session() caches these cookies after the first login. Every subsequent
// test restores them instantly from the cache instead of hitting the network.
// ---------------------------------------------------------------------------
Cypress.Commands.add("login", () => {
  cy.session(
    "cypress-test-user",
    () => {
      cy.request({
        method: "POST",
        url: "https://api.stack-auth.com/api/v1/auth/password/sign-in",
        headers: {
          "x-stack-project-id": STACK_PROJECT_ID,
          "x-stack-publishable-client-key": STACK_PUBLISHABLE_KEY,
          "x-stack-access-type": "client",
        },
        body: {
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
        },
      }).then(({ body }) => {
        const { access_token, refresh_token } = body as {
          access_token: string;
          refresh_token: string;
        };

        // Write Stack Auth session cookies for localhost.
        // The SDK reads these synchronously at startup; if the refresh token
        // cookie is present it enters "loading" state rather than redirecting.
        cy.setCookie(`stack-refresh-${STACK_PROJECT_ID}`, refresh_token);
        cy.setCookie("stack-access", JSON.stringify([refresh_token, access_token]));
      });
    },
    {
      // Session is still good as long as the refresh token cookie exists.
      validate() {
        cy.getCookie(`stack-refresh-${STACK_PROJECT_ID}`).should("exist");
      },
    }
  );
});

// ---------------------------------------------------------------------------
// Backend stubs — intercept FastAPI calls so no real backend is needed
// ---------------------------------------------------------------------------

Cypress.Commands.add("stubBackend", (chatId: string) => {
  // Session status — NOT_STARTED (matches real SessionResponse schema)
  cy.intercept("GET", `/api/session/${chatId}`, {
    statusCode: 200,
    body: {
      id: chatId,
      user_id: "user_test_123",
      status: "NOT_STARTED",
      created_at: new Date().toISOString(),
    },
  }).as("getSession");

  // Chat history — empty
  cy.intercept("GET", `/api/chat/history/${chatId}`, {
    statusCode: 200,
    body: { messages: [] },
  }).as("getChatHistory");

  // Resume — not uploaded yet: real API returns 404
  cy.intercept("GET", `/api/resume/${chatId}`, {
    statusCode: 404,
    body: { detail: "Resume not found" },
  }).as("getResume");

  // Resume upload — real API returns { message: "..." }
  cy.intercept("POST", "/api/resume/upload", {
    statusCode: 200,
    body: { message: "Resume uploaded successfully!" },
  }).as("uploadResume");

  // Job description — not uploaded yet: real API returns 404
  cy.intercept("GET", `/api/job-description/${chatId}`, {
    statusCode: 404,
    body: { detail: "Job description not found" },
  }).as("getJobDescription");

  // Job description upload — real API returns { message: "..." }
  cy.intercept("POST", "/api/job-description/upload", {
    statusCode: 200,
    body: { message: "Job description uploaded successfully!" },
  }).as("uploadJobDescription");

  // Start session — real API returns full SessionResponse
  cy.intercept("PATCH", `/api/session/${chatId}/start`, {
    statusCode: 200,
    body: {
      id: chatId,
      user_id: "user_test_123",
      status: "IN_PROGRESS",
      created_at: new Date().toISOString(),
    },
  }).as("startSession");

  // Chat streaming
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

  // End session — real API returns full SessionResponse
  cy.intercept("PATCH", `/api/session/${chatId}/end`, {
    statusCode: 200,
    body: {
      id: chatId,
      user_id: "user_test_123",
      status: "ENDED",
      created_at: new Date().toISOString(),
    },
  }).as("endSession");

  // Report — 404 initially so the UI generates it via POST
  cy.intercept("GET", `/api/session/${chatId}/report`, {
    statusCode: 404,
    body: { detail: "Report not found" },
  }).as("getReport");

  // Report generation — real API returns { report: "..." }
  cy.intercept("POST", `/api/session/${chatId}/report`, {
    statusCode: 200,
    body: { report: "# Interview Report\n\nGreat job! Here is your feedback." },
  }).as("generateReport");
});

Cypress.Commands.add("stubBackendWithDocs", (chatId: string) => {
  cy.stubBackend(chatId);

  // Real API returns flat FileInfoResponse: { name, contentType }
  cy.intercept("GET", `/api/resume/${chatId}`, {
    statusCode: 200,
    body: { name: "resume.pdf", contentType: "application/pdf" },
  }).as("getResume");

  cy.intercept("GET", `/api/job-description/${chatId}`, {
    statusCode: 200,
    body: { name: "job-description.pdf", contentType: "application/pdf" },
  }).as("getJobDescription");
});

Cypress.Commands.add("stubBackendInProgress", (chatId: string) => {
  cy.stubBackend(chatId);

  // Override session to IN_PROGRESS (matches real SessionResponse schema)
  cy.intercept("GET", `/api/session/${chatId}`, {
    statusCode: 200,
    body: {
      id: chatId,
      user_id: "user_test_123",
      status: "IN_PROGRESS",
      created_at: new Date().toISOString(),
    },
  }).as("getSession");

  // Real API returns flat FileInfoResponse: { name, contentType }
  cy.intercept("GET", `/api/resume/${chatId}`, {
    statusCode: 200,
    body: { name: "resume.pdf", contentType: "application/pdf" },
  }).as("getResume");

  cy.intercept("GET", `/api/job-description/${chatId}`, {
    statusCode: 200,
    body: { name: "job-description.pdf", contentType: "application/pdf" },
  }).as("getJobDescription");

  cy.intercept("GET", `/api/chat/history/${chatId}`, {
    statusCode: 200,
    body: {
      messages: [
        {
          id: "msg_1",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "Hello! I've reviewed your resume. Tell me about yourself and your experience.",
            },
          ],
        },
      ],
    },
  }).as("getChatHistory");

  cy.intercept("POST", "/api/chat", {
    statusCode: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
    body: MOCK_FOLLOW_UP_STREAM,
  }).as("postChat");
});

Cypress.Commands.add("stubBackendEnded", (chatId: string) => {
  cy.stubBackend(chatId);

  // Override session to ENDED (matches real SessionResponse schema)
  cy.intercept("GET", `/api/session/${chatId}`, {
    statusCode: 200,
    body: {
      id: chatId,
      user_id: "user_test_123",
      status: "ENDED",
      created_at: new Date().toISOString(),
    },
  }).as("getSession");

  // Real API returns flat FileInfoResponse: { name, contentType }
  cy.intercept("GET", `/api/resume/${chatId}`, {
    statusCode: 200,
    body: { name: "resume.pdf", contentType: "application/pdf" },
  }).as("getResume");

  cy.intercept("GET", `/api/job-description/${chatId}`, {
    statusCode: 200,
    body: { name: "job-description.pdf", contentType: "application/pdf" },
  }).as("getJobDescription");

  cy.intercept("GET", `/api/chat/history/${chatId}`, {
    statusCode: 200,
    body: {
      messages: [
        {
          id: "msg_1",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "Hello! I've reviewed your resume. Tell me about yourself and your experience.",
            },
          ],
        },
        {
          id: "msg_2",
          role: "user",
          parts: [
            {
              type: "text",
              text: "I have 5 years of experience in software development.",
            },
          ],
        },
      ],
    },
  }).as("getChatHistory");
});
