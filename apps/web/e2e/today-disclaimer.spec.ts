import { expect, test } from "@playwright/test";

/**
 * Phase-1 E2E flow #1 — disclaimer gate → Today (master plan §19 Done bar).
 *
 * DORMANT: see `e2e/playwright.config.ts` for why this does not run in CI and
 * how to activate it.
 *
 * Reality note (M1.25 review): the plan's literal "disclaimer → CSV-upload →
 * Today" flow can't be fully browser-driven because there is **no CSV-upload
 * UI** — data import is API-only (`POST /data/{positions,chain,iv}/import-csv`).
 * The activated
 * `e2e` CI job seeds chain/positions/iv via the API in setup; this spec then
 * asserts the disclaimer gate + that the Today surface renders (either the
 * decision card when data is seeded, or the actionable prerequisite CTA the
 * `today/error.tsx` boundary shows when it isn't).
 */

const DISCLAIMER_KEY = "disclaimerAcceptedAt_v1";

test("disclaimer gate blocks first run, then reveals the app", async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.removeItem(key);
  }, DISCLAIMER_KEY);

  await page.goto("/today");

  const accept = page.getByRole("button", { name: /I understand/i });
  await expect(accept).toBeVisible();
  await accept.click();
  await expect(accept).toBeHidden();

  // Navigation chrome is reachable once the gate is accepted.
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Outcomes" })).toBeVisible();
});

test("Today renders a decision card or an actionable prerequisite CTA", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, new Date().toISOString());
  }, DISCLAIMER_KEY);

  await page.goto("/today");

  // Either the headline card (data seeded) or a known prereq/auth boundary.
  const card = page.getByTestId("daily-decision-card");
  const prereq = page.getByTestId("prereq-error");
  const auth = page.getByTestId("auth-error");
  await expect(card.or(prereq).or(auth)).toBeVisible();
});
