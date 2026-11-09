/**
 * Playwright E2E test configuration.
 *
 * Starts both server (port 3000) and frontend (port 3001) automatically.
 * Uses a setup project to authenticate and save session state.
 * Single worker prevents DB race conditions in tests.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // ── Setup: regular user authentication ──────────────────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // ── Setup: platform admin authentication ────────────────────────────────
    {
      name: 'setup-platform',
      testMatch: /platform-admin\.setup\.ts/,
    },
    // ── Core tests: authenticated regular user ──────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /platform-admin\.spec\.ts/,
    },
    // ── Platform admin tests: requires platform admin session ────────────────
    {
      name: 'platform-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/platform-admin.json',
      },
      dependencies: ['setup-platform'],
      testMatch: /platform-admin\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @siteflow/server dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @siteflow/web dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_DEV_BYPASS: 'false',
      },
    },
  ],
});
