// packages/shared/src/modules/billing/catalog.schema.ts
// Phase 10 — SaaS Billing Shared Catalog & Subscription Contracts
// Strictly reflects approved policy values from 10-POLICY-DECISIONS.md

import { z } from 'zod';

export const PlanTierSchema = z.enum(['Starter', 'Professional', 'Enterprise']);
export type PlanTier = z.infer<typeof PlanTierSchema>;

export const PlanIdSchema = z.enum(['trial', 'starter', 'professional', 'enterprise']);
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
  aiTokensMonthly: z.number().int().nonnegative(), // AI assistant token budget per billing cycle
  // Feature flags — which capabilities are available on this plan
  features: z.object({
    procurementChain: z.boolean(),       // Full procurement (MR→quote→approval→PO→committed→delivery→receipt→inventory)
    subcontractorMgmt: z.boolean(),      // Subcontractor management + retainage
    changeOrders: z.boolean(),           // Change order approval workflow
    aiaPaymentApps: z.boolean(),         // AIA G702/G703 payment apps + certified retainage
    costControl: z.boolean(),            // Committed costs + commercial/financial summary + cost transactions
    conversationalAi: z.boolean(),       // AI chat + specialized agents + approvals + voice + memory
    advancedReporting: z.boolean(),      // Portfolio/executive-summary reports + CSV export
  }),
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
  stripeProductId: z.string().optional(), // Stripe product ID (prices resolved at runtime)
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
  trial: {
    activeProjects: 2,
    teamMembers: 5,
    storageGb: 5,
    aiTokensMonthly: 100_000,
    features: {
      procurementChain: true,
      subcontractorMgmt: true,
      changeOrders: true,
      aiaPaymentApps: true,
      costControl: true,
      conversationalAi: true,
      advancedReporting: true,
    },
  },
  starter: {
    activeProjects: 3,
    teamMembers: 10,
    storageGb: 50,
    aiTokensMonthly: 100_000,
    features: {
      procurementChain: false,
      subcontractorMgmt: false,
      changeOrders: false,
      aiaPaymentApps: false,
      costControl: false,
      conversationalAi: false,
      advancedReporting: false,
    },
  },
  professional: {
    activeProjects: 15,
    teamMembers: 50,
    storageGb: 250,
    aiTokensMonthly: 500_000,
    features: {
      procurementChain: true,
      subcontractorMgmt: true,
      changeOrders: true,
      aiaPaymentApps: true,
      costControl: true,
      conversationalAi: true,
      advancedReporting: true,
    },
  },
  enterprise: {
    activeProjects: 100,
    teamMembers: 500,
    storageGb: 1000,
    aiTokensMonthly: 2_000_000,
    features: {
      procurementChain: true,
      subcontractorMgmt: true,
      changeOrders: true,
      aiaPaymentApps: true,
      costControl: true,
      conversationalAi: true,
      advancedReporting: true,
    },
  },
};

export interface ApprovedPricingItem {
  unitAmountCents: number;   // USD cents (e.g. 2000 = $20.00)
  unitAmountUsd: number;     // USD whole dollars (e.g. 20)
  stripeProductId: string;   // Stripe product ID (prices resolved at runtime)
}

// Safe server-only env read — never called in browser bundles
// (Stripe product IDs are only used by checkout.routes.ts on the server)
function serverEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

// Annual prices apply a 10% discount off the monthly rate × 12.
// USD monthly: Starter $20    / Professional $100     / Enterprise $300
export const APPROVED_PRICING_V1: Record<Exclude<PlanId, 'trial'>, Record<BillingInterval, ApprovedPricingItem>> = {
  starter: {
    month: {
      unitAmountCents: 2000,          // $20.00
      unitAmountUsd: 20,
      stripeProductId: serverEnv('STRIPE_PRODUCT_STARTER') ?? 'prod_starter_placeholder',
    },
    year: {
      unitAmountCents: 21_600,        // $20 × 12 × 0.90 = $216.00
      unitAmountUsd: 216,
      stripeProductId: serverEnv('STRIPE_PRODUCT_STARTER') ?? 'prod_starter_placeholder',
    },
  },
  professional: {
    month: {
      unitAmountCents: 10_000,        // $100.00
      unitAmountUsd: 100,
      stripeProductId: serverEnv('STRIPE_PRODUCT_PRO') ?? 'prod_pro_placeholder',
    },
    year: {
      unitAmountCents: 108_000,       // $100 × 12 × 0.90 = $1,080.00
      unitAmountUsd: 1_080,
      stripeProductId: serverEnv('STRIPE_PRODUCT_PRO') ?? 'prod_pro_placeholder',
    },
  },
  enterprise: {
    month: {
      unitAmountCents: 30_000,        // $300.00
      unitAmountUsd: 300,
      stripeProductId: serverEnv('STRIPE_PRODUCT_ENT') ?? 'prod_ent_placeholder',
    },
    year: {
      unitAmountCents: 324_000,       // $300 × 12 × 0.90 = $3,240.00
      unitAmountUsd: 3_240,
      stripeProductId: serverEnv('STRIPE_PRODUCT_ENT') ?? 'prod_ent_placeholder',
    },
  },
};

export const APPROVED_PLANS: Record<PlanId, PlanDefinition> = {
  trial: {
    id: 'trial',
    name: 'Starter',
    tier: 'Starter',
    description: 'Free 14-day trial with full Professional features and lower caps.',
    limits: APPROVED_LIMITS.trial,
    isActive: true,
    prices: [], // Trial has no Stripe prices — free and time-limited
  },
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
        stripeProductId: APPROVED_PRICING_V1.starter.month.stripeProductId,
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
        stripeProductId: APPROVED_PRICING_V1.starter.year.stripeProductId,
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
        stripeProductId: APPROVED_PRICING_V1.professional.month.stripeProductId,
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
        stripeProductId: APPROVED_PRICING_V1.professional.year.stripeProductId,
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
        stripeProductId: APPROVED_PRICING_V1.enterprise.month.stripeProductId,
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
        stripeProductId: APPROVED_PRICING_V1.enterprise.year.stripeProductId,
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
 * Maps a provider product identifier and interval to the corresponding local approved price version.
 * Provider IDs remain references; local price and limit definitions are strictly authoritative.
 */
export function findPriceByProviderProduct(
  stripeProductId: string,
  interval: BillingInterval,
): PriceVersion | null {
  for (const plan of Object.values(APPROVED_PLANS)) {
    for (const price of plan.prices) {
      if (price.stripeProductId === stripeProductId && price.interval === interval) {
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
