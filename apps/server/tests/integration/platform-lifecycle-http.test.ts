// apps/server/tests/integration/platform-lifecycle-http.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../src/lib/db/index.js';
import { auditLogs, users, platformUserRoles } from '@siteflow/database/schema';
import { createTestApp } from '../helpers/test-app.js';
import { createVerifiedUser } from '../helpers/fixtures.js';
import { PlatformRbacRepository } from '../../src/modules/platform/platform-rbac.repository.js';

const SUPPORT_ROLE_ID = 'prole_support';
const ADMIN_ROLE_ID = 'prole_admin';

const lifecycleBody = {
  password: 'password123',
  reasonCode: 'SECURITY_INCIDENT',
  reasonNote: 'Suspicious login activity review',
};

describe('platform lifecycle HTTP authorization (Phase 11-03)', () => {
  let app: FastifyInstance;
  let serverUrl: string;
  const createdUserIds: string[] = [];
  const rbac = new PlatformRbacRepository();

  beforeAll(async () => {
    app = await createTestApp();
    serverUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  }, 30_000);

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await getDb().delete(auditLogs).where(inArray(auditLogs.actorUserId, createdUserIds));
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

  it('requires a reason when reactivating an organization', async () => {
    const admin = await newUser('missing-reactivation-reason-admin');
    await rbac.grantPlatformRole(admin.user.id, ADMIN_ROLE_ID);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/platform/organizations/org_missing_reason/reactivate',
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { password: 'password123', reasonCode: 'SECURITY_INCIDENT' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('keeps separate write-rate budgets for two operators sharing one IP', async () => {
    const firstOperator = await newUser('rate-operator-one');
    const secondOperator = await newUser('rate-operator-two');
    await Promise.all([
      rbac.grantPlatformRole(firstOperator.user.id, ADMIN_ROLE_ID),
      rbac.grantPlatformRole(secondOperator.user.id, ADMIN_ROLE_ID),
    ]);
    const target = await newUser('shared-ip-rate-target');
    const url = `${serverUrl}/api/v1/platform/accounts/${target.user.id}/suspend`;

    async function suspend(token: string) {
      return fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(lifecycleBody),
      });
    }

    let lastFirstOperatorResponse: Response | undefined;
    for (let i = 0; i < 30; i += 1) {
      lastFirstOperatorResponse = await suspend(firstOperator.token);
    }
    expect(lastFirstOperatorResponse!.status).not.toBe(429);

    const secondOperatorResponse = await suspend(secondOperator.token);
    expect(secondOperatorResponse.status).not.toBe(429);

    const firstOperatorOverLimitResponse = await suspend(firstOperator.token);
    expect(firstOperatorOverLimitResponse.status).toBe(429);
  }, 30_000);

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

  it('replays, rejects mismatched bodies, and serializes concurrent requests by Idempotency-Key', async () => {
    const admin = await newUser('idempotency-admin');
    await rbac.grantPlatformRole(admin.user.id, ADMIN_ROLE_ID);
    const target = await newUser('idempotency-target');
    await getDb().update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, target.user.id));

    const url = `/api/v1/platform/accounts/${target.user.id}/reactivate`;
    const headers = {
      authorization: `Bearer ${admin.token}`,
      'idempotency-key': 'platform-reactivate-account-test',
    };
    const first = await app.inject({ method: 'POST', url, headers, payload: lifecycleBody });
    const replay = await app.inject({ method: 'POST', url, headers, payload: lifecycleBody });

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toBe(first.body);

    const changedBody = { ...lifecycleBody, reasonNote: 'Changed reason for same key' };
    const conflict = await app.inject({ method: 'POST', url, headers, payload: changedBody });
    expect(conflict.statusCode).toBe(409);

    const [targetRow] = await getDb()
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, target.user.id));
    expect(targetRow!.status).toBe('ACTIVE');

    const concurrentTarget = await newUser('concurrent-idempotency-target');
    await getDb()
      .update(users)
      .set({ status: 'SUSPENDED' })
      .where(eq(users.id, concurrentTarget.user.id));
    const concurrentHeaders = {
      authorization: `Bearer ${admin.token}`,
      'idempotency-key': 'platform-reactivate-concurrent-test',
    };
    const concurrentResults = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/platform/accounts/${concurrentTarget.user.id}/reactivate`,
        headers: concurrentHeaders,
        payload: lifecycleBody,
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/platform/accounts/${concurrentTarget.user.id}/reactivate`,
        headers: concurrentHeaders,
        payload: lifecycleBody,
      }),
    ]);
    expect(concurrentResults.some((res) => res.statusCode === 200)).toBe(true);
    expect(concurrentResults.every((res) => [200, 409].includes(res.statusCode))).toBe(true);

    const concurrentAuditRows = await getDb()
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actorUserId, admin.user.id),
          eq(auditLogs.action, 'platform.account.reactivated'),
          eq(auditLogs.resourceId, concurrentTarget.user.id),
        ),
      );
    expect(concurrentAuditRows).toHaveLength(1);
  });
});
