// apps/server/src/modules/reporting/schedule/schedule-report.repository.ts
// F.12 — Repository queries for schedule variance & progress report facts.
// Scoped strictly by organizationId and projectId.

import { getDb } from '../../../lib/db/index.js';
import { tasks, projects } from '@siteflow/database/schema';
import { and, eq, count, sql, gte, lte } from 'drizzle-orm';

export interface TasksByStatusFacts {
  notStarted: number;
  inProgress: number;
  completed: number;
  blocked: number;
  cancelled: number;
}

export interface LookaheadTaskItem {
  id: string;
  taskCode: string;
  name: string;
  status: string;
  priority: string;
  isCritical: boolean;
  currentStartDate: string | null;
  currentFinishDate: string | null;
  progressPercent: number;
}

export class ScheduleReportRepository {
  private get db() {
    return getDb();
  }

  async getTasksByStatus(
    organizationId: string,
    projectId: string,
  ): Promise<TasksByStatusFacts> {
    const rows = await this.db
      .select({
        status: tasks.status,
        count: count(),
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, organizationId),
          eq(tasks.projectId, projectId),
        ),
      )
      .groupBy(tasks.status);

    const result: TasksByStatusFacts = {
      notStarted: 0,
      inProgress: 0,
      completed: 0,
      blocked: 0,
      cancelled: 0,
    };

    for (const row of rows) {
      const cnt = Number(row.count);
      if (row.status === 'NOT_STARTED') result.notStarted = cnt;
      else if (row.status === 'IN_PROGRESS') result.inProgress = cnt;
      else if (row.status === 'COMPLETED') result.completed = cnt;
      else if (row.status === 'BLOCKED') result.blocked = cnt;
      else if (row.status === 'CANCELLED') result.cancelled = cnt;
    }
    return result;
  }

  async getLookaheadTasks(
    organizationId: string,
    projectId: string,
    startDate?: string | null,
    endDate?: string | null,
  ): Promise<LookaheadTaskItem[]> {
    const conditions = [
      eq(tasks.organizationId, organizationId),
      eq(tasks.projectId, projectId),
    ];

    if (startDate) {
      conditions.push(gte(tasks.currentFinishDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(tasks.currentStartDate, endDate));
    }

    const rows = await this.db
      .select({
        id: tasks.id,
        taskCode: tasks.taskCode,
        name: tasks.name,
        status: tasks.status,
        priority: tasks.priority,
        isCritical: tasks.isCritical,
        currentStartDate: tasks.currentStartDate,
        currentFinishDate: tasks.currentFinishDate,
        progressPercent: tasks.progressPercent,
      })
      .from(tasks)
      .where(and(...conditions))
      .limit(100);

    return rows.map((r) => ({
      ...r,
      currentStartDate: r.currentStartDate ?? null,
      currentFinishDate: r.currentFinishDate ?? null,
    }));
  }
}
