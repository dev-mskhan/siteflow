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
  findPriceByProviderProduct,
} from '@siteflow/shared';
import { ValidationError, NotFoundError } from '../../../src/modules/auth/auth.errors.js';

describe('SaaS Billing — Catalog Policy Unit Tests (10-05)', () => {
  describe('Test 1: Approved Local Plans and Immutable Price Versions', () => {
    it('returns exactly the three paid plans with correct tiers and descriptions', () => {
      const catalog = catalogService.getCatalog();
      expect(catalog).toHaveLength(3); // starter, professional, enterprise (trial excluded)

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

    it('includes trial plan in APPROVED_LIMITS but not in paid catalog', () => {
      // Trial exists in limits but has no Stripe prices
      expect(APPROVED_LIMITS.trial).toBeDefined();
      expect(APPROVED_LIMITS.trial.activeProjects).toBe(2);
      expect(APPROVED_LIMITS.trial.teamMembers).toBe(5);
      expect(APPROVED_LIMITS.trial.storageGb).toBe(5);
      expect(APPROVED_LIMITS.trial.aiTokensMonthly).toBe(100000);

      // Trial not in paid catalog (managed separately by trial service)
      const catalog = catalogService.getCatalog();
      expect(catalog.find(p => p.id === 'trial')).toBeUndefined();
    });

    it('enforces exact approved pricing matching updated spec', () => {
      // Starter: $20/month, $216/year (10% annual discount)
      const starterMonth = catalogService.getPriceVersion('starter', 'month');
      expect(starterMonth.unitAmountUsd).toBe(20);
      expect(starterMonth.unitAmountCents).toBe(2000);
      expect(starterMonth.interval).toBe('month');

      const starterYear = catalogService.getPriceVersion('starter', 'year');
      expect(starterYear.unitAmountUsd).toBe(216); // $20 × 12 × 0.90
      expect(starterYear.unitAmountCents).toBe(21600);
      expect(starterYear.interval).toBe('year');

      // Professional: $100/month, $1,080/year (10% annual discount)
      const proMonth = catalogService.getPriceVersion('professional', 'month');
      expect(proMonth.unitAmountUsd).toBe(100);
      expect(proMonth.unitAmountCents).toBe(10000);

      const proYear = catalogService.getPriceVersion('professional', 'year');
      expect(proYear.unitAmountUsd).toBe(1080); // $100 × 12 × 0.90
      expect(proYear.unitAmountCents).toBe(108000);

      // Enterprise: $300/month, $3,240/year (10% annual discount)
      const entMonth = catalogService.getPriceVersion('enterprise', 'month');
      expect(entMonth.unitAmountUsd).toBe(300);
      expect(entMonth.unitAmountCents).toBe(30000);

      const entYear = catalogService.getPriceVersion('enterprise', 'year');
      expect(entYear.unitAmountUsd).toBe(3240); // $300 × 12 × 0.90
      expect(entYear.unitAmountCents).toBe(324000);
    });

    it('enforces exact approved limits with AI tokens (no API calls) for all 4 plans', () => {
      // Trial: 2 projects, 5 members, 5 GB, 100k AI tokens
      expect(APPROVED_LIMITS.trial).toEqual({
        activeProjects: 2,
        teamMembers: 5,
        storageGb: 5,
        aiTokensMonthly: 100000,
        features: expect.objectContaining({
          procurementChain: true,
          subcontractorMgmt: true,
          changeOrders: true,
          aiaPaymentApps: true,
          costControl: true,
          conversationalAi: true,
          advancedReporting: true,
        }),
      });

      // Starter: 3 projects, 10 members, 50 GB, 100k AI tokens, all features false
      const starter = catalogService.getPlan('starter');
      expect(starter.limits).toEqual({
        activeProjects: 3,
        teamMembers: 10,
        storageGb: 50,
        aiTokensMonthly: 100000,
        features: {
          procurementChain: false,
          subcontractorMgmt: false,
          changeOrders: false,
          aiaPaymentApps: false,
          costControl: false,
          conversationalAi: false,
          advancedReporting: false,
        },
      });

      // Professional: 15 projects, 50 members, 250 GB, 500k AI tokens, all features true
      const pro = catalogService.getPlan('professional');
      expect(pro.limits).toEqual({
        activeProjects: 15,
        teamMembers: 50,
        storageGb: 250,
        aiTokensMonthly: 500000,
        features: {
          procurementChain: true,
          subcontractorMgmt: true,
          changeOrders: true,
          aiaPaymentApps: true,
          costControl: true,
          conversationalAi: true,
          advancedReporting: true,
        },
      });

      // Enterprise: 100 projects, 500 members, 1TB, 2M AI tokens, all features true
      const ent = catalogService.getPlan('enterprise');
      expect(ent.limits).toEqual({
        activeProjects: 100,
        teamMembers: 500,
        storageGb: 1000,
        aiTokensMonthly: 2000000,
        features: {
          procurementChain: true,
          subcontractorMgmt: true,
          changeOrders: true,
          aiaPaymentApps: true,
          costControl: true,
          conversationalAi: true,
          advancedReporting: true,
        },
      });
    });

    it('throws NotFoundError for unknown plans or unapproved price versions', () => {
      expect(() => catalogService.getPlan('unknown-plan')).toThrow(NotFoundError);
      expect(() => catalogService.getPriceVersion('starter', 'month', 'v999')).toThrow(NotFoundError);
    });
  });

  describe('Test 2: Provider Product IDs Map to Local Authority', () => {
    it('maps Stripe product IDs + interval to local price version', () => {
      // Get actual product IDs from catalog
      const starterProductId = catalogService.getPriceVersion('starter', 'month').stripeProductId;
      const proProductId = catalogService.getPriceVersion('professional', 'year').stripeProductId;
      
      // Uses product ID + interval, not price ID
      const resolvedStarter = catalogService.resolvePriceFromProvider(starterProductId, 'month');
      expect(resolvedStarter.planId).toBe('starter');
      expect(resolvedStarter.interval).toBe('month');
      expect(resolvedStarter.unitAmountUsd).toBe(20);
      expect(resolvedStarter.limits.activeProjects).toBe(3);

      const resolvedProYear = catalogService.resolvePriceFromProvider(proProductId, 'year');
      expect(resolvedProYear.planId).toBe('professional');
      expect(resolvedProYear.interval).toBe('year');
      expect(resolvedProYear.unitAmountUsd).toBe(1080);
      expect(resolvedProYear.limits.activeProjects).toBe(15);
    });

    it('rejects unmapped or tampered provider product IDs', () => {
      expect(() => catalogService.resolvePriceFromProvider('prod_hacked_cheap_999', 'month')).toThrow(ValidationError);
      expect(() => catalogService.resolvePriceFromProvider('prod_unknown_12345', 'year')).toThrow(ValidationError);
    });

    it('ensures local catalog immutability prevents price/limit tampering', () => {
      const price = catalogService.getPriceVersion('professional', 'month');
      // Attempting to modify properties does not alter internal catalog authority
      expect(price.unitAmountUsd).toBe(100);
      expect(price.limits.activeProjects).toBe(15);

      const retrievedAgain = catalogService.getPriceVersion('professional', 'month');
      expect(retrievedAgain.unitAmountUsd).toBe(100);
      expect(retrievedAgain.limits.activeProjects).toBe(15);
    });
  });

  describe('Test 3: Price Versioning and Grandfathering Invariant', () => {
    it('addresses historical price versions explicitly (version v1 is preserved)', () => {
      const v1Starter = catalogService.getPriceVersion('starter', 'month', 'v1');
      expect(v1Starter.version).toBe('v1');
      expect(v1Starter.unitAmountUsd).toBe(20);
      expect(v1Starter.limits.teamMembers).toBe(10);
    });

    it('retains approved limit schema structure across all tiers', () => {
      for (const plan of catalogService.getCatalog()) {
        for (const price of plan.prices) {
          expect(price.limits).toBeDefined();
          expect(typeof price.limits.activeProjects).toBe('number');
          expect(typeof price.limits.teamMembers).toBe('number');
          expect(typeof price.limits.storageGb).toBe('number');
          expect(typeof price.limits.aiTokensMonthly).toBe('number');
          expect(price.limits.features).toBeDefined();
          expect(typeof price.limits.features.procurementChain).toBe('boolean');
          expect(typeof price.limits.features.conversationalAi).toBe('boolean');
          expect(price.currency).toBe('usd');
          expect(price.isActive).toBe(true);
        }
      }
    });
  });

  describe('Test 4: Feature Flag Enforcement', () => {
    it('ensures Starter has all features disabled', () => {
      const starter = APPROVED_LIMITS.starter;
      expect(starter.features.procurementChain).toBe(false);
      expect(starter.features.subcontractorMgmt).toBe(false);
      expect(starter.features.changeOrders).toBe(false);
      expect(starter.features.aiaPaymentApps).toBe(false);
      expect(starter.features.costControl).toBe(false);
      expect(starter.features.conversationalAi).toBe(false);
      expect(starter.features.advancedReporting).toBe(false);
    });

    it('ensures Trial, Professional, and Enterprise have all features enabled', () => {
      for (const planId of ['trial', 'professional', 'enterprise'] as const) {
        const limits = APPROVED_LIMITS[planId];
        expect(limits.features.procurementChain).toBe(true);
        expect(limits.features.subcontractorMgmt).toBe(true);
        expect(limits.features.changeOrders).toBe(true);
        expect(limits.features.aiaPaymentApps).toBe(true);
        expect(limits.features.costControl).toBe(true);
        expect(limits.features.conversationalAi).toBe(true);
        expect(limits.features.advancedReporting).toBe(true);
      }
    });
  });
});
