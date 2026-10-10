// apps/server/src/modules/reporting/cost/cost-report.service.ts
// F.13 — Commercial Financial Summary Report Engine.
// Composes Phase E financialSummaryService without duplicating arithmetic or concealing coverage limits.

import { financialSummaryService } from '../../project/financial-summary/financial-summary.service.js';
import { getReportDateOptions, normalizeReportFilters } from '../report.filters.js';
import type { ReportResultEnvelope, MetricCoverage } from '@siteflow/shared';

export class CostReportService {
  /**
   * Generates a Commercial Financial Summary Report envelope for a given org/project.
   */
  async getCostReport(
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

    let summaryData: Awaited<ReturnType<typeof financialSummaryService.getSummary>>;
    try {
      summaryData = await financialSummaryService.getSummary(organizationId, projectId);
    } catch (err: any) {
      if (err?.code === 'COMMERCIAL_SUMMARY_NOT_FOUND' || err?.statusCode === 404) {
        return null;
      }
      throw err;
    }

    const coverage: MetricCoverage = {
      isAvailable: true,
      sourceModule: 'commercial-summary',
    };

    return {
      reportType: 'COMMERCIAL_FINANCIAL_SUMMARY',
      organizationId,
      projectId,
      asOf: new Date().toISOString(),
      effectiveTimezone: dateOptions.timezone ?? 'UTC',
      filters,
      coverage,
      data: {
        cost: summaryData.cost,
        commitments: summaryData.commitments,
        billingAndCash: summaryData.billingAndCash,
        subcontractCommitmentsCoverage: {
          isAvailable: false,
          reason: summaryData.subcontractCommitments,
          sourceModule: 'subcontractor',
        },
      },
    };
  }
}
