// apps/server/src/modules/reporting/procurement/procurement-report.service.ts
// F.14 — Procurement Report Engine.
// Composes material request, PO, delivery, and inventory facts from authoritative procurement tables.
// Discloses unsupported material-to-task schedule impact as explicitly unavailable.

import { ProcurementReportRepository } from './procurement-report.repository.js';
import { getReportDateOptions, normalizeReportFilters } from '../report.filters.js';
import type { ReportResultEnvelope, MetricCoverage } from '@siteflow/shared';

export class ProcurementReportService {
  constructor(private readonly repo = new ProcurementReportRepository()) {}

  /**
   * Generates a Procurement & Subcontractor Report envelope for a given org/project.
   */
  async getProcurementReport(
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

    const facts = await this.repo.getProcurementFacts(organizationId, projectId);

    const coverage: MetricCoverage = {
      isAvailable: true,
      sourceModule: 'procurement',
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
        materialRequests: facts.materialRequestsByStatus,
        purchaseOrders: facts.purchaseOrdersByStatus,
        deliveries: facts.deliveriesByStatus,
        receipts: facts.receiptsByStatus,
        inventoryItemCount: facts.inventoryItemCount,
        materialScheduleImpactCoverage: {
          isAvailable: false,
          reason: 'UNSUPPORTED_MATERIAL_SCHEDULE_IMPACT_FORMULA',
          sourceModule: 'schedule-execution',
        },
      },
    };
  }
}
