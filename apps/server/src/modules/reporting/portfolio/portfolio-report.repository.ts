// apps/server/src/modules/reporting/portfolio/portfolio-report.repository.ts
// F.16 — Portfolio report repository queries projects for an organization.
// Filters out archived/cancelled projects by default and scopes strictly by organizationId.

import { getDb } from '../../../lib/db/index.js';
import { projects } from '@siteflow/database/schema';
import { and, eq, ne, count } from 'drizzle-orm';

export interface PortfolioProjectItem {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  currency: string;
  contractValue: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  updatedAt: Date;
}

export class PortfolioReportRepository {
  private get db() {
    return getDb();
  }

  async getPortfolioProjects(
    organizationId: string,
    limit = 50,
  ): Promise<PortfolioProjectItem[]> {
    const rows = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        projectNumber: projects.projectNumber,
        status: projects.status,
        currency: projects.currency,
        contractValue: projects.contractValue,
        plannedStartDate: projects.plannedStartDate,
        plannedEndDate: projects.plannedEndDate,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, organizationId),
          ne(projects.status, 'ARCHIVED'),
          ne(projects.status, 'CANCELLED'),
        ),
      )
      .limit(Math.min(limit, 100));

    return rows.map((r) => ({
      ...r,
      contractValue: r.contractValue ?? null,
      plannedStartDate: r.plannedStartDate ?? null,
      plannedEndDate: r.plannedEndDate ?? null,
    }));
  }

  async getProjectStatusCounts(
    organizationId: string,
  ): Promise<Record<string, number>> {
    const rows = await this.db
      .select({
        status: projects.status,
        count: count(),
      })
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .groupBy(projects.status);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.status] = Number(row.count);
    }
    return result;
  }
}
