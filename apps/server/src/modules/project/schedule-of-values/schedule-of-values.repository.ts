import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  changeOrders,
  projectCostCodes,
  projectPhases,
  scheduleOfValueLines,
  scheduleOfValueRevisions,
  scheduleOfValues,
  projects,
  type NewScheduleOfValueLine,
} from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import type { getDb } from '../../../lib/db/index.js';

type ScheduleDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

export class ScheduleOfValuesRepository {
  async findHeader(
    db: ScheduleDatabase,
    organizationId: string,
    projectId: string,
    lock = false,
  ) {
    const query = db.select().from(scheduleOfValues).where(and(
      eq(scheduleOfValues.organizationId, organizationId),
      eq(scheduleOfValues.projectId, projectId),
    )).limit(1);
    return lock ? query.for('update') : query;
  }

  async listHeaders(
    db: ScheduleDatabase,
    organizationId: string,
    projectId: string,
    limit: number,
  ) {
    return db.select().from(scheduleOfValues).where(and(
      eq(scheduleOfValues.organizationId, organizationId),
      eq(scheduleOfValues.projectId, projectId),
    )).orderBy(desc(scheduleOfValues.updatedAt)).limit(limit);
  }

  async findRevision(
    db: ScheduleDatabase,
    organizationId: string,
    projectId: string,
    scheduleOfValuesId: string,
    revisionNumber: number,
    lock = false,
  ) {
    const query = db.select().from(scheduleOfValueRevisions).where(and(
      eq(scheduleOfValueRevisions.organizationId, organizationId),
      eq(scheduleOfValueRevisions.projectId, projectId),
      eq(scheduleOfValueRevisions.scheduleOfValuesId, scheduleOfValuesId),
      eq(scheduleOfValueRevisions.revisionNumber, revisionNumber),
    )).limit(1);
    return lock ? query.for('update') : query;
  }

  async findLines(
    db: ScheduleDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    return db.select().from(scheduleOfValueLines).where(and(
      eq(scheduleOfValueLines.organizationId, organizationId),
      eq(scheduleOfValueLines.projectId, projectId),
      eq(scheduleOfValueLines.revisionId, revisionId),
    )).orderBy(scheduleOfValueLines.lineNumber);
  }

  async createHeader(tx: DatabaseTransaction, values: typeof scheduleOfValues.$inferInsert) {
    const [row] = await tx.insert(scheduleOfValues).values(values).returning();
    return row!;
  }

  async updateHeader(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    scheduleOfValuesId: string,
    expectedVersion: number,
    values: Partial<typeof scheduleOfValues.$inferInsert>,
  ) {
    const [row] = await tx.update(scheduleOfValues).set({
      ...values,
      updatedAt: new Date(),
    }).where(and(
      eq(scheduleOfValues.id, scheduleOfValuesId),
      eq(scheduleOfValues.organizationId, organizationId),
      eq(scheduleOfValues.projectId, projectId),
      eq(scheduleOfValues.version, expectedVersion),
    )).returning();
    return row ?? null;
  }

  async createRevision(
    tx: DatabaseTransaction,
    values: typeof scheduleOfValueRevisions.$inferInsert,
  ) {
    const [row] = await tx.insert(scheduleOfValueRevisions).values(values).returning();
    return row!;
  }

  async updateRevision(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    revisionId: string,
    values: Partial<typeof scheduleOfValueRevisions.$inferInsert>,
  ) {
    const [row] = await tx.update(scheduleOfValueRevisions).set(values).where(and(
      eq(scheduleOfValueRevisions.id, revisionId),
      eq(scheduleOfValueRevisions.organizationId, organizationId),
      eq(scheduleOfValueRevisions.projectId, projectId),
    )).returning();
    return row ?? null;
  }

  async insertLines(tx: DatabaseTransaction, values: NewScheduleOfValueLine[]) {
    if (values.length === 0) return [];
    return tx.insert(scheduleOfValueLines).values(values).returning();
  }

  async replaceLines(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    revisionId: string,
    values: NewScheduleOfValueLine[],
  ) {
    await tx.delete(scheduleOfValueLines).where(and(
      eq(scheduleOfValueLines.organizationId, organizationId),
      eq(scheduleOfValueLines.projectId, projectId),
      eq(scheduleOfValueLines.revisionId, revisionId),
    ));
    return this.insertLines(tx, values);
  }

  async validateReferences(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    costCodeIds: string[],
    phaseIds: string[],
    hasBoqReference: boolean,
  ) {
    if (hasBoqReference) return false;
    const [codes, phases] = await Promise.all([
      costCodeIds.length === 0 ? [] : tx.select({ id: projectCostCodes.id })
        .from(projectCostCodes)
        .where(and(
          eq(projectCostCodes.organizationId, organizationId),
          eq(projectCostCodes.projectId, projectId),
          eq(projectCostCodes.isActive, true),
          inArray(projectCostCodes.id, costCodeIds),
        )),
      phaseIds.length === 0 ? [] : tx.select({ id: projectPhases.id })
        .from(projectPhases)
        .where(and(
          eq(projectPhases.organizationId, organizationId),
          eq(projectPhases.projectId, projectId),
          eq(projectPhases.status, 'ACTIVE'),
          inArray(projectPhases.id, phaseIds),
        )),
    ]);
    return codes.length === costCodeIds.length && phases.length === phaseIds.length;
  }

  async findProjectCurrency(tx: DatabaseTransaction, organizationId: string, projectId: string) {
    const [project] = await tx.select({ currency: projects.currency }).from(projects).where(and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId),
    )).limit(1);
    return project?.currency ?? null;
  }

  async findEffectedChangeOrders(
    db: ScheduleDatabase,
    organizationId: string,
    projectId: string,
    currencyCode: string,
  ) {
    return db.select({ revenueDelta: changeOrders.revenueDelta })
      .from(changeOrders)
      .where(and(
        eq(changeOrders.organizationId, organizationId),
        eq(changeOrders.projectId, projectId),
        eq(changeOrders.currencyCode, currencyCode),
        eq(changeOrders.status, 'EFFECTED'),
      ));
  }
}

export const scheduleOfValuesRepository = new ScheduleOfValuesRepository();
