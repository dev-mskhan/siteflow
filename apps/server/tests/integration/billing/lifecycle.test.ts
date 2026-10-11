// apps/server/tests/integration/billing/lifecycle.test.ts
// Phase 10 (Plan 10-18): policy-governed subscription lifecycle routes.

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../../helpers/test-app.js';
import {
  addMemberDirectly,
  createVerifiedUser,
  createOrgWithAdmin,
} from '../../helpers/fixtures.js';
import { getDb } from '../../../src/lib/db/index.js';
import { saasSubscriptionHistory, auditLogs } from '@siteflow/database/schema';
import { and, eq } from 'drizzle-orm';
import { catalogService } from '../../../src/modules/billing/catalog.service.js';
import { catalogRepository } from '../../../src/modules/billing/catalog.repository.js';
import { stripeAdapter } from '../../../src/modules/billing/stripe.adapter.js';

describe('SaaS Billing — Subscription Lifecycle Routes (10-18)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function seedSubscription(orgId: string, actorId: string, stripeSubId: string) {
    return catalogService.createSubscription({
      organizationId: orgId,
      planId: 'starter',
      interval: 'month',
      actorId,
      stripeCustomerId: `cus_${orgId.replace(/-/g, '').slice(0, 12)}`,
      stripeSubscriptionId: stripeSubId,
    });
  }

  function mockProvider() {
    return vi.spyOn(stripeAdapter, 'updateSubscription').mockResolvedValue({
      id: 'sub_mock',
    } as any);
  }

  describe('POST /:organizationId/billing/subscription/cancel', () => {
    it('admin schedules cancel at period end; provider called once; local state, history, and audit written', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      const subId = `sub_${Date.now()}_a`;
      const seeded = await seedSubscription(orgId, admin.id, subId);
      const spy = mockProvider();

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/billing/subscription/cancel`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body).data;
      expect(body.cancelAtPeriodEnd).toBe(true);
      expect(body.subscriptionId).toBe(seeded.subscription.id);
      expect(body.idempotent).toBe(false);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        subId,
        { cancel_at_period_end: true },
        `saas-lifecycle:cancel:${seeded.subscription.id}`,
      );

      const current = await catalogRepository.findCurrentSubscription(orgId);
      expect(current!.cancelAtPeriodEnd).toBe(true);
      expect(current!.status).toBe(seeded.subscription.status);

      const db = getDb();
      const history = await db
        .select()
        .from(saasSubscriptionHistory)
        .where(
          and(
            eq(saasSubscriptionHistory.subscriptionId, seeded.subscription.id),
            eq(saasSubscriptionHistory.action, 'cancel_scheduled'),
          ),
        );
      expect(history).toHaveLength(1);

      const audits = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.organizationId, orgId),
            eq(auditLogs.action, 'billing.subscription.cancel_scheduled'),
          ),
        );
      expect(audits).toHaveLength(1);
      expect(audits[0]!.actorUserId).toBe(admin.id);
    });

    it('repeated cancel is idempotent: no second provider call, no duplicate history or audit', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      const seeded = await seedSubscription(orgId, admin.id, `sub_${Date.now()}_b`);
      const spy = mockProvider();
      const url = `/api/v1/organizations/${orgId}/billing/subscription/cancel`;

      const first = await app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } });
      const second = await app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(JSON.parse(second.body).data.idempotent).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);

      const history = await getDb()
        .select()
        .from(saasSubscriptionHistory)
        .where(eq(saasSubscriptionHistory.subscriptionId, seeded.subscription.id));
      expect(history.filter((h) => h.action === 'cancel_scheduled')).toHaveLength(1);
    });

    it('provider failure leaves local state unchanged', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      await seedSubscription(orgId, admin.id, `sub_${Date.now()}_c`);
      vi.spyOn(stripeAdapter, 'updateSubscription').mockRejectedValue(new Error('provider down'));

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/billing/subscription/cancel`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBeGreaterThanOrEqual(500);
      const current = await catalogRepository.findCurrentSubscription(orgId);
      expect(current!.cancelAtPeriodEnd).toBe(false);
    });

    it('non-billing member is denied (403) and no provider call occurs', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId, roleMap } = await createOrgWithAdmin(app, token);
      await seedSubscription(orgId, admin.id, `sub_${Date.now()}_d`);
      const spy = mockProvider();

      const { user: member, token: memberToken } = await createVerifiedUser();
      await addMemberDirectly(orgId, member.id, roleMap.get('Client')!);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/billing/subscription/cancel`,
        headers: { authorization: `Bearer ${memberToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    });

    it('unauthenticated request is rejected (401)', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      const spy = mockProvider();

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/billing/subscription/cancel`,
      });

      expect(res.statusCode).toBe(401);
      expect(spy).not.toHaveBeenCalled();
    });

    it('admin of another organization is denied (403) — tenant isolation', async () => {
      const { user: adminA, token: tokenA } = await createVerifiedUser();
      const { orgId: orgA } = await createOrgWithAdmin(app, tokenA);
      await seedSubscription(orgA, adminA.id, `sub_${Date.now()}_e`);

      const { token: tokenB } = await createVerifiedUser();
      await createOrgWithAdmin(app, tokenB);
      const spy = mockProvider();

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgA}/billing/subscription/cancel`,
        headers: { authorization: `Bearer ${tokenB}` },
      });

      expect(res.statusCode).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    });

    it('returns 404 when the organization has no current subscription', async () => {
      const { token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      const spy = mockProvider();

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/billing/subscription/cancel`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
