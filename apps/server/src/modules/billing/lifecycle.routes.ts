// apps/server/src/modules/billing/lifecycle.routes.ts
// Phase 10 (Plan 10-18): policy-governed subscription lifecycle routes.

import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
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
};
