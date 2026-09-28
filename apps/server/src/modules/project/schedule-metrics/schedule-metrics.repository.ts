// apps/server/src/modules/project/schedule-metrics/schedule-metrics.repository.ts
import { projectScheduleMetrics, type ProjectScheduleMetrics } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export class ScheduleMetricsRepository {
  async findByProject(
    db: any,
    projectId: string,
  ): Promise<ProjectScheduleMetrics | undefined> {
    const rows = await db
      .select()
      .from(projectScheduleMetrics)
      .where(eq(projectScheduleMetrics.projectId, projectId));
    return rows[0];
  }

  /**
   * Upsert metrics — always overwrites for the given projectId.
   * Called after every schedule recalculation.
   */
  async upsert(
    db: any,
    data: {
      id: string;
      organizationId: string;
      projectId: string;
      totalTasks: number;
      completedTasks: number;
      criticalTaskCount: number;
      scheduleRevision: number;
    },
  ): Promise<ProjectScheduleMetrics> {
    const rows = await db
      .insert(projectScheduleMetrics)
      .values(data)
      .onConflictDoUpdate({
        target: projectScheduleMetrics.projectId,
        set: {
          totalTasks: sql`excluded.total_tasks`,
          completedTasks: sql`excluded.completed_tasks`,
          criticalTaskCount: sql`excluded.critical_task_count`,
          scheduleRevision: sql`excluded.schedule_revision`,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return rows[0]!;
  }
}
