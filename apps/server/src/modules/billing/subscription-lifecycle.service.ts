// apps/server/src/modules/billing/subscription-lifecycle.service.ts
// Phase 10 (Plan 10-18): policy-governed subscription lifecycle changes.
// Provider mutations run outside DB transactions with a stable idempotency key;
// local state, history, and audit are written atomically after the provider accepts the change.

import { randomUUID } from 'crypto';
import { getDb } from '../../lib/db/index.js';
import { auditService } from '../audit/audit.service.js';
import { catalogRepository } from './catalog.repository.js';
import { stripeAdapter } from './stripe.adapter.js';
import { AuthError, NotFoundError, ValidationError } from '../auth/auth.errors.js';
import { getApprovedPrice, type BillingInterval, type PlanId } from '@siteflow/shared';
import type { SaasSubscription } from '@siteflow/database/schema';

export interface ChangeSubscriptionParams {
  organizationId: string;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface PlanChangeParams extends ChangeSubscriptionParams {
  planId: PlanId;
  interval?: BillingInterval;
}

export interface LifecycleOutcome {
  subscription: SaasSubscription;
  accessUntil: Date | null;
  idempotent: boolean;
}

function monthlyEquivalentCents(unitAmountCents: number, interval: string): number {
  return interval === 'year' ? unitAmountCents / 12 : unitAmountCents;
}

function firstItemId(snapshot: { items?: { data?: Array<{ id: string }> } }): string {
  const itemId = snapshot.items?.data?.[0]?.id;
  if (!itemId) {
    throw new ValidationError('Provider subscription has no item to change');
  }
  return itemId;
}

export interface ScheduleCancellationParams {
  organizationId: string;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ScheduleCancellationResult {
  subscription: SaasSubscription;
  accessUntil: Date | null;
  idempotent: boolean;
}

export class SubscriptionLifecycleService {
  async scheduleCancellation(
    params: ScheduleCancellationParams,
  ): Promise<ScheduleCancellationResult> {
    const { organizationId, actorUserId, ipAddress, userAgent } = params;

    const current = await catalogRepository.findCurrentSubscription(organizationId);
    if (!current) {
      throw new NotFoundError(`No current subscription for organization ${organizationId}`);
    }

    const accessUntil = current.currentPeriodEnd ?? null;

    if (current.cancelAtPeriodEnd) {
      return { subscription: current, accessUntil, idempotent: true };
    }

    if (!current.stripeSubscriptionId) {
      throw new ValidationError('Subscription has no provider reference and cannot be cancelled');
    }

    await stripeAdapter.updateSubscription(
      current.stripeSubscriptionId,
      { cancel_at_period_end: true },
      `saas-lifecycle:cancel:${current.id}`,
    );

    const db = getDb();
    const updated = await db.transaction(async (tx) => {
      const row = await catalogRepository.updateSubscription(
        current.id,
        { cancelAtPeriodEnd: true },
        tx,
      );

      await catalogRepository.recordHistory(
        {
          id: randomUUID(),
          subscriptionId: current.id,
          organizationId,
          action: 'cancel_scheduled',
          fromPlanId: current.planId,
          toPlanId: current.planId,
          fromPriceVersionId: current.priceVersionId,
          toPriceVersionId: current.priceVersionId,
          fromStatus: current.status,
          toStatus: current.status,
          reason: 'customer_requested_cancel_at_period_end',
          metadata: { accessUntil: accessUntil?.toISOString() ?? null },
        },
        tx,
      );

      await auditService.log(
        {
          organizationId,
          actorUserId,
          action: 'billing.subscription.cancel_scheduled',
          resourceType: 'saas_subscription',
          resourceId: current.id,
          metadata: { accessUntil: accessUntil?.toISOString() ?? null },
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
        tx,
      );

      return row;
    });

    return { subscription: updated, accessUntil, idempotent: false };
  }

  async scheduleDowngrade(params: PlanChangeParams): Promise<LifecycleOutcome> {
    const { organizationId, actorUserId, planId, ipAddress, userAgent } = params;
    const current = await this.requireCurrent(organizationId);
    const interval = params.interval ?? (current.interval as BillingInterval);
    const accessUntil = current.currentPeriodEnd ?? null;

    if (current.scheduledPlanId === planId) {
      return { subscription: current, accessUntil, idempotent: true };
    }
    if (current.cancelAtPeriodEnd) {
      throw new AuthError('A cancellation is scheduled; reactivate before changing plan', 'CANCEL_SCHEDULED', 409);
    }

    const currentPrice = getApprovedPrice(current.planId, current.interval as BillingInterval);
    const targetPrice = getApprovedPrice(planId, interval);
    if (targetPrice.unitAmountCents >= currentPrice.unitAmountCents) {
      throw new AuthError('Target plan is not a downgrade from the current plan', 'INVALID_PLAN_CHANGE', 409);
    }
    const stripeSubscriptionId = this.requireProviderRef(current);

    const snapshot = await stripeAdapter.retrieveSubscription(stripeSubscriptionId);
    const itemId = firstItemId(snapshot);
    await stripeAdapter.updateSubscription(
      stripeSubscriptionId,
      {
        items: [{ id: itemId, price: targetPrice.stripePriceId }],
        proration_behavior: 'none',
      },
      `saas-lifecycle:downgrade:${current.id}:${planId}:${interval}`,
    );

    const updated = await this.writeLocal({
      organizationId,
      actorUserId,
      current,
      data: { scheduledPlanId: planId },
      history: {
        action: 'downgrade_scheduled',
        toPlanId: current.planId,
        reason: 'customer_requested_downgrade',
        metadata: { targetPlanId: planId, interval, accessUntil: accessUntil?.toISOString() ?? null },
      },
      audit: 'billing.subscription.downgrade_scheduled',
      ipAddress,
      userAgent,
    });

    return { subscription: updated, accessUntil, idempotent: false };
  }

  async applyUpgrade(params: PlanChangeParams): Promise<LifecycleOutcome> {
    const { organizationId, actorUserId, planId, ipAddress, userAgent } = params;
    const current = await this.requireCurrent(organizationId);
    const interval = params.interval ?? (current.interval as BillingInterval);
    const accessUntil = current.currentPeriodEnd ?? null;

    if (current.cancelAtPeriodEnd) {
      throw new AuthError('A cancellation is scheduled; reactivate before upgrading', 'CANCEL_SCHEDULED', 409);
    }
    if (current.planId === planId && current.interval === interval && !current.scheduledPlanId) {
      return { subscription: current, accessUntil, idempotent: true };
    }

    const currentPrice = getApprovedPrice(current.planId, current.interval as BillingInterval);
    const targetPrice = getApprovedPrice(planId, interval);
    if (monthlyEquivalentCents(targetPrice.unitAmountCents, interval) <=
        monthlyEquivalentCents(currentPrice.unitAmountCents, current.interval)) {
      throw new AuthError('Target plan is not an upgrade from the current plan', 'INVALID_PLAN_CHANGE', 409);
    }
    const stripeSubscriptionId = this.requireProviderRef(current);

    const snapshot = await stripeAdapter.retrieveSubscription(stripeSubscriptionId);
    const itemId = firstItemId(snapshot);
    await stripeAdapter.updateSubscription(
      stripeSubscriptionId,
      {
        items: [{ id: itemId, price: targetPrice.stripePriceId }],
        proration_behavior: 'create_prorations',
      },
      `saas-lifecycle:upgrade:${current.id}:${planId}:${interval}`,
    );

    const db = getDb();
    const updated = await db.transaction(async (tx) => {
      const targetVersion = await catalogRepository.findPriceVersion(planId, interval, 'v1', tx);
      const row = await catalogRepository.updateSubscription(
        current.id,
        {
          planId,
          interval,
          priceVersionId: targetVersion?.id ?? current.priceVersionId,
          stripePriceId: targetPrice.stripePriceId,
          scheduledPlanId: null,
        },
        tx,
      );
      await catalogRepository.recordHistory(
        {
          id: randomUUID(),
          subscriptionId: current.id,
          organizationId,
          action: 'upgrade_applied',
          fromPlanId: current.planId,
          toPlanId: planId,
          fromPriceVersionId: current.priceVersionId,
          toPriceVersionId: targetVersion?.id ?? current.priceVersionId,
          fromStatus: current.status,
          toStatus: current.status,
          reason: 'customer_requested_upgrade',
          metadata: { interval, accessUntil: accessUntil?.toISOString() ?? null },
        },
        tx,
      );
      await auditService.log(
        {
          organizationId,
          actorUserId,
          action: 'billing.subscription.upgrade_applied',
          resourceType: 'saas_subscription',
          resourceId: current.id,
          metadata: { fromPlanId: current.planId, toPlanId: planId, interval },
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
        tx,
      );
      return row;
    });

    return { subscription: updated, accessUntil, idempotent: false };
  }

  pause(): never {
    throw new AuthError(
      'Pause is not supported (policy D-07: customer.subscription.paused is unsupported)',
      'LIFECYCLE_ACTION_NOT_SUPPORTED',
      409,
    );
  }

  async reactivate(params: ChangeSubscriptionParams): Promise<LifecycleOutcome> {
    const { organizationId, actorUserId, ipAddress, userAgent } = params;
    const current = await this.requireCurrent(organizationId);
    const accessUntil = current.currentPeriodEnd ?? null;

    if (current.status === 'CANCELED') {
      throw new AuthError('Subscription has ended; start a new checkout', 'CHECKOUT_REQUIRED', 409);
    }
    if (!current.cancelAtPeriodEnd) {
      return { subscription: current, accessUntil, idempotent: true };
    }
    const stripeSubscriptionId = this.requireProviderRef(current);

    await stripeAdapter.updateSubscription(
      stripeSubscriptionId,
      { cancel_at_period_end: false },
      `saas-lifecycle:reactivate:${current.id}`,
    );

    const updated = await this.writeLocal({
      organizationId,
      actorUserId,
      current,
      data: { cancelAtPeriodEnd: false },
      history: {
        action: 'cancel_reverted',
        toPlanId: current.planId,
        reason: 'customer_requested_reactivate',
        metadata: { accessUntil: accessUntil?.toISOString() ?? null },
      },
      audit: 'billing.subscription.cancel_reverted',
      ipAddress,
      userAgent,
    });

    return { subscription: updated, accessUntil, idempotent: false };
  }

  private async requireCurrent(organizationId: string): Promise<SaasSubscription> {
    const current = await catalogRepository.findCurrentSubscription(organizationId);
    if (!current) {
      throw new NotFoundError(`No current subscription for organization ${organizationId}`);
    }
    return current;
  }

  private requireProviderRef(current: SaasSubscription): string {
    if (!current.stripeSubscriptionId) {
      throw new ValidationError('Subscription has no provider reference');
    }
    return current.stripeSubscriptionId;
  }

  private async writeLocal(input: {
    organizationId: string;
    actorUserId: string;
    current: SaasSubscription;
    data: Partial<SaasSubscription>;
    history: {
      action: string;
      toPlanId: string;
      reason: string;
      metadata: Record<string, unknown>;
    };
    audit: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<SaasSubscription> {
    const { organizationId, actorUserId, current, data, history, audit, ipAddress, userAgent } = input;
    const db = getDb();
    return db.transaction(async (tx) => {
      const row = await catalogRepository.updateSubscription(current.id, data as any, tx);
      await catalogRepository.recordHistory(
        {
          id: randomUUID(),
          subscriptionId: current.id,
          organizationId,
          action: history.action,
          fromPlanId: current.planId,
          toPlanId: history.toPlanId,
          fromPriceVersionId: current.priceVersionId,
          toPriceVersionId: current.priceVersionId,
          fromStatus: current.status,
          toStatus: current.status,
          reason: history.reason,
          metadata: history.metadata,
        },
        tx,
      );
      await auditService.log(
        {
          organizationId,
          actorUserId,
          action: audit,
          resourceType: 'saas_subscription',
          resourceId: current.id,
          metadata: history.metadata,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
        tx,
      );
      return row;
    });
  }
}

export const subscriptionLifecycleService = new SubscriptionLifecycleService();
