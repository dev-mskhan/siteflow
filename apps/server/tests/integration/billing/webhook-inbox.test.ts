import Stripe from 'stripe';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type PgBoss from 'pg-boss';
import { getDb } from '../../../src/lib/db/index.js';
import { stripeAdapter } from '../../../src/modules/billing/stripe.adapter.js';
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

function makeEvent(eventId = `evt_siteflow_${crypto.randomUUID().replaceAll('-', '')}`) {
  return {
    id: eventId,
    object: 'event',
    api_version: null,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `sub_siteflow_${crypto.randomUUID().replaceAll('-', '')}`,
        object: 'subscription',
        customer: `cus_siteflow_${crypto.randomUUID().replaceAll('-', '')}`,
        metadata: { organizationId: crypto.randomUUID() },
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: 'customer.subscription.updated',
  } satisfies Stripe.Event;
}

function signedHeader(payload: Buffer): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
}

async function deliver(payload: Buffer, signature?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/webhooks/stripe',
    headers: {
      'content-type': 'application/json',
      ...(signature ? { 'stripe-signature': signature } : {}),
    },
    payload,
  });
}

async function findInboxRows(eventId: string) {
  return getDb().execute(sql`
    SELECT provider_event_id AS "providerEventId",
      status,
      attempt_count AS "attemptCount",
      next_attempt_at AS "nextAttemptAt",
      last_error_code AS "lastErrorCode"
    FROM app.saas_webhook_inbox
    WHERE provider = 'stripe' AND provider_event_id = ${eventId}
  `);
}

describe('Stripe webhook durable inbox (10-07)', () => {
  it('accepts an event signed over the exact original raw bytes and persists it before acknowledgement', async () => {
    const event = makeEvent();
    const eventId = event.id;
    const rawBody = Buffer.from(`{\n  "id": "${event.id}",\n  "object": "${event.object}",\n  "api_version": null,\n  "created": ${event.created},\n  "data": ${JSON.stringify(event.data)},\n  "livemode": false,\n  "pending_webhooks": 1,\n  "request": null,\n  "type": "${event.type}"\n}\n`, 'utf8');

    const response = await deliver(rawBody, signedHeader(rawBody));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    expect(response.body).not.toContain(WEBHOOK_SECRET);
    expect(response.body).not.toContain(rawBody.toString('utf8'));

    const rows = await findInboxRows(eventId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      providerEventId: eventId,
      status: 'PENDING',
      attemptCount: 0,
    });
    expect(Number.isFinite(new Date(rows[0]!.nextAttemptAt).getTime())).toBe(true);
  });

  it('rejects a delivery with no Stripe-Signature before persisting an inbox event', async () => {
    const event = makeEvent();
    const payload = Buffer.from(JSON.stringify(event), 'utf8');

    const response = await deliver(payload);

    expect(response.statusCode).toBe(400);
    expect(await findInboxRows(event.id)).toHaveLength(0);
  });

  it('rejects an invalid Stripe signature before persisting an inbox event', async () => {
    const event = makeEvent();
    const payload = Buffer.from(JSON.stringify(event), 'utf8');

    const response = await deliver(payload, 't=1,v1=invalid');

    expect(response.statusCode).toBe(400);
    expect(await findInboxRows(event.id)).toHaveLength(0);
  });

  it('rejects a request whose raw bytes differ from the signed payload', async () => {
    const event = makeEvent();
    const signedPayload = Buffer.from(JSON.stringify(event), 'utf8');
    const alteredPayload = Buffer.concat([signedPayload, Buffer.from(' ', 'utf8')]);

    const response = await deliver(alteredPayload, signedHeader(signedPayload));

    expect(response.statusCode).toBe(400);
    expect(await findInboxRows(event.id)).toHaveLength(0);
  });

  it('acknowledges duplicate event IDs without duplicating or terminating retryable state', async () => {
    const event = makeEvent();
    const payload = Buffer.from(JSON.stringify(event), 'utf8');
    const signature = signedHeader(payload);

    const first = await deliver(payload, signature);
    expect(first.statusCode).toBe(200);

    const initialRows = await findInboxRows(event.id);
    expect(initialRows).toHaveLength(1);

    const retryAt = new Date(Date.now() + 60_000);
    await getDb().execute(sql`
      UPDATE app.saas_webhook_inbox
      SET status = 'RETRY', attempt_count = 2,
        next_attempt_at = ${retryAt.toISOString()}::timestamptz
      WHERE provider = 'stripe' AND provider_event_id = ${event.id}
    `);

    const duplicate = await deliver(payload, signature);
    const rows = await findInboxRows(event.id);

    expect(duplicate.statusCode).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'RETRY', attemptCount: 2 });
    expect(new Date(rows[0]!.nextAttemptAt).getTime()).toBe(retryAt.getTime());
  });

  it('acknowledges signed but unsupported event types without storing them', async () => {
    const event = { ...makeEvent(), type: 'customer.created' as Stripe.Event.Type };
    const payload = Buffer.from(JSON.stringify(event), 'utf8');

    const response = await deliver(payload, signedHeader(payload));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    expect(await findInboxRows(event.id)).toHaveLength(0);
  });

  it('publishes the unauthenticated Stripe endpoint and signature header in OpenAPI', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const operation = response.json().paths['/api/v1/webhooks/stripe'].post;
    expect(operation.summary).toContain('Stripe webhook');
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'stripe-signature',
          in: 'header',
          required: true,
        }),
      ]),
    );
  });
});

