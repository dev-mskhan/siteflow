// apps/server/src/modules/project/baseline/baseline.repository.ts
import { eq, and, sql } from 'drizzle-orm';

import {
  scheduleBaselines,
  scheduleBaselineTasks,
  tasks,
  type ScheduleBaseline,
  type NewScheduleBaseline,
  type ScheduleBaselineTask,
} from '@siteflow/database/schema';

export class BaselineRepository {
  async insertBaseline(
    db: any,
    data: NewScheduleBaseline,
  ): Promise<ScheduleBaseline> {
    const result = await db.insert(scheduleBaselines).values(data).returning();
    return result[0]!;
  }

  async findById(
    db: any,
    orgId: string,
    projectId: string,
    baselineId: string,
  ): Promise<ScheduleBaseline | null> {
    const result = await db
      .select()
      .from(scheduleBaselines)
      .where(
        and(
          eq(scheduleBaselines.id, baselineId),
          eq(scheduleBaselines.projectId, projectId),
          eq(scheduleBaselines.organizationId, orgId),
        ),
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findByProject(
    db: any,
    orgId: string,
    projectId: string,
  ): Promise<(ScheduleBaseline & { taskCount: number })[]> {
    const rows = await db
      .select({
        baseline: scheduleBaselines,
        taskCount: sql<number>`COALESCE(COUNT(${scheduleBaselineTasks.id}), 0)::int`,
      })
      .from(scheduleBaselines)
      .leftJoin(
        scheduleBaselineTasks,
        eq(scheduleBaselineTasks.baselineId, scheduleBaselines.id),
      )
      .where(
        and(
          eq(scheduleBaselines.projectId, projectId),
          eq(scheduleBaselines.organizationId, orgId),
        ),
      )
      .groupBy(scheduleBaselines.id)
      .orderBy(sql`${scheduleBaselines.createdAt} DESC`);

    return rows.map((r: any) => ({
      ...r.baseline,
      taskCount: r.taskCount,
    }));
  }

  async findActiveBaseline(
    db: any,
    orgId: string,
    projectId: string,
  ): Promise<ScheduleBaseline | null> {
    const result = await db
      .select()
      .from(scheduleBaselines)
      .where(
        and(
          eq(scheduleBaselines.projectId, projectId),
          eq(scheduleBaselines.organizationId, orgId),
          eq(scheduleBaselines.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findBaselineTasks(
    db: any,
    baselineId: string,
  ): Promise<ScheduleBaselineTask[]> {
    return db
      .select()
      .from(scheduleBaselineTasks)
      .where(eq(scheduleBaselineTasks.baselineId, baselineId));
  }

  /**
   * Snapshot current project tasks into baseline_tasks table for given baselineId.
   */
  async createSnapshotTasks(
    db: any,
    orgId: string,
    projectId: string,
    baselineId: string,
    idGenerator: () => string,
  ): Promise<number> {
    const projectTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId),
          eq(tasks.organizationId, orgId),
        ),
      );

    const schedulableTasks = projectTasks.filter(
      (t: any) => t.currentStartDate && t.currentFinishDate,
    );

    if (schedulableTasks.length === 0) {
      return 0;
    }

    const newRows = schedulableTasks.map((t: any) => ({
      id: idGenerator(),
      baselineId,
      taskId: t.id,
      baselineStartDate: t.currentStartDate!,
      baselineFinishDate: t.currentFinishDate!,
      baselineDurationDays: t.currentDurationDays,
    }));

    await db.insert(scheduleBaselineTasks).values(newRows);
    return newRows.length;
  }

  /**
   * Sets current ACTIVE baseline to SUPERSEDED for a project.
   */
  async supersedeActiveBaselines(
    db: any,
    orgId: string,
    projectId: string,
  ): Promise<void> {
    await db
      .update(scheduleBaselines)
      .set({
        status: 'SUPERSEDED',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduleBaselines.projectId, projectId),
          eq(scheduleBaselines.organizationId, orgId),
          eq(scheduleBaselines.status, 'ACTIVE'),
        ),
      );
  }

  /**
   * Activates a baseline (sets status = ACTIVE, activatedAt, activatedBy).
   */
  async activateBaseline(
    db: any,
    orgId: string,
    projectId: string,
    baselineId: string,
    actorUserId: string,
  ): Promise<ScheduleBaseline> {
    const result = await db
      .update(scheduleBaselines)
      .set({
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduleBaselines.id, baselineId),
          eq(scheduleBaselines.projectId, projectId),
          eq(scheduleBaselines.organizationId, orgId),
        ),
      )
      .returning();

    return result[0]!;
  }

  async delete(
    db: any,
    orgId: string,
    projectId: string,
    baselineId: string,
  ): Promise<boolean> {
    const result = await db
      .delete(scheduleBaselines)
      .where(
        and(
          eq(scheduleBaselines.id, baselineId),
          eq(scheduleBaselines.projectId, projectId),
          eq(scheduleBaselines.organizationId, orgId),
          eq(scheduleBaselines.status, 'DRAFT'), // Safety check: only DRAFT can be deleted
        ),
      )
      .returning({ id: scheduleBaselines.id });

    return result.length > 0;
  }
}

