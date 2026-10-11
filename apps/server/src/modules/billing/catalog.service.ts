// apps/server/src/modules/billing/catalog.service.ts
// Phase 10 — SaaS Billing Catalog & Subscription Authority Service
// Strictly enforces approved local plans, immutable price versions, and 1-current-subscription invariant.

import { randomUUID } from 'crypto';
import { getDb } from '../../lib/db/index.js';
import { auditService } from '../audit/audit.service.js';
import { catalogRepository, CatalogRepository } from './catalog.repository.js';
import {
  APPROVED_PLANS,
  APPROVED_LIMITS,
  APPROVED_PRICING_V1,
  getApprovedPlan,
  getApprovedPrice,
  findPriceByProviderPriceId,
  getApprovedCatalog,
  type PlanDefinition,
  type PriceVersion,
  type PlanLimits,
  type PlanId,
  type BillingInterval,
  type SubscriptionStatus,
} from '@siteflow/shared';
import type {
  SaasSubscription,
  SaasSubscriptionHistoryEntry,
  NewSaasSubscription,
} from '@siteflow/database/schema';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../auth/auth.errors.js';

export interface CreateSubscriptionParams {
  organizationId: string;
  planId: string;
  interval: BillingInterval;
  priceVersionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  actorId?: string;
}

export interface ChangePlanParams {
  organizationId: string;
  newPlanId: string;
  newInterval?: BillingInterval;
  newPriceVersionId?: string;
  reason?: string;
  actorId?: string;
}

export interface SubscriptionWithDetails {
  subscription: SaasSubscription;
  plan: PlanDefinition;
  priceVersion: PriceVersion;
  limits: PlanLimits;
}

export class CatalogService {
  constructor(private readonly repo: CatalogRepository = catalogRepository) {}

  // ── Catalog Authority Lookups ───────────────────────────────────────────────

  /**
   * Returns all approved plans with their immutable price versions and limit definitions.
   */
  getCatalog(): PlanDefinition[] {
    return getApprovedCatalog();
  }

  /**
   * Resolves an approved plan by ID. Throws NotFoundError if not found.
   */
  getPlan(planId: string): PlanDefinition {
    try {
      return getApprovedPlan(planId);
    } catch {
      throw new NotFoundError(`Plan '${planId}' does not exist in the approved catalog`);
    }
  }

  /**
   * Resolves an immutable price version for a plan and billing interval.
   */
  getPriceVersion(
    planId: string,
    interval: BillingInterval,
    version = 'v1',
  ): PriceVersion {
    try {
      return getApprovedPrice(planId, interval, version);
    } catch {
      throw new NotFoundError(
        `Price version '${version}' for plan '${planId}' (${interval}) does not exist in the approved catalog`,
      );
    }
  }

  /**
   * Resolves a provider price identifier to the corresponding local approved price version.
   * Throws ValidationError if the provider price is unmapped or unknown.
   * Client-supplied prices or provider overrides are NEVER accepted as authority.
   */
  resolvePriceFromProvider(stripePriceId: string): PriceVersion {
    const matched = findPriceByProviderPriceId(stripePriceId);
    if (!matched) {
      throw new ValidationError(
        `Provider price '${stripePriceId}' is not mapped to any approved local price version`,
      );
    }
    return matched;
  }

  // ── Subscription Management ─────────────────────────────────────────────────

  /**
   * Returns the organization's current active subscription with resolved plan details and limits.
   */
  async getCurrentSubscription(
    organizationId: string,
    tx?: any,
  ): Promise<SubscriptionWithDetails | null> {
    const sub = await this.repo.findCurrentSubscription(organizationId, tx);
    if (!sub) {
      return null;
    }

    const plan = this.getPlan(sub.planId);
    // priceVersionId in DB is the full PK (e.g. 'starter_month_v1'), look it up in the catalog
    const allPrices = plan.prices;
    const priceVersion = allPrices.find((p) => p.id === sub.priceVersionId);
    if (!priceVersion) {
      throw new NotFoundError(
        `Price version '${sub.priceVersionId}' for plan '${sub.planId}' is not found in the approved catalog`,
      );
    }

    return {
      subscription: sub,
      plan,
      priceVersion,
      limits: priceVersion.limits,
    };
  }

