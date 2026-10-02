// apps/server/src/modules/audit/audit.routes.ts
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { auditService } from './audit.service.js';
import { createSuccessResponse } from '../../shared/response.js';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import { listAuditLogsSchemaDoc } from './docs/audit.schemas.js';

const listAuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export async function handleListAuditLogs(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const { limit, offset } = listAuditLogsQuerySchema.parse(request.query);
  const logs = await auditService.listForOrg(organizationId, limit, offset);
  return reply.send(createSuccessResponse({ logs }, { limit, offset, total: logs.length }));
}

export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authenticate);
    protectedRoutes.addHook('preHandler', organizationContext);
    protectedRoutes.addHook('preHandler', requirePermission('audit:read'));

    protectedRoutes.get('/:organizationId/audit-logs', { schema: listAuditLogsSchemaDoc }, handleListAuditLogs);
  });
};
