// apps/server/src/modules/billing/trial.routes.ts
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import { trialService } from './trial.service.js';
import { catalogService } from './catalog.service.js';
import { createSuccessResponse } from '../../shared/response.js';
import { NotFoundError } from '../auth/auth.errors.js';

export const trialRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', organizationContext);

  // POST /:organizationId/billing/trial - Start or retrieve trial
  app.post<{ Params: { organizationId: string } }>(
    '/:organizationId/billing/trial',
    {
      preHandler: [requirePermission('billing:manage')],
      schema: {
        tags: ['billing'],
        summary: 'Provision organization SaaS trial',
        description:
          'Provisions a 14-day no-card free trial with Professional tier limits. Idempotent per organization.',
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: {
            organizationId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { organizationId: string } }>,
      reply: FastifyReply,
    ) => {
      const { organizationId } = req.params;
      const actorUserId = req.user!.sub;

      const { trial, isNew } = await trialService.provisionTrial({
        organizationId,
        actorUserId,
        ipAddress: req.ip,
        userAgent: (req.headers['user-agent'] as string) ?? null,
      });

      return reply.status(isNew ? 201 : 200).send(createSuccessResponse({ trial }));
    },
  );

  // GET /:organizationId/billing/trial - Retrieve trial status (with computed fields)
  app.get<{ Params: { organizationId: string } }>(
    '/:organizationId/billing/trial',
    {
      preHandler: [requirePermission('billing:read')],
      schema: {
        tags: ['billing'],
        summary: 'Get organization SaaS trial status',
        description:
          'Returns the current trial record including daysRemaining, graceStatus and isUsable.',
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: {
            organizationId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { organizationId: string } }>,
      reply: FastifyReply,
    ) => {
      const { organizationId } = req.params;
      const trial = await trialService.getTrial(organizationId);
      if (!trial) {
        throw new NotFoundError(`No trial found for organization ${organizationId}`);
      }
      return reply.status(200).send(createSuccessResponse({ trial }));
    },
  );

  // GET /:organizationId/billing/status - Full billing status (trial + subscription)
  // Used by BillingPage to show the correct UI state without multiple round trips.
  app.get<{ Params: { organizationId: string } }>(
    '/:organizationId/billing/status',
    {
      preHandler: [requirePermission('billing:read')],
      schema: {
        tags: ['billing'],
        summary: 'Get full billing status (trial + subscription)',
        description:
          'Returns trial, active subscription, plan limits and current entitlement state in one call.',
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: {
            organizationId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { organizationId: string } }>,
      reply: FastifyReply,
    ) => {
      const { organizationId } = req.params;

      const [trial, subscription] = await Promise.all([
        trialService.getTrial(organizationId),
        catalogService.getCurrentSubscription(organizationId),
      ]);

      // Derive a simple unified status string for the frontend
      let billingState: 'trial' | 'trial_grace' | 'trial_expired' | 'active' | 'past_due' | 'canceled' | 'none';
      if (subscription?.subscription.status === 'ACTIVE') {
        billingState = 'active';
      } else if (subscription?.subscription.status === 'PAST_DUE') {
        billingState = 'past_due';
      } else if (subscription?.subscription.status === 'CANCELED') {
        billingState = 'canceled';
      } else if (trial?.graceStatus === 'active') {
        billingState = 'trial';
      } else if (trial?.graceStatus === 'grace-period') {
        billingState = 'trial_grace';
      } else if (trial?.graceStatus === 'expired' || trial?.status === 'EXPIRED') {
        billingState = 'trial_expired';
      } else {
        billingState = 'none';
      }

      return reply.status(200).send(createSuccessResponse({
        billingState,
        trial: trial ?? null,
        subscription: subscription ? {
          id: subscription.subscription.id,
          planId: subscription.subscription.planId,
          planName: subscription.plan.name,
          interval: subscription.subscription.interval,
          status: subscription.subscription.status,
          currentPeriodEnd: subscription.subscription.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: subscription.subscription.cancelAtPeriodEnd,
        } : null,
        limits: subscription?.limits ?? null,
      }));
    },
  );
};
