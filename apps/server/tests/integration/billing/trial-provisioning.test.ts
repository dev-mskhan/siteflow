// apps/server/tests/integration/billing/trial-provisioning.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';
import { getDb } from '../../../src/lib/db/index.js';
import {
  saasTrials,
  auditLogs,
  organizationMemberships,
} from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';
import { rbacCacheService } from '../../../src/modules/rbac/rbac.cache.service.js';

describe('SaaS Billing — Trial Provisioning Integration (10-04 Tracer)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('provisions a 14-day no-card trial for an organization and persists in PostgreSQL with audit log', async () => {
    const { user: admin, token: adminToken } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, adminToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/trial`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.trial.organizationId).toBe(orgId);
    expect(body.data.trial.tier).toBe('Professional');
    expect(body.data.trial.status).toBe('ACTIVE');

    const startedAt = new Date(body.data.trial.startedAt);
    const expiresAt = new Date(body.data.trial.expiresAt);
    const diffDays = Math.round((expiresAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(14);

    // Verify PostgreSQL persistence
    const db = getDb();
    const persisted = await db.select().from(saasTrials).where(eq(saasTrials.organizationId, orgId));
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.organizationId).toBe(orgId);
    expect(persisted[0]!.tier).toBe('Professional');
    expect(persisted[0]!.status).toBe('ACTIVE');

    // Verify scoped audit log persisted
    const audits = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.organizationId, orgId),
          eq(auditLogs.action, 'billing.trial.started'),
        ),
      );
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(audits[0]!.actorUserId).toBe(admin.id);
    expect(audits[0]!.resourceType).toBe('SaaSTrial');
    expect(audits[0]!.resourceId).toBe(persisted[0]!.id);
  });

  it('repeating trial provisioning for the same organization is idempotent and returns existing trial', async () => {
    const { user: admin, token: adminToken } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, adminToken);

    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/trial`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res1.statusCode).toBe(201);
    const trial1 = res1.json().data.trial;

    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/trial`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect([200, 201]).toContain(res2.statusCode);
    const trial2 = res2.json().data.trial;
    expect(trial2.id).toBe(trial1.id);

    const db = getDb();
    const persisted = await db.select().from(saasTrials).where(eq(saasTrials.organizationId, orgId));
    expect(persisted).toHaveLength(1);
  });

  it('allows reading trial status through GET route for authorized organization admin', async () => {
    const { user: admin, token: adminToken } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, adminToken);

    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/trial`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/billing/trial`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(getRes.statusCode).toBe(200);
    const body = getRes.json();
    expect(body.success).toBe(true);
    expect(body.data.trial.organizationId).toBe(orgId);
    expect(body.data.trial.status).toBe('ACTIVE');
  });

  it('denies unauthenticated requests before any database writes', async () => {
    const { user: admin, token: adminToken } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, adminToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/trial`,
    });
    expect(res.statusCode).toBe(401);

    const db = getDb();
    const persisted = await db.select().from(saasTrials).where(eq(saasTrials.organizationId, orgId));
    expect(persisted).toHaveLength(0);
  });

  it('denies users with insufficient permission (non-admin member without billing:manage)', async () => {
    const { user: admin, token: adminToken } = await createVerifiedUser();
    const { orgId, roleMap } = await createOrgWithAdmin(app, adminToken);

    // Create a regular member with Subcontractor role (lacks billing:manage)
    const { user: memberUser, token: memberToken } = await createVerifiedUser();
    const subRoleId = roleMap.get('Subcontractor');
    expect(subRoleId).toBeDefined();

    const db = getDb();
    await db.insert(organizationMemberships).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: memberUser.id,
      roleId: subRoleId!,
    });
    await rbacCacheService.invalidate(orgId, memberUser.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/trial`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(res.statusCode).toBe(403);

    const persisted = await db.select().from(saasTrials).where(eq(saasTrials.organizationId, orgId));
    expect(persisted).toHaveLength(0);
  });

  it('denies cross-tenant trial access (Org A member cannot access Org B trial)', async () => {
    const { user: adminA, token: tokenA } = await createVerifiedUser();
    const { orgId: orgIdA } = await createOrgWithAdmin(app, tokenA);

    const { user: adminB, token: tokenB } = await createVerifiedUser();
    const { orgId: orgIdB } = await createOrgWithAdmin(app, tokenB);

    // Provision Org A trial
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgIdA}/billing/trial`,
      headers: { authorization: `Bearer ${tokenA}` },
    });

    // Admin B attempts to access Org A's trial
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgIdA}/billing/trial`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect([403, 404]).toContain(res.statusCode);
  });

  it('handles concurrent duplicate trial requests safely, producing exactly one persisted trial', async () => {
    const { user: admin, token: adminToken } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, adminToken);

    const [res1, res2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/billing/trial`,
        headers: { authorization: `Bearer ${adminToken}` },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/billing/trial`,
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    ]);

    expect([200, 201]).toContain(res1.statusCode);
    expect([200, 201]).toContain(res2.statusCode);

    const db = getDb();
    const persisted = await db.select().from(saasTrials).where(eq(saasTrials.organizationId, orgId));
    expect(persisted).toHaveLength(1);
  });
});
