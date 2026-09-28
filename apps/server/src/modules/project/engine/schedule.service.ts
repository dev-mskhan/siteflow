// apps/server/src/modules/project/engine/schedule.service.ts
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { getDb } from '../../../lib/db/index.js';
import { sendJob } from '../../../lib/queue/index.js';
import {
  tasks,
  taskDependencies,
  projectCalendars,
  calendarExceptions,
  projects,
} from '@siteflow/database/schema';
import type { WorkDaysConfig } from '@siteflow/database/schema';
import { ScheduleValidator } from './schedule.validator.js';
import { ScheduleEngine } from './schedule.engine.js';
import { ScheduleValidationError, ScheduleRevisionConflictError } from './schedule.errors.js';
import type { ScheduleGraph, ScheduleNode, ScheduleDependency } from './schedule.engine.types.js';
import { SCHEDULE_QUEUES, type ScheduleRecalculateJobPayload } from './schedule.jobs.js';

const tracer = trace.getTracer('schedule-service');

export const SYNC_CALCULATION_TASK_THRESHOLD = 100;

export interface RecalculationResponse {
  queued: boolean;
  revision: number;
  maxFinishDate?: string | null;
  criticalPathCount?: number;
}

// ── Internal graph hydration ──────────────────────────────────────────────────

interface HydratedGraph {
  graph: ScheduleGraph;
  workDays: WorkDaysConfig;
  exceptionsMap: Map<string, boolean>;
  taskCount: number;
  projectStartDate: string;
  currentRevision: number;
}

export class ScheduleService {
  private get db() {
    return getDb();
  }

