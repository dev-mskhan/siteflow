// apps/server/src/modules/billing/trial.routes.ts
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import { trialService } from './trial.service.js';
import { createSuccessResponse } from '../../shared/response.js';
import { NotFoundError } from '../auth/auth.errors.js';

export const trialRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', organizationContext);

  // POST /:organizationId/billing/trial - Start or retrieve trial
  app.post(
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

  // GET /:organizationId/billing/trial - Retrieve trial status
  app.get(
    '/:organizationId/billing/trial',
    {
      preHandler: [requirePermission('billing:read')],
      schema: {
        tags: ['billing'],
        summary: 'Get organization SaaS trial status',
        description:
          'Returns the current trial record and active/expired status for the organization.',
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
        throw new NotFoundError(`Trial not found for organization ${organizationId}`);
      }
      return reply.status(200).send(createSuccessResponse({ trial }));
    },
  );
};
