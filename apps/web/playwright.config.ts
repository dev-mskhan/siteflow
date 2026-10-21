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
    // Setup project: authenticates user and saves storage state
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Core test project reusing the authenticated session
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
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
