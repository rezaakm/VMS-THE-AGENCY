import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Authentication", () => {
  test("logs in and reaches the app shell", async ({ page }) => {
    await login(page);

    // The sidebar nav (with a Dashboard link) is the signal that we are in.
    await expect(
      page.getByRole("link", { name: /dashboard/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // The login form's Sign in button should no longer be present.
    await expect(page.getByRole("button", { name: /sign in/i })).toBeHidden();
  });
});
