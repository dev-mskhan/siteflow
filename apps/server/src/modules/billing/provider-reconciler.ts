import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { saasCustomers, saasInvoices, saasSubscriptions } from '@siteflow/database/schema';
import { createLogger } from '@siteflow/observability/server';
import { serverEnv } from '../../config/env.js';
import { getDb } from '../../lib/db/index.js';
import { writeOutboxEvent } from '../../lib/outbox/outbox.service.js';
import { auditService } from '../audit/audit.service.js';
import { catalogRepository } from './catalog.repository.js';
import { catalogService } from './catalog.service.js';
import { customerRepository } from './customer.repository.js';
import {
  invoiceService,
  SaaSInvoiceIdentityConflictError,
  type SaaSInvoiceStatus,
} from './invoice.service.js';
import {
  refundHistoryRepository,
  RefundFactVerificationError,
  type RefundStatus,
} from './refund-history.repository.js';
import {
  StripeProviderError,
  stripeAdapter,
  type StripeInvoiceSnapshot,
  type StripeSubscriptionSnapshot,
} from './stripe.adapter.js';
import type { ClaimedStripeWebhookEvent } from './webhook-inbox.repository.js';

const logger = createLogger({ name: 'stripe-provider-reconciler' });

export class StripeWebhookQuarantineError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'StripeWebhookQuarantineError';
  }
}

interface ProviderSubscriptionFacts {
  subscription: StripeSubscriptionSnapshot;
  customerId: string;
  invoice?: StripeInvoiceSnapshot;
}

function providerId(value: string | { id: string } | null | undefined): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value.id === 'string') return value.id;
  return null;
}

function providerStatus(
  status: StripeSubscriptionSnapshot['status'],
): 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' {
  switch (status) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    case 'unpaid':
      return 'UNPAID';
    default:
      throw new StripeWebhookQuarantineError('UNSUPPORTED_SUBSCRIPTION_STATUS');
  }
}

function eventDate(value: Date | string): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new StripeWebhookQuarantineError('INVALID_EVENT_TIMESTAMP');
  }
  return parsed;
}

function reconciledEventTimestamp(metadata: unknown): number | null {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    !('stripeLastReconciledEventCreatedAt' in metadata)
  ) {
    return null;
  }
  const value = metadata.stripeLastReconciledEventCreatedAt;
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function metadataWithReconciledEvent(metadata: unknown, timestamp: Date): Record<string, unknown> {
  const currentMetadata =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : metadata === null || metadata === undefined
        ? {}
        : { previousMetadata: metadata };
  return {
    ...currentMetadata,
    stripeLastReconciledEventCreatedAt: timestamp.toISOString(),
  };
}

function providerFacts(
  subscription: StripeSubscriptionSnapshot,
  expectedSubscriptionId: string,
): ProviderSubscriptionFacts {
  if (subscription.id !== expectedSubscriptionId) {
    throw new StripeWebhookQuarantineError('PROVIDER_SUBSCRIPTION_ID_MISMATCH');
  }
  const customerId = providerId(subscription.customer);
  const item = subscription.items.data[0];
  const price = item?.price;
  const priceId = typeof price === 'string' ? price : price?.id;
  if (!customerId || !priceId || subscription.items.data.length !== 1) {
    throw new StripeWebhookQuarantineError('INVALID_SUBSCRIPTION_FACTS');
  }
  if (
    !Number.isSafeInteger(subscription.current_period_start) ||
    !Number.isSafeInteger(subscription.current_period_end) ||
    subscription.current_period_end <= subscription.current_period_start
  ) {
    throw new StripeWebhookQuarantineError('INVALID_SUBSCRIPTION_PERIOD');
  }
  return { subscription, customerId };
}

