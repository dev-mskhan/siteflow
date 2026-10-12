// apps/server/tests/integration/platform-lifecycle-http.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../../src/lib/db/index.js';
import { users, platformUserRoles } from '@siteflow/database/schema';
import { createTestApp } from '../helpers/test-app.js';
import { createVerifiedUser } from '../helpers/fixtures.js';
import { PlatformRbacRepository } from '../../src/modules/platform/platform-rbac.repository.js';

const SUPPORT_ROLE_ID = 'prole_support';

const lifecycleBody = {
  password: 'password123',
  reasonCode: 'SECURITY_INCIDENT',
  reasonNote: 'Suspicious login activity review',
};

describe('platform lifecycle HTTP authorization (Phase 11-03)', () => {
  let app: FastifyInstance;
  const createdUserIds: string[] = [];
  const rbac = new PlatformRbacRepository();

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await getDb()
        .delete(platformUserRoles)
        .where(inArray(platformUserRoles.userId, createdUserIds));
      await getDb().delete(users).where(inArray(users.id, createdUserIds));
    }
    await app.close();
  });

  async function newUser(label: string) {
    const { user, token } = await createVerifiedUser({ firstName: label });
    createdUserIds.push(user.id);
    return { user, token };
  }

  it('rejects unauthenticated lifecycle writes', async () => {
    const target = await newUser('target-anon');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/platform/accounts/${target.user.id}/suspend`,
      payload: lifecycleBody,
    });
    expect([401, 403]).toContain(res.statusCode);
  });

  it('denies an ordinary user with no platform role', async () => {
    const actor = await newUser('plain-actor');
    const target = await newUser('plain-target');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/platform/accounts/${target.user.id}/suspend`,
      headers: { authorization: `Bearer ${actor.token}` },
      payload: lifecycleBody,
    });
    expect(res.statusCode).toBe(403);

    const row = await getDb().select().from(users).where(eq(users.id, target.user.id));
    expect(row[0]!.status).toBe('ACTIVE');
  });

  it('applies a 30/min rate limit to lifecycle writes', async () => {
    const target = await newUser('rate-target');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/platform/accounts/${target.user.id}/suspend`,
      payload: lifecycleBody,
    });
    expect(res.headers['x-ratelimit-limit']).toBe('30');
  });

  it('denies a support operator lacking write:organization_lifecycle', async () => {
    const support = await newUser('support-actor');
    await rbac.grantPlatformRole(support.user.id, SUPPORT_ROLE_ID);
    const target = await newUser('support-target');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/platform/accounts/${target.user.id}/suspend`,
      headers: { authorization: `Bearer ${support.token}` },
      payload: lifecycleBody,
    });
    expect(res.statusCode).toBe(403);

    const row = await getDb().select().from(users).where(eq(users.id, target.user.id));
    expect(row[0]!.status).toBe('ACTIVE');
  });
});
