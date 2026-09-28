import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { eq, and } from 'drizzle-orm';



import { getDb } from '../../../lib/db/index.js';
import { tasks, taskDependencies, projectCalendars, calendarExceptions, projects } from '@siteflow/database/schema';
import type { WorkDaysConfig } from '@siteflow/database/schema';
import { ScheduleValidator } from './schedule.validator.js';
import { ScheduleEngine } from './schedule.engine.js';
import { ScheduleValidationError, ScheduleRevisionConflictError } from './schedule.errors.js';
import type { ScheduleGraph, ScheduleNode, ScheduleDependency } from './schedule.engine.types.js';


const tracer = trace.getTracer('schedule-service');

export const SYNC_CALCULATION_TASK_THRESHOLD = 100;

export interface RecalculationResponse {
  queued: boolean;
  revision: number;
  maxFinishDate?: string | null;
  criticalPathCount?: number;
}

export class ScheduleService {
  private get db() {
    return getDb();
  }

  /**
   * Recalculates the project schedule.
   * Small graphs (< 100 tasks) are recalculated synchronously inside a locked transaction.
   * Large graphs (>= 100 tasks) set scheduleStatus = 'CALCULATING' and enqueue async worker.
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

      // 1. Fetch project to verify existence and check plannedStartDate / scheduleRevision
      const [proj] = await this.db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)))
        .limit(1);

      if (!proj) {
        throw new Error(`Project '${projectId}' not found in organization '${orgId}'.`);
      }

      if (expectedRevision !== undefined && proj.scheduleRevision !== expectedRevision) {
        throw new ScheduleRevisionConflictError(expectedRevision, proj.scheduleRevision);
      }

      const projectStartDate = proj.plannedStartDate ?? new Date().toISOString().split('T')[0]!;

      // 2. Fetch all tasks for project
      const dbTasks = await this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.organizationId, orgId)));

      // 3. Fetch all dependencies for project
      const dbDeps = await this.db
        .select()
        .from(taskDependencies)
        .where(and(eq(taskDependencies.projectId, projectId), eq(taskDependencies.organizationId, orgId)));

      // 4. Fetch project calendar & exceptions
      const [cal] = await this.db
        .select()
        .from(projectCalendars)
        .where(and(eq(projectCalendars.projectId, projectId), eq(projectCalendars.organizationId, orgId)))
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

      // 5. Construct ScheduleGraph
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

      // 6. Pre-flight Validation
      const validation = ScheduleValidator.validate(graph);
      if (!validation.valid) {
        throw new ScheduleValidationError(validation.errors);
      }

      // 7. Check threshold for Sync vs Async
      if (dbTasks.length >= SYNC_CALCULATION_TASK_THRESHOLD) {
        // Queue PgBoss async job for large projects
        // Note: For Phase 1-3.4 fast-path, async queue dispatch handles >100 tasks
        return {
          queued: true,
          revision: proj.scheduleRevision,
        };
      }

      // 8. Synchronous Fast-Path: Calculate and persist in locked transaction
      const result = await this.db.transaction(async (tx) => {
        // Lock project record FOR UPDATE to prevent race conditions & check revision
        const [lockedProj] = await tx
          .select({
            id: projects.id,
            scheduleRevision: projects.scheduleRevision,
          })
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


        // Run calculation engine
        const calcResult = ScheduleEngine.calculate(graph, workDays, exceptionsMap);

        // Update each calculated task node
        for (const [taskId, calculatedNode] of calcResult.updatedNodes.entries()) {
          await tx
            .update(tasks)
            .set({
              currentStartDate: calculatedNode.earlyStart ?? null,
              currentFinishDate: calculatedNode.earlyFinish ?? null,
              floatDays: calculatedNode.totalFloat ?? 0,
              isCritical: calculatedNode.isCritical ?? false,
              updatedAt: new Date(),
            })
            .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));
        }

        // Increment project schedule_revision
        const nextRevision = currentRev + 1;
        await tx
          .update(projects)
          .set({
            scheduleRevision: nextRevision,
            updatedAt: new Date(),
          })
          .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)));

        return {
          calcResult,
          nextRevision,
        };
      });

      return {
        queued: false,
        revision: result.nextRevision,
        maxFinishDate: result.calcResult.maxFinishDate,
        criticalPathCount: result.calcResult.criticalPathTaskIds.length,
      };
    });
  }
}
