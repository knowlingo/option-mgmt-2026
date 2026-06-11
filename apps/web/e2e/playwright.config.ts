import { defineConfig, devices } from "@playwright/test";

import { STORAGE_STATE } from "./global-setup";

/**
 * Playwright config for the Phase-1 E2E flows (M1.25; activated in the E2E
 * CI-activation PR).
 *
 * `@playwright/test` is now a devDependency (the lockfile was regenerated with
 * the CI-pinned pnpm and verified against `pnpm install --frozen-lockfile`).
 * The `e2e/` dir stays excluded from the `web` job's vitest / tsc / eslint /
 * `next build` surface — Playwright runs these specs in the dedicated `e2e` CI
 * job (`pnpm -C apps/web e2e`), which boots postgres + the API + `next start`,
 * seeds a session via `apps/api/scripts/e2e_seed.py`, and installs the chromium
 * browser.
 *
 * `globalSetup` writes a storage state from `E2E_ACCESS_TOKEN` (the httpOnly
 * `access_token` cookie). Authenticated specs `test.skip` when that env is
 * absent, so the job is green even if the seed step doesn't run.
 */
export default defineConfig({
  testDir: ".",
  globalSetup: "./global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    storageState: STORAGE_STATE,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
