import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type Stripe from 'stripe';
import { serverEnv } from '../../config/env.js';
import { stripeAdapter } from './stripe.adapter.js';
import {
  getSupportedStripeObjectType,
  recordVerifiedStripeEvent,
} from './webhook-inbox.repository.js';

const SUPPORTED_EVENT_TYPES = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const;

export const SUPPORTED_STRIPE_WEBHOOK_EVENT_TYPES = SUPPORTED_EVENT_TYPES;

const webhookRoutes: FastifyPluginAsync = async (app) => {
  // This parser is encapsulated to this provider-only route plugin. It returns
  // the original bytes instead of allowing Fastify's normal JSON parser to run.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  );

  app.post(
    '/stripe',
    {
      attachValidation: true,
      bodyLimit: serverEnv.BODY_LIMIT_BYTES,
      schema: {
        tags: ['billing'],
        summary: 'Receive a Stripe webhook',
        description:
          'Verifies the Stripe-Signature over the original request bytes and durably stores supported event references before acknowledging delivery.',
        headers: {
          type: 'object',
          required: ['stripe-signature'],
          properties: {
            'stripe-signature': { type: 'string', minLength: 1 },
          },
        },
        body: { type: 'object', additionalProperties: true },
        response: {
          200: {
            type: 'object',
            required: ['received'],
            properties: { received: { type: 'boolean', const: true } },
          },
          400: {
            type: 'object',
            required: ['error'],
            properties: { error: { type: 'string' } },
          },
          503: {
            type: 'object',
            required: ['error'],
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply) => {
      const rawBody = request.body;
      const signature = request.headers['stripe-signature'];
      if (
        !Buffer.isBuffer(rawBody) ||
        typeof signature !== 'string' ||
        !signature.trim()
      ) {
        return reply.code(400).send({ error: 'Invalid Stripe webhook request' });
      }

      let event: Stripe.Event;
      try {
        event = stripeAdapter.verifyWebhook(rawBody, signature);
      } catch {
        return reply.code(400).send({ error: 'Invalid Stripe webhook signature' });
      }

      if (!SUPPORTED_EVENT_TYPES.some((eventType) => event.type === eventType)) {
        return reply.code(200).send({ received: true });
      }

      const expectedObjectType = getSupportedStripeObjectType(event.type);
      const eventObject = event.data.object;
      if (
        event.livemode !== (serverEnv.STRIPE_MODE === 'live') ||
        !event.id ||
        event.id.length > 255 ||
        !Number.isSafeInteger(event.created) ||
        event.created < 0 ||
        event.type.length > 128 ||
        !expectedObjectType ||
        !eventObject ||
        typeof eventObject !== 'object' ||
        !('id' in eventObject) ||
        typeof eventObject.id !== 'string' ||
        eventObject.id.length === 0 ||
        eventObject.id.length > 255 ||
        !('object' in eventObject) ||
        eventObject.object !== expectedObjectType
      ) {
        return reply.code(400).send({ error: 'Invalid Stripe webhook event' });
      }

      try {
        await recordVerifiedStripeEvent(event);
      } catch {
        request.log.error(
          { code: 'STRIPE_WEBHOOK_INBOX_PERSIST_FAILED' },
          'Unable to persist verified Stripe webhook',
        );
        return reply.code(503).send({ error: 'Webhook temporarily unavailable' });
      }

      return reply.code(200).send({ received: true });
    },
  );
};

export { webhookRoutes };
