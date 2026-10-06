import { and, desc, eq, lt, max, or } from 'drizzle-orm';
import {
  submittalRevisions,
  submittalRevisionReviews,
  submittals,
  type Submittal,
  type SubmittalRevision,
  type SubmittalRevisionReview,
} from '@siteflow/database/schema';
import { SubmittalInvalidCursorError } from './submittal.errors.js';

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
    throw new SubmittalInvalidCursorError();
  }
}

export function encodeSubmittalCursor(row: Pick<Submittal, 'createdAt' | 'id'>): string {
  return Buffer.from(JSON.stringify({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
  })).toString('base64url');
}

export class SubmittalRepository {
  async create(tx: any, input: Record<string, unknown>): Promise<Submittal> {
    const [row] = await tx.insert(submittals).values(input).returning();
    return row;
  }

  async findById(
    db: any,
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<Submittal | undefined> {
    const [row] = await db.select().from(submittals).where(and(
      eq(submittals.id, id),
      eq(submittals.organizationId, organizationId),
      eq(submittals.projectId, projectId),
    )).limit(1);
    return row;
  }

  async findByIdForUpdate(
    tx: any,
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<Submittal | undefined> {
    const [row] = await tx.select().from(submittals).where(and(
      eq(submittals.id, id),
      eq(submittals.organizationId, organizationId),
      eq(submittals.projectId, projectId),
    )).limit(1).for('update');
    return row;
  }

  async update(
    tx: any,
    organizationId: string,
    projectId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Submittal | undefined> {
    const [row] = await tx.update(submittals).set(patch).where(and(
      eq(submittals.id, id),
      eq(submittals.organizationId, organizationId),
      eq(submittals.projectId, projectId),
    )).returning();
    return row;
  }

  async list(
    db: any,
    organizationId: string,
    projectId: string,
    options: { cursor?: string; limit: number; status?: Submittal['status'] },
  ): Promise<Submittal[]> {
    const filters = [
      eq(submittals.organizationId, organizationId),
      eq(submittals.projectId, projectId),
    ];
    if (options.status) filters.push(eq(submittals.status, options.status));
    const cursor = decodeCursor(options.cursor);
    if (cursor) {
      filters.push(or(
        lt(submittals.createdAt, cursor.createdAt),
        and(eq(submittals.createdAt, cursor.createdAt), lt(submittals.id, cursor.id)),
      )!);
    }
    return db.select().from(submittals).where(and(...filters))
      .orderBy(desc(submittals.createdAt), desc(submittals.id))
      .limit(options.limit + 1);
  }

  async createRevision(tx: any, input: Record<string, unknown>): Promise<SubmittalRevision> {
    const [revision] = await tx.insert(submittalRevisions).values(input).returning();
    return revision;
  }

  async latestRevisionForUpdate(tx: any, organizationId: string, submittalId: string) {
    const [revision] = await tx.select().from(submittalRevisions).where(and(
      eq(submittalRevisions.organizationId, organizationId),
      eq(submittalRevisions.submittalId, submittalId),
    )).orderBy(desc(submittalRevisions.revisionNumber)).limit(1).for('update');
    return revision;
  }

  async createReview(tx: any, input: Record<string, unknown>) {
    const [row] = await tx.insert(submittalRevisionReviews).values(input).returning();
    return row;
  }

  async nextRevisionNumber(tx: any, submittalId: string, organizationId: string): Promise<number> {
    const [row] = await tx.select({ revisionNumber: max(submittalRevisions.revisionNumber) })
      .from(submittalRevisions)
      .where(and(
        eq(submittalRevisions.submittalId, submittalId),
        eq(submittalRevisions.organizationId, organizationId),
      ));
    return (row?.revisionNumber ?? 0) + 1;
  }

  async listRevisions(
    db: any,
    organizationId: string,
    submittalId: string,
  ): Promise<Array<{ revision: SubmittalRevision; review: SubmittalRevisionReview | null }>> {
    return db.select({
      revision: submittalRevisions,
      review: submittalRevisionReviews,
    }).from(submittalRevisions).leftJoin(
      submittalRevisionReviews,
      eq(submittalRevisionReviews.submittalRevisionId, submittalRevisions.id),
    ).where(and(
      eq(submittalRevisions.organizationId, organizationId),
      eq(submittalRevisions.submittalId, submittalId),
    )).orderBy(submittalRevisions.revisionNumber);
  }

  async findRevision(
    db: any,
    organizationId: string,
    submittalId: string,
    revisionId: string,
  ) {
    const [record] = await db.select({
      revision: submittalRevisions,
      review: submittalRevisionReviews,
    }).from(submittalRevisions).leftJoin(
      submittalRevisionReviews,
      eq(submittalRevisionReviews.submittalRevisionId, submittalRevisions.id),
    ).where(and(
      eq(submittalRevisions.id, revisionId),
      eq(submittalRevisions.organizationId, organizationId),
      eq(submittalRevisions.submittalId, submittalId),
    )).limit(1);
    return record;
  }
}
