import { and, desc, eq, lt, or } from 'drizzle-orm';
import { rfis, type Rfi } from '@siteflow/database/schema';
import { RfiInvalidCursorError } from './rfi.errors.js';

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
    throw new RfiInvalidCursorError();
  }
}

export class RfiRepository {
  async create(tx: any, input: Record<string, unknown>): Promise<Rfi> {
    const [row] = await tx.insert(rfis).values(input).returning();
    return row;
  }

  async findById(db: any, organizationId: string, projectId: string, id: string): Promise<Rfi | undefined> {
    const [row] = await db.select().from(rfis).where(and(
      eq(rfis.id, id),
      eq(rfis.organizationId, organizationId),
      eq(rfis.projectId, projectId),
    )).limit(1);
    return row;
  }

  async findByIdForUpdate(
    tx: any,
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<Rfi | undefined> {
    const [row] = await tx.select().from(rfis).where(and(
      eq(rfis.id, id),
      eq(rfis.organizationId, organizationId),
      eq(rfis.projectId, projectId),
    )).limit(1).for('update');
    return row;
  }

  async update(
    tx: any,
    organizationId: string,
    projectId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Rfi | undefined> {
    const [row] = await tx.update(rfis).set(patch).where(and(
      eq(rfis.id, id),
      eq(rfis.organizationId, organizationId),
      eq(rfis.projectId, projectId),
    )).returning();
    return row;
  }

  async list(
    db: any,
    organizationId: string,
    projectId: string,
    options: { cursor?: string; limit: number; status?: string; priority?: string },
  ): Promise<Rfi[]> {
    const filters = [
      eq(rfis.organizationId, organizationId),
      eq(rfis.projectId, projectId),
    ];
    if (options.status) filters.push(eq(rfis.status, options.status as Rfi['status']));
    if (options.priority) filters.push(eq(rfis.priority, options.priority as Rfi['priority']));
    const cursor = decodeCursor(options.cursor);
    if (cursor) {
      filters.push(or(
        lt(rfis.createdAt, cursor.createdAt),
        and(eq(rfis.createdAt, cursor.createdAt), lt(rfis.id, cursor.id)),
      )!);
    }
    return db.select().from(rfis).where(and(...filters))
      .orderBy(desc(rfis.createdAt), desc(rfis.id))
      .limit(options.limit + 1);
  }
}

export function encodeRfiCursor(row: Pick<Rfi, 'createdAt' | 'id'>): string {
  return Buffer.from(JSON.stringify({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
  })).toString('base64url');
}
