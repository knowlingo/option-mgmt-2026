import { expect, test } from "@playwright/test";

/**
 * Phase-1 E2E flows #2/#3 — Settings save + Outcome entry (master plan §19).
 *
 * DORMANT: see `e2e/playwright.config.ts`. These authenticated flows require
 * the activated `e2e` CI job to seed a session cookie (`access_token`) and, for
 * the outcome flow, at least one `daily_decision` whose id is exposed via
 * `E2E_DECISION_ID`. Selectors below are the real testids shipped in M1.22/M1.23.
 */

const DISCLAIMER_KEY = "disclaimerAcceptedAt_v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, new Date().toISOString());
  }, DISCLAIMER_KEY);
});

test("settings: change strategy style and save", async ({ page }) => {
  await page.goto("/settings");

  await page.getByTestId("field-style").selectOption("growth");
  const save = page.getByTestId("save-button");
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByTestId("save-status")).toContainText(/saved/i);
});

test("outcomes: record an outcome and see it in history", async ({ page }) => {
  const decisionId = process.env.E2E_DECISION_ID ?? "";
  test.skip(decisionId === "", "E2E_DECISION_ID not provided by the harness");

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
