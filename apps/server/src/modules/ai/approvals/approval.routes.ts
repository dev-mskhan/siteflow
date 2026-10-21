// apps/server/src/modules/ai/approvals/approval.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import { handleGetApproval, handleApprove, handleReject } from './approval.handler.js';
import {
  getApprovalSchemaDoc,
  approveApprovalSchemaDoc,
  rejectApprovalSchemaDoc,
} from '../docs/ai.api.schemas.js';

export const approvalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get(
    '/:organizationId/ai/approvals/:approvalId',
    {
      schema: getApprovalSchemaDoc,
      preHandler: [requirePermission('ai.runs.read')],
    },
    handleGetApproval,
  );

  fastify.post(
    '/:organizationId/ai/approvals/:approvalId/approve',
    {
      schema: approveApprovalSchemaDoc,
      preHandler: [requirePermission('ai.approvals.decide')],
    },
    handleApprove,
  );

  fastify.post(
    '/:organizationId/ai/approvals/:approvalId/reject',
    {
      schema: rejectApprovalSchemaDoc,
      preHandler: [requirePermission('ai.approvals.decide')],
    },
    handleReject,
  );
};
