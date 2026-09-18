// apps/server/src/modules/rbac/permission.middleware.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { rbacService } from './rbac.service.js';
import { auditService } from '../audit/audit.service.js';
import { UnauthorizedError, ForbiddenError, ValidationError } from '../auth/auth.errors.js';

/**
 * Fastify preHandler hook to establish Organization Context.
 * Must run AFTER `authenticate` hook.
 * Looks for `organizationId` or `id` in request params.
 */
export async function organizationContext(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.user) {
    throw new UnauthorizedError('Authentication token missing');
  }

  const params = request.params as Record<string, string | undefined>;
  const organizationId = params['organizationId'] || params['id'];

  if (!organizationId) {
    throw new ValidationError('Organization ID missing in request parameters');
  }

  const userId = request.user.sub;
  const ctx = await rbacService.getOrganizationContext(organizationId, userId);
  request.orgContext = ctx;
}

/**
 * Factory for permission-checking Fastify preHandler hooks.
 * Verifies that request.orgContext contains the required permission key.
 * Logs `permission.denied` audit entry if unauthorized.
 */
export function requirePermission(permission: string) {
  return async function permissionGuard(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.orgContext) {
      throw new ForbiddenError('Organization context not established');
    }

    if (!rbacService.hasPermission(request.orgContext, permission)) {
      // Asynchronously log permission.denied audit event
      auditService
        .log({
          organizationId: request.orgContext.organizationId,
          actorUserId: request.orgContext.userId,
          action: 'permission.denied',
          resourceType: 'Permission',
          resourceId: permission,
          metadata: {
            requiredPermission: permission,
            userPermissions: request.orgContext.permissions,
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        })
        .catch(() => {
          // Swallow audit logging errors on denial path
        });

      throw new ForbiddenError(`Missing required permission: ${permission}`);
    }
  };
}