async function retrieveCurrentSubscription(
  event: ClaimedStripeWebhookEvent,
): Promise<ProviderSubscriptionFacts> {
  if (!event.objectId) {
    throw new StripeWebhookQuarantineError('MISSING_PROVIDER_OBJECT_ID');
  }

  if (event.objectType === 'subscription') {
    return providerFacts(
      await stripeAdapter.retrieveSubscription(event.objectId),
      event.objectId,
    );
  }

  if (event.objectType !== 'invoice') {
    throw new StripeWebhookQuarantineError('UNSUPPORTED_PROVIDER_OBJECT_TYPE');
  }

  const invoice: StripeInvoiceSnapshot = await stripeAdapter.retrieveInvoice(event.objectId);
  if (invoice.id !== event.objectId) {
    throw new StripeWebhookQuarantineError('PROVIDER_INVOICE_ID_MISMATCH');
  }
  const subscriptionId = providerId(invoice.subscription);
  const invoiceCustomerId = providerId(invoice.customer);
  if (!subscriptionId || !invoiceCustomerId) {
    throw new StripeWebhookQuarantineError('INVOICE_NOT_LINKED_TO_SUBSCRIPTION');
  }
  const facts = providerFacts(
    await stripeAdapter.retrieveSubscription(subscriptionId),
    subscriptionId,
  );
  if (facts.customerId !== invoiceCustomerId) {
    throw new StripeWebhookQuarantineError('INVOICE_CUSTOMER_MISMATCH');
  }
  return { ...facts, invoice };
}

function providerInvoiceStatus(status: StripeInvoiceSnapshot['status']): SaaSInvoiceStatus {
  switch (status) {
    case 'draft':
      return 'DRAFT';
    case 'open':
      return 'OPEN';
    case 'paid':
      return 'PAID';
    case 'uncollectible':
      return 'UNCOLLECTIBLE';
    case 'void':
      return 'VOID';
    default:
      throw new StripeWebhookQuarantineError('UNSUPPORTED_INVOICE_STATUS');
  }
}

function providerPaymentIntentId(
  paymentIntent: StripeInvoiceSnapshot['payment_intent'],
): string | null {
  return providerId(paymentIntent);
}

/**
 * Fetch Stripe's current object before opening a PostgreSQL transaction. Event
 * snapshots are intentionally ignored: an old webhook can never roll local
 * state back to an obsolete provider value.
 */
