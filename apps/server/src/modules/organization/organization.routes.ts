// apps/server/src/modules/organization/organization.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import {
  handleCreateOrg,
  handleListOrgs,
  handleGetOrg,
  handleUpdateOrg,
  handleGetSettings,
  handleUpdateSettings,
} from './organization.handler.js';

export const organizationRoutes: FastifyPluginAsync = async (fastify) => {
  // Public/authenticated user routes (no org context required yet)
  fastify.register(async (userOrgRoutes) => {
    userOrgRoutes.addHook('preHandler', authenticate);

    userOrgRoutes.post('/', handleCreateOrg);
    userOrgRoutes.get('/', handleListOrgs);
  });

  // Org-scoped routes requiring organizationContext & permissions
  fastify.register(async (scopedRoutes) => {
    scopedRoutes.addHook('preHandler', authenticate);
    scopedRoutes.addHook('preHandler', organizationContext);

    scopedRoutes.get('/:organizationId', handleGetOrg);
    scopedRoutes.patch(
      '/:organizationId',
      { preHandler: [requirePermission('organization:update')] },
      handleUpdateOrg,
    );

    // Settings routes
    scopedRoutes.get(
      '/:organizationId/settings',
      { preHandler: [requirePermission('settings:read')] },
      handleGetSettings,
    );
    scopedRoutes.patch(
      '/:organizationId/settings',
      { preHandler: [requirePermission('settings:update')] },
      handleUpdateSettings,
    );
  });
};
