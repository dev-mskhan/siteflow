/**
 * E2E Auth Setup — registers a test user, logs in, and saves the session.
 * The saved storageState (cookies) is reused by all subsequent test files.
 *
 * Flow:
 *   1. Register via direct API POST (faster than UI)
 *   2. Authenticate via the live API (sets HttpOnly cookies)
 *   3. Persist the authenticated API context as Playwright storage state
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

setup('authenticate user and store state', async ({ request }) => {
  // Always log in fresh: the access JWT lasts JWT_EXPIRY (15m), so a cached
  // storageState older than that makes every request-fixture call return 401.

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
  
  if (!regRes.ok()) {
    const errorBody = await regRes.text();
    throw new Error(`Registration failed (${regRes.status()}): ${errorBody}`);
  }
  
  await markEmailVerified(email);

  // 2. Authenticate through the same-origin Vite proxy. The request fixture
  // retains the HttpOnly cookies returned by the server.
  const loginRes = await request.post('/api/v1/auth/login', {
    data: { email, password },
  });
  const loginBody = await loginRes.text();
  expect(
    loginRes.status(),
    `POST /auth/login response: ${loginBody}`,
  ).toBe(200);

  // 3. Save the authenticated session state (cookies)
  await request.storageState({ path: authFile });
  console.log('✓ New auth session created');
});
