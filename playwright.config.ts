import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E smoke tests for Agency OS (VMS).
 *
 * Target the deployed app by default; override with E2E_BASE_URL to run
 * against a local `npm run dev` server (e.g. http://localhost:5174).
 *
 * Credentials and the destructive-test opt-in are read from env — see
 * tests/e2e/README.md. Never hard-code a password.
 */
const baseURL = process.env.E2E_BASE_URL || "https://vms-the-agency.vercel.app";

export default defineConfig({
  testDir: "./tests/e2e",
  // One worker keeps the shared (single-user) Supabase session stable and
  // avoids interleaving the create/edit/delete round-trip with reads.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
