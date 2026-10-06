import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import {
  complianceInspections,
  complianceRecords,
  permits,
} from '@siteflow/database/schema';
import { ComplianceInvalidCursorError } from './compliance.errors.js';

export const COMPLIANCE_ENTITIES = {
  permit: { table: permits, tableName: 'permits' },
  inspection: { table: complianceInspections, tableName: 'compliance_inspections' },
  record: { table: complianceRecords, tableName: 'compliance_records' },
} as const;

export type ComplianceEntityType = keyof typeof COMPLIANCE_ENTITIES;

function decodeCursor(cursor?: string): { createdAt: Date; id: string } | undefined {
  if (!cursor) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('Invalid cursor encoding');
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      decoded === null
      || typeof decoded !== 'object'
      || !('createdAt' in decoded)
      || !('id' in decoded)
      || typeof decoded.createdAt !== 'string'
      || typeof decoded.id !== 'string'
      || decoded.id.length === 0
    ) {
      throw new Error('Invalid cursor payload');
    }
    const createdAt = new Date(decoded.createdAt);
    if (Number.isNaN(createdAt.valueOf())) throw new Error('Invalid cursor timestamp');
    return { createdAt, id: decoded.id };
  } catch {
    throw new ComplianceInvalidCursorError();
  }
}

export class ComplianceRepository {
  async findById(
    db: any,
    entity: ComplianceEntityType,
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<any | undefined> {
    const table: any = COMPLIANCE_ENTITIES[entity].table;
    const [row] = await db.select().from(table).where(and(
      eq(table.id, id),
      eq(table.organizationId, organizationId),
      eq(table.projectId, projectId),
    )).limit(1);
    return row;
  }

  async findByIdForUpdate(
    tx: any,
    entity: ComplianceEntityType,
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<any | undefined> {
    const tableName = COMPLIANCE_ENTITIES[entity].tableName;
    await tx.execute(sql`SELECT id FROM app.${sql.identifier(tableName)}
      WHERE id = ${id} AND organization_id = ${organizationId} AND project_id = ${projectId}
      FOR UPDATE`);
    return this.findById(tx, entity, organizationId, projectId, id);
  }

  async create(tx: any, entity: ComplianceEntityType, input: Record<string, unknown>): Promise<any> {
    const table: any = COMPLIANCE_ENTITIES[entity].table;
    const [row] = await tx.insert(table).values(input).returning();
    return row;
  }

  async update(
    tx: any,
    entity: ComplianceEntityType,
    organizationId: string,
    projectId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<any | undefined> {
    const table: any = COMPLIANCE_ENTITIES[entity].table;
    const [row] = await tx.update(table).set(patch).where(and(
      eq(table.id, id),
      eq(table.organizationId, organizationId),
      eq(table.projectId, projectId),
    )).returning();
    return row;
  }

  async list(
    db: any,
    entity: ComplianceEntityType,
    organizationId: string,
    projectId: string,
    options: { cursor?: string; limit: number; status?: string },
  ): Promise<any[]> {
    const table: any = COMPLIANCE_ENTITIES[entity].table;
    const filters = [
      eq(table.organizationId, organizationId),
      eq(table.projectId, projectId),
    ];
    if (options.status) filters.push(eq(table.status, options.status));
    const cursor = decodeCursor(options.cursor);
    if (cursor) {
      filters.push(or(
        lt(table.createdAt, cursor.createdAt),
        and(eq(table.createdAt, cursor.createdAt), lt(table.id, cursor.id)),
      )!);
    }
    return db.select().from(table).where(and(...filters))
      .orderBy(desc(table.createdAt), desc(table.id))
      .limit(options.limit + 1);
  }
}
