// apps/server/src/modules/project/baseline/baseline.service.ts
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { BaselineRepository } from './baseline.repository.js';
import { CalendarService } from '../calendar/calendar.service.js';
import {
  BaselineNotFoundError,
  BaselineImmutabilityError,
  BaselineAlreadyActiveError,
  BaselineNoTasksError,
} from './baseline.errors.js';
import type {
  BaselineDTO,
  CreateBaselineInput,
  BaselineComparisonDTO,
} from './baseline.types.js';

import { tasks, projects, projectCalendars, calendarExceptions, type ScheduleBaseline, type ScheduleBaselineTask, type WorkDaysConfig } from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';

const tracer = trace.getTracer('baseline-service');
const calendarService = new CalendarService();

export function toBaselineDTO(
  baseline: ScheduleBaseline,
  taskCount?: number,
  tasksList?: ScheduleBaselineTask[],
): BaselineDTO {
  return {
    id: baseline.id,
    organizationId: baseline.organizationId,
    projectId: baseline.projectId,
    name: baseline.name,
    description: baseline.description,
    status: baseline.status,
    activatedAt: baseline.activatedAt ? baseline.activatedAt.toISOString() : null,
    activatedBy: baseline.activatedBy,
    createdBy: baseline.createdBy,
    createdAt: baseline.createdAt.toISOString(),
    taskCount: taskCount ?? tasksList?.length,
    tasks: tasksList?.map((t) => ({
      id: t.id,
      baselineId: t.baselineId,
      taskId: t.taskId,
      baselineStartDate: t.baselineStartDate,
      baselineFinishDate: t.baselineFinishDate,
      baselineDurationDays: t.baselineDurationDays,
    })),
  };
}

export class BaselineService {
  constructor(private repo = new BaselineRepository()) {}

  private get db() {
    return getDb();
  }

  // ── 1. Create Baseline Snapshot ─────────────────────────────────────────────
  async createBaseline(
    actorUserId: string,
    orgId: string,
    projectId: string,
    input: CreateBaselineInput,
  ): Promise<BaselineDTO> {
    return withSpan(tracer, 'baseline.create', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('actor.user_id', actorUserId);

      const result = await this.db.transaction(async (tx) => {
        const baselineId = generateId();
        const newBaseline = await this.repo.insertBaseline(tx as any, {
          id: baselineId,
          organizationId: orgId,
          projectId,
          name: input.name,
          description: input.description ?? null,
          status: 'DRAFT',
          createdBy: actorUserId,
        });

        const count = await this.repo.createSnapshotTasks(
          tx as any,
          orgId,
          projectId,
          baselineId,
          () => generateId(),
        );

        if (count === 0) {
          throw new BaselineNoTasksError();
        }

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'schedule_baseline.created',
            resourceType: 'ScheduleBaseline',
            resourceId: baselineId,
            metadata: { name: input.name, taskCount: count },
          },
          tx,
        );

        return { newBaseline, count };
      });

