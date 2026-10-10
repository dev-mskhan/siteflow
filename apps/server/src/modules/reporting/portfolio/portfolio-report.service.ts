// apps/server/src/modules/reporting/portfolio/portfolio-report.service.ts
// F.16 — Portfolio Report Service.
// Aggregates organization-wide project metrics without cross-currency summing.

import { PortfolioReportRepository } from './portfolio-report.repository.js';
import { getReportDateOptions, normalizeReportFilters } from '../report.filters.js';
import type { ReportResultEnvelope, MetricCoverage } from '@siteflow/shared';
import type { ProjectContext } from '../../project/core/project.types.js';

export class PortfolioReportService {
  constructor(private readonly repo = new PortfolioReportRepository()) {}

  async getPortfolioReport(
    organizationId: string,
    actor: {
      userId: string;
      organizationMembership: ProjectContext['organizationMembership'];
    },
    rawFilters?: unknown,
  ): Promise<ReportResultEnvelope> {
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const dateOptions = await getReportDateOptions(organizationId);
    const filters = normalizeReportFilters({
      ...(typeof rawFilters === 'object' && rawFilters ? rawFilters : {}),
      organizationId,
    }, dateOptions);

    const query = (
      typeof rawFilters === 'object' && rawFilters
        ? rawFilters
        : {}
    ) as { limit?: number; cursor?: string };
    const readableProjectIds = await this.repo.getReadableProjectIds(
      organizationId,
      actor,
    );
    const [page, statusCounts, totalProjects, contractValueByCurrency] =
      await Promise.all([
      this.repo.getPortfolioProjects(
        organizationId,
        readableProjectIds,
        query.limit,
        query.cursor,
      ),
      this.repo.getProjectStatusCounts(organizationId, readableProjectIds),
      this.repo.getPortfolioProjectCount(organizationId, readableProjectIds),
      this.repo.getContractValueByCurrency(organizationId, readableProjectIds),
    ]);

    const coverage: MetricCoverage = {
      isAvailable: true,
      sourceModule: 'portfolio-core',
    };

    return {
      reportType: 'ORGANIZATION_PORTFOLIO',
      organizationId,
      asOf: new Date().toISOString(),
      effectiveTimezone: dateOptions.timezone ?? 'UTC',
      filters,
      coverage,
      data: {
        totalProjects,
        statusCounts,
        contractValueByCurrency,
        projects: page.projects,
        nextCursor: page.nextCursor,
      },
    };
  }
}
