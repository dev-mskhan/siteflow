// Portfolio queries share one server-derived, organization-qualified visibility
// scope so rows and every aggregate disclose exactly the same project set.
import { and, count, desc, eq, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { projectMembers, projects } from '@siteflow/database/schema';
import { getDb } from '../../../lib/db/index.js';
import { projectPolicy } from '../../project/core/project.policy.js';
import type { ProjectContext } from '../../project/core/project.types.js';

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

export interface PortfolioProjectPage {
  projects: PortfolioProjectItem[];
  nextCursor: string | null;
}

export class PortfolioReportRepository {
  private get db() {
    return getDb();
  }

  /**
   * `null` means the caller has explicit organization-level project-read
   * authority. An empty array means the caller has no readable projects.
   */
  async getReadableProjectIds(
    organizationId: string,
    actor: {
      userId: string;
      organizationMembership: ProjectContext['organizationMembership'];
    },
  ): Promise<string[] | null> {
    const orgOnlyActor: ProjectContext = {
      organizationId,
      projectId: '',
      userId: actor.userId,
      organizationMembership: actor.organizationMembership,
      projectMembership: null,
    };
    if (projectPolicy.can({ actor: orgOnlyActor, action: 'project:read' })) {
      return null;
    }

    const memberships = await this.db
      .select({
        projectId: projectMembers.projectId,
        role: projectMembers.role,
      })
      .from(projectMembers)
      .innerJoin(
        projects,
        and(
          eq(projects.id, projectMembers.projectId),
          eq(projects.organizationId, organizationId),
        ),
      )
      .where(
        and(
          eq(projectMembers.organizationId, organizationId),
          eq(projectMembers.userId, actor.userId),
          eq(projectMembers.status, 'ACTIVE'),
        ),
      );

    return memberships
      .filter(({ projectId, role }) =>
        projectPolicy.can({
          actor: {
            ...orgOnlyActor,
            projectId,
            projectMembership: {
              id: `${actor.userId}:${projectId}`,
              role,
              status: 'ACTIVE',
            },
          },
          action: 'project:read',
        }),
      )
      .map(({ projectId }) => projectId);
  }

  async getPortfolioProjects(
    organizationId: string,
    readableProjectIds: string[] | null,
    requestedLimit = 50,
    cursor?: string,
  ): Promise<PortfolioProjectPage> {
    const limit = Math.max(1, Math.min(Math.trunc(requestedLimit) || 50, 100));
    const cursorData = this.decodeCursor(cursor);
    const conditions = this.projectScope(organizationId, readableProjectIds);
    if (cursorData) {
      conditions.push(
        or(
          lt(projects.createdAt, cursorData.createdAt),
          and(
            eq(projects.createdAt, cursorData.createdAt),
            lt(projects.id, cursorData.id),
          ),
        )!,
      );
    }

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
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt), desc(projects.id))
      .limit(limit + 1);

    const hasNext = rows.length > limit;
    if (hasNext) rows.pop();
    const last = rows.at(-1);
    return {
      projects: rows.map(({ createdAt: _createdAt, ...row }) => ({
        ...row,
        contractValue: row.contractValue ?? null,
        plannedStartDate: row.plannedStartDate ?? null,
        plannedEndDate: row.plannedEndDate ?? null,
      })),
      nextCursor:
        hasNext && last
          ? Buffer.from(
              JSON.stringify({
                createdAt: last.createdAt.toISOString(),
                id: last.id,
              }),
            ).toString('base64url')
          : null,
    };
  }

  async getProjectStatusCounts(
    organizationId: string,
    readableProjectIds: string[] | null,
  ): Promise<Record<string, number>> {
    const rows = await this.db
      .select({ status: projects.status, count: count() })
      .from(projects)
      .where(and(...this.projectScope(organizationId, readableProjectIds)))
      .groupBy(projects.status);

    return Object.fromEntries(
      rows.map(({ status, count: projectCount }) => [
        status,
        Number(projectCount),
      ]),
    );
  }

  async getPortfolioProjectCount(
    organizationId: string,
    readableProjectIds: string[] | null,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(projects)
      .where(and(...this.projectScope(organizationId, readableProjectIds)));
    return Number(row?.count ?? 0);
  }

  async getContractValueByCurrency(
    organizationId: string,
    readableProjectIds: string[] | null,
  ): Promise<Record<string, number>> {
    const rows = await this.db
      .select({
        currency: projects.currency,
        amount: sql<string>`coalesce(sum(${projects.contractValue}::numeric), 0)::text`,
      })
      .from(projects)
      .where(and(...this.projectScope(organizationId, readableProjectIds)))
      .groupBy(projects.currency);
    return Object.fromEntries(
      rows.map(({ currency, amount }) => [currency, Number(amount)]),
    );
  }

  private projectScope(
    organizationId: string,
    readableProjectIds: string[] | null,
  ) {
    const conditions = [
      eq(projects.organizationId, organizationId),
      ne(projects.status, 'ARCHIVED'),
      ne(projects.status, 'CANCELLED'),
    ];
    if (readableProjectIds !== null) {
      conditions.push(inArray(projects.id, readableProjectIds));
    }
    return conditions;
  }

  private decodeCursor(
    cursor?: string,
  ): { createdAt: Date; id: string } | null {
    if (!cursor) return null;
    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as { createdAt?: unknown; id?: unknown };
      if (
        typeof decoded.createdAt !== 'string' ||
        typeof decoded.id !== 'string'
      ) {
        return null;
      }
      const createdAt = new Date(decoded.createdAt);
      if (Number.isNaN(createdAt.getTime())) return null;
      return { createdAt, id: decoded.id };
    } catch {
      return null;
    }
  }
}