      return toBaselineDTO(result.newBaseline, result.count);
    });
  }

  // ── 2. Activate Baseline ──────────────────────────────────────────────────
  async activateBaseline(
    actorUserId: string,
    orgId: string,
    projectId: string,
    baselineId: string,
  ): Promise<BaselineDTO> {
    return withSpan(tracer, 'baseline.activate', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('baseline.id', baselineId);
      span.setAttribute('actor.user_id', actorUserId);

      const existing = await this.repo.findById(this.db, orgId, projectId, baselineId);
      if (!existing) {
        throw new BaselineNotFoundError(baselineId);
      }

      if (existing.status === 'ACTIVE') {
        throw new BaselineAlreadyActiveError(baselineId);
      }

      const activated = await this.db.transaction(async (tx) => {
        // Lock project record to prevent concurrent baseline activations
        await tx
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)))
          .for('update');

        // Supersede any currently active baseline
        await this.repo.supersedeActiveBaselines(tx as any, orgId, projectId);

        // Activate target baseline
        const activatedBaseline = await this.repo.activateBaseline(
          tx as any,
          orgId,
          projectId,
          baselineId,
          actorUserId,
        );

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'schedule_baseline.activated',
            resourceType: 'ScheduleBaseline',
            resourceId: baselineId,
          },
          tx,
        );

        return activatedBaseline;
      });

      const tasksList = await this.repo.findBaselineTasks(this.db, baselineId);
      return toBaselineDTO(activated, tasksList.length, tasksList);
    });
  }

  // ── 3. Get Baseline with Tasks ─────────────────────────────────────────────
  async getBaseline(
    orgId: string,
    projectId: string,
    baselineId: string,
  ): Promise<BaselineDTO> {
    return withSpan(tracer, 'baseline.get', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('baseline.id', baselineId);

      const baseline = await this.repo.findById(this.db, orgId, projectId, baselineId);
      if (!baseline) {
        throw new BaselineNotFoundError(baselineId);
      }

      const tasksList = await this.repo.findBaselineTasks(this.db, baselineId);
      return toBaselineDTO(baseline, tasksList.length, tasksList);
    });
  }

  // ── 4. List Baselines for Project ──────────────────────────────────────────
  async listBaselines(orgId: string, projectId: string): Promise<BaselineDTO[]> {
    return withSpan(tracer, 'baseline.list', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      const baselines = await this.repo.findByProject(this.db, orgId, projectId);
      return baselines.map((b) => toBaselineDTO(b, b.taskCount));
    });
  }

  // ── 5. Compare Baseline with Current Schedule ──────────────────────────────
  async compareBaselineWithCurrent(
    orgId: string,
    projectId: string,
    baselineId: string,
  ): Promise<BaselineComparisonDTO[]> {
    return withSpan(tracer, 'baseline.compare', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('baseline.id', baselineId);

      const baseline = await this.repo.findById(this.db, orgId, projectId, baselineId);
      if (!baseline) {
        throw new BaselineNotFoundError(baselineId);
      }

      const baselineTasks = await this.repo.findBaselineTasks(this.db, baselineId);
      const currentTasks = await this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.organizationId, orgId)));

      const currentTaskMap = new Map(currentTasks.map((t) => [t.id, t]));

      // Fetch calendar for working day calculations
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

      const comparisons: BaselineComparisonDTO[] = [];

      for (const bt of baselineTasks) {
        const ct = currentTaskMap.get(bt.taskId);
        if (!ct) continue;

        let startVariance = 0;
        let finishVariance = 0;

        if (ct.currentStartDate) {
          if (ct.currentStartDate >= bt.baselineStartDate) {
            startVariance = calendarService.calculateWorkingDuration(
              bt.baselineStartDate,
              ct.currentStartDate,
              workDays,
              exceptionsMap,
            ) - 1;
          } else {
            startVariance = -(
              calendarService.calculateWorkingDuration(
                ct.currentStartDate,
                bt.baselineStartDate,
                workDays,
                exceptionsMap,
              ) - 1
            );
          }
        }

        if (ct.currentFinishDate) {
          if (ct.currentFinishDate >= bt.baselineFinishDate) {
            finishVariance = calendarService.calculateWorkingDuration(
              bt.baselineFinishDate,
              ct.currentFinishDate,
              workDays,
              exceptionsMap,
            ) - 1;
          } else {
            finishVariance = -(
              calendarService.calculateWorkingDuration(
                ct.currentFinishDate,
                bt.baselineFinishDate,
                workDays,
                exceptionsMap,
              ) - 1
            );
          }
        }

        comparisons.push({
          taskId: bt.taskId,
          taskCode: ct.taskCode,
          taskName: ct.name,
          currentStart: ct.currentStartDate,
          currentFinish: ct.currentFinishDate,
          baselineStart: bt.baselineStartDate,
          baselineFinish: bt.baselineFinishDate,
          baselineDurationDays: bt.baselineDurationDays,
          currentDurationDays: ct.currentDurationDays,
          startVarianceDays: Math.max(0, startVariance),
          finishVarianceDays: Math.max(0, finishVariance),
        });
      }

      return comparisons;
    });
  }

  // ── 6. Delete Baseline ─────────────────────────────────────────────────────
  async deleteBaseline(
    actorUserId: string,
    orgId: string,
    projectId: string,
    baselineId: string,
  ): Promise<void> {
    return withSpan(tracer, 'baseline.delete', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('baseline.id', baselineId);
      span.setAttribute('actor.user_id', actorUserId);

      const existing = await this.repo.findById(this.db, orgId, projectId, baselineId);
      if (!existing) {
        throw new BaselineNotFoundError(baselineId);
      }

      if (existing.status === 'ACTIVE' || existing.status === 'SUPERSEDED') {
        throw new BaselineImmutabilityError(
          `Cannot delete baseline '${baselineId}' because it is in status '${existing.status}'. Only DRAFT baselines can be deleted.`,
        );
      }

      await this.db.transaction(async (tx) => {
        await this.repo.delete(tx as any, orgId, projectId, baselineId);
        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'schedule_baseline.deleted',
            resourceType: 'ScheduleBaseline',
            resourceId: baselineId,
          },
          tx,
        );
      });
    });
  }
}
