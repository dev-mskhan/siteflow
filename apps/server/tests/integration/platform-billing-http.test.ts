// apps/server/tests/integration/platform-billing-http.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../src/lib/db/index.js';
import { users, platformUserRoles } from '@siteflow/database/schema';
import { createTestApp } from '../helpers/test-app.js';
import { createVerifiedUser } from '../helpers/fixtures.js';
import { PlatformRbacRepository } from '../../src/modules/platform/platform-rbac.repository.js';

const SUPPORT_ROLE_ID = 'prole_support';
const ADMIN_ROLE_ID = 'prole_admin';

const recoveryBody = {
  password: 'password123',
  reasonCode: 'SECURITY_INCIDENT',
  reasonNote: 'Stripe webhook backlog recovery review',
};

describe('platform billing admin HTTP authorization (Phase 11-04)', () => {
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

  it('rejects unauthenticated billing reads and recovery', async () => {
    const orgId = randomUUID();
    const view = await app.inject({
      method: 'GET',
      url: `/api/v1/platform/organizations/${orgId}/billing`,
    });
    const inbox = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/billing/webhook-inbox',
    });
    const recovery = await app.inject({
      method: 'POST',
      url: '/api/v1/platform/billing/webhook-recovery',
      payload: recoveryBody,
    });
    expect([401, 403]).toContain(view.statusCode);
    expect([401, 403]).toContain(inbox.statusCode);
    expect([401, 403]).toContain(recovery.statusCode);
  });

  it('denies an ordinary user with no platform role', async () => {
    const actor = await newUser('billing-plain');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/billing/webhook-inbox',
      headers: { authorization: `Bearer ${actor.token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('denies a support operator billing read and billing sync', async () => {
    const support = await newUser('billing-support');
    await rbac.grantPlatformRole(support.user.id, SUPPORT_ROLE_ID);

    const inbox = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/billing/webhook-inbox',
      headers: { authorization: `Bearer ${support.token}` },
    });
    expect(inbox.statusCode).toBe(403);

    const recovery = await app.inject({
      method: 'POST',
      url: '/api/v1/platform/billing/webhook-recovery',
      headers: { authorization: `Bearer ${support.token}` },
      payload: recoveryBody,
    });
    expect(recovery.statusCode).toBe(403);
  });

  it('returns 404 for an unknown organization billing view', async () => {
    const admin = await newUser('billing-admin-404');
    await rbac.grantPlatformRole(admin.user.id, ADMIN_ROLE_ID);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/platform/organizations/${randomUUID()}/billing`,
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects webhook recovery with a wrong password before calling Stripe', async () => {
    const admin = await newUser('billing-admin-pw');
    await rbac.grantPlatformRole(admin.user.id, ADMIN_ROLE_ID);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/platform/billing/webhook-recovery',
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { ...recoveryBody, password: 'wrong-password-value' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('lets a platform admin read the webhook inbox summary', async () => {
    const admin = await newUser('billing-admin-ok');
    await rbac.grantPlatformRole(admin.user.id, ADMIN_ROLE_ID);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/billing/webhook-inbox',
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
