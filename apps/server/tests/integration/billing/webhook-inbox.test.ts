import Stripe from 'stripe';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getDb } from '../../../src/lib/db/index.js';
import { createTestApp } from '../../helpers/test-app.js';

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
      next_attempt_at AS "nextAttemptAt"
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
