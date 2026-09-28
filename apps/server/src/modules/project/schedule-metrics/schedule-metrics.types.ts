// apps/server/src/modules/project/schedule-metrics/schedule-metrics.types.ts

export interface ScheduleMetricsDTO {
  id: string;
  organizationId: string;
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  criticalTaskCount: number;
  scheduleRevision: number;
  updatedAt: string;
}
