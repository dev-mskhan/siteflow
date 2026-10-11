import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { serverEnv } from '@siteflow/env/server';
import { organizations, users } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { BillingIntervalSchema, PlanIdSchema } from '@siteflow/shared';
import { getDb } from '../../lib/db/index.js';
import { createSuccessResponse } from '../../shared/response.js';
import { ConflictError, NotFoundError, ValidationError } from '../auth/auth.errors.js';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import { catalogRepository } from './catalog.repository.js';
import { catalogService } from './catalog.service.js';
import { customerRepository } from './customer.repository.js';
import { stripeAdapter } from './stripe.adapter.js';

const CheckoutParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

const CheckoutBodySchema = z.object({
  planId: PlanIdSchema,
  interval: BillingIntervalSchema,
}).strict();

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

function createReturnUrl(frontendUrl: string, path: string, organizationId: string): string {
  const url = new URL(path, frontendUrl);
  url.searchParams.set('organizationId', organizationId);
  return url.toString();
}

export const checkoutRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', organizationContext);

  app.post(
    '/:organizationId/billing/checkout',
    {
      preHandler: [requirePermission('billing:manage')],
      schema: {
        tags: ['billing'],
        summary: 'Create a hosted SaaS subscription Checkout session',
        description:
          'Creates a Stripe-hosted subscription session using an approved SiteFlow plan. Only verified provider reconciliation changes subscription entitlements.',
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: { organizationId: { type: 'string', format: 'uuid' } },
        },
        headers: {
          type: 'object',
          required: ['idempotency-key'],
          properties: {
            'idempotency-key': { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
        body: {
          type: 'object',
          required: ['planId', 'interval'],
          additionalProperties: false,
          properties: {
            planId: { type: 'string', enum: ['starter', 'professional', 'enterprise'] },
            interval: { type: 'string', enum: ['month', 'year'] },
          },
        },
        response: {
          201: {
            type: 'object',
            required: ['success', 'data'],
            properties: {
              success: { type: 'boolean', const: true },
              data: {
                type: 'object',
                required: ['checkoutUrl'],
                properties: { checkoutUrl: { type: 'string', format: 'uri' } },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const { organizationId } = CheckoutParamsSchema.parse(request.params);
      const { planId, interval } = CheckoutBodySchema.parse(request.body);
      const idempotencyHeader = request.headers['idempotency-key'];
      if (
        typeof idempotencyHeader !== 'string' ||
        !IDEMPOTENCY_KEY_PATTERN.test(idempotencyHeader)
      ) {
        throw new ValidationError(
          'A valid Idempotency-Key header is required for Checkout',
        );
      }

      const organization = await getDb()
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      if (!organization[0]) {
        throw new NotFoundError('Organization not found');
      }

      const currentSubscription = await catalogRepository.findCurrentSubscription(organizationId);
      if (
        currentSubscription &&
        currentSubscription.currentPeriodEnd > new Date() &&
        ['ACTIVE', 'CANCELED'].includes(currentSubscription.status)
      ) {
        throw new ConflictError('Organization already has a paid subscription for this period');
      }

      const price = catalogService.getPriceVersion(planId, interval);
      if (!price.stripePriceId) {
        throw new Error(`Approved price version ${price.id} has no Stripe price mapping`);
      }

      if (!serverEnv.FRONTEND_URL && serverEnv.NODE_ENV === 'production') {
        throw new Error('FRONTEND_URL must be configured before paid Checkout can be enabled');
      }
      const frontendUrl = serverEnv.FRONTEND_URL ?? DEFAULT_FRONTEND_URL;
      const successUrl = createReturnUrl(
        frontendUrl,
        '/billing/checkout/success',
        organizationId,
      );
      const cancelUrl = createReturnUrl(frontendUrl, '/billing/checkout/cancel', organizationId);

      const actor = await getDb()
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, request.user!.sub))
        .limit(1);
      if (!actor[0]) {
        throw new NotFoundError('Authenticated user not found');
      }

      const stripeMode = serverEnv.STRIPE_MODE;
      let customer = await customerRepository.findByOrganization(organizationId, stripeMode);
      if (!customer) {
        const providerCustomer = await stripeAdapter.createCustomer(
          {
            email: actor[0].email,
            name: organization[0].name,
            metadata: { organizationId, stripeMode },
          },
          `saas-customer:${stripeMode}:${organizationId}`,
        );
        customer = await customerRepository.createOrGet(
          organizationId,
          stripeMode,
          providerCustomer.id,
        );
      }

      const session = await stripeAdapter.createCheckoutSession(
        {
          mode: 'subscription',
          line_items: [{ price: price.stripePriceId, quantity: 1 }],
          customer: customer.stripeCustomerId,
          client_reference_id: organizationId,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            organizationId,
            planId,
            priceVersionId: price.id,
          },
          subscription_data: {
            metadata: {
              organizationId,
              planId,
              priceVersionId: price.id,
            },
          },
        },
        `saas-checkout:${organizationId}:${price.id}:${idempotencyHeader}`,
      );
      if (!session.url) {
        throw new Error('Stripe Checkout did not return a hosted session URL');
      }

      return reply.status(201).send(
        createSuccessResponse({ checkoutUrl: session.url }),
      );
    },
  );
};
