// apps/server/src/modules/platform/platform-permission.middleware.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../auth/auth.errors.js';
import { PlatformRbacRepository } from './platform-rbac.repository.js';

const platformRbacRepository = new PlatformRbacRepository();

/**
 * Deny-by-default platform permission guard. Uses only platform_user_roles and
 * platform role permissions; organization membership is never consulted.
 * Must run after `authenticate`.
 */
export function requirePlatformPermission(permissionKey: string) {
  return async function platformPermissionGuard(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.user?.sub) {
      throw new UnauthorizedError('Authentication token missing');
    }

    const allowed = await platformRbacRepository.hasPlatformPermission(
      request.user.sub,
      permissionKey,
    );

    if (!allowed) {
      throw new ForbiddenError(`Missing required platform permission: ${permissionKey}`);
    }
  };
}
