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
import {
  listSuppliersSchemaDoc,
  createSupplierSchemaDoc,
  getSupplierSchemaDoc,
  updateSupplierSchemaDoc,
  createSupplierContactSchemaDoc,
  updateSupplierContactSchemaDoc,
} from './docs/supplier.api.schemas.js';

export const supplierRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get(
    '/:organizationId/suppliers',
    { schema: listSuppliersSchemaDoc, preHandler: [requirePermission('supplier:read')] },
    handleListSuppliers,
  );
  fastify.post(
    '/:organizationId/suppliers',
    { schema: createSupplierSchemaDoc, preHandler: [requirePermission('supplier:create')] },
    handleCreateSupplier,
  );
  fastify.get(
    '/:organizationId/suppliers/:supplierId',
    { schema: getSupplierSchemaDoc, preHandler: [requirePermission('supplier:read')] },
    handleGetSupplier,
  );
  fastify.patch(
    '/:organizationId/suppliers/:supplierId',
    { schema: updateSupplierSchemaDoc, preHandler: [requirePermission('supplier:update')] },
    handleUpdateSupplier,
  );
  fastify.post(
    '/:organizationId/suppliers/:supplierId/contacts',
    { schema: createSupplierContactSchemaDoc, preHandler: [requirePermission('supplier:update')] },
    handleCreateSupplierContact,
  );
  fastify.patch(
    '/:organizationId/suppliers/:supplierId/contacts/:contactId',
    { schema: updateSupplierContactSchemaDoc, preHandler: [requirePermission('supplier:update')] },
    handleUpdateSupplierContact,
  );
};
