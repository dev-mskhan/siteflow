// apps/server/tests/integration/billing/restricted-access.test.ts
// Phase 10 (Plan 10-19): restricted-state enforcement for project:update (D-09).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';
import { getDb } from '../../../src/lib/db/index.js';
import { saasSubscriptions } from '@siteflow/database/schema';
import { and, eq } from 'drizzle-orm';
import { catalogService } from '../../../src/modules/billing/catalog.service.js';

describe('SaaS Billing — Restricted-access enforcement (10-19)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('allows project update while subscription is ACTIVE and blocks it once RESTRICTED', async () => {
    const { user: admin, token } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, token);
    await catalogService.createSubscription({
      organizationId: orgId,
      planId: 'starter',
      interval: 'month',
      actorId: admin.id,
      stripeCustomerId: `cus_ra_${orgId.replace(/-/g, '').slice(0, 10)}`,
      stripeSubscriptionId: `sub_ra_${Date.now()}`,
    });

    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Restricted Access Project', projectType: 'COMMERCIAL' },
    });
    expect(created.statusCode).toBe(201);
    const projectId = JSON.parse(created.body).data.project.id as string;

    const allowed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Renamed While Active', expectedVersion: 1 },
    });
    expect(allowed.statusCode).toBe(200);

    await getDb()
      .update(saasSubscriptions)
      .set({ status: 'RESTRICTED' as any })
      .where(and(eq(saasSubscriptions.organizationId, orgId), eq(saasSubscriptions.isCurrent, true)));

    const denied = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Renamed While Restricted', expectedVersion: 2 },
    });
    expect(denied.statusCode).toBe(403);
    expect(JSON.parse(denied.body).error.code).toBe('ACCESS_RESTRICTED');

    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(read.statusCode).toBe(200);
    expect(JSON.parse(read.body).data.project.name).toBe('Renamed While Active');
  });
});
