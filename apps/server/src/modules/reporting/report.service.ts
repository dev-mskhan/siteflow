// apps/server/src/modules/reporting/report.service.ts
// F.16 — Unified Reporting Service orchestrator.
// Routes requests to specialized family services (Health, Schedule, Cost, Procurement, Subcontractor, Portfolio, Executive Summary).

import { ProjectHealthService } from './project-health/project-health.service.js';
import { ScheduleReportService } from './schedule/schedule-report.service.js';
import { CostReportService } from './cost/cost-report.service.js';
import { ProcurementReportService } from './procurement/procurement-report.service.js';
import { SubcontractorReportService } from './subcontractor/subcontractor-report.service.js';
import { PortfolioReportService } from './portfolio/portfolio-report.service.js';
import { normalizeReportFilters } from './report.filters.js';
import type { ReportResultEnvelope } from '@siteflow/shared';

export class ReportService {
  private readonly healthSvc = new ProjectHealthService();
  private readonly scheduleSvc = new ScheduleReportService();
  private readonly costSvc = new CostReportService();
  private readonly procurementSvc = new ProcurementReportService();
  private readonly subcontractorSvc = new SubcontractorReportService();
  private readonly portfolioSvc = new PortfolioReportService();

  async getHealthReport(organizationId: string, projectId: string) {
    return this.healthSvc.getProjectHealth(organizationId, projectId);
  }

  async getScheduleReport(organizationId: string, projectId: string, filters?: unknown) {
    return this.scheduleSvc.getScheduleReport(organizationId, projectId, filters);
  }

  async getCostReport(organizationId: string, projectId: string, filters?: unknown) {
    return this.costSvc.getCostReport(organizationId, projectId, filters);
  }

  async getProcurementReport(organizationId: string, projectId: string, filters?: unknown) {
    return this.procurementSvc.getProcurementReport(organizationId, projectId, filters);
  }

  async getSubcontractorReport(organizationId: string, projectId: string, filters?: unknown) {
    return this.subcontractorSvc.getSubcontractorReport(organizationId, projectId, filters);
  }

  async getPortfolioReport(organizationId: string, filters?: unknown) {
    return this.portfolioSvc.getPortfolioReport(organizationId, filters);
  }

  async getExecutiveSummaryReport(
    organizationId: string,
    projectId: string,
    rawFilters?: unknown,
  ): Promise<ReportResultEnvelope | null> {
    if (!organizationId || !projectId) {
      throw new Error('organizationId and projectId are required');
    }

    const [health, schedule, cost, procurement] = await Promise.all([
      this.getHealthReport(organizationId, projectId),
      this.getScheduleReport(organizationId, projectId, rawFilters),
      this.getCostReport(organizationId, projectId, rawFilters),
      this.getProcurementReport(organizationId, projectId, rawFilters),
    ]);

    if (!health) {
      return null;
    }

    const filters = normalizeReportFilters({
      ...(typeof rawFilters === 'object' && rawFilters ? rawFilters : {}),
      organizationId,
      projectId,
    });

    return {
      reportType: 'PROJECT_EXECUTIVE_SUMMARY',
      organizationId,
      projectId,
      asOf: new Date().toISOString(),
      effectiveTimezone: 'UTC',
      filters,
      coverage: {
        isAvailable: true,
        sourceModule: 'project-core',
      },
      data: {
        health,
        scheduleSummary: schedule?.data ?? null,
        costSummary: cost?.data ?? null,
        procurementSummary: procurement?.data ?? null,
      },
    };
  }
}

export const reportService = new ReportService();