export async function reconcileStripeWebhookEvent(
  event: ClaimedStripeWebhookEvent,
): Promise<void> {
  const expectedLiveMode = serverEnv.STRIPE_MODE === 'live';
  if (event.liveMode !== expectedLiveMode) {
    throw new StripeWebhookQuarantineError('STRIPE_MODE_MISMATCH');
  }

  const facts = await retrieveCurrentSubscription(event);
  const stripeMode = event.liveMode ? 'live' : 'test';
  const customer = await customerRepository.findByStripeCustomer(
    facts.customerId,
    stripeMode,
  );
  if (!customer) {
    throw new StripeWebhookQuarantineError('CUSTOMER_ASSOCIATION_NOT_FOUND');
  }

  const priceId = facts.subscription.items.data[0]?.price;
  const stripePriceId = typeof priceId === 'string' ? priceId : priceId?.id;
  if (!stripePriceId) {
    throw new StripeWebhookQuarantineError('SUBSCRIPTION_PRICE_NOT_FOUND');
  }
  let price;
  try {
    price = catalogService.resolvePriceFromProvider(stripePriceId);
  } catch {
    throw new StripeWebhookQuarantineError('SUBSCRIPTION_PRICE_NOT_MAPPED');
  }

  const next = {
    planId: price.planId,
    priceVersionId: price.id,
    interval: price.interval,
    status: providerStatus(facts.subscription.status),
    currentPeriodStart: new Date(facts.subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(facts.subscription.current_period_end * 1000),
    cancelAtPeriodEnd: facts.subscription.cancel_at_period_end,
    stripeCustomerId: facts.customerId,
    stripeSubscriptionId: facts.subscription.id,
    stripePriceId,
  };
  const receivedEventDate = eventDate(event.eventCreatedAt);

  await getDb().transaction(async (tx) => {
    // Serialize provider reconciliation per persisted SiteFlow customer. The
    // lock is held only for local reads/writes, never while calling Stripe.
    const lockedCustomer = await tx
      .select({ id: saasCustomers.id })
      .from(saasCustomers)
      .where(
        and(
          eq(saasCustomers.id, customer.id),
          eq(saasCustomers.organizationId, customer.organizationId),
          eq(saasCustomers.stripeMode, stripeMode),
          eq(saasCustomers.stripeCustomerId, facts.customerId),
        ),
      )
      .for('update')
      .limit(1);
    if (!lockedCustomer[0]) {
      throw new StripeWebhookQuarantineError('CUSTOMER_ASSOCIATION_CHANGED');
    }

    const currentRows = await tx
      .select()
      .from(saasSubscriptions)
      .where(
        and(
          eq(saasSubscriptions.organizationId, customer.organizationId),
          eq(saasSubscriptions.isCurrent, true),
        ),
      )
      .for('update')
      .limit(1);
    let current = currentRows[0];

    const associationRows = await tx
      .select()
      .from(saasSubscriptions)
      .where(eq(saasSubscriptions.stripeSubscriptionId, facts.subscription.id))
      .for('update')
      .limit(1);
    const existingAssociation = associationRows[0];
    if (
      existingAssociation &&
      (existingAssociation.organizationId !== customer.organizationId ||
        existingAssociation.stripeCustomerId !== facts.customerId)
    ) {
      throw new StripeWebhookQuarantineError('SUBSCRIPTION_ASSOCIATION_MISMATCH');
    }
    if (existingAssociation && !existingAssociation.isCurrent) {
      throw new StripeWebhookQuarantineError('SUBSCRIPTION_ASSOCIATION_NOT_CURRENT');
    }
    if (
      current &&
      current.stripeSubscriptionId &&
      current.stripeSubscriptionId !== facts.subscription.id
    ) {
      throw new StripeWebhookQuarantineError('CURRENT_SUBSCRIPTION_CONFLICT');
    }
    if (
      current?.stripeCustomerId &&
      current.stripeCustomerId !== facts.customerId
    ) {
      throw new StripeWebhookQuarantineError('SUBSCRIPTION_CUSTOMER_MISMATCH');
    }
    if (existingAssociation && current?.id !== existingAssociation.id) {
      throw new StripeWebhookQuarantineError('CURRENT_SUBSCRIPTION_CONFLICT');
    }

    // Reject stale deliveries before synchronizing any associated invoice
    // facts. Invoice and subscription state share the event-time high-water
    // mark; applying the invoice first would allow an old event to regress it.
    if (
      current &&
      (reconciledEventTimestamp(current.metadata) ?? Number.NEGATIVE_INFINITY) >
        receivedEventDate.getTime()
    ) {
      return;
    }

    if (facts.invoice) {
      const invoiceSubscriptionId = providerId(facts.invoice.subscription);
      const invoiceCustomerId = providerId(facts.invoice.customer);
      if (
        facts.invoice.id !== event.objectId ||
        invoiceSubscriptionId !== facts.subscription.id ||
        invoiceCustomerId !== facts.customerId
      ) {
        throw new StripeWebhookQuarantineError('INVOICE_ASSOCIATION_MISMATCH');
      }
      if (
        !Number.isSafeInteger(facts.invoice.amount_due) ||
        facts.invoice.amount_due < 0 ||
        !Number.isSafeInteger(facts.invoice.amount_paid) ||
        facts.invoice.amount_paid < 0 ||
        !Number.isSafeInteger(facts.invoice.attempt_count) ||
        facts.invoice.attempt_count < 0 ||
        !Number.isSafeInteger(facts.invoice.period_start) ||
        !Number.isSafeInteger(facts.invoice.period_end) ||
        facts.invoice.period_end < facts.invoice.period_start ||
        !/^[a-z]{3}$/.test(facts.invoice.currency)
      ) {
        throw new StripeWebhookQuarantineError('INVALID_INVOICE_FACTS');
      }

      const paymentIntentId = providerPaymentIntentId(facts.invoice.payment_intent);
      const paymentAttempt =
        paymentIntentId && facts.invoice.attempt_count > 0
          ? {
              stripePaymentIntentId: paymentIntentId,
              attemptNumber: facts.invoice.attempt_count,
              status: facts.invoice.paid ? ('SUCCEEDED' as const) : ('FAILED' as const),
              amountCents: facts.invoice.paid
                ? facts.invoice.amount_paid
                : facts.invoice.amount_due,
            }
          : undefined;

      try {
        await invoiceService.synchronizeVerifiedInvoice(
          {
            organizationId: customer.organizationId,
            stripeMode,
            stripeInvoiceId: facts.invoice.id,
            stripeCustomerId: facts.customerId,
            stripeSubscriptionId: facts.subscription.id,
            invoiceNumber: facts.invoice.number,
            status: providerInvoiceStatus(facts.invoice.status),
            amountDueCents: facts.invoice.amount_due,
            amountPaidCents: facts.invoice.amount_paid,
            currency: facts.invoice.currency,
            periodStart: new Date(facts.invoice.period_start * 1000),
            periodEnd: new Date(facts.invoice.period_end * 1000),
            hostedInvoiceUrl: facts.invoice.hosted_invoice_url ?? null,
            invoicePdfUrl: facts.invoice.invoice_pdf ?? null,
            providerEventCreatedAt: receivedEventDate,
            paymentAttempt,
          },
          tx,
        );
      } catch (error) {
        if (error instanceof SaaSInvoiceIdentityConflictError) {
          throw new StripeWebhookQuarantineError(error.code);
        }
        throw error;
      }
    }

    const previous = current;
    const previousGraceStartsAt = current?.graceStartsAt ?? null;
    const graceStartsAt =
      next.status === 'PAST_DUE'
        ? current?.status === 'PAST_DUE' && current.graceStartsAt
          ? current.graceStartsAt
          : receivedEventDate
        : null;
    const reconciledNext = { ...next, graceStartsAt };
    const updatedMetadata = metadataWithReconciledEvent(
      current?.metadata,
      receivedEventDate,
    );
    if (!current) {
      const created = await tx
        .insert(saasSubscriptions)
        .values({
          id: randomUUID(),
          organizationId: customer.organizationId,
          planId: reconciledNext.planId,
          priceVersionId: reconciledNext.priceVersionId,
          interval: reconciledNext.interval,
          status: reconciledNext.status,
          graceStartsAt: reconciledNext.graceStartsAt,
          isCurrent: true,
          currentPeriodStart: next.currentPeriodStart,
          currentPeriodEnd: next.currentPeriodEnd,
          cancelAtPeriodEnd: next.cancelAtPeriodEnd,
          stripeCustomerId: next.stripeCustomerId,
          stripeSubscriptionId: next.stripeSubscriptionId,
          stripePriceId: next.stripePriceId,
          metadata: updatedMetadata,
        })
        .returning();
      current = created[0];
      if (!current) throw new Error('Provider subscription insert returned no row');
    } else {
      const unchanged =
        current.planId === reconciledNext.planId &&
        current.priceVersionId === reconciledNext.priceVersionId &&
        current.interval === reconciledNext.interval &&
        current.status === reconciledNext.status &&
        current.graceStartsAt?.getTime() === reconciledNext.graceStartsAt?.getTime() &&
        current.currentPeriodStart.getTime() === reconciledNext.currentPeriodStart.getTime() &&
        current.currentPeriodEnd.getTime() === reconciledNext.currentPeriodEnd.getTime() &&
        current.cancelAtPeriodEnd === reconciledNext.cancelAtPeriodEnd &&
        current.stripeCustomerId === reconciledNext.stripeCustomerId &&
        current.stripeSubscriptionId === reconciledNext.stripeSubscriptionId &&
        current.stripePriceId === reconciledNext.stripePriceId;
      if (unchanged) {
        await tx
          .update(saasSubscriptions)
          .set({ metadata: updatedMetadata, updatedAt: new Date() })
          .where(
            and(
              eq(saasSubscriptions.id, current.id),
              eq(saasSubscriptions.organizationId, customer.organizationId),
              eq(saasSubscriptions.isCurrent, true),
            ),
          );
        return;
      }

      const updated = await tx
        .update(saasSubscriptions)
        .set({ ...reconciledNext, metadata: updatedMetadata, updatedAt: new Date() })
        .where(
          and(
            eq(saasSubscriptions.id, current.id),
            eq(saasSubscriptions.organizationId, customer.organizationId),
            eq(saasSubscriptions.isCurrent, true),
          ),
        )
        .returning();
      current = updated[0];
      if (!current) throw new Error('Tenant-qualified subscription update returned no row');
    }

    await catalogRepository.recordHistory(
      {
        id: randomUUID(),
        subscriptionId: current.id,
        organizationId: customer.organizationId,
        action: 'PROVIDER_RECONCILED',
        fromPlanId: previous?.planId ?? null,
        toPlanId: current.planId,
        fromPriceVersionId: previous?.priceVersionId ?? null,
        toPriceVersionId: current.priceVersionId,
        fromStatus: previous?.status ?? null,
        toStatus: current.status,
        reason: `Stripe current object reconciled (${event.eventType})`,
      },
      tx,
    );
    await auditService.log(
      {
        organizationId: customer.organizationId,
        actorUserId: null,
        action: 'billing.subscription.provider_reconciled',
        resourceType: 'SaaSSubscription',
        resourceId: current.id,
        metadata: {
          providerEventId: event.providerEventId,
          providerObjectId: facts.subscription.id,
          fromStatus: previous?.status ?? null,
          toStatus: current.status,
        },
        ipAddress: null,
        userAgent: null,
      },
      tx,
    );
    const providerEventId = event.providerEventId;
    if (!previous || previous.status !== current.status) {
      await writeOutboxEvent(
        tx,
        'billing.subscription.status_changed',
        {
          id: `${providerEventId}:billing.subscription.status_changed`,
          organizationId: customer.organizationId,
          subscriptionId: current.id,
          fromStatus: previous?.status ?? null,
          toStatus: current.status,
          providerEventId,
        },
        customer.organizationId,
      );
    }
    if (!previous || previous.planId !== current.planId || previous.priceVersionId !== current.priceVersionId) {
      await writeOutboxEvent(
        tx,
        'billing.entitlement.changed',
        {
          id: `${providerEventId}:billing.entitlement.changed`,
          organizationId: customer.organizationId,
          subscriptionId: current.id,
          fromPlanId: previous?.planId ?? null,
          toPlanId: current.planId,
          providerEventId,
        },
        customer.organizationId,
      );
    }
    if (previous?.status !== 'PAST_DUE' && current.status === 'PAST_DUE') {
      await writeOutboxEvent(
        tx,
        'billing.grace.started',
        {
          id: `${providerEventId}:billing.grace.started`,
          organizationId: customer.organizationId,
          subscriptionId: current.id,
          graceStartsAt: current.graceStartsAt?.toISOString() ?? null,
          providerEventId,
        },
        customer.organizationId,
      );
    } else if (previous?.status === 'PAST_DUE' && current.status !== 'PAST_DUE') {
      await writeOutboxEvent(
        tx,
        'billing.grace.ended',
        {
          id: `${providerEventId}:billing.grace.ended`,
          organizationId: customer.organizationId,
          subscriptionId: current.id,
          graceStartsAt: previousGraceStartsAt?.toISOString() ?? null,
          providerEventId,
        },
        customer.organizationId,
      );
    }
  });
}

export interface VerifiedProviderRefundFact {
  stripeMode: 'test' | 'live';
  stripeRefundId: string;
  stripeInvoiceId: string;
  stripeCustomerId: string;
  sourceEventId: string;
  amountCents: number;
  currency: string;
  status: RefundStatus;
  providerEventCreatedAt: Date;
}

/**
 * Persist an already-verified provider refund fact as SaaS financial history.
 * The tenant comes from the stored customer association, never from provider metadata.
 * Refund facts never change subscription or entitlement state.
 */
export async function reconcileVerifiedRefundFact(
  fact: VerifiedProviderRefundFact,
): Promise<void> {
  const customer = await customerRepository.findByStripeCustomer(
    fact.stripeCustomerId,
    fact.stripeMode,
  );
  if (!customer) {
    throw new StripeWebhookQuarantineError('CUSTOMER_ASSOCIATION_NOT_FOUND');
  }

  try {
    await getDb().transaction(async (tx) => {
      const invoiceRows = await tx
        .select({ id: saasInvoices.id })
        .from(saasInvoices)
        .where(
          and(
            eq(saasInvoices.organizationId, customer.organizationId),
            eq(saasInvoices.stripeMode, fact.stripeMode),
            eq(saasInvoices.stripeInvoiceId, fact.stripeInvoiceId),
          ),
        )
        .limit(1);
      const invoice = invoiceRows[0];
      if (!invoice) {
        throw new StripeWebhookQuarantineError('REFUND_INVOICE_NOT_FOUND');
      }

      await refundHistoryRepository.recordVerifiedRefund(
        {
          organizationId: customer.organizationId,
          saasInvoiceId: invoice.id,
          stripeMode: fact.stripeMode,
          stripeRefundId: fact.stripeRefundId,
          stripeInvoiceId: fact.stripeInvoiceId,
          stripeCustomerId: fact.stripeCustomerId,
          sourceEventId: fact.sourceEventId,
          amountCents: fact.amountCents,
          currency: fact.currency,
          status: fact.status,
          providerEventCreatedAt: fact.providerEventCreatedAt,
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof RefundFactVerificationError) {
      throw new StripeWebhookQuarantineError(error.code);
    }
    throw error;
  }
}

export function getStripeWebhookReconciliationErrorCode(error: unknown): string {
  if (error instanceof StripeWebhookQuarantineError) return error.code;
  if (error instanceof StripeProviderError) return 'STRIPE_PROVIDER_UNAVAILABLE';
  logger.error(
    { errorName: error instanceof Error ? error.name : 'UnknownError' },
    'Stripe webhook reconciliation failed',
  );
  return 'RECONCILIATION_FAILED';
}
