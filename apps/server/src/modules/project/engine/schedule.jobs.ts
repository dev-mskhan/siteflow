// apps/server/src/modules/project/engine/schedule.jobs.ts

export const SCHEDULE_QUEUES = {
  SCHEDULE_RECALCULATE: 'schedule:recalculate',
  SCHEDULE_RECALCULATED_EVENT: 'schedule:recalculated_event',
  SCHEDULE_BASELINE_ACTIVATED: 'schedule:baseline_activated',
  FIELD_LOG_LOCKED: 'field_log:locked',
} as const;

export interface ScheduleJobEnvelope {
  organizationId: string;
  projectId: string;
  actorUserId?: string;
  correlationId: string;
  idempotencyKey?: string;
}

export interface ScheduleRecalculateJobPayload extends ScheduleJobEnvelope {
  expectedRevision?: number;
}

export interface ScheduleRecalculatedEventPayload extends ScheduleJobEnvelope {
  newRevision: number;
  criticalTaskCount: number;
  taskCount: number;
}

export interface ScheduleBaselineActivatedPayload extends ScheduleJobEnvelope {
  baselineId: string;
  baselineName: string;
}

export interface FieldLogLockedPayload extends ScheduleJobEnvelope {
  logId: string;
  logDate: string;
}
