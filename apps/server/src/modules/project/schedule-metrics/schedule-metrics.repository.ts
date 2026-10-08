// apps/server/src/modules/project/schedule-metrics/schedule-metrics.repository.ts
import { projectScheduleMetrics, type ProjectScheduleMetrics } from '@siteflow/database/schema';
import { and, eq, sql } from 'drizzle-orm';

export class ScheduleMetricsRepository {
  async findByProject(
    db: any,
    organizationId: string,
    projectId: string,
  ): Promise<ProjectScheduleMetrics | undefined> {
    const rows = await db
      .select()
      .from(projectScheduleMetrics)
      .where(
        and(
          eq(projectScheduleMetrics.organizationId, organizationId),
          eq(projectScheduleMetrics.projectId, projectId),
        ),
      )
      .limit(1);
    return rows[0];
  }

  /**
   * Upsert metrics — always overwrites for the given organization/project pair.
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
        target: [projectScheduleMetrics.organizationId, projectScheduleMetrics.projectId],
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
