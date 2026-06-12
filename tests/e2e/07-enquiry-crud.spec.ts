import { test, expect } from "@playwright/test";
import { login, goToRoute } from "./helpers";

/**
 * DESTRUCTIVE round-trip: create -> edit -> delete a clearly-marked test
 * enquiry. This WRITES to the live Supabase database, so it is gated behind
 * E2E_RUN_DESTRUCTIVE=1 and is skipped by default. Never run against
 * production without an explicit opt-in.
 */
const DESTRUCTIVE = process.env.E2E_RUN_DESTRUCTIVE === "1";

const STAMP = Date.now();
const SUBJECT = `E2E SMOKE TEST — delete me (${STAMP})`;
const SUBJECT_EDITED = `E2E SMOKE TEST — edited, delete me (${STAMP})`;
const CLIENT = `E2E Test Client ${STAMP}`;

test.describe("Enquiry create → edit → delete round-trip", () => {
  test.skip(
    !DESTRUCTIVE,
    "Destructive write test — set E2E_RUN_DESTRUCTIVE=1 to enable (writes to live DB).",
  );

  test("creates, edits and deletes a test enquiry", async ({ page }) => {
    await login(page);
    await goToRoute(page, "/enquiries");

    // CREATE
    await page.getByTestId("button-create-enquiry").click();
    await page.getByTestId("input-enquiry-client-name").fill(CLIENT);
    await page.getByTestId("input-enquiry-subject").fill(SUBJECT);
    await page.getByTestId("button-submit-enquiry").click();

    // Search narrows the table to our record; it should appear.
    await page.getByPlaceholder(/search by client/i).fill(SUBJECT);
    const createdRow = page.locator("tbody tr", { hasText: SUBJECT });
    await expect(createdRow).toHaveCount(1, { timeout: 30_000 });

    // EDIT — open the row's edit dialog and change the subject.
    await createdRow
      .locator('[data-testid^="button-edit-enquiry-"]')
      .click();
    const subjectInput = page.getByTestId("input-enquiry-subject");
    await expect(subjectInput).toHaveValue(SUBJECT);
    await subjectInput.fill(SUBJECT_EDITED);
    await page.getByTestId("button-submit-enquiry").click();

    await page.getByPlaceholder(/search by client/i).fill(SUBJECT_EDITED);
    const editedRow = page.locator("tbody tr", { hasText: SUBJECT_EDITED });
    await expect(editedRow).toHaveCount(1, { timeout: 30_000 });

    // DELETE — open the confirm dialog and confirm.
    await editedRow
      .locator('[data-testid^="button-delete-enquiry-"]')
      .click();
    await page.getByTestId("button-confirm-delete-enquiry").click();

    // The record should be gone.
    await page.getByPlaceholder(/search by client/i).fill(SUBJECT_EDITED);
    await expect(
      page.locator("tbody tr", { hasText: SUBJECT_EDITED }),
    ).toHaveCount(0, { timeout: 30_000 });
  });
});
