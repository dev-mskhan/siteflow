import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const platformAuthFile = './e2e/.auth/platform-admin.json';

function findRepoRoot(): string {
  let cur = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(cur, 'pnpm-workspace.yaml')) || fs.existsSync(path.join(cur, 'packages', 'database', 'package.json'))) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return path.resolve(process.cwd(), '..');
}

async function markEmailVerifiedAndGrantRole(email: string): Promise<void> {
  const repoRoot = findRepoRoot();
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
    await sql.unsafe('UPDATE app.users SET email_verified_at = NOW() WHERE email = $1', [email]);
    await sql.unsafe(
      `INSERT INTO app.platform_user_roles (user_id, platform_role_id)
       SELECT u.id, pr.id
       FROM app.users u, app.platform_roles pr
       WHERE u.email = $1 AND pr.key = 'platform_admin'
       ON CONFLICT DO NOTHING`,
      [email],
    );
  } finally {
    await sql.end();
  }
}

setup('create platform admin session', async ({ request }) => {
  const email = 'amin.siteflow@gamil.com';
  const password = 'TestPassword123!';

  // Ensure .auth directory exists
  const authDir = path.join(process.cwd(), 'e2e', '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Register (idempotent — 409 is fine if already exists)
  const regRes = await request.post('/api/v1/auth/register', {
    data: { email, password, firstName: 'Platform', lastName: 'Admin' },
  });
  if (![200, 201, 409].includes(regRes.status())) {
    const errorText = await regRes.text();
    throw new Error(`Platform admin registration failed: ${errorText}`);
  }

  await markEmailVerifiedAndGrantRole(email);

  const loginRes = await request.post('/api/v1/auth/login', {
    data: { email, password },
  });
  if (loginRes.status() !== 200) {
    throw new Error(`Platform admin login failed: ${await loginRes.text()}`);
  }

  await request.storageState({ path: platformAuthFile });
  console.log('✓ Platform admin session created');
});
