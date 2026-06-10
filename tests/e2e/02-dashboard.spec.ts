import { test, expect } from "@playwright/test";
import { login, goToRoute } from "./helpers";

test.describe("Dashboard", () => {
  test("shows non-zero metrics after login", async ({ page }) => {
    await login(page);
    await goToRoute(page, "/");

    // Wait for currency-formatted figures to appear (OMR X,XXX.XXX).
    const body = page.locator("body");
    await expect(body).toContainText(/OMR/i, { timeout: 30_000 });

    // At least one metric should be a non-zero amount — guards against the
    // "everything renders but all values are 0 / blocked" failure mode.
    const text = await body.innerText();
    const amounts = text.match(/OMR\s*[\d,]+(?:\.\d+)?/gi) ?? [];
    const hasNonZero = amounts.some((a) => /[1-9]/.test(a.replace(/^OMR\s*/i, "")));
    expect(
      hasNonZero,
      `Expected at least one non-zero OMR metric on the dashboard. Found: ${amounts.join(", ") || "none"}`,
    ).toBeTruthy();
  });
});
