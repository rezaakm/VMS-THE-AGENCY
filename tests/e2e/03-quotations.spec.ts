import { test, expect } from "@playwright/test";
import { login, goToRoute } from "./helpers";

test.describe("Quotations", () => {
  test("quotations list loads with rows", async ({ page }) => {
    await login(page);
    await goToRoute(page, "/quotations");

    // Page heading should render.
    await expect(
      page.getByRole("heading", { name: /quotation/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Expect a populated table: more than just the header row.
    const rows = page.locator("table tbody tr");
    await expect
      .poll(async () => rows.count(), { timeout: 30_000 })
      .toBeGreaterThan(0);
  });
});
