// apps/server/src/modules/billing/lifecycle.routes.ts
// Phase 10 (Plan 10-18): policy-governed subscription lifecycle routes.

import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import type { BillingInterval, PlanId } from '@siteflow/shared';
import { subscriptionLifecycleService } from './subscription-lifecycle.service.js';
import { createSuccessResponse } from '../../shared/response.js';

export const lifecycleRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', organizationContext);

  // POST /:organizationId/billing/subscription/cancel - Cancel at period end
  app.post<{ Params: { organizationId: string } }>(
    '/:organizationId/billing/subscription/cancel',
    {
      preHandler: [requirePermission('billing:manage')],
      schema: {
        tags: ['billing'],
        summary: 'Schedule subscription cancellation at period end',
        description:
          'Sets cancel_at_period_end on the current organization subscription. Access is preserved until the current period ends. Idempotent: repeated calls return the existing scheduled cancellation without a provider call.',
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: {
            organizationId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      const { organizationId } = req.params;
      const result = await subscriptionLifecycleService.scheduleCancellation({
        organizationId,
        actorUserId: req.user!.sub,
        ipAddress: req.ip,
        userAgent: (req.headers['user-agent'] as string) ?? null,
      });

      return reply.status(200).send(
        createSuccessResponse({
          subscriptionId: result.subscription.id,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: result.subscription.currentPeriodEnd?.toISOString() ?? null,
          accessUntil: result.accessUntil?.toISOString() ?? null,
          idempotent: result.idempotent,
        }),
      );
    },
  );

  // POST /:organizationId/billing/subscription/downgrade - Schedule plan downgrade at period end
  app.post<{ Params: { organizationId: string }; Body: { planId: PlanId; interval?: BillingInterval } }>(
    '/:organizationId/billing/subscription/downgrade',
    {
      preHandler: [requirePermission('billing:manage')],
      schema: {
        tags: ['billing'],
        summary: 'Schedule a plan downgrade',
        description:
          'Records a lower-priced target plan on the current subscription and syncs the provider price without proration. Current access tier is retained until the period ends. Idempotent for the same target.',
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: { organizationId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string', enum: ['starter', 'professional', 'enterprise'] },
            interval: { type: 'string', enum: ['month', 'year'] },
          },
        },
      },
    },
    async (req, reply) => {
      const result = await subscriptionLifecycleService.scheduleDowngrade({
        organizationId: req.params.organizationId,
        actorUserId: req.user!.sub,
        planId: req.body.planId,
        interval: req.body.interval,
        ipAddress: req.ip,
        userAgent: (req.headers['user-agent'] as string) ?? null,
      });

      return reply.status(200).send(
        createSuccessResponse({
          subscriptionId: result.subscription.id,
          scheduledPlanId: result.subscription.scheduledPlanId,
          accessUntil: result.accessUntil?.toISOString() ?? null,
          idempotent: result.idempotent,
        }),
      );
    },
  );

  // POST /:organizationId/billing/subscription/upgrade - Apply plan upgrade immediately
  app.post<{ Params: { organizationId: string }; Body: { planId: PlanId; interval?: BillingInterval } }>(
    '/:organizationId/billing/subscription/upgrade',
    {
      preHandler: [requirePermission('billing:manage')],
      schema: {
        tags: ['billing'],
        summary: 'Upgrade the subscription plan',
        description:
          'Applies a higher-priced plan immediately with prorations. Refused while a cancellation is scheduled.',
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: { organizationId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string', enum: ['starter', 'professional', 'enterprise'] },
            interval: { type: 'string', enum: ['month', 'year'] },
          },
        },
      },
    },
    async (req, reply) => {
      const result = await subscriptionLifecycleService.applyUpgrade({
        organizationId: req.params.organizationId,
        actorUserId: req.user!.sub,
        planId: req.body.planId,
        interval: req.body.interval,
        ipAddress: req.ip,
        userAgent: (req.headers['user-agent'] as string) ?? null,
      });

      return reply.status(200).send(
        createSuccessResponse({
          subscriptionId: result.subscription.id,
          planId: result.subscription.planId,
          interval: result.subscription.interval,
          accessUntil: result.accessUntil?.toISOString() ?? null,
          idempotent: result.idempotent,
        }),
      );
    },
  );

  // POST /:organizationId/billing/subscription/pause - Not supported by policy (D-07)
  app.post<{ Params: { organizationId: string } }>(
    '/:organizationId/billing/subscription/pause',
    {
      preHandler: [requirePermission('billing:manage')],
      schema: {
        tags: ['billing'],
        summary: 'Pause subscription (unsupported)',
        description:
          'Pause is not supported by the approved billing policy (D-07). Always returns 409 LIFECYCLE_ACTION_NOT_SUPPORTED without a provider call.',
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: { organizationId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async () => {
      subscriptionLifecycleService.pause();
    },
  );

  // POST /:organizationId/billing/subscription/reactivate - Undo a scheduled cancellation
  app.post<{ Params: { organizationId: string } }>(
    '/:organizationId/billing/subscription/reactivate',
    {
      preHandler: [requirePermission('billing:manage')],
      schema: {
        tags: ['billing'],
        summary: 'Reactivate a scheduled cancellation',
        description:
          'Reverts cancel_at_period_end while the subscription is still active. After a real cancellation returns 409 CHECKOUT_REQUIRED.',
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: { organizationId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (req, reply) => {
      const result = await subscriptionLifecycleService.reactivate({
        organizationId: req.params.organizationId,
        actorUserId: req.user!.sub,
        ipAddress: req.ip,
        userAgent: (req.headers['user-agent'] as string) ?? null,
      });

      return reply.status(200).send(
        createSuccessResponse({
          subscriptionId: result.subscription.id,
          cancelAtPeriodEnd: result.subscription.cancelAtPeriodEnd,
          accessUntil: result.accessUntil?.toISOString() ?? null,
          idempotent: result.idempotent,
        }),
      );
    },
  );
};
