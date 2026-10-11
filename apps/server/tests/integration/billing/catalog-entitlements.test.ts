// apps/server/tests/integration/billing/catalog-entitlements.test.ts
// Phase 10 — SaaS Billing Integration Tests: Catalog, Subscription History, One-Current Invariant

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify'
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';
import { getDb } from '../../../src/lib/db/index.js';
import {
  saasPlans,
  saasPriceVersions,
  saasSubscriptions,
  saasSubscriptionHistory,
} from '@siteflow/database/schema';
import { eq, and, count } from 'drizzle-orm';
import { catalogService } from '../../../src/modules/billing/catalog.service.js';
import { ValidationError, NotFoundError } from '../../../src/modules/auth/auth.errors.js';

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
      const initial = await catalogService.createSubscription({
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
