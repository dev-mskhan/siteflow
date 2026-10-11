import Stripe from 'stripe';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getDb } from '../../../src/lib/db/index.js';
import { stripeAdapter } from '../../../src/modules/billing/stripe.adapter.js';
import { reconcileStripeWebhookEvent } from '../../../src/modules/billing/provider-reconciler.js';
import { createTestApp } from '../../helpers/test-app.js';
import {
  createOrgWithAdmin,
  createVerifiedUser,
} from '../../helpers/fixtures.js';

const WEBHOOK_SECRET = 'whsec_siteflow_test_fixture_only';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
}, 30_000);

afterAll(async () => {
  await app.close();
}, 30_000);

describe('SaaS invoice and payment-attempt persistence (10-08)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createMappedSubscription() {
    const { token } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, token);
    const customerId = `cus_invoice_${crypto.randomUUID()}`;
    const subscriptionId = `sub_invoice_${crypto.randomUUID()}`;
    await getDb().execute(sql`
    INSERT INTO app.saas_customers (id, organization_id, stripe_mode, stripe_customer_id)
    VALUES (${crypto.randomUUID()}, ${orgId}, 'test', ${customerId})
    `);
    await getDb().execute(sql`
    INSERT INTO app.saas_subscriptions (
      id, organization_id, plan_id, price_version_id, interval, status,
      is_current, current_period_start, current_period_end, cancel_at_period_end,
      stripe_customer_id, stripe_subscription_id, stripe_price_id
    ) VALUES (
      ${crypto.randomUUID()}, ${orgId}, 'professional', 'pro_month_v1', 'month',
      'ACTIVE', true, now(), now() + interval '30 days', false,
      ${customerId}, ${subscriptionId}, 'price_pro_month_v1'
    )
    `);
    return { organizationId: orgId, customerId, subscriptionId };
  }

  function makeInvoiceEvent(params: {
    eventId: string;
    invoiceId: string;
    customerId: string;
    subscriptionId: string;
    eventType: 'invoice.paid' | 'invoice.payment_failed';
    createdAt?: number;
  }): Stripe.Event {
    return {
    id: params.eventId,
    object: 'event',
    api_version: null,
    created: params.createdAt ?? Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: params.invoiceId,
        object: 'invoice',
        customer: params.customerId,
        subscription: params.subscriptionId,
        metadata: { organizationId: crypto.randomUUID() },
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: params.eventType,
    } as unknown as Stripe.Event;
  }

  function signedHeader(payload: Buffer): string {
    return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
    });
  }

  async function deliverInvoiceEvent(event: Stripe.Event) {
    const payload = Buffer.from(JSON.stringify(event), 'utf8');
    return app.inject({
    method: 'POST',
    url: '/api/v1/webhooks/stripe',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signedHeader(payload),
    },
    payload,
    });
  }

  async function reconcileInboxEvent(eventId: string) {
    const rows = await getDb().execute(sql`
      SELECT id, provider_event_id AS "providerEventId", event_type AS "eventType",
        event_created_at AS "eventCreatedAt", live_mode AS "liveMode",
        object_type AS "objectType", object_id AS "objectId",
        status, attempt_count AS "attemptCount"
      FROM app.saas_webhook_inbox
      WHERE provider = 'stripe' AND provider_event_id = ${eventId}
    `);
    const row = rows[0];
    if (!row) throw new Error('Delivered invoice webhook was not persisted');
    await reconcileStripeWebhookEvent({
      id: row.id as string,
      providerEventId: row.providerEventId as string,
      eventType: row.eventType as string,
      eventCreatedAt: row.eventCreatedAt as Date | string,
      liveMode: row.liveMode as boolean,
      objectType: row.objectType as string | null,
      objectId: row.objectId as string | null,
      status: row.status as string,
      attemptCount: row.attemptCount as number,
    });
    await getDb().execute(sql`
      UPDATE app.saas_webhook_inbox
      SET status = 'PROCESSED', processed_at = now()
      WHERE id = ${row.id as string} AND status = 'PENDING'
    `);
  }

  function stripeSubscriptionSnapshot(subscriptionId: string, customerId: string) {
    return {
    id: subscriptionId,
    customer: customerId,
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: 'price_pro_month_v1' } }] },
    } as unknown as Awaited<ReturnType<typeof stripeAdapter.retrieveSubscription>>;
  }

  function stripeInvoiceSnapshot(params: {
    invoiceId: string;
    customerId: string;
    subscriptionId: string;
    status: 'open' | 'paid';
    paid: boolean;
    amountPaid: number;
    attemptCount: number;
  }) {
    const now = Math.floor(Date.now() / 1000);
    return {
    id: params.invoiceId,
    customer: params.customerId,
    subscription: params.subscriptionId,
    status: params.status,
    amount_due: 1299,
    amount_paid: params.amountPaid,
    currency: 'usd',
    paid: params.paid,
    period_start: now - 30 * 24 * 60 * 60,
    period_end: now,
    number: 'SF-2026-0001',
    attempt_count: params.attemptCount,
    payment_intent: { id: `pi_${params.invoiceId}` },
    hosted_invoice_url: 'https://invoice.stripe.test/hosted',
    invoice_pdf: 'https://invoice.stripe.test/pdf',
    } as unknown as Awaited<ReturnType<typeof stripeAdapter.retrieveInvoice>>;
  }

  it('reconciles signed invoice events into tenant-scoped SaaS invoice and payment history', async () => {
    const schemaRows = await getDb().execute(sql`
    SELECT
      to_regclass('app.saas_invoices')::text AS "invoiceTable",
      to_regclass('app.saas_payment_attempts')::text AS "paymentAttemptTable"
    `);

    expect(schemaRows[0]?.invoiceTable).toBe('saas_invoices');
    expect(schemaRows[0]?.paymentAttemptTable).toBe('saas_payment_attempts');

    const { organizationId, customerId, subscriptionId } = await createMappedSubscription();
    const invoiceId = `in_invoice_${crypto.randomUUID()}`;
    const constructionInvoiceCount = await getDb().execute(sql`
    SELECT count(*)::int AS count FROM app.invoices
    WHERE organization_id = ${organizationId}
    `);
    let currentInvoice = stripeInvoiceSnapshot({
    invoiceId,
    customerId,
    subscriptionId,
    status: 'open',
    paid: false,
    amountPaid: 0,
    attemptCount: 1,
    });
    vi.spyOn(stripeAdapter, 'retrieveInvoice').mockImplementation(async () => currentInvoice);
    vi.spyOn(stripeAdapter, 'retrieveSubscription').mockResolvedValue(
    stripeSubscriptionSnapshot(subscriptionId, customerId),
    );

    const failedEvent = makeInvoiceEvent({
    eventId: `evt_invoice_failed_${crypto.randomUUID()}`,
    invoiceId,
    customerId,
    subscriptionId,
    eventType: 'invoice.payment_failed',
    });
    const firstDelivery = await deliverInvoiceEvent(failedEvent);
    const duplicateDelivery = await deliverInvoiceEvent(failedEvent);
    expect(firstDelivery.statusCode).toBe(200);
    expect(duplicateDelivery.statusCode).toBe(200);

    await reconcileInboxEvent(failedEvent.id);

    let invoices = await getDb().execute(sql`
    SELECT id, organization_id AS "organizationId", stripe_invoice_id AS "stripeInvoiceId",
      status, amount_due_cents AS "amountDueCents", amount_paid_cents AS "amountPaidCents",
      currency
    FROM app.saas_invoices
    WHERE organization_id = ${organizationId} AND stripe_invoice_id = ${invoiceId}
    `);
    let attempts = await getDb().execute(sql`
    SELECT organization_id AS "organizationId", attempt_number AS "attemptNumber",
      stripe_payment_intent_id AS "paymentIntentId", status,
      amount_cents AS "amountCents", currency
    FROM app.saas_payment_attempts
    WHERE organization_id = ${organizationId} AND stripe_invoice_id = ${invoiceId}
    ORDER BY attempt_number
    `);
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({
    organizationId,
    stripeInvoiceId: invoiceId,
    status: 'OPEN',
    amountDueCents: 1299,
    amountPaidCents: 0,
    currency: 'usd',
    });
    expect(attempts).toEqual([
    expect.objectContaining({
      organizationId,
      attemptNumber: 1,
      paymentIntentId: `pi_${invoiceId}`,
      status: 'FAILED',
      amountCents: 1299,
      currency: 'usd',
    }),
    ]);

    currentInvoice = stripeInvoiceSnapshot({
    invoiceId,
    customerId,
    subscriptionId,
    status: 'paid',
    paid: true,
    amountPaid: 1299,
    attemptCount: 2,
    });
    const paidEvent = makeInvoiceEvent({
    eventId: `evt_invoice_paid_${crypto.randomUUID()}`,
    invoiceId,
    customerId,
    subscriptionId,
    eventType: 'invoice.paid',
    createdAt: Math.floor(Date.now() / 1000) + 5,
    });
    expect((await deliverInvoiceEvent(paidEvent)).statusCode).toBe(200);
    await reconcileInboxEvent(paidEvent.id);

    const replay = makeInvoiceEvent({
    eventId: `evt_invoice_paid_replay_${crypto.randomUUID()}`,
    invoiceId,
    customerId,
    subscriptionId,
    eventType: 'invoice.paid',
    createdAt: Math.floor(Date.now() / 1000) + 10,
    });
    expect((await deliverInvoiceEvent(replay)).statusCode).toBe(200);
    await reconcileInboxEvent(replay.id);

    invoices = await getDb().execute(sql`
    SELECT id, organization_id AS "organizationId", stripe_invoice_id AS "stripeInvoiceId",
      status, amount_due_cents AS "amountDueCents", amount_paid_cents AS "amountPaidCents",
      currency
    FROM app.saas_invoices
    WHERE organization_id = ${organizationId} AND stripe_invoice_id = ${invoiceId}
    `);
    attempts = await getDb().execute(sql`
    SELECT organization_id AS "organizationId", attempt_number AS "attemptNumber",
      stripe_payment_intent_id AS "paymentIntentId", status,
      amount_cents AS "amountCents", currency
    FROM app.saas_payment_attempts
    WHERE organization_id = ${organizationId} AND stripe_invoice_id = ${invoiceId}
    ORDER BY attempt_number
    `);
    const constructionInvoiceCountAfter = await getDb().execute(sql`
    SELECT count(*)::int AS count FROM app.invoices
    WHERE organization_id = ${organizationId}
    `);

    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({
    organizationId,
    stripeInvoiceId: invoiceId,
    status: 'PAID',
    amountDueCents: 1299,
    amountPaidCents: 1299,
    currency: 'usd',
    });
    expect(attempts).toHaveLength(2);
    expect(attempts.map((attempt) => attempt.status)).toEqual(['FAILED', 'SUCCEEDED']);
    expect(constructionInvoiceCountAfter[0]?.count).toBe(constructionInvoiceCount[0]?.count);
  });
});
