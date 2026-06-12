import { expect, type Page } from "@playwright/test";

/**
 * Shared E2E helpers.
 *
 * Credentials come from the environment — NEVER hard-code a password.
 *   E2E_EMAIL     – login email
 *   E2E_PASSWORD  – login password
 */
export const E2E_EMAIL = process.env.E2E_EMAIL ?? "";
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "";

export function requireCredentials() {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "E2E_EMAIL and E2E_PASSWORD must be set in the environment to run these tests. " +
        "See tests/e2e/README.md.",
    );
  }
}

/**
 * Log in through the Supabase email/password form and wait until the app
 * shell (sidebar nav) is visible. Uses resilient role/label selectors that
 * match the LoginPage markup.
 */
export async function login(page: Page) {
  requireCredentials();

  await page.goto("/");

  // If we are already authenticated (persisted session), the sidebar appears
  // and there is no Sign in button — short-circuit.
  const signInButton = page.getByRole("button", { name: /sign in/i });
  if (!(await signInButton.isVisible().catch(() => false))) {
    return;
  }

  await page.getByLabel(/email/i).fill(E2E_EMAIL);
  await page.getByLabel(/password/i).fill(E2E_PASSWORD);
  await signInButton.click();

  // The login form should disappear once authenticated.
  await expect(signInButton).toBeHidden({ timeout: 30_000 });
}

/** Navigate to an in-app route and wait for it to settle. */
export async function goToRoute(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle").catch(() => {});
}
