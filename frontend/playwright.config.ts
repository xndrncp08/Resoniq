import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end checks for the workflows that matter most (and the ones that have
 * broken before). Runs against a running app: `npm run e2e:serve` (a production
 * build; it sets AUTH_TRUST_HOST, without which Auth.js refuses sign-ins on
 * localhost) or `npm run dev -- -p 3100`, then `npm run test:e2e`, or E2E_BASE_URL=https://… for a deployment (the signed-in
 * spec creates and then deletes its own account).
 * Uses the installed Google Chrome, so there is no browser download.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
    // Safari's engine (iPhone emulation and desktop). Opt in with E2E_WEBKIT=1 after `npx playwright install webkit`.
    ...(process.env.E2E_WEBKIT ? [{ name: "iphone", use: { ...devices["iPhone 15"] } }, { name: "safari", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 1000 } } }] : []),
  ],
});
