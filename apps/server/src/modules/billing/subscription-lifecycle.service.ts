// apps/server/src/modules/billing/subscription-lifecycle.service.ts
// Phase 10 (Plan 10-18): policy-governed subscription lifecycle changes.
// Provider mutations run outside DB transactions with a stable idempotency key;
// local state, history, and audit are written atomically after the provider accepts the change.

import { randomUUID } from 'crypto';
import { getDb } from '../../lib/db/index.js';
import { auditService } from '../audit/audit.service.js';
import { catalogRepository } from './catalog.repository.js';
import { stripeAdapter } from './stripe.adapter.js';
import { NotFoundError, ValidationError } from '../auth/auth.errors.js';
import type { SaasSubscription } from '@siteflow/database/schema';

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
}

export const subscriptionLifecycleService = new SubscriptionLifecycleService();
