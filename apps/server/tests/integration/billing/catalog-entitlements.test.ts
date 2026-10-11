// apps/server/tests/integration/billing/catalog-entitlements.test.ts
// Phase 10 — SaaS Billing Integration Tests: Catalog, Subscription History, One-Current Invariant
// Extended in Plan 11 with entitlement enforcement, concurrency, and tenant-isolation coverage.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify'
import { createTestApp } from '../../helpers/test-app.js';
import {
  addMemberDirectly,
  createVerifiedUser,
  createOrgWithAdmin,
  getInvitationTokenFromOutbox,
} from '../../helpers/fixtures.js';
import { getDb } from '../../../src/lib/db/index.js';
import {
  saasPlans,
  saasPriceVersions,
  saasSubscriptions,
  saasSubscriptionHistory,
  invitations,
} from '@siteflow/database/schema';
import { eq, and, count } from 'drizzle-orm';
import { catalogService } from '../../../src/modules/billing/catalog.service.js';
import { ValidationError } from '../../../src/modules/auth/auth.errors.js';

describe('SaaS Billing — Catalog & Subscription Entitlements Integration (10-05)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ── Test 1: Catalog lookup returns exact approved local plan and immutable price version ─────
  describe('Test 1: Catalog lookup returns approved local plan and immutable price version', () => {
    it('catalog seeded in PostgreSQL contains exactly 3 approved plans', async () => {
      const db = getDb();
      const plans = await db.select().from(saasPlans).where(eq(saasPlans.isActive, true));
      expect(plans).toHaveLength(3);
      const ids = plans.map((p) => p.id).sort();
      expect(ids).toEqual(['enterprise', 'professional', 'starter']);
    });

    it('catalog seeded in PostgreSQL contains 6 approved price versions (2 intervals × 3 tiers)', async () => {
      const db = getDb();
      const prices = await db.select().from(saasPriceVersions);
      expect(prices.length).toBeGreaterThanOrEqual(6);

      // Validate price version for Starter monthly exists with correct amount
      const starterMonth = prices.find(
        (p) => p.planId === 'starter' && p.interval === 'month' && p.version === 'v1',
      );
      expect(starterMonth).toBeDefined();
      expect(starterMonth!.unitAmountCents).toBe(19900);

      // Validate price version for Enterprise annual exists with correct amount
      const entYear = prices.find(
        (p) => p.planId === 'enterprise' && p.interval === 'year' && p.version === 'v1',
      );
      expect(entYear).toBeDefined();
      expect(entYear!.unitAmountCents).toBe(1018900);
    });

    it('catalog service returns exact approved limits from local authority', async () => {
      const starterPlan = catalogService.getPlan('starter');
      expect(starterPlan.limits).toEqual({
        activeProjects: 3,
        teamMembers: 10,
        storageGb: 50,
        apiCallsMonthly: 5000,
      });

      const proPlan = catalogService.getPlan('professional');
      expect(proPlan.limits).toEqual({
        activeProjects: 15,
        teamMembers: 50,
        storageGb: 250,
        apiCallsMonthly: 25000,
      });
    });
  });

  // ── Test 2: Provider Price IDs map to local approved price version ─────────
  describe('Test 2: Provider Price IDs map to local approved price version and cannot override policy', () => {
    it('resolves provider price ID to correct local price version', async () => {
      const price = catalogService.resolvePriceFromProvider('price_pro_month_v1');
      expect(price.planId).toBe('professional');
      expect(price.interval).toBe('month');
      expect(price.unitAmountUsd).toBe(499);
      expect(price.unitAmountCents).toBe(49900);
      expect(price.limits.activeProjects).toBe(15);
    });

    it('rejects unknown provider price IDs with ValidationError', () => {
      expect(() => catalogService.resolvePriceFromProvider('price_attacker_crafted')).toThrow(ValidationError);
    });

    it('does not allow caller to supply entitlement overrides through provider price ID', () => {
      // Even if a provider price ID matches, the entitlements come from LOCAL approved catalog
      const price = catalogService.resolvePriceFromProvider('price_starter_month_v1');
      // Starter limits are fixed locally, provider cannot override them
      expect(price.limits.activeProjects).toBe(3); // not 999 or unlimited
      expect(price.limits.teamMembers).toBe(10);  // not 500 or unlimited
    });
  });

  // ── Test 3: Historical price versions remain addressable, one current subscription enforced ─
  describe('Test 3: Historical subscription records preserved, one-current-subscription enforced', () => {
    it('creates initial subscription and persists it as current with history', async () => {
      const { user: admin, token: adminToken } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, adminToken);

      // Create an initial subscription via catalogService
      const result = await catalogService.createSubscription({
        organizationId: orgId,
        planId: 'starter',
        interval: 'month',
        actorId: admin.id,
      });

      expect(result.subscription.organizationId).toBe(orgId);
      expect(result.subscription.planId).toBe('starter');
      expect(result.subscription.isCurrent).toBe(true);
      expect(result.subscription.status).toBe('ACTIVE');
      expect(result.limits.activeProjects).toBe(3);
      expect(result.limits.teamMembers).toBe(10);

      // Verify PostgreSQL persisted with correct price version
      const db = getDb();
      const subs = await db
        .select()
        .from(saasSubscriptions)
        .where(
          and(
            eq(saasSubscriptions.organizationId, orgId),
            eq(saasSubscriptions.isCurrent, true),
          ),
        );
      expect(subs).toHaveLength(1);
      expect(subs[0]!.planId).toBe('starter');
      expect(subs[0]!.priceVersionId).toBe('starter_month_v1');

      // Verify history entry recorded
      const history = await db
        .select()
        .from(saasSubscriptionHistory)
        .where(eq(saasSubscriptionHistory.organizationId, orgId));
      expect(history).toHaveLength(1);
      expect(history[0]!.action).toBe('CREATED');
      expect(history[0]!.toPlanId).toBe('starter');
    });

    it('enforces one-current-subscription invariant when plan changes', async () => {
      const { user: admin, token: adminToken } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, adminToken);

      // Create initial subscription
      await catalogService.createSubscription({
        organizationId: orgId,
        planId: 'starter',
        interval: 'month',
        actorId: admin.id,
      });

      // Upgrade to professional
      const upgraded = await catalogService.changePlan({
        organizationId: orgId,
        newPlanId: 'professional',
        newInterval: 'month',
        reason: 'Plan upgrade test',
        actorId: admin.id,
      });

      expect(upgraded.subscription.planId).toBe('professional');
      expect(upgraded.subscription.isCurrent).toBe(true);
      expect(upgraded.limits.activeProjects).toBe(15);

      // Verify only ONE current subscription exists
      const db = getDb();
      const currentSubs = await db
        .select()
        .from(saasSubscriptions)
        .where(
          and(
            eq(saasSubscriptions.organizationId, orgId),
            eq(saasSubscriptions.isCurrent, true),
          ),
        );
      expect(currentSubs).toHaveLength(1);
      expect(currentSubs[0]!.planId).toBe('professional');

      // Verify OLD starter subscription is now archived (not current)
      const allSubs = await db
        .select()
        .from(saasSubscriptions)
        .where(eq(saasSubscriptions.organizationId, orgId));
      expect(allSubs).toHaveLength(2);

      const archivedStarter = allSubs.find((s) => s.planId === 'starter');
      expect(archivedStarter).toBeDefined();
      expect(archivedStarter!.isCurrent).toBe(false);

      // Verify subscription history ledger retains both transitions
      const history = await db
        .select()
        .from(saasSubscriptionHistory)
        .where(eq(saasSubscriptionHistory.organizationId, orgId));
      expect(history).toHaveLength(2);

      const actions = history.map((h) => h.action);
      expect(actions).toContain('CREATED');
      expect(actions).toContain('PLAN_CHANGED');
    });

    it('preserves historical v1 price version after plan change — grandfathering invariant', async () => {
      const { user: admin, token: adminToken } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, adminToken);

      // Create initial subscription with starter v1
      await catalogService.createSubscription({
        organizationId: orgId,
        planId: 'starter',
        interval: 'year', // Using yearly pricing
        actorId: admin.id,
      });

      // Verify the starter yearly price version still exists and is addressable
      const db = getDb();
      const starterYearSub = await db
        .select()
        .from(saasSubscriptions)
        .where(eq(saasSubscriptions.organizationId, orgId));

      expect(starterYearSub).toHaveLength(1);
      expect(starterYearSub[0]!.interval).toBe('year');
      expect(starterYearSub[0]!.priceVersionId).toBe('starter_year_v1');

      // Change to monthly professional
      await catalogService.changePlan({
        organizationId: orgId,
        newPlanId: 'professional',
        newInterval: 'month',
        actorId: admin.id,
      });

      // Old yearly starter subscription still exists in history — grandfathering proof
      const allSubs = await db
        .select()
        .from(saasSubscriptions)
        .where(eq(saasSubscriptions.organizationId, orgId));
      expect(allSubs).toHaveLength(2);

      // Previous subscription with year interval preserved
      const previousSub = allSubs.find((s) => s.interval === 'year');
      expect(previousSub).toBeDefined();
      expect(previousSub!.planId).toBe('starter');
      expect(previousSub!.priceVersionId).toBe('starter_year_v1');
      expect(previousSub!.isCurrent).toBe(false);

      // The v1 price version remains in the price_versions table for historical reference
      const starterYearPriceVersion = await db
        .select()
        .from(saasPriceVersions)
        .where(
          and(
            eq(saasPriceVersions.planId, 'starter'),
            eq(saasPriceVersions.interval, 'year'),
            eq(saasPriceVersions.version, 'v1'),
          ),
        );
      expect(starterYearPriceVersion).toHaveLength(1);
      expect(starterYearPriceVersion[0]!.unitAmountCents).toBe(202900);
    });
  });
});

