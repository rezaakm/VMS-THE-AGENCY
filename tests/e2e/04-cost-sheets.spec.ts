import { test, expect } from "@playwright/test";
import { login, goToRoute } from "./helpers";

test.describe("Cost Sheets", () => {
  test("cost sheet titles render (not blank)", async ({ page }) => {
    await login(page);
    await goToRoute(page, "/cost-sheets");

    await expect(
      page.getByRole("heading", { name: /cost sheet/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    const rows = page.locator("table tbody tr");
    await expect
      .poll(async () => rows.count(), { timeout: 30_000 })
      .toBeGreaterThan(0);

    // The title/event column should carry real text, not an empty cell. The
    // cost-sheet display title lives in the `event` column (mapped to `title`).
    const firstRowText = (await rows.first().innerText()).trim();
    expect(
      firstRowText.replace(/[\s|—-]/g, "").length,
      `First cost-sheet row appears blank: "${firstRowText}"`,
    ).toBeGreaterThan(0);
  });
});
