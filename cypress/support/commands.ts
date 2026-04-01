/// <reference types="cypress" />

// Stack Auth: NEXT_PUBLIC_STACK_* loaded in cypress.config.ts from .env / .env.local
const TEST_USER_EMAIL = "cypress@test.com";
const TEST_USER_PASSWORD = "password";

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
      cy.env<{
        STACK_PROJECT_ID: string;
        STACK_PUBLISHABLE_CLIENT_KEY: string;
      }>(["STACK_PROJECT_ID", "STACK_PUBLISHABLE_CLIENT_KEY"]).then(
        ({ STACK_PROJECT_ID, STACK_PUBLISHABLE_CLIENT_KEY }) => {
          if (!STACK_PROJECT_ID || !STACK_PUBLISHABLE_CLIENT_KEY) {
            throw new Error(
              "Set NEXT_PUBLIC_STACK_PROJECT_ID and NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY in .env.local (or export them before cypress run).",
            );
          }

          cy.request({
            method: "POST",
            url: "https://api.stack-auth.com/api/v1/auth/password/sign-in",
            headers: {
              "x-stack-project-id": STACK_PROJECT_ID,
              "x-stack-publishable-client-key": STACK_PUBLISHABLE_CLIENT_KEY,
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

            cy.setCookie(`stack-refresh-${STACK_PROJECT_ID}`, refresh_token);
            cy.setCookie(
              "stack-access",
              JSON.stringify([refresh_token, access_token]),
            );
          });
        },
      );
    },
    {
      validate() {
        cy.env(["STACK_PROJECT_ID"]).then(({ STACK_PROJECT_ID }) => {
          cy.getCookie(`stack-refresh-${STACK_PROJECT_ID}`).should("exist");
        });
      },
    },
  );
});

export {};
