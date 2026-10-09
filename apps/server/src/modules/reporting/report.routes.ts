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
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getHealthReportHandler,
  );

  // --- Schedule Variance & Progress Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/schedule',
    {
      schema: getScheduleReportSchemaDoc,
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getScheduleReportHandler,
  );

  // --- Commercial Financial Summary Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/cost',
    {
      schema: getCostReportSchemaDoc,
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getCostReportHandler,
  );

  // --- Procurement Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/procurement',
    {
      schema: getProcurementReportSchemaDoc,
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getProcurementReportHandler,
  );

  // --- Subcontractor Performance Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/subcontractor',
    {
      schema: getSubcontractorReportSchemaDoc,
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getSubcontractorReportHandler,
  );

  // --- Project Executive Summary Report ---
  app.get(
    '/:organizationId/projects/:projectId/reports/executive-summary',
    {
      schema: getExecutiveSummaryReportSchemaDoc,
      preHandler: [authenticate, organizationContext, projectContext],
    },
    getExecutiveSummaryReportHandler,
  );
};
