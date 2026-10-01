import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import {
  handleListMaterials,
  handleCreateMaterial,
  handleGetMaterial,
  handleUpdateMaterial,
} from './material.handler.js';
import {
  listMaterialsSchemaDoc,
  createMaterialSchemaDoc,
  getMaterialSchemaDoc,
  updateMaterialSchemaDoc,
} from './docs/material.api.schemas.js';

export const materialRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get(
    '/:organizationId/materials',
    { schema: listMaterialsSchemaDoc, preHandler: [requirePermission('material:read')] },
    handleListMaterials,
  );
  fastify.post(
    '/:organizationId/materials',
    { schema: createMaterialSchemaDoc, preHandler: [requirePermission('material:create')] },
    handleCreateMaterial,
  );
  fastify.get(
    '/:organizationId/materials/:materialId',
    { schema: getMaterialSchemaDoc, preHandler: [requirePermission('material:read')] },
    handleGetMaterial,
  );
  fastify.patch(
    '/:organizationId/materials/:materialId',
    { schema: updateMaterialSchemaDoc, preHandler: [requirePermission('material:update')] },
    handleUpdateMaterial,
  );
};
