// apps/server/src/modules/project/field-log/field-log.repository.ts
import { dailyFieldLogs, fieldLogTaskEntries, type DailyFieldLog, type FieldLogTaskEntry } from '@siteflow/database/schema';
import { eq, and, sql } from 'drizzle-orm';

export class FieldLogRepository {
  async findById(db: any, id: string): Promise<DailyFieldLog | undefined> {
    const rows = await db.select().from(dailyFieldLogs).where(eq(dailyFieldLogs.id, id));
    return rows[0];
  }

  async findByIdForUpdate(db: any, id: string): Promise<DailyFieldLog | undefined> {
    await db.execute(sql`SELECT id FROM app.daily_field_logs WHERE id = ${id} FOR UPDATE`);
    return this.findById(db, id);
  }

  async findByProjectAndDate(
    db: any,
    projectId: string,
    logDate: string,
  ): Promise<DailyFieldLog | undefined> {
    const rows = await db
      .select()
      .from(dailyFieldLogs)
      .where(and(eq(dailyFieldLogs.projectId, projectId), eq(dailyFieldLogs.logDate, logDate)));
    return rows[0];
  }

  async listByProject(
    db: any,
    organizationId: string,
    projectId: string,
  ): Promise<DailyFieldLog[]> {
    return db
      .select()
      .from(dailyFieldLogs)
      .where(
        and(
          eq(dailyFieldLogs.organizationId, organizationId),
          eq(dailyFieldLogs.projectId, projectId),
        ),
      );
  }

  async create(
    db: any,
    data: {
      id: string;
      organizationId: string;
      projectId: string;
      logDate: string;
      supervisorId: string;
      notes?: string;
    },
  ): Promise<DailyFieldLog> {
    const rows = await db.insert(dailyFieldLogs).values(data).returning();
    return rows[0]!;
  }

  async update(
    db: any,
    id: string,
    patch: { notes?: string; status?: string; lockedAt?: Date },
  ): Promise<DailyFieldLog> {
    const rows = await db
      .update(dailyFieldLogs)
      .set(patch)
      .where(eq(dailyFieldLogs.id, id))
      .returning();
    return rows[0]!;
  }

  async deleteEntriesByLog(db: any, logId: string): Promise<void> {
    await db.delete(fieldLogTaskEntries).where(eq(fieldLogTaskEntries.logId, logId));
  }

  async insertEntries(
    db: any,
    entries: Array<{
      id: string;
      logId: string;
      taskId: string;
      completionPctRecorded: number;
      quantityCompleted?: string;
      unit?: string;
      notes?: string;
    }>,
  ): Promise<FieldLogTaskEntry[]> {
    if (entries.length === 0) return [];
    return db.insert(fieldLogTaskEntries).values(entries).returning();
  }

  async listEntriesByLog(db: any, logId: string): Promise<FieldLogTaskEntry[]> {
    return db.select().from(fieldLogTaskEntries).where(eq(fieldLogTaskEntries.logId, logId));
  }
}
