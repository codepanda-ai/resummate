/**
 * Core Interview Flow E2E Tests
 *
 * Tests the end-to-end user journey:
 * 1. Open landing page
 * 2. Upload resume and job description
 * 3. Start interview
 * 4. Reply to interview question with text
 * 5. End interview
 * 6. View feedback report
 *
 * All backend API calls and Stack Auth are stubbed — only the Next.js
 * frontend needs to be running (pnpm next-dev).
 */

const TEST_CHAT_ID = "aaaabbbb-cccc-dddd-eeee-ffffffffffff";

describe("Core Interview Flow", () => {
  beforeEach(() => {
    // Stub Stack Auth so useUser() sees a valid session without a real auth server
    cy.stubAuth();
    // Enable test mode in localStorage so x-test-mode: true header is sent
    cy.window().then((win) => {
      win.localStorage.setItem("test-mode", "true");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Landing page redirects to a UUID chat route
  // ─────────────────────────────────────────────────────────────────────────
  it("Step 1: Landing page redirects to a UUID chat route", () => {
    // Stub backend for whatever UUID the redirect produces
    cy.intercept("GET", "/api/session/*", {
      statusCode: 200,
      body: { status: "NOT_STARTED" },
    }).as("getSessionWildcard");
    cy.intercept("GET", "/api/resume/*", {
      statusCode: 200,
      body: { resume: null },
    }).as("getResumeWildcard");
    cy.intercept("GET", "/api/job-description/*", {
      statusCode: 200,
      body: { job_description: null },
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

    // ChatRedirect generates a UUID and pushes to /{uuid}
    cy.url().should("match", /\/[0-9a-f-]{36}$/);

    // The chat page should render with the start interview button
    cy.get("[data-testid='start-interview-btn']").should("exist");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Upload resume and job description
  // ─────────────────────────────────────────────────────────────────────────
  it("Step 2: Uploads resume and job description", () => {
    cy.stubBackend(TEST_CHAT_ID);
    cy.visit(`/${TEST_CHAT_ID}`);

    // Start button disabled until both docs uploaded
    cy.get("[data-testid='start-interview-btn']").should("be.disabled");

    // --- Upload resume ---
    // Click the paperclip attachments button to open the dropdown
    cy.get("[data-testid='attachments-button']").click();
    // Select "Resume" from the dropdown
    cy.contains("Resume").click();
    // Trigger file selection on the hidden input
    cy.get("[data-testid='resume-file-input']").selectFile(
      "cypress/fixtures/resume.pdf",
      { force: true }
    );
    // Wait for the upload API call and the file attachment to appear
    cy.wait("@uploadResume");
    cy.contains("resume.pdf").should("be.visible");

    // --- Upload job description ---
    // Override resume endpoint to now return the uploaded resume
    cy.intercept("GET", `/api/resume/${TEST_CHAT_ID}`, {
      statusCode: 200,
      body: { resume: { id: "res_1", name: "resume.pdf", type: "PDF" } },
    });
    cy.get("[data-testid='attachments-button']").click();
    cy.contains("Job Description").click();
    cy.get("[data-testid='job-description-file-input']").selectFile(
      "cypress/fixtures/job-description.pdf",
      { force: true }
    );
    cy.wait("@uploadJobDescription");
    cy.contains("job-description.pdf").should("be.visible");

    // Start button should now be enabled
    cy.get("[data-testid='start-interview-btn']").should("not.be.disabled");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Start interview session
  // ─────────────────────────────────────────────────────────────────────────
  it("Step 3: Starts the interview session", () => {
    // Visit with both docs already uploaded and session NOT_STARTED
    cy.stubBackendWithDocs(TEST_CHAT_ID);
    cy.visit(`/${TEST_CHAT_ID}`);

    cy.get("[data-testid='start-interview-btn']").should("not.be.disabled");
    cy.get("[data-testid='start-interview-btn']").click();

    // Verify the start API was called
    cy.wait("@startSession");

    // Wait for the mock AI greeting / first question to appear in the chat
    cy.contains("Tell me about yourself").should("be.visible");

    // End interview button should now be visible
    cy.get("[data-testid='end-interview-btn']").should("be.visible");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Reply to interview question with text response
  // ─────────────────────────────────────────────────────────────────────────
  it("Step 4: Replies to interview question with a text response", () => {
    // Start with an in-progress session that has a question from the AI
    cy.stubBackendInProgress(TEST_CHAT_ID);
    cy.visit(`/${TEST_CHAT_ID}`);

    // Confirm the AI's question is visible in the chat
    cy.contains("Tell me about yourself").should("be.visible");

    // The textarea should be enabled
    cy.get("textarea").should("not.be.disabled");

    // Type a response
    const answer = "I have 5 years of experience in software development.";
    cy.get("textarea").type(answer);

    // Submit via Enter key (no shift)
    cy.get("textarea").type("{enter}");

    // Wait for the chat POST and verify the follow-up question appears
    cy.wait("@postChat");
    cy.contains("Can you tell me more about a specific project").should(
      "be.visible"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: End the interview session
  // ─────────────────────────────────────────────────────────────────────────
  it("Step 5: Ends the interview session", () => {
    cy.stubBackendInProgress(TEST_CHAT_ID);
    cy.visit(`/${TEST_CHAT_ID}`);

    cy.get("[data-testid='end-interview-btn']").should("be.visible");
    cy.get("[data-testid='end-interview-btn']").click();

    // Confirmation dialog should appear
    cy.contains("End interview session?").should("be.visible");
    cy.contains("won't be able to continue answering questions").should(
      "be.visible"
    );

    // Confirm ending the interview
    cy.get("[data-testid='end-interview-confirm-btn']").click();
    cy.wait("@endSession");

    // View feedback report button should now be visible
    cy.get("[data-testid='view-report-btn']").should("be.visible");
    cy.contains("View feedback report").should("be.visible");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6: View the feedback report
  // ─────────────────────────────────────────────────────────────────────────
  it("Step 6: Views the feedback report", () => {
    cy.stubBackendEnded(TEST_CHAT_ID);
    cy.visit(`/${TEST_CHAT_ID}`);

    cy.get("[data-testid='view-report-btn']").should("be.visible");
    cy.get("[data-testid='view-report-btn']").click();

    // Report generation is triggered (GET returns 404, then POST is called)
    cy.wait("@generateReport");

    // Should navigate to the report page
    cy.url().should("include", `/${TEST_CHAT_ID}/report`);

    // Stub the GET report endpoint to now return data (after generation)
    cy.intercept("GET", `/api/session/${TEST_CHAT_ID}/report`, {
      statusCode: 200,
      body: {
        report: "# Interview Report\n\nGreat job! Here is your feedback.",
      },
    }).as("getReportSuccess");

    // Report content should be visible
    cy.get("[data-testid='report-content']").should("be.visible");
    cy.contains("Interview Report").should("be.visible");
    cy.contains("Great job").should("be.visible");
  });
});
