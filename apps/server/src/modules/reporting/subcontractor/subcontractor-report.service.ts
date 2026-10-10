// apps/server/src/modules/reporting/subcontractor/subcontractor-report.service.ts
// F.15 — Subcontractor Performance Report Engine.
// Composes authoritative subcontractor facts while explicitly marking unbacked commitment values as unavailable.

import { SubcontractorReportRepository } from './subcontractor-report.repository.js';
import { getReportDateOptions, normalizeReportFilters } from '../report.filters.js';
import type { ReportResultEnvelope, MetricCoverage } from '@siteflow/shared';

export class SubcontractorReportService {
  constructor(private readonly repo = new SubcontractorReportRepository()) {}

  /**
   * Generates a Subcontractor Performance Report envelope for a given org/project.
   */
  async getSubcontractorReport(
    organizationId: string,
    projectId: string,
    rawFilters?: unknown,
  ): Promise<ReportResultEnvelope | null> {
    if (!organizationId || !projectId) {
      throw new Error('organizationId and projectId are required');
    }

    const dateOptions = await getReportDateOptions(organizationId, projectId);
    const filters = normalizeReportFilters({
      ...(typeof rawFilters === 'object' && rawFilters ? rawFilters : {}),
      organizationId,
      projectId,
    }, dateOptions);

    const facts = await this.repo.getSubcontractorFacts(organizationId, projectId);

    const coverage: MetricCoverage = {
      isAvailable: true,
      sourceModule: 'subcontractor',
    };

    return {
      reportType: 'SUBCONTRACTOR_PERFORMANCE',
      organizationId,
      projectId,
      asOf: new Date().toISOString(),
      effectiveTimezone: dateOptions.timezone ?? 'UTC',
      filters,
      coverage,
      data: {
        activeSubcontractorCount: facts.activeSubcontractorCount,
        totalTaskAssignments: facts.totalTaskAssignments,
        purchaseOrderCount: facts.purchaseOrderCount,
        subcontractCommitmentsCoverage: {
          isAvailable: false,
          reason: 'DEFERRED_UNTIL_APPROVED_CONTRACT_SOURCE_EXISTS',
          sourceModule: 'commercial-summary',
        },
        performanceScoreCoverage: {
          isAvailable: false,
          reason: 'UNSUPPORTED_PERFORMANCE_RATING_FORMULA',
          sourceModule: 'subcontractor',
        },
      },
    };
  }
}
