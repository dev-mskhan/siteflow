// apps/server/src/modules/organization/settings/settings.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import { handleGetSettings, handleUpdateSettings } from './settings.handler.js';
import { getSettingsSchemaDoc, updateSettingsSchemaDoc } from './docs/settings.schemas.js';

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get(
    '/:organizationId/settings',
    { schema: getSettingsSchemaDoc, preHandler: [requirePermission('settings:read')] },
    handleGetSettings,
  );

  fastify.patch(
    '/:organizationId/settings',
    { schema: updateSettingsSchemaDoc, preHandler: [requirePermission('settings:update')] },
    handleUpdateSettings,
  );
};