// ── Plan 11: Entitlement enforcement — PostgreSQL concurrency and tenant isolation ──────────────

describe('SaaS Billing — Entitlement Enforcement Integration (10-11)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ── Test 1: Approved project-count limits enforced at createProject ─────────────────────────

  describe('Test 1: Active-projects limit enforced atomically at ProjectService.createProject', () => {
    it('allows project creation up to the Starter limit (3 projects) then blocks on the 4th', async () => {
      const { user: admin, token: adminToken } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, adminToken);

      // Provision trial (Professional limits) then downgrade to Starter via catalog subscription
      await catalogService.createSubscription({
        organizationId: orgId,
        planId: 'starter',
        interval: 'month',
        actorId: admin.id,
      });

      // Create 3 projects — should all succeed
      for (let i = 1; i <= 3; i++) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgId}/projects`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: `Project ${i}`, currency: 'USD' },
        });
        expect(res.statusCode).toBe(201);
      }

      // 4th project must be blocked by the entitlement gate
      const blocked = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Project 4 (should fail)', currency: 'USD' },
      });
      expect(blocked.statusCode).toBe(403);
      expect(blocked.json().error.code).toBe('LIMIT_EXCEEDED');
    });

    it('does not block project creation for Professional plan (15 project limit)', async () => {
      const { user: admin, token: adminToken } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, adminToken);

      await catalogService.createSubscription({
        organizationId: orgId,
        planId: 'professional',
        interval: 'month',
        actorId: admin.id,
      });

      // Create 3 projects — should succeed since limit is 15
      for (let i = 1; i <= 3; i++) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgId}/projects`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: `Pro Project ${i}`, currency: 'USD' },
        });
        expect(res.statusCode).toBe(201);
      }
    });

    it('blocks project creation when there is no subscription or trial (NO_ENTITLEMENT)', async () => {
      const { token: adminToken } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, adminToken);
      // No subscription and no trial provisioned for this org
      // The org creation itself adds admin as member but doesn't start a trial

      // Attempt project creation without any subscription
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Should be blocked', currency: 'USD' },
      });
      // Must be blocked — 403 for NO_ENTITLEMENT
      expect(res.statusCode).toBe(403);
    });

    it('allows project creation during an active trial (Professional limits apply — D-01)', async () => {
      const { token: adminToken } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, adminToken);

      // Start the trial
      await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/billing/trial`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // Should be allowed — Professional trial gives 15 projects
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Trial Project 1', currency: 'USD' },
      });
      expect(res.statusCode).toBe(201);
    });
  });

  // ── Test 2: entitlementService.assertCanCreateProject — concurrent safety ──────────────────

  describe('Test 2: Concurrent project creation does not exceed approved limit', () => {
    it('concurrent requests do not exceed the Starter project limit (3)', async () => {
      const { user: admin, token: adminToken } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, adminToken);

      await catalogService.createSubscription({
        organizationId: orgId,
        planId: 'starter',
        interval: 'month',
        actorId: admin.id,
      });

      // Fire 5 concurrent project creation requests
      const requests = Array.from({ length: 5 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgId}/projects`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: `Concurrent Project ${i + 1}`, currency: 'USD' },
        }),
      );

      const results = await Promise.all(requests);
      const successes = results.filter((r) => r.statusCode === 201).length;
      const failures = results.filter((r) => r.statusCode === 403).length;

      // At most 3 should succeed; at least 2 should be rejected
      expect(successes).toBeLessThanOrEqual(3);
      expect(failures).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Test 3: Tenant isolation — tenant A cannot consume tenant B's capacity ────────────────

  describe('Test 3: Cross-tenant capacity isolation', () => {
    it('entitlement counts are scoped per organization — one org exhausting limit does not affect another', async () => {
      const { user: adminA, token: tokenA } = await createVerifiedUser();
      const { orgId: orgIdA } = await createOrgWithAdmin(app, tokenA);

      const { user: adminB, token: tokenB } = await createVerifiedUser();
      const { orgId: orgIdB } = await createOrgWithAdmin(app, tokenB);

      // Give both orgs Starter subscriptions
      await catalogService.createSubscription({ organizationId: orgIdA, planId: 'starter', interval: 'month', actorId: adminA.id });
      await catalogService.createSubscription({ organizationId: orgIdB, planId: 'starter', interval: 'month', actorId: adminB.id });

      // Exhaust Org A's project limit
      for (let i = 1; i <= 3; i++) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgIdA}/projects`,
          headers: { authorization: `Bearer ${tokenA}` },
          payload: { name: `Org A Project ${i}`, currency: 'USD' },
        });
        expect(res.statusCode).toBe(201);
      }

      // Org A is now at limit
      const blockedA = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgIdA}/projects`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { name: 'Org A Project 4 — blocked', currency: 'USD' },
      });
      expect(blockedA.statusCode).toBe(403);

      // Org B is unaffected — can still create projects
      const allowedB = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgIdB}/projects`,
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { name: 'Org B Project 1 — should succeed', currency: 'USD' },
      });
      expect(allowedB.statusCode).toBe(201);
    });
  });

  // ── Test 4: rollback — failed project creation leaves no partial state ─────────────────────

  describe('Test 4: Transaction rollback on limit violation', () => {
    it('entitlement gate blocks the entire transaction — no partial project row created', async () => {
      const { user: admin, token: adminToken } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, adminToken);

      await catalogService.createSubscription({
        organizationId: orgId,
        planId: 'starter',
        interval: 'month',
        actorId: admin.id,
      });

      // Fill the limit
      for (let i = 1; i <= 3; i++) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgId}/projects`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: `Filler ${i}`, currency: 'USD' },
        });
      }

      // Attempt a blocked creation
      const blocked = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Should not persist', currency: 'USD' },
      });
      expect(blocked.statusCode).toBe(403);

      // Verify no 4th project was persisted
      const db = getDb();
      const { projects } = await import('@siteflow/database/schema');
      const { notInArray } = await import('drizzle-orm');
      const remaining = await db
        .select({ cnt: count() })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, orgId),
            notInArray(projects.status, ['CANCELLED', 'ARCHIVED']),
          ),
        );
      expect(Number(remaining[0]!.cnt)).toBe(3);
    });

    describe('Organization-user limit enforced at invitation boundaries', () => {
      async function createStarterOrganizationWithNineMembers() {
        const { user: admin, token } = await createVerifiedUser();
        const { orgId, roleMap } = await createOrgWithAdmin(app, token);
        await catalogService.createSubscription({
          organizationId: orgId,
          planId: 'starter',
          interval: 'month',
          actorId: admin.id,
        });

        for (let i = 0; i < 8; i++) {
          const { user } = await createVerifiedUser();
          await addMemberDirectly(orgId, user.id, roleMap.get('Client')!);
        }

        return { orgId, token, roleId: roleMap.get('Client')! };
      }

      it('reserves a seat for pending invitations and converts that reservation on acceptance', async () => {
        const { orgId, token, roleId } = await createStarterOrganizationWithNineMembers();
        const invitedEmail = `seat_accept_${crypto.randomUUID()}@test.dev`;
        const invite = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgId}/invitations`,
          headers: { authorization: `Bearer ${token}` },
          payload: { email: invitedEmail, roleId },
        });
        expect(invite.statusCode).toBe(201);

        const overLimitEmail = `seat_over_limit_${crypto.randomUUID()}@test.dev`;
        const blocked = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgId}/invitations`,
          headers: { authorization: `Bearer ${token}` },
          payload: { email: overLimitEmail, roleId },
        });
        expect(blocked.statusCode).toBe(403);
        expect(blocked.json().error.code).toBe('LIMIT_EXCEEDED');
        const persistedBlockedInvitation = await getDb()
          .select({ id: invitations.id })
          .from(invitations)
          .where(eq(invitations.email, overLimitEmail));
        expect(persistedBlockedInvitation).toHaveLength(0);

        const rawToken = await getInvitationTokenFromOutbox(invitedEmail);
        const { token: inviteeToken } = await createVerifiedUser({ email: invitedEmail });
        const accepted = await app.inject({
          method: 'POST',
          url: `/api/v1/invitations/${rawToken}/accept`,
          headers: { authorization: `Bearer ${inviteeToken}` },
        });
        expect(accepted.statusCode).toBe(200);

        const stillOverLimit = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgId}/invitations`,
          headers: { authorization: `Bearer ${token}` },
          payload: { email: `seat_after_accept_${crypto.randomUUID()}@test.dev`, roleId },
        });
        expect(stillOverLimit.statusCode).toBe(403);
        expect(stillOverLimit.json().error.code).toBe('LIMIT_EXCEEDED');

        const { user: otherAdmin, token: otherToken } = await createVerifiedUser();
        const { orgId: otherOrgId, roleMap: otherRoleMap } = await createOrgWithAdmin(app, otherToken);
        await catalogService.createSubscription({
          organizationId: otherOrgId,
          planId: 'starter',
          interval: 'month',
          actorId: otherAdmin.id,
        });
        const otherTenantInvite = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${otherOrgId}/invitations`,
          headers: { authorization: `Bearer ${otherToken}` },
          payload: {
            email: `other_tenant_seat_${crypto.randomUUID()}@test.dev`,
            roleId: otherRoleMap.get('Client')!,
          },
        });
        expect(otherTenantInvite.statusCode).toBe(201);
      });

      it('serializes concurrent invitations so reserved seats cannot exceed the limit', async () => {
        const { orgId, token, roleId } = await createStarterOrganizationWithNineMembers();
        const requests = Array.from({ length: 3 }, (_, i) =>
          app.inject({
            method: 'POST',
            url: `/api/v1/organizations/${orgId}/invitations`,
            headers: { authorization: `Bearer ${token}` },
            payload: {
              email: `seat_concurrent_${i}_${crypto.randomUUID()}@test.dev`,
              roleId,
            },
          }),
        );

        const results = await Promise.all(requests);
        expect(results.filter((result) => result.statusCode === 201)).toHaveLength(1);
        const blocked = results.filter((result) => result.statusCode === 403);
        expect(blocked).toHaveLength(2);
        for (const result of blocked) {
          expect(result.json().error.code).toBe('LIMIT_EXCEEDED');
        }
      });
    });
  });
});
