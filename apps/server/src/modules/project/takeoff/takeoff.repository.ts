import { and, asc, desc, eq, inArray, lt, or } from 'drizzle-orm';
import {
  takeoffMeasurementInputs,
  takeoffMeasurements,
  takeoffSheetRevisions,
  takeoffSheets,
  takeoffSources,
} from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import type { getDb } from '../../../lib/db/index.js';

type TakeoffDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

type Cursor = { createdAt: Date; id: string };

export class ProjectTakeoffRepository {
  async findSheet(
    db: TakeoffDatabase,
    organizationId: string,
    projectId: string,
    sheetId: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(takeoffSheets)
      .where(
        and(
          eq(takeoffSheets.id, sheetId),
          eq(takeoffSheets.organizationId, organizationId),
          eq(takeoffSheets.projectId, projectId),
        ),
      )
      .limit(1);
    const [sheet] = await (lock ? query.for('update') : query);
    return sheet ?? null;
  }

  async listSheets(
    db: TakeoffDatabase,
    organizationId: string,
    projectId: string,
    options: { status?: string; cursor?: Cursor; limit: number },
  ) {
    return db
      .select()
      .from(takeoffSheets)
      .where(
        and(
          eq(takeoffSheets.organizationId, organizationId),
          eq(takeoffSheets.projectId, projectId),
          ...(options.status ? [eq(takeoffSheets.status, options.status)] : []),
          ...(options.cursor
            ? [
                or(
                  lt(takeoffSheets.createdAt, options.cursor.createdAt),
                  and(
                    eq(takeoffSheets.createdAt, options.cursor.createdAt),
                    lt(takeoffSheets.id, options.cursor.id),
                  ),
                )!,
              ]
            : []),
        ),
      )
      .orderBy(desc(takeoffSheets.createdAt), desc(takeoffSheets.id))
      .limit(options.limit + 1);
  }

  async createSheet(tx: DatabaseTransaction, data: typeof takeoffSheets.$inferInsert) {
    const [sheet] = await tx.insert(takeoffSheets).values(data).returning();
    return sheet!;
  }

  async updateSheet(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    sheetId: string,
    expectedVersion: number,
    data: Partial<typeof takeoffSheets.$inferInsert>,
  ) {
    const updated = await tx
      .update(takeoffSheets)
      .set({ ...data, version: expectedVersion + 1, updatedAt: new Date() })
      .where(
        and(
          eq(takeoffSheets.id, sheetId),
          eq(takeoffSheets.organizationId, organizationId),
          eq(takeoffSheets.projectId, projectId),
          eq(takeoffSheets.version, expectedVersion),
        ),
      )
      .returning();
    return updated[0] ?? null;
  }

  async createRevision(tx: DatabaseTransaction, data: typeof takeoffSheetRevisions.$inferInsert) {
    const [revision] = await tx.insert(takeoffSheetRevisions).values(data).returning();
    return revision!;
  }

  async findRevision(
    db: TakeoffDatabase,
    organizationId: string,
    projectId: string,
    sheetId: string,
    revisionId: string,
  ) {
    const [revision] = await db
      .select()
      .from(takeoffSheetRevisions)
      .where(
        and(
          eq(takeoffSheetRevisions.id, revisionId),
          eq(takeoffSheetRevisions.sheetId, sheetId),
          eq(takeoffSheetRevisions.organizationId, organizationId),
          eq(takeoffSheetRevisions.projectId, projectId),
        ),
      )
      .limit(1);
    return revision ?? null;
  }

  async listRevisions(
    db: TakeoffDatabase,
    organizationId: string,
    projectId: string,
    sheetId: string,
  ) {
    return db
      .select()
      .from(takeoffSheetRevisions)
      .where(
        and(
          eq(takeoffSheetRevisions.sheetId, sheetId),
          eq(takeoffSheetRevisions.organizationId, organizationId),
          eq(takeoffSheetRevisions.projectId, projectId),
        ),
      )
      .orderBy(asc(takeoffSheetRevisions.revisionNumber));
  }

