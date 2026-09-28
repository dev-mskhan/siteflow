// apps/server/src/modules/project/engine/schedule.worker.ts
import type PgBoss from 'pg-boss';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { eq, and } from 'drizzle-orm';

import { registerWorker } from '../../../lib/queue/worker-factory.js';
import { sendJob } from '../../../lib/queue/index.js';
import { getDb } from '../../../lib/db/index.js';
import { projects } from '@siteflow/database/schema';
import {
  SCHEDULE_QUEUES,
  type ScheduleRecalculateJobPayload,
  type ScheduleRecalculatedEventPayload,
} from './schedule.jobs.js';
import { ScheduleService } from './schedule.service.js';
import { ScheduleRevisionConflictError, ScheduleValidationError } from './schedule.errors.js';
import { ScheduleMetricsService } from '../schedule-metrics/schedule-metrics.service.js';

const logger = createLogger({ name: 'schedule-worker' });
const tracer = trace.getTracer('schedule-worker');

const scheduleService = new ScheduleService();
const metricsService = new ScheduleMetricsService();

/**
 * Marks the project scheduleStatus as FAILED so the UI can surface the error
 * without leaving the project stuck in CALCULATING forever.
 */
async function markScheduleFailed(orgId: string, projectId: string): Promise<void> {
  try {
    await getDb()
      .update(projects)
      .set({ scheduleStatus: 'FAILED', updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)));
  } catch (err) {
    logger.error({ err, projectId }, 'Failed to mark scheduleStatus as FAILED');
  }
}

export async function registerScheduleWorkers(boss: PgBoss): Promise<void> {
  // ── SCHEDULE_RECALCULATE worker ────────────────────────────────────────────
  // Handles large-project (≥ 100 tasks) asynchronous schedule recalculation.
  // Concurrency 2 keeps DB write pressure manageable; timeout 5 min covers
  // the worst-case recalculation for very large graphs.
  await registerWorker<ScheduleRecalculateJobPayload>(
    boss,
    {
      queue: SCHEDULE_QUEUES.SCHEDULE_RECALCULATE,
      concurrency: 2,
      timeoutSecs: 300,
      tenantIdExtractor: (data) => data.organizationId,
    },
    async (job) => {
      const { organizationId, projectId, actorUserId, expectedRevision, correlationId } = job.data;

      return withSpan(tracer, 'worker.schedule.recalculate', async (span) => {
        span.setAttribute('organization.id', organizationId);
        span.setAttribute('project.id', projectId);
        span.setAttribute('schedule.correlation_id', correlationId);
        span.setAttribute('pg_boss.job_id', job.id);

        logger.info(
          { jobId: job.id, organizationId, projectId, expectedRevision, correlationId },
          'Starting async schedule recalculation',
        );

        try {
          const result = await scheduleService.executeCalculation(
            organizationId,
            projectId,
            expectedRevision,
          );

          logger.info(
            {
              jobId: job.id,
              organizationId,
              projectId,
              nextRevision: result.nextRevision,
              criticalPathCount: result.criticalPathCount,
              correlationId,
            },
            'Async schedule recalculation complete',
          );

          span.setAttribute('schedule.new_revision', result.nextRevision);
          span.setAttribute('schedule.critical_task_count', result.criticalPathCount);

          // Count total tasks for the completion event payload
          const { taskCount } = await scheduleService.hydrateGraph(organizationId, projectId);

          // Fire the post-calculation domain event so downstream consumers
          // (metrics materialization, notifications, webhooks) can react.
          const eventPayload: ScheduleRecalculatedEventPayload = {
            organizationId,
            projectId,
            actorUserId,
            newRevision: result.nextRevision,
            criticalTaskCount: result.criticalPathCount,
            taskCount,
            correlationId,
            idempotencyKey: `schedule:recalculated:${projectId}:${result.nextRevision}`,
          };

          await sendJob(SCHEDULE_QUEUES.SCHEDULE_RECALCULATED_EVENT, eventPayload, {
            singletonKey: eventPayload.idempotencyKey,
          });
        } catch (err) {
          if (err instanceof ScheduleRevisionConflictError) {
            // The project was already recalculated by a concurrent job — not an error,
            // just discard this stale job. scheduleStatus was reset to IDLE by the
            // winning transaction so we don't need to mark FAILED.
            logger.info(
              { jobId: job.id, projectId, correlationId },
              'Discarding stale schedule recalculation job (revision conflict)',
            );
            return; // complete the job successfully so pg-boss doesn't retry
          }

          if (err instanceof ScheduleValidationError) {
            // Validation failures are deterministic — retrying won't help.
            // Mark as FAILED so the UI can surface the issue immediately.
            logger.warn(
              { jobId: job.id, projectId, correlationId, errors: err.errors },
              'Schedule validation failed — marking project FAILED, not retrying',
            );
            await markScheduleFailed(organizationId, projectId);
            return; // complete without throwing so pg-boss doesn't retry
          }

          // All other errors (DB transient failures, etc.) — mark FAILED and
          // rethrow so pg-boss can apply its retry/backoff policy.
          await markScheduleFailed(organizationId, projectId);
          throw err;
        }
      });
    },
  );

  // ── SCHEDULE_RECALCULATED_EVENT consumer ────────────────────────────────────
  // Materializes the projectScheduleMetrics read model and populates the
  // revision-tied Redis cache after a successful large-project recalculation.
  // This closes the loop: async worker → event → metrics read model refresh.
  await registerWorker<ScheduleRecalculatedEventPayload>(
    boss,
    {
      queue: SCHEDULE_QUEUES.SCHEDULE_RECALCULATED_EVENT,
      concurrency: 5,
      timeoutSecs: 60,
      tenantIdExtractor: (data) => data.organizationId,
    },
    async (job) => {
      const { organizationId, projectId, newRevision, correlationId } = job.data;

      return withSpan(tracer, 'worker.schedule.metrics_refresh', async (span) => {
        span.setAttribute('organization.id', organizationId);
        span.setAttribute('project.id', projectId);
        span.setAttribute('schedule.new_revision', newRevision);
        span.setAttribute('schedule.correlation_id', correlationId);

        logger.info(
          { organizationId, projectId, newRevision, correlationId },
          'Materializing schedule metrics after async recalculation',
        );

        await metricsService.materializeMetrics(organizationId, projectId, newRevision);

        logger.info(
          { organizationId, projectId, newRevision },
          'Schedule metrics materialized and cached',
        );
      });
    },
  );

  logger.info('Registered Schedule module PgBoss workers');
}
