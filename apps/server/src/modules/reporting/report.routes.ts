// apps/server/src/modules/reporting/report.routes.ts
// F.16 — Fastify routes for all reporting endpoints.

import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext } from '../rbac/permission.middleware.js';
import {
  projectContext,
  requireProjectPermission,
} from '../project/core/project.middleware.js';
import {
  getHealthReportHandler,
  getScheduleReportHandler,
  getCostReportHandler,
  getProcurementReportHandler,
  getSubcontractorReportHandler,
  getExecutiveSummaryReportHandler,
  getPortfolioReportHandler,
} from './report.handlers.js';
import {
  getHealthReportSchemaDoc,
  getScheduleReportSchemaDoc,
  getCostReportSchemaDoc,
  getProcurementReportSchemaDoc,
  getSubcontractorReportSchemaDoc,
  getExecutiveSummaryReportSchemaDoc,
  getPortfolioReportSchemaDoc,
} from './docs/report.api.schemas.js';

export const reportRoutes: FastifyPluginAsync = async (app) => {
  const projectReportReadHandlers = (...capabilities: string[]) => [
    authenticate,
    organizationContext,
    projectContext,
    requireProjectPermission('project:read'),
    ...capabilities.map((capability) =>
      requireProjectPermission(capability),
    ),
  ];

  // --- Portfolio Report (Organization Level) ---
  app.get(
    '/:organizationId/reports/portfolio',
    {
      schema: getPortfolioReportSchemaDoc,
      preHandler: [authenticate, organizationContext],
    },
    getPortfolioReportHandler,
  );

  // --- Project Health Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/health',
    {
      schema: getHealthReportSchemaDoc,
      preHandler: projectReportReadHandlers(
        'project.task.read',
        'project.issue.read',
        'project.rfi.read',
      ),
    },
    getHealthReportHandler,
  );

  // --- Schedule Variance & Progress Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/schedule',
    {
      schema: getScheduleReportSchemaDoc,
      preHandler: projectReportReadHandlers(
        'project.task.read',
        'project.baseline.read',
      ),
    },
    getScheduleReportHandler,
  );

  // --- Commercial Financial Summary Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/cost',
    {
      schema: getCostReportSchemaDoc,
      preHandler: projectReportReadHandlers(
        'project.financial_summary.read',
      ),
    },
    getCostReportHandler,
  );

  // --- Procurement Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/procurement',
    {
      schema: getProcurementReportSchemaDoc,
      preHandler: projectReportReadHandlers(
        'project.material_request.read',
        'project.purchase_order.read',
        'project.delivery.read',
        'project.receipt.read',
        'project.inventory.read',
      ),
    },
    getProcurementReportHandler,
  );

  // --- Subcontractor Performance Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/subcontractor',
    {
      schema: getSubcontractorReportSchemaDoc,
      preHandler: projectReportReadHandlers(
        'project.subcontractor.read',
        'project.task.read',
        'project.purchase_order.read',
      ),
    },
    getSubcontractorReportHandler,
  );

  // --- Project Executive Summary Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/executive-summary',
    {
      schema: getExecutiveSummaryReportSchemaDoc,
      preHandler: projectReportReadHandlers(
        'project.task.read',
        'project.issue.read',
        'project.rfi.read',
        'project.baseline.read',
        'project.financial_summary.read',
        'project.material_request.read',
        'project.purchase_order.read',
        'project.delivery.read',
        'project.receipt.read',
        'project.inventory.read',
      ),
    },
    getExecutiveSummaryReportHandler,
  );
};