  /**
   * Fetches all data needed to build a ScheduleGraph for the given project.
   * Used by both the sync fast-path and the async worker.
   */
  async hydrateGraph(orgId: string, projectId: string): Promise<HydratedGraph> {
    const [proj] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)))
      .limit(1);

    if (!proj) {
      throw new Error(`Project '${projectId}' not found in organization '${orgId}'.`);
    }

    const projectStartDate = proj.plannedStartDate ?? new Date().toISOString().split('T')[0]!;

    const dbTasks = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.organizationId, orgId)));

    const dbDeps = await this.db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.projectId, projectId),
          eq(taskDependencies.organizationId, orgId),
        ),
      );

    const [cal] = await this.db
      .select()
      .from(projectCalendars)
      .where(
        and(
          eq(projectCalendars.projectId, projectId),
          eq(projectCalendars.organizationId, orgId),
        ),
      )
      .limit(1);

    const workDays: WorkDaysConfig = cal?.workDays ?? {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    };

    const exceptionsMap = new Map<string, boolean>();
    if (cal) {
      const excs = await this.db
        .select()
        .from(calendarExceptions)
        .where(eq(calendarExceptions.calendarId, cal.id));
      for (const exc of excs) {
        exceptionsMap.set(exc.exceptionDate, exc.isWorkingDay);
      }
    }

    const nodesMap = new Map<string, ScheduleNode>();
    for (const t of dbTasks) {
      nodesMap.set(t.id, {
        id: t.id,
        taskCode: t.taskCode,
        taskType: t.taskType,
        durationDays: t.currentDurationDays,
        currentStartDate: t.currentStartDate,
        currentFinishDate: t.currentFinishDate,
        constraintType: t.constraintType,
        constraintDate: t.constraintDate,
      });
    }

    const edgesList: ScheduleDependency[] = dbDeps.map((d) => ({
      id: d.id,
      taskId: d.taskId,
      predecessorId: d.predecessorId,
      dependencyType: d.dependencyType,
      lagDays: d.lagDays,
    }));

    const graph: ScheduleGraph = {
      nodes: nodesMap,
      edges: edgesList,
      projectStartDate,
    };

    return {
      graph,
      workDays,
      exceptionsMap,
      taskCount: dbTasks.length,
      projectStartDate,
      currentRevision: proj.scheduleRevision,
    };
  }

  /**
   * Core calculation + persistence, run inside a locked transaction.
   * Called by both the sync fast-path and the async worker.
   * Returns the new revision and calculation result.
   */
  async executeCalculation(
    orgId: string,
    projectId: string,
    expectedRevision?: number,
  ): Promise<{ nextRevision: number; maxFinishDate: string | null; criticalPathCount: number }> {
    const { graph, workDays, exceptionsMap } = await this.hydrateGraph(orgId, projectId);

    // Pre-flight validation (outside transaction — read-only)
    const validation = ScheduleValidator.validate(graph);
    if (!validation.valid) {
      throw new ScheduleValidationError(validation.errors);
    }

    return this.db.transaction(async (tx) => {
      // Lock the project row to prevent concurrent recalculations
      const [lockedProj] = await tx
        .select({ id: projects.id, scheduleRevision: projects.scheduleRevision })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)))
        .for('update');

      if (!lockedProj) {
        throw new Error(`Project '${projectId}' not found.`);
      }

      const currentRev = lockedProj.scheduleRevision;
      if (expectedRevision !== undefined && currentRev !== expectedRevision) {
        throw new ScheduleRevisionConflictError(expectedRevision, currentRev);
      }

      const calcResult = ScheduleEngine.calculate(graph, workDays, exceptionsMap);

      // Persist updated task dates, float, and critical flag
      for (const [taskId, node] of calcResult.updatedNodes.entries()) {
        await tx
          .update(tasks)
          .set({
            currentStartDate: node.earlyStart ?? null,
            currentFinishDate: node.earlyFinish ?? null,
            floatDays: node.totalFloat ?? 0,
            isCritical: node.isCritical ?? false,
            updatedAt: new Date(),
          })
          .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));
      }

      // Increment revision and reset scheduleStatus to IDLE
      const nextRevision = currentRev + 1;
      await tx
        .update(projects)
        .set({
          scheduleRevision: nextRevision,
          scheduleStatus: 'IDLE',
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)));

      return {
        nextRevision,
        maxFinishDate: calcResult.maxFinishDate,
        criticalPathCount: calcResult.criticalPathTaskIds.length,
      };
    });
  }

  /**
   * Public entry point called by the HTTP handler.
   *
   * Small graph  (< 100 tasks): runs synchronously, returns 200 with full result.
   * Large graph  (≥ 100 tasks): sets scheduleStatus = CALCULATING, enqueues a
   *   SCHEDULE_RECALCULATE PgBoss job, and returns immediately so the HTTP
   *   handler can respond 202 Accepted.
   */
  async recalculateProjectSchedule(
    actorUserId: string,
    orgId: string,
    projectId: string,
    expectedRevision?: number,
  ): Promise<RecalculationResponse> {
    return withSpan(tracer, 'schedule.recalculate', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('actor.user_id', actorUserId);

      // Hydrate graph once — used for both the threshold check and (sync) execution
      const hydrated = await this.hydrateGraph(orgId, projectId);

      if (expectedRevision !== undefined && hydrated.currentRevision !== expectedRevision) {
        throw new ScheduleRevisionConflictError(expectedRevision, hydrated.currentRevision);
      }

      // ── Async path: large graph ────────────────────────────────────────────
      if (hydrated.taskCount >= SYNC_CALCULATION_TASK_THRESHOLD) {
        span.setAttribute('schedule.async', true);
        span.setAttribute('schedule.task_count', hydrated.taskCount);

        // Mark the project as calculating so clients can show a spinner
        await this.db
          .update(projects)
          .set({ scheduleStatus: 'CALCULATING', updatedAt: new Date() })
          .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)));

        const correlationId = randomUUID();
        const payload: ScheduleRecalculateJobPayload = {
          organizationId: orgId,
          projectId,
          actorUserId,
          expectedRevision,
          correlationId,
          idempotencyKey: `schedule:recalc:${projectId}:${hydrated.currentRevision}`,
        };

        await sendJob(SCHEDULE_QUEUES.SCHEDULE_RECALCULATE, payload, {
          // Deduplicate concurrent enqueues for the same project+revision
          singletonKey: payload.idempotencyKey,
          // Allow a reasonable window before the job expires
          expireInSeconds: 300,
          // Retry up to 3 times with exponential backoff
          retryLimit: 3,
          retryDelay: 30,
          retryBackoff: true,
        });

        span.setAttribute('schedule.correlation_id', correlationId);

        return {
          queued: true,
          revision: hydrated.currentRevision,
        };
      }

      // ── Sync path: small graph ─────────────────────────────────────────────
      span.setAttribute('schedule.async', false);
      span.setAttribute('schedule.task_count', hydrated.taskCount);

      const result = await this.executeCalculation(orgId, projectId, expectedRevision);

      return {
        queued: false,
        revision: result.nextRevision,
        maxFinishDate: result.maxFinishDate,
        criticalPathCount: result.criticalPathCount,
      };
    });
  }
}
