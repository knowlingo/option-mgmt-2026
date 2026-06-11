import { expect, test } from "@playwright/test";

/**
 * Phase-1 E2E flows #2/#3 — Settings save + Outcome entry (master plan §19).
 *
 * Authenticated flows. The session cookie is injected by `global-setup.ts` from
 * `E2E_ACCESS_TOKEN` (minted by `apps/api/scripts/e2e_seed.py` in the `e2e` CI
 * job). Each test `test.skip`s when its prerequisite env is absent, so the job
 * stays green when the seed step doesn't run (e.g. local `pnpm e2e` without a
 * seeded DB). Selectors are the real testids shipped in M1.22/M1.23.
 *   - Settings save  → needs E2E_ACCESS_TOKEN (PUT /profile 404s without the user row)
 *   - Outcome entry  → also needs E2E_DECISION_ID (a seeded daily_decision)
 */

const DISCLAIMER_KEY = "disclaimerAcceptedAt_v1";
const HAS_SESSION = Boolean(process.env.E2E_ACCESS_TOKEN);

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, new Date().toISOString());
  }, DISCLAIMER_KEY);
});

test("settings: change strategy style and save", async ({ page }) => {
  test.skip(!HAS_SESSION, "E2E_ACCESS_TOKEN not provided by the harness");
  await page.goto("/settings");

  await page.getByTestId("field-style").selectOption("growth");
  const save = page.getByTestId("save-button");
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByTestId("save-status")).toContainText(/saved/i);
});

test("outcomes: record an outcome and see it in history", async ({ page }) => {
  const decisionId = process.env.E2E_DECISION_ID ?? "";
  test.skip(
    !HAS_SESSION || decisionId === "",
    "E2E_ACCESS_TOKEN / E2E_DECISION_ID not provided by the harness",
  );

  await page.goto("/outcomes");

  await page.getByTestId("field-new-daily_decision_id").fill(decisionId);
  await page.getByTestId("field-new-horizon_days").fill("7");
  await page.getByTestId("field-new-decision_quality").selectOption("good");

  const save = page.getByTestId("entry-save-button");
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByTestId("entry-status")).toContainText(/recorded/i);
  // The newly created row is prepended to the history table.
  await expect(page.getByTestId("outcome-table")).toBeVisible();
});
