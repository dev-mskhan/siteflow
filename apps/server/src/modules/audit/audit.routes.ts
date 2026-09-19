// apps/server/src/modules/audit/audit.routes.ts
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { auditService } from './audit.service.js';
import { createSuccessResponse } from '../../shared/response.js';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import { listAuditLogsSchemaDoc } from './docs/audit.schemas.js';

export async function handleListAuditLogs(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const query = request.query as { limit?: string; offset?: string };

  const limit = query.limit ? parseInt(query.limit, 10) : 50;
  const offset = query.offset ? parseInt(query.offset, 10) : 0;

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
