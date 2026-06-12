import { test, expect } from "@playwright/test";
import { login, goToRoute } from "./helpers";

test.describe("P&L", () => {
  test("shows snapshot-derived YTD figures", async ({ page }) => {
    await login(page);
    await goToRoute(page, "/finance/pnl");

    // YTD StatCards (Revenue / Expenses / Net) should render.
    await expect(page.getByText(/YTD/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // The YTD figures are OMR amounts derived from monthly snapshots — at
    // least one should be a real, non-zero value.
    const text = await page.locator("body").innerText();
    const amounts = text.match(/OMR\s*[\d,]+(?:\.\d+)?/gi) ?? [];
    const hasNonZero = amounts.some((a) => /[1-9]/.test(a.replace(/^OMR\s*/i, "")));
    expect(
      hasNonZero,
      `Expected at least one non-zero OMR YTD figure on P&L. Found: ${amounts.join(", ") || "none"}`,
    ).toBeTruthy();
  });
});
