// apps/server/src/modules/reporting/schedule/schedule-report.service.ts
// F.12 — Schedule Variance & Progress Report Engine.
// Composes authoritative ScheduleMetricsService + schedule task details without duplicate formula logic.

import { ScheduleMetricsService } from '../../project/schedule-metrics/schedule-metrics.service.js';
import { ScheduleReportRepository } from './schedule-report.repository.ts';
import { REPORT_SOURCE_CATALOG } from '../report.sources.js';
import { normalizeReportFilters } from '../report.filters.js';
import type { ReportResultEnvelope, MetricCoverage } from '@siteflow/shared';

export class ScheduleReportService {
  constructor(
    private readonly scheduleMetricsSvc = new ScheduleMetricsService(),
    private readonly repo = new ScheduleReportRepository(),
  ) {}

  /**
   * Generates a Schedule Variance & Progress Report envelope for a given org/project.
   */
  async getScheduleReport(
    organizationId: string,
    projectId: string,
    rawFilters?: unknown,
  ): Promise<ReportResultEnvelope | null> {
    if (!organizationId || !projectId) {
      throw new Error('organizationId and projectId are required');
    }

    const filters = normalizeReportFilters({
      ...(typeof rawFilters === 'object' && rawFilters ? rawFilters : {}),
      organizationId,
      projectId,
    });

    // 1. Fetch authoritative schedule metrics summary
    const metrics = await this.scheduleMetricsSvc.getMetrics(organizationId, projectId);

    // 2. Fetch task status breakdown & lookahead window items
    const [statusBreakdown, lookaheadTasks] = await Promise.all([
      this.repo.getTasksByStatus(organizationId, projectId),
      this.repo.getLookaheadTasks(organizationId, projectId, filters.startDate, filters.endDate),
    ]);

    const coverage: MetricCoverage = {
      isAvailable: true,
      sourceModule: 'schedule-metrics',
    };

    const totalTasks = metrics.totalTasks;
    const completedTasks = metrics.completedTasks;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    return {
      reportType: 'SCHEDULE_VARIANCE_PROGRESS',
      organizationId,
      projectId,
      asOf: new Date().toISOString(),
      effectiveTimezone: 'UTC',
      filters,
      coverage,
      data: {
        summary: {
          totalTasks: metrics.totalTasks,
          completedTasks: metrics.completedTasks,
          criticalTaskCount: metrics.criticalTaskCount,
          scheduleRevision: metrics.scheduleRevision,
          completionRate,
        },
        statusBreakdown,
        lookaheadTasks,
      },
    };
  }
}
