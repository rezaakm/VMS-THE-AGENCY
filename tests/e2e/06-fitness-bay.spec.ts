import { test, expect } from "@playwright/test";
import { login, goToRoute } from "./helpers";

test.describe("Fitness Bay", () => {
  test("shows the partner split (Reza + Mahsa)", async ({ page }) => {
    await login(page);
    await goToRoute(page, "/fitness-bay");

    await expect(
      page.getByRole("heading", { name: /fitness bay/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Partner Split section names both partners.
    await expect(page.getByText("Partner Split", { exact: false })).toBeVisible();
    await expect(page.getByText("Reza", { exact: true })).toBeVisible();
    await expect(page.getByText("Mahsa", { exact: true })).toBeVisible();

    // Their split percentages (70 / 30) should render.
    await expect(page.getByText("70%")).toBeVisible();
    await expect(page.getByText("30%")).toBeVisible();
  });
});
