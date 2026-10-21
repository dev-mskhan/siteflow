/**
 * E2E Auth Setup — registers a test user, logs in, and saves the session.
 * The saved storageState (cookies) is reused by all subsequent test files.
 *
 * Flow:
 *   1. Register via direct API POST (faster than UI)
 *   2. Navigate to login page and authenticate via UI (sets HttpOnly cookies)
 *   3. Wait for redirect to app/dashboard
 *   4. Save storageState to e2e/.auth/user.json
 */
import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const authFile = './e2e/.auth/user.json';

// Marks an E2E user's email as verified directly in the dev DB. Org creation
// requires a verified email, and E2E has no inbox to click a verify link from.
// `postgres` is resolved from packages/database, which owns that dependency.
async function markEmailVerified(email: string): Promise<void> {
  const repoRoot = path.resolve(process.cwd(), '../..');
  const envText = fs.readFileSync(path.join(repoRoot, '.env'), 'utf8');
  const match = envText.match(/^DATABASE_URL=(.+)$/m);
  if (!match) throw new Error('DATABASE_URL not found in root .env');
  const dbUrl = match[1].trim().replace(/^["']|["']$/g, '');

  const requireFromDb = createRequire(path.join(repoRoot, 'packages/database/package.json'));
  const postgres = requireFromDb('postgres') as (url: string, opts?: object) => {
    unsafe: (q: string, params?: unknown[]) => Promise<unknown>;
    end: () => Promise<void>;
  };
  const sql = postgres(dbUrl, { max: 1 });
  try {
    await sql.unsafe('update app.users set email_verified_at = now() where email = $1', [email]);
  } finally {
    await sql.end();
  }
}

setup('authenticate user and store state', async ({ page, request }) => {
  const email = `e2e_${Date.now()}@siteflow.test`;
  const password = 'TestPassword123!';

  // 1. Register via API through the Vite /api proxy (same origin as the UI)
  const regRes = await request.post('/api/v1/auth/register', {
    data: {
      email,
      password,
      firstName: 'E2E',
      lastName: 'Tester',
    },
  });
  expect(regRes.ok()).toBeTruthy();
  await markEmailVerified(email);

  // 2. Navigate to login page and authenticate via UI
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // 3. Wait for redirect — either to onboarding or dashboard
  await page.waitForURL(/\/(onboarding|dashboard|org)/, { timeout: 15_000 });

  // 4. Save the authenticated session state (cookies)
  await page.context().storageState({ path: authFile });
});
