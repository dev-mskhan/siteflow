// apps/server/src/modules/project/schedule-history/schedule-history.repository.ts
import { scheduleChanges, type ScheduleChange } from '@siteflow/database/schema';
import { eq, and, desc } from 'drizzle-orm';

export class ScheduleHistoryRepository {
  async listByProject(
    db: any,
    organizationId: string,
    projectId: string,
  ): Promise<ScheduleChange[]> {
    return db
      .select()
      .from(scheduleChanges)
      .where(
        and(
          eq(scheduleChanges.organizationId, organizationId),
          eq(scheduleChanges.projectId, projectId),
        ),
      )
      .orderBy(desc(scheduleChanges.createdAt));
  }

  async listByTask(
    db: any,
    organizationId: string,
    projectId: string,
    taskId: string,
  ): Promise<ScheduleChange[]> {
    return db
      .select()
      .from(scheduleChanges)
      .where(
        and(
          eq(scheduleChanges.organizationId, organizationId),
          eq(scheduleChanges.projectId, projectId),
          eq(scheduleChanges.taskId, taskId),
        ),
      )
      .orderBy(desc(scheduleChanges.createdAt));
  }

  /**
   * Append-only insert — domain event recording a task date change.
   * Never update or delete these records.
   */
  async record(
    db: any,
    data: {
      id: string;
      organizationId: string;
      projectId: string;
      taskId: string;
      sourceType: string;
      sourceId?: string;
      oldStartDate?: string;
      oldFinishDate?: string;
      newStartDate?: string;
      newFinishDate?: string;
      reason?: string;
      actorUserId?: string;
    },
  ): Promise<ScheduleChange> {
    const rows = await db.insert(scheduleChanges).values(data).returning();
    return rows[0]!;
  }
}
