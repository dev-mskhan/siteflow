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

  async function seedSubscription(
    orgId: string,
    actorId: string,
    stripeSubId: string,
    planId: 'starter' | 'professional' = 'starter',
  ) {
    return catalogService.createSubscription({
      organizationId: orgId,
      planId,
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

  function lifecycleUrl(orgId: string, action: string) {
    return `/api/v1/organizations/${orgId}/billing/subscription/${action}`;
  }

  function mockSubscriptionRetrieve() {
    return vi.spyOn(stripeAdapter, 'retrieveSubscription').mockResolvedValue({
      id: 'sub_mock',
      items: { data: [{ id: 'si_mock' }] },
    } as any);
  }

  describe('POST /:organizationId/billing/subscription/downgrade', () => {
    it('admin schedules a lower plan for period end; access tier and period unchanged; provider repriced without proration', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      const subId = `sub_${Date.now()}_dg1`;
      const seeded = await catalogService.createSubscription({
        organizationId: orgId,
        planId: 'professional',
        interval: 'month',
        actorId: admin.id,
        stripeCustomerId: `cus_dg_${Date.now()}`,
        stripeSubscriptionId: subId,
      });
      mockSubscriptionRetrieve();
      const spy = mockProvider();

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'downgrade'),
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: 'starter' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body).data;
      expect(body.scheduledPlanId).toBe('starter');
      expect(body.idempotent).toBe(false);
      expect(body.accessUntil).toBe(seeded.subscription.currentPeriodEnd.toISOString());

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        subId,
        {
          items: [{ id: 'si_mock', price: 'price_starter_month_v1' }],
          proration_behavior: 'none',
        },
        `saas-lifecycle:downgrade:${seeded.subscription.id}:starter:month`,
      );

      const current = await catalogRepository.findCurrentSubscription(orgId);
      expect(current!.planId).toBe('professional');
      expect(current!.scheduledPlanId).toBe('starter');
      expect(current!.currentPeriodEnd.toISOString()).toBe(
        seeded.subscription.currentPeriodEnd.toISOString(),
      );

      const history = await getDb()
        .select()
        .from(saasSubscriptionHistory)
        .where(
          and(
            eq(saasSubscriptionHistory.subscriptionId, seeded.subscription.id),
            eq(saasSubscriptionHistory.action, 'downgrade_scheduled'),
          ),
        );
      expect(history).toHaveLength(1);

      const audits = await getDb()
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.organizationId, orgId),
            eq(auditLogs.action, 'billing.subscription.downgrade_scheduled'),
          ),
        );
      expect(audits).toHaveLength(1);
      expect(audits[0]!.actorUserId).toBe(admin.id);
    });

    it('repeated downgrade to the same plan is idempotent with no provider call', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      await catalogService.createSubscription({
        organizationId: orgId,
        planId: 'professional',
        interval: 'month',
        actorId: admin.id,
        stripeCustomerId: `cus_dg_${Date.now()}_i`,
        stripeSubscriptionId: `sub_${Date.now()}_dg2`,
      });
      mockSubscriptionRetrieve();
      const spy = mockProvider();
      const url = lifecycleUrl(orgId, 'downgrade');

      const first = await app.inject({
        method: 'POST',
        url,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: 'starter' },
      });
      const second = await app.inject({
        method: 'POST',
        url,
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: 'starter' },
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(JSON.parse(second.body).data.idempotent).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('rejects a target that is not a lower price (409) with no provider call', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      await seedSubscription(orgId, admin.id, `sub_${Date.now()}_dg3`);
      const spy = mockProvider();

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'downgrade'),
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: 'enterprise' },
      });

      expect(res.statusCode).toBe(409);
      expect(spy).not.toHaveBeenCalled();
    });

    it('provider failure leaves local scheduled plan unchanged', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      await catalogService.createSubscription({
        organizationId: orgId,
        planId: 'professional',
        interval: 'month',
        actorId: admin.id,
        stripeCustomerId: `cus_dg_${Date.now()}_f`,
        stripeSubscriptionId: `sub_${Date.now()}_dg4`,
      });
      mockSubscriptionRetrieve();
      vi.spyOn(stripeAdapter, 'updateSubscription').mockRejectedValue(new Error('provider down'));

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'downgrade'),
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: 'starter' },
      });

      expect(res.statusCode).toBeGreaterThanOrEqual(500);
      const current = await catalogRepository.findCurrentSubscription(orgId);
      expect(current!.scheduledPlanId).toBeNull();
    });

    it('non-billing member is denied (403) with no provider call', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId, roleMap } = await createOrgWithAdmin(app, token);
      await catalogService.createSubscription({
        organizationId: orgId,
        planId: 'professional',
        interval: 'month',
        actorId: admin.id,
        stripeCustomerId: `cus_dg_${Date.now()}_p`,
        stripeSubscriptionId: `sub_${Date.now()}_dg5`,
      });
      const spy = mockProvider();
      const { user: member, token: memberToken } = await createVerifiedUser();
      await addMemberDirectly(orgId, member.id, roleMap.get('Client')!);

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'downgrade'),
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { planId: 'starter' },
      });

      expect(res.statusCode).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    });

    it('unauthenticated request is rejected (401)', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'downgrade'),
        payload: { planId: 'starter' },
      });
      expect(res.statusCode).toBe(401);
      void admin;
    });

    it('admin of another organization is denied (403) — tenant isolation', async () => {
      const { user: adminA, token: tokenA } = await createVerifiedUser();
      const { orgId: orgA } = await createOrgWithAdmin(app, tokenA);
      await catalogService.createSubscription({
        organizationId: orgA,
        planId: 'professional',
        interval: 'month',
        actorId: adminA.id,
        stripeCustomerId: `cus_dg_${Date.now()}_t`,
        stripeSubscriptionId: `sub_${Date.now()}_dg6`,
      });
      const { token: tokenB } = await createVerifiedUser();
      await createOrgWithAdmin(app, tokenB);
      const spy = mockProvider();

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgA, 'downgrade'),
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { planId: 'starter' },
      });

      expect(res.statusCode).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('POST /:organizationId/billing/subscription/upgrade', () => {
    it('admin upgrades immediately with proration; plan and price updated in place; provider called once', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      const subId = `sub_${Date.now()}_ug1`;
      const seeded = await seedSubscription(orgId, admin.id, subId);
      mockSubscriptionRetrieve();
      const spy = mockProvider();

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'upgrade'),
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: 'professional' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body).data;
      expect(body.planId).toBe('professional');
      expect(body.idempotent).toBe(false);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        subId,
        {
          items: [{ id: 'si_mock', price: 'price_pro_month_v1' }],
          proration_behavior: 'create_prorations',
        },
        `saas-lifecycle:upgrade:${seeded.subscription.id}:professional:month`,
      );

      const current = await catalogRepository.findCurrentSubscription(orgId);
      expect(current!.id).toBe(seeded.subscription.id);
      expect(current!.planId).toBe('professional');
      expect(current!.stripePriceId).toBe('price_pro_month_v1');

      const history = await getDb()
        .select()
        .from(saasSubscriptionHistory)
        .where(
          and(
            eq(saasSubscriptionHistory.subscriptionId, seeded.subscription.id),
            eq(saasSubscriptionHistory.action, 'upgrade_applied'),
          ),
        );
      expect(history).toHaveLength(1);
    });

    it('rejects a target that is not a higher price (409) with no provider call', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      await seedSubscription(orgId, admin.id, `sub_${Date.now()}_ug2`, 'professional');
      const spy = mockProvider();

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'upgrade'),
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: 'starter' },
      });

      expect(res.statusCode).toBe(409);
      expect(spy).not.toHaveBeenCalled();
    });

    it('rejects upgrade while a cancellation is scheduled (409)', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      await seedSubscription(orgId, admin.id, `sub_${Date.now()}_ug3`);
      const spy = mockProvider();
      await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'cancel'),
        headers: { authorization: `Bearer ${token}` },
      });
      spy.mockClear();

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'upgrade'),
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: 'professional' },
      });

      expect(res.statusCode).toBe(409);
      expect(spy).not.toHaveBeenCalled();
    });

    it('provider failure leaves the local plan unchanged', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      await seedSubscription(orgId, admin.id, `sub_${Date.now()}_ug4`);
      mockSubscriptionRetrieve();
      vi.spyOn(stripeAdapter, 'updateSubscription').mockRejectedValue(new Error('provider down'));

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'upgrade'),
        headers: { authorization: `Bearer ${token}` },
        payload: { planId: 'professional' },
      });

      expect(res.statusCode).toBeGreaterThanOrEqual(500);
      const current = await catalogRepository.findCurrentSubscription(orgId);
      expect(current!.planId).toBe('starter');
    });

    it('non-billing member is denied (403) and unauthenticated is rejected (401)', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId, roleMap } = await createOrgWithAdmin(app, token);
      await seedSubscription(orgId, admin.id, `sub_${Date.now()}_ug5`);
      const spy = mockProvider();
      const { user: member, token: memberToken } = await createVerifiedUser();
      await addMemberDirectly(orgId, member.id, roleMap.get('Client')!);

      const denied = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'upgrade'),
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { planId: 'professional' },
      });
      const anon = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'upgrade'),
        payload: { planId: 'professional' },
      });

      expect(denied.statusCode).toBe(403);
      expect(anon.statusCode).toBe(401);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('POST /:organizationId/billing/subscription/pause', () => {
    it('fails safely (409) because pause is not approved policy; no provider call', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      await seedSubscription(orgId, admin.id, `sub_${Date.now()}_ps1`);
      const spy = mockProvider();

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'pause'),
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).error.code).toBe('LIFECYCLE_ACTION_NOT_SUPPORTED');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('POST /:organizationId/billing/subscription/reactivate', () => {
    it('admin undoes a scheduled cancellation within the period; provider and local state cleared', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      const subId = `sub_${Date.now()}_ra1`;
      const seeded = await seedSubscription(orgId, admin.id, subId);
      const spy = mockProvider();
      await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'cancel'),
        headers: { authorization: `Bearer ${token}` },
      });
      spy.mockClear();

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'reactivate'),
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.cancelAtPeriodEnd).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        subId,
        { cancel_at_period_end: false },
        `saas-lifecycle:reactivate:${seeded.subscription.id}`,
      );
      const current = await catalogRepository.findCurrentSubscription(orgId);
      expect(current!.cancelAtPeriodEnd).toBe(false);

      const history = await getDb()
        .select()
        .from(saasSubscriptionHistory)
        .where(
          and(
            eq(saasSubscriptionHistory.subscriptionId, seeded.subscription.id),
            eq(saasSubscriptionHistory.action, 'cancel_reverted'),
          ),
        );
      expect(history).toHaveLength(1);
    });

    it('is an idempotent no-op when no cancellation is scheduled; no provider call', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      await seedSubscription(orgId, admin.id, `sub_${Date.now()}_ra2`);
      const spy = mockProvider();

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'reactivate'),
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.idempotent).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it('non-billing member is denied (403) with no provider call', async () => {
      const { user: admin, token } = await createVerifiedUser();
      const { orgId, roleMap } = await createOrgWithAdmin(app, token);
      await seedSubscription(orgId, admin.id, `sub_${Date.now()}_ra3`);
      const spy = mockProvider();
      const { user: member, token: memberToken } = await createVerifiedUser();
      await addMemberDirectly(orgId, member.id, roleMap.get('Client')!);

      const res = await app.inject({
        method: 'POST',
        url: lifecycleUrl(orgId, 'reactivate'),
        headers: { authorization: `Bearer ${memberToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