  async updateRevisionStatus(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    revisionId: string,
    status: string,
  ) {
    const [updated] = await tx
      .update(takeoffSheetRevisions)
      .set({ status })
      .where(
        and(
          eq(takeoffSheetRevisions.id, revisionId),
          eq(takeoffSheetRevisions.organizationId, organizationId),
          eq(takeoffSheetRevisions.projectId, projectId),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async listMeasurements(
    db: TakeoffDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    return db
      .select()
      .from(takeoffMeasurements)
      .where(
        and(
          eq(takeoffMeasurements.revisionId, revisionId),
          eq(takeoffMeasurements.organizationId, organizationId),
          eq(takeoffMeasurements.projectId, projectId),
        ),
      )
      .orderBy(asc(takeoffMeasurements.lineNumber));
  }

  async findMeasurement(
    db: TakeoffDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
    measurementId: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(takeoffMeasurements)
      .where(
        and(
          eq(takeoffMeasurements.id, measurementId),
          eq(takeoffMeasurements.revisionId, revisionId),
          eq(takeoffMeasurements.organizationId, organizationId),
          eq(takeoffMeasurements.projectId, projectId),
        ),
      )
      .limit(1);
    const [measurement] = await (lock ? query.for('update') : query);
    return measurement ?? null;
  }

  async createMeasurements(tx: DatabaseTransaction, rows: (typeof takeoffMeasurements.$inferInsert)[]) {
    if (rows.length === 0) return [];
    return tx.insert(takeoffMeasurements).values(rows).returning();
  }

  async updateMeasurement(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    revisionId: string,
    measurementId: string,
    data: Partial<typeof takeoffMeasurements.$inferInsert>,
  ) {
    const updated = await tx
      .update(takeoffMeasurements)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(takeoffMeasurements.id, measurementId),
          eq(takeoffMeasurements.revisionId, revisionId),
          eq(takeoffMeasurements.organizationId, organizationId),
          eq(takeoffMeasurements.projectId, projectId),
        ),
      )
      .returning();
    return updated[0] ?? null;
  }

  async listInputsForMeasurements(
    db: TakeoffDatabase,
    organizationId: string,
    projectId: string,
    measurementIds: string[],
  ) {
    if (measurementIds.length === 0) return [];
    return db
      .select()
      .from(takeoffMeasurementInputs)
      .where(
        and(
          inArray(takeoffMeasurementInputs.measurementId, measurementIds),
          eq(takeoffMeasurementInputs.organizationId, organizationId),
          eq(takeoffMeasurementInputs.projectId, projectId),
        ),
      )
      .orderBy(asc(takeoffMeasurementInputs.position));
  }

  async replaceInputs(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    measurementId: string,
    rows: (typeof takeoffMeasurementInputs.$inferInsert)[],
  ) {
    await tx
      .delete(takeoffMeasurementInputs)
      .where(
        and(
          eq(takeoffMeasurementInputs.measurementId, measurementId),
          eq(takeoffMeasurementInputs.organizationId, organizationId),
          eq(takeoffMeasurementInputs.projectId, projectId),
        ),
      );
    if (rows.length === 0) return [];
    return tx.insert(takeoffMeasurementInputs).values(rows).returning();
  }

  async findSource(
    db: TakeoffDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
    sourceId: string,
  ) {
    const [source] = await db
      .select()
      .from(takeoffSources)
      .where(
        and(
          eq(takeoffSources.id, sourceId),
          eq(takeoffSources.revisionId, revisionId),
          eq(takeoffSources.organizationId, organizationId),
          eq(takeoffSources.projectId, projectId),
        ),
      )
      .limit(1);
    return source ?? null;
  }

  async listSources(
    db: TakeoffDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    return db
      .select()
      .from(takeoffSources)
      .where(
        and(
          eq(takeoffSources.revisionId, revisionId),
          eq(takeoffSources.organizationId, organizationId),
          eq(takeoffSources.projectId, projectId),
        ),
      )
      .orderBy(asc(takeoffSources.createdAt), asc(takeoffSources.id));
  }

  async createSource(tx: DatabaseTransaction, data: typeof takeoffSources.$inferInsert) {
    const [source] = await tx.insert(takeoffSources).values(data).returning();
    return source!;
  }
}
