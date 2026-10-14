// apps/server/src/modules/ai/approvals/approval.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import { handleGetApproval, handleApprove, handleReject } from './approval.handler.js';

export const approvalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get(
    '/:organizationId/ai/approvals/:approvalId',
    { preHandler: [requirePermission('ai.runs.read')] },
    handleGetApproval,
  );

  fastify.post(
    '/:organizationId/ai/approvals/:approvalId/approve',
    { preHandler: [requirePermission('ai.approvals.decide')] },
    handleApprove,
  );

  fastify.post(
    '/:organizationId/ai/approvals/:approvalId/reject',
    { preHandler: [requirePermission('ai.approvals.decide')] },
    handleReject,
  );
};
