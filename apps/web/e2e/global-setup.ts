import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { chromium } from "@playwright/test";

/**
 * Playwright global setup (M1.25 E2E activation).
 *
 * Login is a 501 stub, so there is no UI login. The CI `e2e` job mints a JWT
 * out-of-band (`apps/api/scripts/e2e_seed.py`) and exposes it as
 * `E2E_ACCESS_TOKEN`; here we bake it into a storage state as the httpOnly
 * `access_token` cookie the Next server components read.
 *
 * Always writes a valid storage-state file (empty cookies when no token), so
 * `playwright.config.ts`'s `use.storageState` never points at a missing file.
 * The authenticated specs `test.skip` when `E2E_ACCESS_TOKEN` is unset, so a
 * cookieless state simply means those specs skip.
 *
 * Note: Playwright transpiles configs/setup to CommonJS, so this uses
 * `__dirname` (not `import.meta.url`, which is unavailable under CJS).
 */

// Shared with playwright.config.ts so the write + read paths can't drift.
export const STORAGE_STATE = join(__dirname, ".auth", "state.json");

export default async function globalSetup(): Promise<void> {
  mkdirSync(dirname(STORAGE_STATE), { recursive: true });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const token = process.env.E2E_ACCESS_TOKEN;
    if (token) {
      await context.addCookies([
        {
          name: "access_token",
          value: token,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    }
    await context.storageState({ path: STORAGE_STATE });
  } finally {
    await browser.close();
  }
}
