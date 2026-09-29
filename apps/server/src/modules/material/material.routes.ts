import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import {
  handleListMaterials,
  handleCreateMaterial,
  handleGetMaterial,
  handleUpdateMaterial,
} from './material.handler.js';

export const materialRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get(
    '/:organizationId/materials',
    { preHandler: [requirePermission('material:read')] },
    handleListMaterials,
  );
  fastify.post(
    '/:organizationId/materials',
    { preHandler: [requirePermission('material:create')] },
    handleCreateMaterial,
  );
  fastify.get(
    '/:organizationId/materials/:materialId',
    { preHandler: [requirePermission('material:read')] },
    handleGetMaterial,
  );
  fastify.patch(
    '/:organizationId/materials/:materialId',
    { preHandler: [requirePermission('material:update')] },
    handleUpdateMaterial,
  );
};
