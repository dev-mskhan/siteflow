import { and, desc, eq, lt, or } from 'drizzle-orm';
import {
  correctiveActions,
  qualityDeficiencies,
  qualityInspections,
  type CorrectiveAction,
  type QualityDeficiency,
  type QualityInspection,
} from '@siteflow/database/schema';
import { QualityInvalidCursorError } from './quality.errors.js';

export const QUALITY_ENTITIES = {
  inspection: { table: qualityInspections },
  deficiency: { table: qualityDeficiencies },
  action: { table: correctiveActions },
} as const;

export type QualityEntityType = keyof typeof QUALITY_ENTITIES;
export type QualityRow = QualityInspection | QualityDeficiency | CorrectiveAction;

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
    ) throw new Error('Invalid cursor payload');
    const createdAt = new Date(decoded.createdAt);
    if (Number.isNaN(createdAt.valueOf())) throw new Error('Invalid cursor timestamp');
    return { createdAt, id: decoded.id };
  } catch {
    throw new QualityInvalidCursorError();
  }
}

export function encodeQualityCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
  })).toString('base64url');
}

export class QualityRepository {
  async create(tx: any, entity: QualityEntityType, input: Record<string, unknown>): Promise<QualityRow> {
    const table: any = QUALITY_ENTITIES[entity].table;
    const [row] = await tx.insert(table).values(input).returning();
    return row;
  }

  async findById(
    db: any,
    entity: QualityEntityType,
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<QualityRow | undefined> {
    const table: any = QUALITY_ENTITIES[entity].table;
    const [row] = await db.select().from(table).where(and(
      eq(table.id, id),
      eq(table.organizationId, organizationId),
      eq(table.projectId, projectId),
    )).limit(1);
    return row;
  }

  async findByIdForUpdate(
    tx: any,
    entity: QualityEntityType,
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<QualityRow | undefined> {
    const table: any = QUALITY_ENTITIES[entity].table;
    const [row] = await tx.select().from(table).where(and(
      eq(table.id, id),
      eq(table.organizationId, organizationId),
      eq(table.projectId, projectId),
    )).limit(1).for('update');
    return row;
  }

  async update(
    tx: any,
    entity: QualityEntityType,
    organizationId: string,
    projectId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<QualityRow | undefined> {
    const table: any = QUALITY_ENTITIES[entity].table;
    const [row] = await tx.update(table).set(patch).where(and(
      eq(table.id, id),
      eq(table.organizationId, organizationId),
      eq(table.projectId, projectId),
    )).returning();
    return row;
  }

  async list(
    db: any,
    entity: QualityEntityType,
    organizationId: string,
    projectId: string,
    options: {
      cursor?: string;
      limit: number;
      status?: string;
      severity?: string;
      inspectionId?: string;
      sourceType?: string;
      sourceId?: string;
    },
  ): Promise<QualityRow[]> {
    const table: any = QUALITY_ENTITIES[entity].table;
    const filters = [
      eq(table.organizationId, organizationId),
      eq(table.projectId, projectId),
    ];
    if (options.status) filters.push(eq(table.status, options.status));
    if (options.severity && entity === 'deficiency') {
      filters.push(eq(table.severity, options.severity));
    }
    if (options.inspectionId && entity === 'deficiency') {
      filters.push(eq(table.inspectionId, options.inspectionId));
    }
    if (options.sourceType && entity === 'action') {
      filters.push(eq(table.sourceType, options.sourceType));
    }
    if (options.sourceId && entity === 'action') {
      filters.push(eq(table.sourceId, options.sourceId));
    }
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
