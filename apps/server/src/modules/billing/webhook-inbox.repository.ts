import { saasWebhookInbox } from '@siteflow/database/schema';
import type Stripe from 'stripe';
import { getDb } from '../../lib/db/index.js';

const EXPECTED_OBJECT_TYPE: Record<string, 'subscription' | 'invoice'> = {
  'customer.subscription.created': 'subscription',
  'customer.subscription.updated': 'subscription',
  'customer.subscription.deleted': 'subscription',
  'invoice.paid': 'invoice',
  'invoice.payment_failed': 'invoice',
};

export function getSupportedStripeObjectType(
  eventType: string,
): 'subscription' | 'invoice' | undefined {
  return EXPECTED_OBJECT_TYPE[eventType];
}

/**
 * Inserts only a bounded provider reference. Raw webhook bodies, metadata, and
 * organization identifiers are intentionally excluded from the inbound ledger.
 */
export async function recordVerifiedStripeEvent(
  event: Stripe.Event,
): Promise<'inserted' | 'duplicate'> {
  const eventObject = event.data.object;
  const objectType =
    eventObject &&
    typeof eventObject === 'object' &&
    'object' in eventObject &&
    typeof eventObject.object === 'string'
      ? eventObject.object
      : null;
  const objectId =
    eventObject &&
    typeof eventObject === 'object' &&
    'id' in eventObject &&
    typeof eventObject.id === 'string'
      ? eventObject.id
      : null;

  const inserted = await getDb()
    .insert(saasWebhookInbox)
    .values({
      id: crypto.randomUUID(),
      provider: 'stripe',
      providerEventId: event.id,
      eventType: event.type,
      eventCreatedAt: new Date(event.created * 1000),
      liveMode: event.livemode,
      objectType,
      objectId,
      status: 'PENDING',
      attemptCount: 0,
      nextAttemptAt: new Date(),
    })
    .onConflictDoNothing({
      target: [saasWebhookInbox.provider, saasWebhookInbox.providerEventId],
    })
    .returning({ id: saasWebhookInbox.id });

  return inserted.length === 0 ? 'duplicate' : 'inserted';
}
