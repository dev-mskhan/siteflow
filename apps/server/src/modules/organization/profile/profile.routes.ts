// apps/server/src/modules/organization/profile/profile.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import { handleGetProfile, handleUpdateProfile } from './profile.handler.js';
import { getProfileSchemaDoc, updateProfileSchemaDoc } from './docs/profile.schemas.js';

export const profileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get(
    '/:organizationId/profile',
    { schema: getProfileSchemaDoc, preHandler: [requirePermission('organization:read')] },
    handleGetProfile,
  );

  fastify.patch(
    '/:organizationId/profile',
    { schema: updateProfileSchemaDoc, preHandler: [requirePermission('organization:update')] },
    handleUpdateProfile,
  );
};
