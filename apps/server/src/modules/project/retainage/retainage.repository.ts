import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm';
import type { DatabaseTransaction } from '@siteflow/database';
import {
  paymentApplicationLines,
  paymentApplications,
  retainageRecords,
  retainageReleases,
  scheduleOfValueProgress,
} from '@siteflow/database/schema';
import type { getDb } from '../../../lib/db/index.js';
import type { ListRetainageQuery } from '@siteflow/shared';

type Db = DatabaseTransaction | ReturnType<typeof getDb>;

export interface Cursor {
  createdAt: Date;
  id: string;
}

export class RetainageRepository {
  findApplication(tx: DatabaseTransaction, organizationId: string, projectId: string, id: string) {
    return tx
      .select()
      .from(paymentApplications)
      .where(
        and(
          eq(paymentApplications.id, id),
          eq(paymentApplications.organizationId, organizationId),
          eq(paymentApplications.projectId, projectId),
        ),
      )
      .limit(1)
      .for('update');
  }

  findApplicationLines(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    id: string,
  ) {
    return tx
      .select()
      .from(paymentApplicationLines)
      .where(
        and(
          eq(paymentApplicationLines.paymentApplicationId, id),
          eq(paymentApplicationLines.organizationId, organizationId),
          eq(paymentApplicationLines.projectId, projectId),
        ),
      )
      .orderBy(paymentApplicationLines.lineNumber, paymentApplicationLines.id);
  }

  createRecords(tx: DatabaseTransaction, values: (typeof retainageRecords.$inferInsert)[]) {
    return tx.insert(retainageRecords).values(values).returning();
  }

  findRecord(tx: Db, organizationId: string, projectId: string, id: string, lock = false) {
    const query = tx
      .select()
      .from(retainageRecords)
      .where(
        and(
          eq(retainageRecords.id, id),
          eq(retainageRecords.organizationId, organizationId),
          eq(retainageRecords.projectId, projectId),
        ),
      )
      .limit(1);
    return lock ? query.for('update') : query;
  }

  findApplicationLine(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    id: string,
  ) {
    return tx
      .select()
      .from(paymentApplicationLines)
      .where(
        and(
          eq(paymentApplicationLines.id, id),
          eq(paymentApplicationLines.organizationId, organizationId),
          eq(paymentApplicationLines.projectId, projectId),
        ),
      )
      .limit(1);
  }

  findProgress(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    scheduleOfValueLineId: string,
  ) {
    return tx
      .select()
      .from(scheduleOfValueProgress)
      .where(
        and(
          eq(scheduleOfValueProgress.organizationId, organizationId),
          eq(scheduleOfValueProgress.projectId, projectId),
          eq(scheduleOfValueProgress.scheduleOfValueLineId, scheduleOfValueLineId),
        ),
      )
      .limit(1)
      .for('update');
  }

  updateProgress(tx: DatabaseTransaction, id: string, retainageAccrued: string) {
    return tx
      .update(scheduleOfValueProgress)
      .set({ retainageAccrued, updatedAt: new Date() })
      .where(eq(scheduleOfValueProgress.id, id))
      .returning();
  }

  updateRecord(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    id: string,
    version: number,
    value: Partial<typeof retainageRecords.$inferInsert>,
  ) {
    return tx
      .update(retainageRecords)
      .set({ ...value, updatedAt: new Date() })
      .where(
        and(
          eq(retainageRecords.id, id),
          eq(retainageRecords.organizationId, organizationId),
          eq(retainageRecords.projectId, projectId),
          eq(retainageRecords.version, version),
        ),
      )
      .returning();
  }

  createRelease(tx: DatabaseTransaction, value: typeof retainageReleases.$inferInsert) {
    return tx.insert(retainageReleases).values(value).returning();
  }

  async list(
    db: Db,
    organizationId: string,
    projectId: string,
    query: ListRetainageQuery,
    cursor?: Cursor,
  ) {
    const conditions: SQL[] = [
      eq(retainageRecords.organizationId, organizationId),
      eq(retainageRecords.projectId, projectId),
    ];
    if (query.status) conditions.push(eq(retainageRecords.status, query.status));
    if (cursor) {
      conditions.push(
        or(
          lt(retainageRecords.createdAt, cursor.createdAt),
          and(eq(retainageRecords.createdAt, cursor.createdAt), lt(retainageRecords.id, cursor.id)),
        )!,
      );
    }
    return db
      .select()
      .from(retainageRecords)
      .where(and(...conditions))
      .orderBy(desc(retainageRecords.createdAt), desc(retainageRecords.id))
      .limit(query.limit + 1);
  }

  listReleases(db: Db, organizationId: string, projectId: string, retainageId: string) {
    return db
      .select()
      .from(retainageReleases)
      .where(
        and(
          eq(retainageReleases.organizationId, organizationId),
          eq(retainageReleases.projectId, projectId),
          eq(retainageReleases.retainageRecordId, retainageId),
        ),
      )
      .orderBy(desc(retainageReleases.releasedAt), desc(retainageReleases.id));
  }
}

export const retainageRepository = new RetainageRepository();
