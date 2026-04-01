import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "cypress";

// Match Next.js: .env then .env.local overrides (same keys as the app uses)
loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    baseUrl: "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    video: false,
    env: {
      STACK_PROJECT_ID: process.env.NEXT_PUBLIC_STACK_PROJECT_ID ?? "",
      STACK_PUBLISHABLE_CLIENT_KEY:
        process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY ?? "",
    },
  },
});