  /**
   * Creates a new authoritative subscription for an organization.
   * Enforces that local approved pricing and limits govern the subscription.
   * Deactivates any existing current subscription atomically to preserve 1-current invariant.
   */
  async createSubscription(
    params: CreateSubscriptionParams,
    tx?: any,
  ): Promise<SubscriptionWithDetails> {
    const {
      organizationId,
      planId,
      interval,
      priceVersionId = 'v1',
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      actorId,
    } = params;

    // Validate plan and price version exist in approved local catalog
    const plan = this.getPlan(planId);
    const priceVersion = this.getPriceVersion(planId, interval, priceVersionId);
    // Use the full PK id of the price version row (e.g. 'starter_month_v1'), not the version string ('v1')
    const resolvedPriceVersionId = priceVersion.id;

    // If a provider price ID is provided, verify it maps to the resolved price version
    if (stripePriceId && priceVersion.stripePriceId && stripePriceId !== priceVersion.stripePriceId) {
      throw new ValidationError(
        `Provider price ID '${stripePriceId}' does not match approved local price version for ${planId} (${interval})`,
      );
    }

    const runInTx = async (dbTx: any) => {
      // Deactivate any existing current subscription for this organization
      await this.repo.clearCurrentSubscription(organizationId, dbTx);

      const now = new Date();
      const periodEnd = new Date(now);
      if (interval === 'year') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const subscriptionId = randomUUID();
      const newSubData: NewSaasSubscription = {
        id: subscriptionId,
        organizationId,
        planId,
        priceVersionId: resolvedPriceVersionId,
        interval,
        status: 'ACTIVE',
        isCurrent: true,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        stripeCustomerId: stripeCustomerId ?? null,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        stripePriceId: priceVersion.stripePriceId ?? stripePriceId ?? null,
      };

      const created = await this.repo.createSubscription(newSubData, dbTx);

      // Record subscription change in history ledger
      await this.repo.recordHistory(
        {
          id: randomUUID(),
          subscriptionId: created.id,
          organizationId,
          action: 'CREATED',
          toPlanId: planId,
          toPriceVersionId: resolvedPriceVersionId,
          toStatus: 'ACTIVE',
          reason: 'Initial subscription creation',
        },
        dbTx,
      );

      // Record transactional audit log
      await auditService.log(
        {
          action: 'billing.subscription.created',
          entityType: 'saas_subscription',
          entityId: created.id,
          organizationId,
          userId: actorId ?? 'system',
          details: {
            planId,
            priceVersionId,
            interval,
            unitAmountCents: priceVersion.unitAmountCents,
            stripeSubscriptionId: stripeSubscriptionId ?? null,
          },
        },
        dbTx,
      );

      return {
        subscription: created,
        plan,
        priceVersion,
        limits: priceVersion.limits,
      };
    };

    if (tx) {
      return runInTx(tx);
    }

    const db = getDb();
    return db.transaction(runInTx);
  }

  /**
   * Changes the plan or billing interval of an active subscription.
   * Atomically archives the previous subscription and creates a new current subscription,
   * recording the transition in the historical ledger.
   */
  async changePlan(
    params: ChangePlanParams,
    tx?: any,
  ): Promise<SubscriptionWithDetails> {
    const {
      organizationId,
      newPlanId,
      newInterval,
      newPriceVersionId = 'v1',
      reason,
      actorId,
    } = params;

    const runInTx = async (dbTx: any) => {
      const current = await this.repo.findCurrentSubscription(organizationId, dbTx);
      if (!current) {
        throw new NotFoundError(
          `No active current subscription found for organization '${organizationId}'`,
        );
      }

      const targetInterval = newInterval ?? (current.interval as BillingInterval);
      const newPlan = this.getPlan(newPlanId);
      const newPriceVersion = this.getPriceVersion(
        newPlanId,
        targetInterval,
        newPriceVersionId,
      );
      // Resolve full PK of new price version (e.g. 'pro_month_v1'), not just version string
      const resolvedNewPriceVersionId = newPriceVersion.id;

      // Mark existing subscription as no longer current
      await this.repo.updateSubscription(
        current.id,
        {
          isCurrent: false,
          endedAt: new Date(),
        },
        dbTx,
      );

      const now = new Date();
      const periodEnd = new Date(now);
      if (targetInterval === 'year') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const newSubData: NewSaasSubscription = {
        id: randomUUID(),
        organizationId,
        planId: newPlanId,
        priceVersionId: resolvedNewPriceVersionId,
        interval: targetInterval,
        status: 'ACTIVE',
        isCurrent: true,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        stripeCustomerId: current.stripeCustomerId,
        stripeSubscriptionId: current.stripeSubscriptionId,
        stripePriceId: newPriceVersion.stripePriceId ?? null,
      };

      const created = await this.repo.createSubscription(newSubData, dbTx);

      // Record in subscription history
      await this.repo.recordHistory(
        {
          id: randomUUID(),
          subscriptionId: created.id,
          organizationId,
          action: 'PLAN_CHANGED',
          fromPlanId: current.planId,
          toPlanId: newPlanId,
          fromPriceVersionId: current.priceVersionId,
          toPriceVersionId: resolvedNewPriceVersionId,
          fromStatus: current.status,
          toStatus: 'ACTIVE',
          reason: reason ?? 'Plan changed',
        },
        dbTx,
      );

      // Audit log
      await auditService.log(
        {
          action: 'billing.subscription.plan_changed',
          entityType: 'saas_subscription',
          entityId: created.id,
          organizationId,
          userId: actorId ?? 'system',
          details: {
            fromPlanId: current.planId,
            toPlanId: newPlanId,
            fromPriceVersionId: current.priceVersionId,
            toPriceVersionId: newPriceVersionId,
            interval: targetInterval,
          },
        },
        dbTx,
      );

      return {
        subscription: created,
        plan: newPlan,
        priceVersion: newPriceVersion,
        limits: newPriceVersion.limits,
      };
    };

    if (tx) {
      return runInTx(tx);
    }

    const db = getDb();
    return db.transaction(runInTx);
  }

  /**
   * Retrieves subscription change history for an organization.
   */
  async getSubscriptionHistory(
    organizationId: string,
    tx?: any,
  ): Promise<SaasSubscriptionHistoryEntry[]> {
    return this.repo.listSubscriptionHistory(organizationId, tx);
  }

  /**
   * Resolves effective limits for an organization based on their current subscription.
   * If an organization is on grandfathered v1 pricing, it maintains v1 limits even if catalog changes.
   */
  async getEffectiveEntitlements(
    organizationId: string,
    tx?: any,
  ): Promise<PlanLimits | null> {
    const current = await this.getCurrentSubscription(organizationId, tx);
    if (!current) {
      return null;
    }
    return current.limits;
  }
}

export const catalogService = new CatalogService();
