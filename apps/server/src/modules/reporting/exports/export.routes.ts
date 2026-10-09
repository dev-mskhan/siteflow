// apps/server/src/modules/reporting/exports/export.routes.ts
// F.17B — Export routes for requesting CSV generation, polling status, and downloading presigned URLs.

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext } from '../../rbac/permission.middleware.js';
import { exportService } from './export.service.js';
import { createSuccessResponse } from '../../../shared/response.js';
import {
  requestExportSchemaDoc,
  listExportsSchemaDoc,
  getExportStatusSchemaDoc,
  getExportDownloadSchemaDoc,
} from '../docs/export.api.schemas.js';

const RequestExportBodySchema = z.object({
  projectId: z.string().optional().nullable(),
  reportType: z.string().min(1),
  format: z.literal('csv').default('csv'),
  filters: z.record(z.unknown()).default({}),
});

export const exportRoutes: FastifyPluginAsync = async (app) => {
  // All export routes require authentication and organization context
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', organizationContext);

  // 1. Request export
  app.post(
    '/:organizationId/exports',
    { schema: requestExportSchemaDoc },
    async (
      req: FastifyRequest<{
        Params: { organizationId: string };
        Body: z.infer<typeof RequestExportBodySchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const { organizationId } = req.params;
      const parsed = RequestExportBodySchema.parse(req.body);
      const userId = (req.user?.sub ?? (req.user as any)?.id)!;

      const result = await exportService.requestExport({
        organizationId,
        projectId: parsed.projectId ?? null,
        requestedBy: userId,
        reportType: parsed.reportType,
        filterSnapshot: parsed.filters,
      });

      return reply.status(202).send(createSuccessResponse(result));
    },
  );

  // 2. List user exports
  app.get(
    '/:organizationId/exports',
    { schema: listExportsSchemaDoc },
    async (
      req: FastifyRequest<{ Params: { organizationId: string } }>,
      reply: FastifyReply,
    ) => {
      const { organizationId } = req.params;
      const userId = (req.user?.sub ?? (req.user as any)?.id)!;

      const exports = await exportService.listExports(organizationId, userId);
      return reply.send(createSuccessResponse(exports));
    },
  );

  // 3. Get export status
  app.get(
    '/:organizationId/exports/:exportId',
    { schema: getExportStatusSchemaDoc },
    async (
      req: FastifyRequest<{ Params: { organizationId: string; exportId: string } }>,
      reply: FastifyReply,
    ) => {
      const { organizationId, exportId } = req.params;
      const userId = (req.user?.sub ?? (req.user as any)?.id)!;

      const record = await exportService.getExportStatus(exportId, organizationId, userId);
      if (!record) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Export not found or unauthorized' },
        });
      }

      // Safe DTO: omit raw objectKey
      return reply.send(
        createSuccessResponse({
          id: record.id,
          organizationId: record.organizationId,
          projectId: record.projectId,
          reportType: record.reportType,
          format: record.format,
          status: record.status,
          lastError: record.lastError,
          expiresAt: record.expiresAt,
          createdAt: record.createdAt,
        }),
      );
    },
  );

  // 4. Get fresh presigned download URL
  app.get(
    '/:organizationId/exports/:exportId/download',
    { schema: getExportDownloadSchemaDoc },
    async (
      req: FastifyRequest<{ Params: { organizationId: string; exportId: string } }>,
      reply: FastifyReply,
    ) => {
      const { organizationId, exportId } = req.params;
      const userId = (req.user?.sub ?? (req.user as any)?.id)!;

      const result = await exportService.getDownloadUrl(exportId, organizationId, userId);
      if (!result) {
        return reply.status(404).send({
          success: false,
          error: { code: 'EXPORT_NOT_READY', message: 'Export is not ready, expired, or unauthorized' },
        });
      }

      return reply.send(createSuccessResponse(result));
    },
  );
};
