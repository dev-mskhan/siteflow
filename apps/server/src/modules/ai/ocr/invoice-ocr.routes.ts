// apps/server/src/modules/ai/ocr/invoice-ocr.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import { handleExtractInvoice } from './invoice-ocr.handler.js';
import { extractInvoiceSchemaDoc } from './invoice-ocr.schemas.js';

export const invoiceOcrRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.post(
    '/:organizationId/projects/:projectId/invoices/extract',
    {
      schema: extractInvoiceSchemaDoc,
      preHandler: [requirePermission('project.invoice.create')],
    },
    handleExtractInvoice
  );
};
