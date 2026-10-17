// apps/server/tests/integration/platform-admin-baseline.test.ts
// Phase 11-07 baseline: p95 timings for platform admin read endpoints.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { inArray } from 'drizzle-orm';
import { getDb } from '../../src/lib/db/index.js';
import { users, platformUserRoles, organizations, auditLogs } from '@siteflow/database/schema';
import { createTestApp } from '../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../helpers/fixtures.js';
import { PlatformRbacRepository } from '../../src/modules/platform/platform-rbac.repository.js';

const ADMIN_ROLE_ID = 'prole_admin';
const BASE = '/api/v1/platform';
const ORG_COUNT = 20;
const SAMPLES = 40;
const P95_THRESHOLD_MS = 300;

const p95 = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
};

describe('platform admin read baseline (Phase 11-07)', () => {
  let app: FastifyInstance;
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const rbac = new PlatformRbacRepository();
  let admin: { user: { id: string }; token: string };
  let firstOrgId = '';
  let currentOwnerToken = '';
  let firstOwnerToken = '';

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createTestApp();
    admin = await createVerifiedUser({ firstName: 'baseline-admin' });
    createdUserIds.push(admin.user.id);
    await rbac.grantPlatformRole(admin.user.id, ADMIN_ROLE_ID);

    // Per-user organization cap is 5, so spread the dataset across owners.
    const ORGS_PER_OWNER = 4;
    for (let i = 0; i < ORG_COUNT; i++) {
      if (i % ORGS_PER_OWNER === 0) {
        const owner = await createVerifiedUser({ firstName: `baseline-owner-${i}` });
        createdUserIds.push(owner.user.id);
        currentOwnerToken = owner.token;
      }
      const org = await createOrgWithAdmin(app, currentOwnerToken);
      createdOrgIds.push(org.orgId);
      if (i === 0) {
        firstOrgId = org.orgId;
        firstOwnerToken = currentOwnerToken;
      }
    }
  }, 120_000);

  afterAll(async () => {
    const db = getDb();
    if (createdUserIds.length > 0) {
      await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, createdUserIds));
    }
    if (createdOrgIds.length > 0) {
      await db.delete(auditLogs).where(inArray(auditLogs.organizationId, createdOrgIds));
      await db.delete(organizations).where(inArray(organizations.id, createdOrgIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(platformUserRoles).where(inArray(platformUserRoles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    await app.close();
  }, 120_000);

  async function measure(label: string, url: string, token: string = admin.token): Promise<number> {
    const timings: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const start = performance.now();
      const res = await app.inject({ method: 'GET', url, headers: auth(token) });
      timings.push(performance.now() - start);
      expect(res.statusCode, `${label} status`).toBe(200);
    }
    const value = p95(timings);
    console.log(`BASELINE ${label} p95=${value.toFixed(1)}ms samples=${SAMPLES} orgs=${ORG_COUNT}`);
    return value;
  }

  it('organization search p95 is under threshold', async () => {
    const value = await measure('org-search', `${BASE}/organizations?limit=20`);
    expect(value).toBeLessThan(P95_THRESHOLD_MS);
  });

  it('organization billing summary p95 is under threshold', async () => {
    const value = await measure('org-billing-summary', `${BASE}/organizations/${firstOrgId}/billing`);
    expect(value).toBeLessThan(P95_THRESHOLD_MS);
  });

  it('queue dashboard p95 is under threshold', async () => {
    const value = await measure('queue-dashboard', `${BASE}/diagnostics/queue`);
    expect(value).toBeLessThan(P95_THRESHOLD_MS);
  });

  // Platform-wide audit history has no route yet (deferred). This measures the existing
  // org-scoped audit trail (audit:read) as the closest audit-history read path.
  it('org audit-log history p95 is under threshold', async () => {
    const value = await measure(
      'org-audit-logs',
      `/api/v1/organizations/${firstOrgId}/audit-logs?limit=50`,
      firstOwnerToken,
    );
    expect(value).toBeLessThan(P95_THRESHOLD_MS);
  });
});
