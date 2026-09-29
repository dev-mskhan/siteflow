import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import {
  handleListSuppliers,
  handleCreateSupplier,
  handleGetSupplier,
  handleUpdateSupplier,
  handleCreateSupplierContact,
  handleUpdateSupplierContact,
} from './supplier.handler.js';

export const supplierRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get(
    '/:organizationId/suppliers',
    { preHandler: [requirePermission('supplier:read')] },
    handleListSuppliers,
  );
  fastify.post(
    '/:organizationId/suppliers',
    { preHandler: [requirePermission('supplier:create')] },
    handleCreateSupplier,
  );
  fastify.get(
    '/:organizationId/suppliers/:supplierId',
    { preHandler: [requirePermission('supplier:read')] },
    handleGetSupplier,
  );
  fastify.patch(
    '/:organizationId/suppliers/:supplierId',
    { preHandler: [requirePermission('supplier:update')] },
    handleUpdateSupplier,
  );
  fastify.post(
    '/:organizationId/suppliers/:supplierId/contacts',
    { preHandler: [requirePermission('supplier:update')] },
    handleCreateSupplierContact,
  );
  fastify.patch(
    '/:organizationId/suppliers/:supplierId/contacts/:contactId',
    { preHandler: [requirePermission('supplier:update')] },
    handleUpdateSupplierContact,
  );
};
