// apps/server/src/modules/reporting/portfolio/portfolio-report.service.ts
// F.16 — Portfolio Report Service.
// Aggregates organization-wide project metrics without cross-currency summing.

import { PortfolioReportRepository } from './portfolio-report.repository.js';
import { normalizeReportFilters } from '../report.filters.js';
import type { ReportResultEnvelope, MetricCoverage } from '@siteflow/shared';

export class PortfolioReportService {
  constructor(private readonly repo = new PortfolioReportRepository()) {}

  async getPortfolioReport(
    organizationId: string,
    rawFilters?: unknown,
  ): Promise<ReportResultEnvelope> {
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const filters = normalizeReportFilters({
      ...(typeof rawFilters === 'object' && rawFilters ? rawFilters : {}),
      organizationId,
    });

    const [projectList, statusCounts] = await Promise.all([
      this.repo.getPortfolioProjects(organizationId),
      this.repo.getProjectStatusCounts(organizationId),
    ]);

    // Group contract values by currency without cross-currency summing
    const contractValueByCurrency: Record<string, number> = {};
    for (const p of projectList) {
      const val = Number(p.contractValue ?? 0);
      contractValueByCurrency[p.currency] = (contractValueByCurrency[p.currency] ?? 0) + val;
    }

    const coverage: MetricCoverage = {
      isAvailable: true,
      sourceModule: 'portfolio-core',
    };

    return {
      reportType: 'ORGANIZATION_PORTFOLIO',
      organizationId,
      asOf: new Date().toISOString(),
      effectiveTimezone: 'UTC',
      filters,
      coverage,
      data: {
        totalProjects: projectList.length,
        statusCounts,
        contractValueByCurrency,
        projects: projectList,
      },
    };
  }
}
