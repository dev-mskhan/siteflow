// apps/server/src/modules/reporting/project-health/project-health.service.ts
// F.11 — Project health indicators composed from authoritative sources.
// No weighted score, forecast, threshold, or historical reconstruction.
// Missing or unauthorized source coverage is explicit (coverage.isAvailable = false).

import { ScheduleMetricsRepository } from '../../project/schedule-metrics/schedule-metrics.repository.js';
import { ProjectHealthRepository } from './project-health.repository.js';
import type { MetricCoverage } from '@siteflow/shared';

export interface ScheduleHealthIndicator {
  totalTasks: number;
  completedTasks: number;
  criticalTaskCount: number;
  scheduleRevision: number;
  completionRate: number; // completedTasks / totalTasks, 0 when totalTasks = 0
  coverage: MetricCoverage;
}

export interface IssueHealthIndicator {
  openIssues: number;
  inProgressIssues: number;
  resolvedIssues: number;
  coverage: MetricCoverage;
}

export interface RfiHealthIndicator {
  openRfis: number;
  overdueRfis: number;
  coverage: MetricCoverage;
}

export interface TaskHealthIndicator {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  coverage: MetricCoverage;
}

export interface ProjectHealthReport {
  organizationId: string;
  projectId: string;
  projectName: string;
  projectStatus: string;
  defaultCurrency: string;
  asOf: string;
  schedule: ScheduleHealthIndicator;
  issues: IssueHealthIndicator;
  rfis: RfiHealthIndicator;
  tasks: TaskHealthIndicator;
}

export class ProjectHealthService {
  constructor(
    private readonly healthRepo = new ProjectHealthRepository(),
    private readonly scheduleMetricsRepo = new ScheduleMetricsRepository(),
  ) {}

  /**
   * Compose project health indicators for a specific org/project.
   * Returns explicit coverage for each section — never substitutes zero for missing data.
   */
  async getProjectHealth(
    organizationId: string,
    projectId: string,
  ): Promise<ProjectHealthReport | null> {
    if (!organizationId || !projectId) {
      throw new Error('organizationId and projectId are required');
    }

    const projectCore = await this.healthRepo.getProjectCore(organizationId, projectId);
    if (!projectCore) {
      // Project does not exist in this org — return null (caller decides 404/403)
      return null;
    }

    const asOf = new Date().toISOString();

    // --- Schedule Metrics (from materialized metrics + tasks count) ---
    const [metricsRow, taskFacts] = await Promise.all([
      this.scheduleMetricsRepo.findByProject(getDb(), organizationId, projectId),
      this.healthRepo.getTaskCounts(organizationId, projectId),
    ]);

    const scheduleIndicator: ScheduleHealthIndicator = metricsRow
      ? {
          totalTasks: metricsRow.totalTasks,
          completedTasks: metricsRow.completedTasks,
          criticalTaskCount: metricsRow.criticalTaskCount,
          scheduleRevision: metricsRow.scheduleRevision,
          completionRate:
            metricsRow.totalTasks > 0
              ? metricsRow.completedTasks / metricsRow.totalTasks
              : 0,
          coverage: { isAvailable: true, sourceModule: 'schedule-metrics' },
        }
      : {
          totalTasks: 0,
          completedTasks: 0,
          criticalTaskCount: 0,
          scheduleRevision: 0,
          completionRate: 0,
          coverage: {
            isAvailable: false,
            reason: 'Schedule metrics not yet calculated for this project.',
            sourceModule: 'schedule-metrics',
          },
        };

    const taskIndicator: TaskHealthIndicator = {
      totalTasks: taskFacts.total,
      completedTasks: taskFacts.completed,
      completionRate: taskFacts.total > 0 ? taskFacts.completed / taskFacts.total : 0,
      coverage: { isAvailable: true, sourceModule: 'task-execution' },
    };

    // --- Issues ---
    const issueFacts = await this.healthRepo.getIssueCounts(organizationId, projectId);
    const issueIndicator: IssueHealthIndicator = {
      openIssues: issueFacts.open,
      inProgressIssues: issueFacts.inProgress,
      resolvedIssues: issueFacts.resolved,
      coverage: { isAvailable: true, sourceModule: 'issue' },
    };

    // --- RFIs ---
    const rfiFacts = await this.healthRepo.getRfiCounts(organizationId, projectId);
    const rfiIndicator: RfiHealthIndicator = {
      openRfis: rfiFacts.open,
      overdueRfis: rfiFacts.overdue,
      coverage: { isAvailable: true, sourceModule: 'rfi' },
    };

    return {
      organizationId,
      projectId,
      projectName: projectCore.name,
      projectStatus: projectCore.status,
      defaultCurrency: projectCore.defaultCurrency,
      asOf,
      schedule: scheduleIndicator,
      issues: issueIndicator,
      rfis: rfiIndicator,
      tasks: taskIndicator,
    };
  }
}

// Helper import — we need getDb inside the service
import { getDb } from '../../../lib/db/index.js';
