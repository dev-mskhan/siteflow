// apps/server/src/modules/project/field-log/field-log-amendment.repository.ts
import { fieldLogAmendments, type FieldLogAmendment } from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';

export class FieldLogAmendmentRepository {
  async insert(
    db: any,
    data: {
      id: string;
      logId: string;
      organizationId: string;
      projectId: string;
      requestedBy: string;
      reason: string;
      correction: Record<string, unknown>;
    },
  ): Promise<FieldLogAmendment> {
    const rows = await db.insert(fieldLogAmendments).values(data).returning();
    return rows[0]!;
  }

  async findById(db: any, id: string, orgId: string): Promise<FieldLogAmendment | undefined> {
    const rows = await db
      .select()
      .from(fieldLogAmendments)
      .where(and(eq(fieldLogAmendments.id, id), eq(fieldLogAmendments.organizationId, orgId)));
    return rows[0];
  }

  async listByLog(
    db: any,
    logId: string,
    orgId: string,
  ): Promise<FieldLogAmendment[]> {
    return db
      .select()
      .from(fieldLogAmendments)
      .where(
        and(
          eq(fieldLogAmendments.logId, logId),
          eq(fieldLogAmendments.organizationId, orgId),
        ),
      );
  }
}
