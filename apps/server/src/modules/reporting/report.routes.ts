// apps/server/src/modules/reporting/report.routes.ts
// F.16 — Fastify routes for all reporting endpoints.

import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext } from '../rbac/permission.middleware.js';
import { projectContext } from '../project/core/project.middleware.js';
import {
  getHealthReportHandler,
  getScheduleReportHandler,
  getCostReportHandler,
  getProcurementReportHandler,
  getSubcontractorReportHandler,
  getExecutiveSummaryReportHandler,
  getPortfolioReportHandler,
} from './report.handlers.js';

export const reportRoutes: FastifyPluginAsync = async (app) => {
  // --- Portfolio Report (Organization Level) ---
  app.get(
    '/:organizationId/reports/portfolio',
    {
      preHandler: [authenticate, organizationContext],
    },
    getPortfolioReportHandler,
  );

  // --- Project Health Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/health',
    {
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getHealthReportHandler,
  );

  // --- Schedule Variance & Progress Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/schedule',
    {
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getScheduleReportHandler,
  );

  // --- Commercial Financial Summary Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/cost',
    {
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getCostReportHandler,
  );

  // --- Procurement Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/procurement',
    {
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getProcurementReportHandler,
  );

  // --- Subcontractor Performance Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/subcontractor',
    {
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getSubcontractorReportHandler,
  );

  // --- Project Executive Summary Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/executive-summary',
    {
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getExecutiveSummaryReportHandler,
  );
};
