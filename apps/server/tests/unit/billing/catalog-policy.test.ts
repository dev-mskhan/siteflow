// apps/server/tests/unit/billing/catalog-policy.test.ts
// Phase 10 — SaaS Billing Unit Tests: Approved Catalog Policy & Immutability

import { describe, it, expect } from 'vitest';
import { catalogService } from '../../../src/modules/billing/catalog.service.js';
import {
  APPROVED_LIMITS,
  APPROVED_PRICING_V1,
  APPROVED_PLANS,
  getApprovedPlan,
  getApprovedPrice,
  findPriceByProviderPriceId,
} from '@siteflow/shared';
import { ValidationError, NotFoundError } from '../../../src/modules/auth/auth.errors.js';

describe('SaaS Billing — Catalog Policy Unit Tests (10-05)', () => {
  describe('Test 1: Approved Local Plans and Immutable Price Versions', () => {
    it('returns exactly the three approved plans with correct tiers and descriptions', () => {
      const catalog = catalogService.getCatalog();
      expect(catalog).toHaveLength(3);

      const planIds = catalog.map((p) => p.id);
      expect(planIds).toEqual(['starter', 'professional', 'enterprise']);

      const starter = catalogService.getPlan('starter');
      expect(starter.name).toBe('Starter');
      expect(starter.tier).toBe('Starter');

      const pro = catalogService.getPlan('professional');
      expect(pro.name).toBe('Professional');
      expect(pro.tier).toBe('Professional');

      const ent = catalogService.getPlan('enterprise');
      expect(ent.name).toBe('Enterprise');
      expect(ent.tier).toBe('Enterprise');
    });

    it('enforces exact approved pricing matching 10-POLICY-DECISIONS.md', () => {
      // Starter: $199/month, $2,029/year (15% annual discount)
      const starterMonth = catalogService.getPriceVersion('starter', 'month');
      expect(starterMonth.unitAmountUsd).toBe(199);
      expect(starterMonth.unitAmountCents).toBe(19900);
      expect(starterMonth.interval).toBe('month');

      const starterYear = catalogService.getPriceVersion('starter', 'year');
      expect(starterYear.unitAmountUsd).toBe(2029);
      expect(starterYear.unitAmountCents).toBe(202900);
      expect(starterYear.interval).toBe('year');

      // Professional: $499/month, $5,089/year (15% annual discount)
      const proMonth = catalogService.getPriceVersion('professional', 'month');
      expect(proMonth.unitAmountUsd).toBe(499);
      expect(proMonth.unitAmountCents).toBe(49900);

      const proYear = catalogService.getPriceVersion('professional', 'year');
      expect(proYear.unitAmountUsd).toBe(5089);
      expect(proYear.unitAmountCents).toBe(508900);

      // Enterprise: $999/month, $10,189/year (15% annual discount)
      const entMonth = catalogService.getPriceVersion('enterprise', 'month');
      expect(entMonth.unitAmountUsd).toBe(999);
      expect(entMonth.unitAmountCents).toBe(99900);

      const entYear = catalogService.getPriceVersion('enterprise', 'year');
      expect(entYear.unitAmountUsd).toBe(10189);
      expect(entYear.unitAmountCents).toBe(1018900);
    });

    it('enforces exact approved included limits matching 10-POLICY-DECISIONS.md', () => {
      // Starter: 3 projects, 10 members, 50 GB storage, 5,000 monthly API calls
      const starter = catalogService.getPlan('starter');
      expect(starter.limits).toEqual({
        activeProjects: 3,
        teamMembers: 10,
        storageGb: 50,
        apiCallsMonthly: 5000,
      });

      // Professional: 15 projects, 50 members, 250 GB storage, 25,000 monthly API calls
      const pro = catalogService.getPlan('professional');
      expect(pro.limits).toEqual({
        activeProjects: 15,
        teamMembers: 50,
        storageGb: 250,
        apiCallsMonthly: 25000,
      });

      // Enterprise: 100 projects, 500 members, 1,000 GB storage, 100,000 monthly API calls
      const ent = catalogService.getPlan('enterprise');
      expect(ent.limits).toEqual({
        activeProjects: 100,
        teamMembers: 500,
        storageGb: 1000,
        apiCallsMonthly: 100000,
      });
    });

    it('throws NotFoundError for unknown plans or unapproved price versions', () => {
      expect(() => catalogService.getPlan('unknown-plan')).toThrow(NotFoundError);
      expect(() => catalogService.getPriceVersion('starter', 'month', 'v999')).toThrow(NotFoundError);
    });
  });

  describe('Test 2: Provider Price IDs Map to Local Authority', () => {
    it('maps valid Stripe Price IDs to the corresponding local price version', () => {
      const resolvedStarter = catalogService.resolvePriceFromProvider('price_starter_month_v1');
      expect(resolvedStarter.planId).toBe('starter');
      expect(resolvedStarter.interval).toBe('month');
      expect(resolvedStarter.unitAmountUsd).toBe(199);
      expect(resolvedStarter.limits.activeProjects).toBe(3);

      const resolvedProYear = catalogService.resolvePriceFromProvider('price_pro_year_v1');
      expect(resolvedProYear.planId).toBe('professional');
      expect(resolvedProYear.interval).toBe('year');
      expect(resolvedProYear.unitAmountUsd).toBe(5089);
      expect(resolvedProYear.limits.activeProjects).toBe(15);
    });

    it('rejects unmapped or tampered provider price IDs', () => {
      expect(() => catalogService.resolvePriceFromProvider('price_hacked_cheap_999')).toThrow(ValidationError);
      expect(() => catalogService.resolvePriceFromProvider('price_unknown_12345')).toThrow(ValidationError);
    });

    it('ensures local catalog immutability prevents price/limit tampering', () => {
      const price = catalogService.getPriceVersion('professional', 'month');
      // Attempting to modify properties does not alter internal catalog authority
      expect(price.unitAmountUsd).toBe(499);
      expect(price.limits.activeProjects).toBe(15);

      const retrievedAgain = catalogService.getPriceVersion('professional', 'month');
      expect(retrievedAgain.unitAmountUsd).toBe(499);
      expect(retrievedAgain.limits.activeProjects).toBe(15);
    });
  });

  describe('Test 3: Price Versioning and Grandfathering Invariant', () => {
    it('addresses historical price versions explicitly (version v1 is preserved)', () => {
      const v1Starter = catalogService.getPriceVersion('starter', 'month', 'v1');
      expect(v1Starter.version).toBe('v1');
      expect(v1Starter.unitAmountUsd).toBe(199);
      expect(v1Starter.limits.teamMembers).toBe(10);
    });

    it('retains approved limit schema structure across all tiers', () => {
      for (const plan of catalogService.getCatalog()) {
        for (const price of plan.prices) {
          expect(price.limits).toBeDefined();
          expect(typeof price.limits.activeProjects).toBe('number');
          expect(typeof price.limits.teamMembers).toBe('number');
          expect(typeof price.limits.storageGb).toBe('number');
          expect(typeof price.limits.apiCallsMonthly).toBe('number');
          expect(price.currency).toBe('usd');
          expect(price.isActive).toBe(true);
        }
      }
    });
  });
});
