// apps/server/src/modules/project/audit/project-audit.repository.ts
import { eq, and, lt, gte, desc, sql } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { auditLogs, type AuditLog } from '@siteflow/database/schema';

export interface ProjectAuditFilters {
  resourceType?: string;
  actorUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  action?: string;
}

export interface ProjectAuditPage {
  rows: AuditLog[];
  nextCursor: string | null;
}

export class ProjectAuditRepository {
  private get db() {
    return getDb();
  }

  async findByProject(
    orgId: string,
    projectId: string,
    filters: ProjectAuditFilters,
    cursor: string | null,
    limit: number,
  ): Promise<ProjectAuditPage> {
    const conditions: any[] = [
      eq(auditLogs.organizationId, orgId),
      eq(auditLogs.projectId, projectId),
    ];

    if (filters.resourceType) conditions.push(eq(auditLogs.resourceType, filters.resourceType));
    if (filters.actorUserId) conditions.push(eq(auditLogs.actorUserId, filters.actorUserId));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo) conditions.push(lt(auditLogs.createdAt, new Date(filters.dateTo)));

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
          createdAt: string;
          id: string;
        };
        conditions.push(
          sql`(${auditLogs.createdAt}, ${auditLogs.id}) < (${new Date(decoded.createdAt)}, ${decoded.id})`,
        );
      } catch {
        // invalid cursor — ignore
      }
    }

    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const last = rows[limit - 1]!;
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
      ).toString('base64url');
      rows.splice(limit);
    }

    return { rows, nextCursor };
  }
}

export const projectAuditRepository = new ProjectAuditRepository();