describe('Stripe webhook recovery and reconciliation (10-14)', () => {
  async function createOrganization() {
    const { token } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, token);
    return orgId;
  }

  async function loadRecoveryWorker() {
    const worker = await import('../../../src/modules/billing/webhook.worker.js')
      .catch((error: unknown) => {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ERR_MODULE_NOT_FOUND'
        ) {
          return undefined;
        }
        throw error;
      });
    expect(worker).toBeDefined();
    return worker;
  }

  async function insertPendingEvent(params: {
    eventId?: string;
    objectId: string;
    objectType?: 'subscription' | 'invoice';
    status?: 'PENDING' | 'RETRY' | 'PROCESSING';
    nextAttemptAt?: Date;
    eventCreatedAt?: Date;
    metadata?: Record<string, string>;
  }) {
    const eventId = params.eventId ?? `evt_recovery_${crypto.randomUUID()}`;
    const payload = Buffer.from(
      JSON.stringify({
        ...makeEvent(eventId),
        created: Math.floor((params.eventCreatedAt ?? new Date()).getTime() / 1000),
        data: {
          object: {
            id: params.objectId,
            object: params.objectType ?? 'subscription',
            customer: `cus_recovery_${eventId}`,
            metadata: params.metadata ?? {},
          },
        },
      }),
      'utf8',
    );
    const event = JSON.parse(payload.toString('utf8')) as Stripe.Event;
    const response = await deliver(payload, signedHeader(payload));
    expect(response.statusCode).toBe(200);
    if (params.status && params.status !== 'PENDING') {
      await getDb().execute(sql`
        UPDATE app.saas_webhook_inbox
        SET status = ${params.status},
            attempt_count = CASE WHEN ${params.status} = 'PROCESSING' THEN 1 ELSE attempt_count END,
            next_attempt_at = ${params.nextAttemptAt?.toISOString() ?? new Date(0).toISOString()}::timestamptz
        WHERE provider = 'stripe' AND provider_event_id = ${eventId}
      `);
    } else if (params.nextAttemptAt) {
      await getDb().execute(sql`
        UPDATE app.saas_webhook_inbox
        SET next_attempt_at = ${params.nextAttemptAt.toISOString()}::timestamptz
        WHERE provider = 'stripe' AND provider_event_id = ${eventId}
      `);
    }
    return event;
  }

  async function findSubscription(subscriptionId: string) {
    const rows = await getDb().execute(sql`
      SELECT id, organization_id AS "organizationId", plan_id AS "planId",
        status, is_current AS "isCurrent", current_period_start AS "periodStart",
        current_period_end AS "periodEnd", cancel_at_period_end AS "cancelAtPeriodEnd"
      FROM app.saas_subscriptions
      WHERE stripe_subscription_id = ${subscriptionId}
    `);
    return rows;
  }

  async function insertCurrentSubscription(params: {
    organizationId: string;
    subscriptionId: string;
    customerId: string;
    status?: string;
  }) {
    const id = crypto.randomUUID();
    await getDb().execute(sql`
      INSERT INTO app.saas_subscriptions (
        id, organization_id, plan_id, price_version_id, interval, status,
        is_current, current_period_start, current_period_end, cancel_at_period_end,
        stripe_customer_id, stripe_subscription_id, stripe_price_id
      ) VALUES (
        ${id}, ${params.organizationId}, 'professional', 'pro_month_v1', 'month',
        ${params.status ?? 'ACTIVE'}, true, now(), now() + interval '30 days',
        false, ${params.customerId}, ${params.subscriptionId}, 'price_pro_month_v1'
      )
    `);
    return id;
  }

  function stripeSubscriptionSnapshot(params: {
    subscriptionId: string;
    customerId: string;
    status?: Stripe.Subscription.Status;
    priceId?: string;
    periodStart?: number;
    periodEnd?: number;
  }) {
    return {
      id: params.subscriptionId,
      customer: params.customerId,
      status: params.status ?? 'active',
      current_period_start: params.periodStart ?? Math.floor(Date.now() / 1000),
      current_period_end:
        params.periodEnd ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: params.priceId ?? 'price_pro_month_v1' } }] },
    } as unknown as Awaited<ReturnType<typeof stripeAdapter.retrieveSubscription>>;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recovers an acknowledged pending event during worker restart and registers a durable one-minute scan', async () => {
    const worker = await loadRecoveryWorker();
    if (!worker) return;

    const organizationId = await createOrganization();
    const customerId = `cus_recovery_${crypto.randomUUID()}`;
    const subscriptionId = `sub_recovery_${crypto.randomUUID()}`;
    await getDb().execute(sql`
      INSERT INTO app.saas_customers (id, organization_id, stripe_mode, stripe_customer_id)
      VALUES (${crypto.randomUUID()}, ${organizationId}, 'test', ${customerId})
    `);
    const localSubscriptionId = await insertCurrentSubscription({
      organizationId,
      subscriptionId,
      customerId,
    });
    const event = makeEvent();
    const raw = Buffer.from(
      JSON.stringify({
        ...event,
        created: Math.floor((Date.now() - 60 * 60 * 1000) / 1000),
        data: {
          object: {
            id: subscriptionId,
            object: 'subscription',
            customer: customerId,
            status: 'canceled',
            metadata: { organizationId: crypto.randomUUID() },
          },
        },
      }),
    );
    const response = await deliver(raw, signedHeader(raw));
    expect(response.statusCode).toBe(200);

    vi.spyOn(stripeAdapter, 'retrieveSubscription').mockResolvedValue(
      stripeSubscriptionSnapshot({ subscriptionId, customerId, status: 'active' }),
    );

    const scheduled = vi.fn();
    let recoveryHandler: (() => Promise<void>) | undefined;
    const boss = {
      createQueue: vi.fn(async () => undefined),
      work: vi.fn(async (_queue: string, _options: object, handler: () => Promise<void>) => {
        recoveryHandler = handler;
        return 'worker-id';
      }),
      schedule: vi.fn(async (...args: unknown[]) => {
        scheduled(...args);
        return 'schedule-id';
      }),
    } as unknown as PgBoss;

    await worker.registerStripeWebhookWorker(boss);

    const inboxRows = await findInboxRows(event.id);
    expect(inboxRows[0]).toMatchObject({ status: 'PROCESSED', attemptCount: 1 });
    expect(await findSubscription(subscriptionId)).toMatchObject([
      expect.objectContaining({ id: localSubscriptionId, status: 'ACTIVE' }),
    ]);
    expect(stripeAdapter.retrieveSubscription).toHaveBeenCalledWith(subscriptionId);
    expect(scheduled).toHaveBeenCalledWith(
      worker.STRIPE_WEBHOOK_RECOVERY_QUEUE,
      worker.STRIPE_WEBHOOK_RECOVERY_CRON,
      {},
      expect.objectContaining({
        singletonKey: worker.STRIPE_WEBHOOK_RECOVERY_SCHEDULE_ID,
      }),
    );
    expect(worker.STRIPE_WEBHOOK_RECOVERY_CRON).toBe('* * * * *');
    expect(recoveryHandler).toBeTypeOf('function');
  });

  it('persists provider outages as retry-due work and later converges from the current object', async () => {
    const worker = await loadRecoveryWorker();
    if (!worker) return;

    const organizationId = await createOrganization();
    const customerId = `cus_outage_${crypto.randomUUID()}`;
    const subscriptionId = `sub_outage_${crypto.randomUUID()}`;
    await getDb().execute(sql`
      INSERT INTO app.saas_customers (id, organization_id, stripe_mode, stripe_customer_id)
      VALUES (${crypto.randomUUID()}, ${organizationId}, 'test', ${customerId})
    `);
    await insertCurrentSubscription({ organizationId, subscriptionId, customerId });
    const event = await insertPendingEvent({ objectId: subscriptionId });
    const retrieve = vi
      .spyOn(stripeAdapter, 'retrieveSubscription')
      .mockRejectedValue(new Error('provider unavailable'));

    await worker.recoverStripeWebhookInbox();

    let rows = await findInboxRows(event.id);
    expect(rows[0]).toMatchObject({
      status: 'RETRY',
      attemptCount: 1,
      lastErrorCode: expect.any(String),
    });
    expect(new Date(rows[0]!.nextAttemptAt).getTime()).toBeGreaterThan(Date.now());

    await getDb().execute(sql`
      UPDATE app.saas_webhook_inbox
      SET next_attempt_at = now() - interval '1 second'
      WHERE provider = 'stripe' AND provider_event_id = ${event.id}
    `);
    retrieve.mockResolvedValue(
      stripeSubscriptionSnapshot({
        subscriptionId,
        customerId,
        status: 'past_due',
      }),
    );

    await worker.recoverStripeWebhookInbox();

    rows = await findInboxRows(event.id);
    expect(rows[0]).toMatchObject({ status: 'PROCESSED', attemptCount: 2 });
    expect(await findSubscription(subscriptionId)).toMatchObject([
      expect.objectContaining({ status: 'PAST_DUE' }),
    ]);
  });

  it('uses the provider current object for stale events and does not duplicate local history or audit on replay', async () => {
    const worker = await loadRecoveryWorker();
    if (!worker) return;

    const organizationId = await createOrganization();
    const customerId = `cus_order_${crypto.randomUUID()}`;
    const subscriptionId = `sub_order_${crypto.randomUUID()}`;
    await getDb().execute(sql`
      INSERT INTO app.saas_customers (id, organization_id, stripe_mode, stripe_customer_id)
      VALUES (${crypto.randomUUID()}, ${organizationId}, 'test', ${customerId})
    `);
    const localSubscriptionId = await insertCurrentSubscription({
      organizationId,
      subscriptionId,
      customerId,
      status: 'ACTIVE',
    });
    vi.spyOn(stripeAdapter, 'retrieveSubscription').mockResolvedValue(
      stripeSubscriptionSnapshot({ subscriptionId, customerId, status: 'active' }),
    );
    const older = new Date(Date.now() - 60 * 60 * 1000);
    const event = await insertPendingEvent({
      objectId: subscriptionId,
      eventCreatedAt: older,
    });

    await worker.recoverStripeWebhookInbox();

    const replay = await insertPendingEvent({
      objectId: subscriptionId,
      eventCreatedAt: new Date(),
    });
    await worker.recoverStripeWebhookInbox();

    const history = await getDb().execute(sql`
      SELECT id FROM app.saas_subscription_history
      WHERE organization_id = ${organizationId} AND subscription_id = ${localSubscriptionId}
    `);
    const audits = await getDb().execute(sql`
      SELECT id FROM app.audit_logs
      WHERE organization_id = ${organizationId}
        AND resource_id = ${localSubscriptionId}
        AND action = 'billing.subscription.provider_reconciled'
    `);
    expect((await findInboxRows(event.id))[0]).toMatchObject({ status: 'PROCESSED' });
    expect((await findInboxRows(replay.id))[0]).toMatchObject({ status: 'PROCESSED' });
    expect(await findSubscription(subscriptionId)).toMatchObject([
      expect.objectContaining({ status: 'ACTIVE' }),
    ]);
    expect(history).toHaveLength(1);
    expect(audits).toHaveLength(1);
  });

  it('does not let a late older reconciliation overwrite a state already accepted from a newer event', async () => {
    const worker = await loadRecoveryWorker();
    if (!worker) return;

    const organizationId = await createOrganization();
    const customerId = `cus_late_${crypto.randomUUID()}`;
    const subscriptionId = `sub_late_${crypto.randomUUID()}`;
    await getDb().execute(sql`
      INSERT INTO app.saas_customers (id, organization_id, stripe_mode, stripe_customer_id)
      VALUES (${crypto.randomUUID()}, ${organizationId}, 'test', ${customerId})
    `);
    const localSubscriptionId = await insertCurrentSubscription({
      organizationId,
      subscriptionId,
      customerId,
      status: 'ACTIVE',
    });
    const older = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const newer = new Date(Date.now() - 60 * 60 * 1000);
    const retrieve = vi
      .spyOn(stripeAdapter, 'retrieveSubscription')
      .mockResolvedValueOnce(
        stripeSubscriptionSnapshot({
          subscriptionId,
          customerId,
          status: 'past_due',
        }),
      )
      .mockResolvedValueOnce(
        stripeSubscriptionSnapshot({
          subscriptionId,
          customerId,
          status: 'active',
        }),
      );

    const newerEvent = await insertPendingEvent({
      objectId: subscriptionId,
      eventCreatedAt: newer,
    });
    await worker.recoverStripeWebhookInbox();
    const lateOlderEvent = await insertPendingEvent({
      objectId: subscriptionId,
      eventCreatedAt: older,
    });
    await worker.recoverStripeWebhookInbox();

    const history = await getDb().execute(sql`
      SELECT id FROM app.saas_subscription_history
      WHERE organization_id = ${organizationId} AND subscription_id = ${localSubscriptionId}
    `);
    const audits = await getDb().execute(sql`
      SELECT id FROM app.audit_logs
      WHERE organization_id = ${organizationId}
        AND resource_id = ${localSubscriptionId}
        AND action = 'billing.subscription.provider_reconciled'
    `);
    expect((await findInboxRows(newerEvent.id))[0]).toMatchObject({ status: 'PROCESSED' });
    expect((await findInboxRows(lateOlderEvent.id))[0]).toMatchObject({ status: 'PROCESSED' });
    expect(await findSubscription(subscriptionId)).toMatchObject([
      expect.objectContaining({ status: 'PAST_DUE' }),
    ]);
    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(history).toHaveLength(1);
    expect(audits).toHaveLength(1);
  });

  it('quarantines unknown provider mappings without trusting event metadata', async () => {
    const worker = await loadRecoveryWorker();
    if (!worker) return;

    const organizationId = await createOrganization();
    const customerId = `cus_unknown_${crypto.randomUUID()}`;
    const subscriptionId = `sub_unknown_${crypto.randomUUID()}`;
    const eventId = `evt_unknown_${crypto.randomUUID()}`;
    const event = {
      ...makeEvent(eventId),
      data: {
        object: {
          id: subscriptionId,
          object: 'subscription',
          customer: customerId,
          metadata: { organizationId },
        },
      },
    };
    const raw = Buffer.from(JSON.stringify(event));
    expect((await deliver(raw, signedHeader(raw))).statusCode).toBe(200);

    const retrieve = vi.spyOn(stripeAdapter, 'retrieveSubscription').mockResolvedValue(
      stripeSubscriptionSnapshot({ subscriptionId, customerId }),
    );

    await worker.recoverStripeWebhookInbox();

    expect((await findInboxRows(eventId))[0]).toMatchObject({
      status: 'QUARANTINED',
      attemptCount: 1,
      lastErrorCode: expect.any(String),
    });
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(await findSubscription(subscriptionId)).toHaveLength(0);
  });

  it('recovers an expired processing lease after a worker crash', async () => {
    const worker = await loadRecoveryWorker();
    if (!worker) return;

    const organizationId = await createOrganization();
    const customerId = `cus_lease_${crypto.randomUUID()}`;
    const subscriptionId = `sub_lease_${crypto.randomUUID()}`;
    await getDb().execute(sql`
      INSERT INTO app.saas_customers (id, organization_id, stripe_mode, stripe_customer_id)
      VALUES (${crypto.randomUUID()}, ${organizationId}, 'test', ${customerId})
    `);
    await insertCurrentSubscription({ organizationId, subscriptionId, customerId });
    const event = await insertPendingEvent({
      objectId: subscriptionId,
      status: 'PROCESSING',
      nextAttemptAt: new Date(Date.now() - 60_000),
    });
    vi.spyOn(stripeAdapter, 'retrieveSubscription').mockResolvedValue(
      stripeSubscriptionSnapshot({ subscriptionId, customerId }),
    );

    await worker.recoverStripeWebhookInbox();

    expect((await findInboxRows(event.id))[0]).toMatchObject({
      status: 'PROCESSED',
      attemptCount: 2,
    });
  });

  it('serializes concurrent events for one provider subscription into one history and audit transition', async () => {
    const worker = await loadRecoveryWorker();
    if (!worker) return;

    const organizationId = await createOrganization();
    const customerId = `cus_concurrent_${crypto.randomUUID()}`;
    const subscriptionId = `sub_concurrent_${crypto.randomUUID()}`;
    await getDb().execute(sql`
      INSERT INTO app.saas_customers (id, organization_id, stripe_mode, stripe_customer_id)
      VALUES (${crypto.randomUUID()}, ${organizationId}, 'test', ${customerId})
    `);
    const localSubscriptionId = await insertCurrentSubscription({
      organizationId,
      subscriptionId,
      customerId,
    });
    const snapshot = stripeSubscriptionSnapshot({
      subscriptionId,
      customerId,
      status: 'past_due',
    });
    const retrieve = vi
      .spyOn(stripeAdapter, 'retrieveSubscription')
      .mockResolvedValue(snapshot);
    const first = await insertPendingEvent({ objectId: subscriptionId });
    const second = await insertPendingEvent({ objectId: subscriptionId });

    await Promise.all([
      worker.recoverStripeWebhookInbox(),
      worker.recoverStripeWebhookInbox(),
    ]);

    const history = await getDb().execute(sql`
      SELECT id FROM app.saas_subscription_history
      WHERE organization_id = ${organizationId} AND subscription_id = ${localSubscriptionId}
    `);
    const audits = await getDb().execute(sql`
      SELECT id FROM app.audit_logs
      WHERE organization_id = ${organizationId}
        AND resource_id = ${localSubscriptionId}
        AND action = 'billing.subscription.provider_reconciled'
    `);
    expect((await findInboxRows(first.id))[0]).toMatchObject({ status: 'PROCESSED' });
    expect((await findInboxRows(second.id))[0]).toMatchObject({ status: 'PROCESSED' });
    expect(await findSubscription(subscriptionId)).toMatchObject([
      expect.objectContaining({ status: 'PAST_DUE' }),
    ]);
    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(history).toHaveLength(1);
    expect(audits).toHaveLength(1);
  });

  it('stops retrying after the bounded attempt limit while retaining a durable terminal failure', async () => {
    const worker = await loadRecoveryWorker();
    if (!worker) return;

    const event = await insertPendingEvent({
      objectId: `sub_permanent_outage_${crypto.randomUUID()}`,
      status: 'RETRY',
      nextAttemptAt: new Date(0),
    });
    await getDb().execute(sql`
      UPDATE app.saas_webhook_inbox
      SET attempt_count = 7,
          next_attempt_at = now() - interval '1 second'
      WHERE provider = 'stripe' AND provider_event_id = ${event.id}
    `);
    vi.spyOn(stripeAdapter, 'retrieveSubscription').mockRejectedValue(
      new Error('provider remains unavailable'),
    );

    await worker.recoverStripeWebhookInbox();

    expect((await findInboxRows(event.id))[0]).toMatchObject({
      status: 'FAILED',
      attemptCount: 8,
      lastErrorCode: 'RECONCILIATION_FAILED',
    });
  });
});
