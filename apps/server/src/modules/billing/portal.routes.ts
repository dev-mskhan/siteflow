import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { serverEnv } from '@siteflow/env/server';
import { createSuccessResponse } from '../../shared/response.js';
import { NotFoundError } from '../auth/auth.errors.js';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import { customerRepository } from './customer.repository.js';
import { StripeConfigurationError, stripeAdapter } from './stripe.adapter.js';

const PortalParamsSchema = z.object({
  organizationId: z.string().uuid(),
}).strict();

const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

function createReturnUrl(frontendUrl: string, organizationId: string): string {
  const url = new URL('/billing', frontendUrl);
  url.searchParams.set('organizationId', organizationId);
  return url.toString();
}

export const portalRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', organizationContext);

  app.post(
    '/:organizationId/billing/portal',
    {
      preHandler: [requirePermission('billing:manage')],
      schema: {
        tags: ['billing'],
        summary: 'Create a restricted SaaS Customer Portal session',
        description:
          'Creates a Stripe-hosted customer session only when its explicitly selected Stripe Portal configuration permits payment-method management and invoice history while disabling customer updates, subscription changes, and cancellations. SiteFlow retains control of subscription lifecycle changes.',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['organizationId'],
          properties: { organizationId: { type: 'string', format: 'uuid' } },
        },
        response: {
          201: {
            type: 'object',
            required: ['success', 'data'],
            properties: {
              success: { type: 'boolean', const: true },
              data: {
                type: 'object',
                required: ['portalUrl'],
                properties: { portalUrl: { type: 'string', format: 'uri' } },
                additionalProperties: false,
              },
              meta: { type: 'object' },
            },
          },
          401: {
            type: 'object',
            required: ['success', 'error'],
            properties: {
              success: { type: 'boolean', const: false },
              error: {
                type: 'object',
                required: ['code', 'message', 'requestId'],
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
          403: {
            type: 'object',
            required: ['success', 'error'],
            properties: {
              success: { type: 'boolean', const: false },
              error: {
                type: 'object',
                required: ['code', 'message', 'requestId'],
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
          404: {
            type: 'object',
            required: ['success', 'error'],
            properties: {
              success: { type: 'boolean', const: false },
              error: {
                type: 'object',
                required: ['code', 'message', 'requestId'],
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
          422: {
            type: 'object',
            required: ['success', 'error'],
            properties: {
              success: { type: 'boolean', const: false },
              error: {
                type: 'object',
                required: ['code', 'message', 'requestId'],
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { organizationId } = PortalParamsSchema.parse(request.params);
      const stripeMode = serverEnv.STRIPE_MODE;
      const customer = await customerRepository.findByOrganization(
        organizationId,
        stripeMode,
      );
      if (!customer) {
        throw new NotFoundError('Billing customer not found');
      }

      const configurationId = serverEnv.STRIPE_PORTAL_CONFIGURATION_ID;
      if (!configurationId) {
        throw new StripeConfigurationError();
      }
      if (!serverEnv.FRONTEND_URL && serverEnv.NODE_ENV === 'production') {
        throw new StripeConfigurationError();
      }

      const frontendUrl = serverEnv.FRONTEND_URL ?? DEFAULT_FRONTEND_URL;
      const session = await stripeAdapter.createPortalSession({
        customer: customer.stripeCustomerId,
        configuration: configurationId,
        return_url: createReturnUrl(frontendUrl, organizationId),
      });

      if (!session.url) {
        throw new Error('Stripe Customer Portal did not return a hosted session URL');
      }

      return reply.status(201).send(
        createSuccessResponse({ portalUrl: session.url }),
      );
    },
  );
};
