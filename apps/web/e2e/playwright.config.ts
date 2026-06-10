import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the Phase-1 E2E flows (M1.25).
 *
 * ⚠️ DORMANT IN CI — read before editing.
 *
 * `@playwright/test` is intentionally NOT in `apps/web/package.json`: adding it
 * would change `pnpm-lock.yaml`, which the `web` CI job consumes with
 * `pnpm install --frozen-lockfile` (a regenerated lockfile is not producible in
 * the current implementation environment). These specs are therefore excluded
 * from the running test/lint/build surface:
 *   - vitest:  `exclude: ["e2e/**", …]`     (apps/web/vitest.config.ts)
 *   - tsc:     `exclude: ["e2e", …]`          (apps/web/tsconfig.json)
 *   - eslint:  `ignores: ["e2e/**", …]`       (apps/web/eslint.config.mjs)
 *   - next build: not under `app/`, not imported → ignored.
 *
 * Activate (out-of-band, regenerates the lockfile) + add the `e2e` CI job
 * documented in the M1.25 dev spec:
 *
 *   pnpm -C apps/web add -D @playwright/test
 *   pnpm -C apps/web exec playwright install --with-deps chromium
 *   BASE_URL=http://localhost:3000 pnpm -C apps/web e2e
 *
 * The CI `e2e` job must boot the full stack (postgres service + alembic +
 * uvicorn API + `next start`) and seed a session + fixture data before running
 * the authenticated Settings / Outcomes flows.
 */
export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
