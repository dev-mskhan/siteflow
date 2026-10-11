// packages/shared/src/modules/billing/catalog.schema.ts
// Phase 10 — SaaS Billing Shared Catalog & Subscription Contracts
// Strictly reflects approved policy values from 10-POLICY-DECISIONS.md

import { z } from 'zod';

export const PlanTierSchema = z.enum(['Starter', 'Professional', 'Enterprise']);
export type PlanTier = z.infer<typeof PlanTierSchema>;

export const PlanIdSchema = z.enum(['starter', 'professional', 'enterprise']);
export type PlanId = z.infer<typeof PlanIdSchema>;

export const BillingIntervalSchema = z.enum(['month', 'year']);
export type BillingInterval = z.infer<typeof BillingIntervalSchema>;

export const SubscriptionStatusSchema = z.enum([
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'RESTRICTED',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const PlanLimitsSchema = z.object({
  activeProjects: z.number().int().nonnegative(),
  teamMembers: z.number().int().nonnegative(),
  storageGb: z.number().int().nonnegative(),
  apiCallsMonthly: z.number().int().nonnegative(),
});
export type PlanLimits = z.infer<typeof PlanLimitsSchema>;

export const PriceVersionSchema = z.object({
  id: z.string(),
  planId: PlanIdSchema,
  version: z.string(),
  interval: BillingIntervalSchema,
  currency: z.literal('usd'),
  unitAmountCents: z.number().int().positive(),
  unitAmountUsd: z.number().positive(),
  stripePriceId: z.string().optional(),
  stripeProductId: z.string().optional(),
  limits: PlanLimitsSchema,
  isActive: z.boolean(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional().nullable(),
});
export type PriceVersion = z.infer<typeof PriceVersionSchema>;

export const PlanDefinitionSchema = z.object({
  id: PlanIdSchema,
  name: PlanTierSchema,
  tier: PlanTierSchema,
  description: z.string(),
  prices: z.array(PriceVersionSchema),
  limits: PlanLimitsSchema,
  isActive: z.boolean(),
});
export type PlanDefinition = z.infer<typeof PlanDefinitionSchema>;

export const SubscriptionDTOSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  planId: PlanIdSchema,
  priceVersionId: z.string(),
  interval: BillingIntervalSchema,
  status: SubscriptionStatusSchema,
  isCurrent: z.boolean(),
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.string().nullable().optional(),
  endedAt: z.string().nullable().optional(),
  stripeCustomerId: z.string().nullable().optional(),
  stripeSubscriptionId: z.string().nullable().optional(),
  stripePriceId: z.string().nullable().optional(),
  scheduledPlanId: z.string().nullable().optional(),
  graceStartsAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SubscriptionDTO = z.infer<typeof SubscriptionDTOSchema>;

export const SubscriptionHistoryDTOSchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  organizationId: z.string(),
  action: z.string(),
  fromPlanId: z.string().nullable().optional(),
  toPlanId: z.string().nullable().optional(),
  fromPriceVersionId: z.string().nullable().optional(),
  toPriceVersionId: z.string().nullable().optional(),
  fromStatus: z.string().nullable().optional(),
  toStatus: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type SubscriptionHistoryDTO = z.infer<typeof SubscriptionHistoryDTOSchema>;

// ── Approved Policy Catalog (10-POLICY-DECISIONS.md) ──────────────────────────

export const APPROVED_LIMITS: Record<PlanId, PlanLimits> = {
  starter: {
    activeProjects: 3,
    teamMembers: 10,
    storageGb: 50,
    apiCallsMonthly: 5000,
  },
  professional: {
    activeProjects: 15,
    teamMembers: 50,
    storageGb: 250,
    apiCallsMonthly: 25000,
  },
  enterprise: {
    activeProjects: 100,
    teamMembers: 500,
    storageGb: 1000,
    apiCallsMonthly: 100000,
  },
};

export interface ApprovedPricingItem {
  unitAmountCents: number;
  unitAmountUsd: number;
  stripePriceId: string;
}

export const APPROVED_PRICING_V1: Record<PlanId, Record<BillingInterval, ApprovedPricingItem>> = {
  starter: {
    month: { unitAmountCents: 19900, unitAmountUsd: 199, stripePriceId: 'price_starter_month_v1' },
    year: { unitAmountCents: 202900, unitAmountUsd: 2029, stripePriceId: 'price_starter_year_v1' },
  },
  professional: {
    month: { unitAmountCents: 49900, unitAmountUsd: 499, stripePriceId: 'price_pro_month_v1' },
    year: { unitAmountCents: 508900, unitAmountUsd: 5089, stripePriceId: 'price_pro_year_v1' },
  },
  enterprise: {
    month: { unitAmountCents: 99900, unitAmountUsd: 999, stripePriceId: 'price_ent_month_v1' },
    year: { unitAmountCents: 1018900, unitAmountUsd: 10189, stripePriceId: 'price_ent_year_v1' },
  },
};

export const APPROVED_PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    tier: 'Starter',
    description: 'Essential construction management for smaller teams and specialized contractors.',
    limits: APPROVED_LIMITS.starter,
    isActive: true,
    prices: [
      {
        id: 'starter_month_v1',
        planId: 'starter',
        version: 'v1',
        interval: 'month',
        currency: 'usd',
        unitAmountCents: APPROVED_PRICING_V1.starter.month.unitAmountCents,
        unitAmountUsd: APPROVED_PRICING_V1.starter.month.unitAmountUsd,
        stripePriceId: APPROVED_PRICING_V1.starter.month.stripePriceId,
        limits: APPROVED_LIMITS.starter,
        isActive: true,
      },
      {
        id: 'starter_year_v1',
        planId: 'starter',
        version: 'v1',
        interval: 'year',
        currency: 'usd',
        unitAmountCents: APPROVED_PRICING_V1.starter.year.unitAmountCents,
        unitAmountUsd: APPROVED_PRICING_V1.starter.year.unitAmountUsd,
        stripePriceId: APPROVED_PRICING_V1.starter.year.stripePriceId,
        limits: APPROVED_LIMITS.starter,
        isActive: true,
      },
    ],
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    tier: 'Professional',
    description: 'Comprehensive operations and multi-project coordination for growing contractors.',
    limits: APPROVED_LIMITS.professional,
    isActive: true,
    prices: [
      {
        id: 'pro_month_v1',
        planId: 'professional',
        version: 'v1',
        interval: 'month',
        currency: 'usd',
        unitAmountCents: APPROVED_PRICING_V1.professional.month.unitAmountCents,
        unitAmountUsd: APPROVED_PRICING_V1.professional.month.unitAmountUsd,
        stripePriceId: APPROVED_PRICING_V1.professional.month.stripePriceId,
        limits: APPROVED_LIMITS.professional,
        isActive: true,
      },
      {
        id: 'pro_year_v1',
        planId: 'professional',
        version: 'v1',
        interval: 'year',
        currency: 'usd',
        unitAmountCents: APPROVED_PRICING_V1.professional.year.unitAmountCents,
        unitAmountUsd: APPROVED_PRICING_V1.professional.year.unitAmountUsd,
        stripePriceId: APPROVED_PRICING_V1.professional.year.stripePriceId,
        limits: APPROVED_LIMITS.professional,
        isActive: true,
      },
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 'Enterprise',
    description: 'Full-scale enterprise coordination, custom integrations, and portfolio visibility.',
    limits: APPROVED_LIMITS.enterprise,
    isActive: true,
    prices: [
      {
        id: 'ent_month_v1',
        planId: 'enterprise',
        version: 'v1',
        interval: 'month',
        currency: 'usd',
        unitAmountCents: APPROVED_PRICING_V1.enterprise.month.unitAmountCents,
        unitAmountUsd: APPROVED_PRICING_V1.enterprise.month.unitAmountUsd,
        stripePriceId: APPROVED_PRICING_V1.enterprise.month.stripePriceId,
        limits: APPROVED_LIMITS.enterprise,
        isActive: true,
      },
      {
        id: 'ent_year_v1',
        planId: 'enterprise',
        version: 'v1',
        interval: 'year',
        currency: 'usd',
        unitAmountCents: APPROVED_PRICING_V1.enterprise.year.unitAmountCents,
        unitAmountUsd: APPROVED_PRICING_V1.enterprise.year.unitAmountUsd,
        stripePriceId: APPROVED_PRICING_V1.enterprise.year.stripePriceId,
        limits: APPROVED_LIMITS.enterprise,
        isActive: true,
      },
    ],
  },
};

/**
 * Resolves an approved plan by ID. Throws if plan does not exist.
 */
export function getApprovedPlan(planId: string): PlanDefinition {
  const plan = APPROVED_PLANS[planId as PlanId];
  if (!plan) {
    throw new Error(`Plan '${planId}' is not an approved SiteFlow plan`);
  }
  return plan;
}

/**
 * Resolves an approved price version for a given plan and interval.
 * Defaults to 'v1' unless another version is requested.
 */
export function getApprovedPrice(
  planId: string,
  interval: BillingInterval,
  version = 'v1',
): PriceVersion {
  const plan = getApprovedPlan(planId);
  const price = plan.prices.find(
    (p) => p.interval === interval && p.version === version,
  );
  if (!price) {
    throw new Error(
      `No approved price version found for plan '${planId}', interval '${interval}', version '${version}'`,
    );
  }
  return price;
}

/**
 * Maps a provider price identifier to the corresponding local approved price version.
 * Provider IDs remain references; local price and limit definitions are strictly authoritative.
 */
export function findPriceByProviderPriceId(stripePriceId: string): PriceVersion | null {
  for (const plan of Object.values(APPROVED_PLANS)) {
    for (const price of plan.prices) {
      if (price.stripePriceId === stripePriceId) {
        return price;
      }
    }
  }
  return null;
}

/**
 * Returns all approved plans in the local catalog.
 */
export function getApprovedCatalog(): PlanDefinition[] {
  return Object.values(APPROVED_PLANS);
}
