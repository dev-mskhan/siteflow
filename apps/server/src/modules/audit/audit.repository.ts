// apps/server/src/modules/audit/audit.repository.ts
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import { generateId } from '../../lib/id.js';
import { auditLogs, type AuditLog, type NewAuditLog } from '@siteflow/database/schema';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'audit-repository' });

export class AuditRepository {
  private get db() {
    return getDb();
  }

  /**
   * Writes an audit entry. Can be passed an optional transaction (`tx`).
   */
  async create(data: NewAuditLog, tx?: any): Promise<AuditLog> {
    logger.debug({ action: data.action, orgId: data.organizationId }, 'Writing audit log entry');
    const client = tx ?? this.db;
    const result = await client.insert(auditLogs).values({ id: generateId(), ...data }).returning();
    return result[0]!;
  }

  async findByOrganizationId(
    orgId: string,
    limit = 50,
    offset = 0,
  ): Promise<AuditLog[]> {
    return this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, orgId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async findByOrgAndAction(orgId: string, action: string): Promise<AuditLog[]> {
    return this.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, orgId), eq(auditLogs.action, action)))
      .orderBy(desc(auditLogs.createdAt));
  }
}
