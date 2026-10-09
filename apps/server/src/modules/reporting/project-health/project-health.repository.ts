// apps/server/src/modules/reporting/project-health/project-health.repository.ts
// F.11 — reads fact rows needed for health indicators from existing domain tables.
// Does NOT create new materialized data; pulls from authoritative sources only.

import { getDb } from '../../../lib/db/index.js';
import {
  projects,
  issues,
  rfis,
  tasks,
} from '@siteflow/database/schema';
import { and, eq, count, sql } from 'drizzle-orm';

export interface ProjectCoreFacts {
  id: string;
  organizationId: string;
  status: string;
  name: string;
  code: string;
  defaultCurrency: string;
  startDate: string | null;
  endDate: string | null;
  updatedAt: Date;
}

export interface IssueCountFacts {
  open: number;
  inProgress: number;
  resolved: number;
}

export interface RfiFacts {
  open: number;
  overdue: number; // due_date < now AND status not CLOSED
}

export interface TaskFacts {
  total: number;
  completed: number;
}

export class ProjectHealthRepository {
  private get db() {
    return getDb();
  }

  async getProjectCore(
    organizationId: string,
    projectId: string,
  ): Promise<ProjectCoreFacts | null> {
    const rows = await this.db
      .select({
        id: projects.id,
        organizationId: projects.organizationId,
        status: projects.status,
        name: projects.name,
        code: projects.projectNumber,
        defaultCurrency: projects.currency,
        startDate: projects.plannedStartDate,
        endDate: projects.plannedEndDate,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, organizationId),
          eq(projects.id, projectId),
        ),
      )
      .limit(1);
    if (!rows[0]) return null;
    return {
      ...rows[0],
      startDate: rows[0].startDate ?? null,
      endDate: rows[0].endDate ?? null,
    };
  }

  async getIssueCounts(
    organizationId: string,
    projectId: string,
  ): Promise<IssueCountFacts> {
    const rows = await this.db
      .select({
        status: issues.status,
        count: count(),
      })
      .from(issues)
      .where(
        and(
          eq(issues.organizationId, organizationId),
          eq(issues.projectId, projectId),
        ),
      )
      .groupBy(issues.status);

    const result: IssueCountFacts = { open: 0, inProgress: 0, resolved: 0 };
    for (const row of rows) {
      if (row.status === 'OPEN') result.open = Number(row.count);
      else if (row.status === 'IN_PROGRESS') result.inProgress = Number(row.count);
      else if (row.status === 'RESOLVED') result.resolved = Number(row.count);
    }
    return result;
  }

  async getRfiCounts(
    organizationId: string,
    projectId: string,
  ): Promise<RfiFacts> {
    const allRows = await this.db
      .select({ status: rfis.status, dueDate: rfis.dueDate })
      .from(rfis)
      .where(
        and(
          eq(rfis.organizationId, organizationId),
          eq(rfis.projectId, projectId),
        ),
      );

    const now = new Date();
    let open = 0;
    let overdue = 0;
    for (const row of allRows) {
      if (row.status !== 'CLOSED') {
        open++;
        if (row.dueDate && new Date(row.dueDate) < now) {
          overdue++;
        }
      }
    }
    return { open, overdue };
  }

  async getTaskCounts(
    organizationId: string,
    projectId: string,
  ): Promise<TaskFacts> {
    const rows = await this.db
      .select({ status: tasks.status, count: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, organizationId),
          eq(tasks.projectId, projectId),
        ),
      )
      .groupBy(tasks.status);

    let total = 0;
    let completed = 0;
    for (const row of rows) {
      const n = Number(row.count);
      total += n;
      if (row.status === 'DONE') completed += n;
    }
    return { total, completed };
  }
}
