import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import {
  proposalClientEvents,
  proposalConversions,
  proposalLines,
  proposalNumberSequences,
  proposalRevisions,
  proposals,
  tenders,
  type NewProposal,
  type NewProposalClientEvent,
  type NewProposalConversion,
  type NewProposalLine,
  type NewProposalRevision,
  type NewTender,
} from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import type { getDb } from '../../../lib/db/index.js';

export type ProposalDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

// ── Number sequence helpers ───────────────────────────────────────────────────

async function nextSequenceNumber(
  tx: DatabaseTransaction,
  organizationId: string,
  series: string,
): Promise<number> {
  const rows = await tx
    .insert(proposalNumberSequences)
    .values({ organizationId, series, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [proposalNumberSequences.organizationId, proposalNumberSequences.series],
      set: { lastNumber: sql`${proposalNumberSequences.lastNumber} + 1` },
    })
    .returning({ lastNumber: proposalNumberSequences.lastNumber });
  return rows[0]!.lastNumber;
}

/** Allocates a new proposal number: PROP-{YYYYMM}-{NNN} */
export async function nextProposalNumber(
  tx: DatabaseTransaction,
  organizationId: string,
  projectId: string,
): Promise<string> {
  const series = `PROP-${organizationId}-${projectId}`;
  const seq = await nextSequenceNumber(tx, organizationId, series);
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `PROP-${yyyymm}-${String(seq).padStart(3, '0')}`;
}

/** Allocates a new tender number: TND-{YYYYMM}-{NNN} */
export async function nextTenderNumber(
  tx: DatabaseTransaction,
  organizationId: string,
): Promise<number> {
  const series = `TND-${organizationId}`;
  return nextSequenceNumber(tx, organizationId, series);
}

// ── Tender repository ─────────────────────────────────────────────────────────

export const tenderRepository = {
  async findTender(
    db: ProposalDatabase,
    organizationId: string,
    tenderId: string,
    forUpdate = false,
  ) {
    const query = db
      .select()
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.organizationId, organizationId)));
    if (forUpdate) query.for('update');
    const [row] = await query.limit(1);
    return row ?? null;
  },

  async listTenders(
    db: ProposalDatabase,
    organizationId: string,
    options: {
      status?: string;
      cursor?: { updatedAt: Date; id: string };
      limit: number;
    },
  ) {
    return db
      .select()
      .from(tenders)
      .where(
        and(
          eq(tenders.organizationId, organizationId),
          options.status ? eq(tenders.status, options.status) : undefined,
          options.cursor
            ? or(
                lt(tenders.updatedAt, options.cursor.updatedAt),
                and(
                  eq(tenders.updatedAt, options.cursor.updatedAt),
                  lt(tenders.id, options.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(tenders.updatedAt), desc(tenders.id))
      .limit(options.limit + 1);
  },

  async insertTender(tx: DatabaseTransaction, data: NewTender) {
    const [row] = await tx.insert(tenders).values(data).returning();
    return row!;
  },

  async updateTenderVersioned(
    tx: DatabaseTransaction,
    organizationId: string,
    tenderId: string,
    expectedVersion: number,
    patch: Partial<NewTender>,
  ) {
    const [row] = await tx
      .update(tenders)
      .set({ ...patch, version: expectedVersion + 1 })
      .where(
        and(
          eq(tenders.id, tenderId),
          eq(tenders.organizationId, organizationId),
          eq(tenders.version, expectedVersion),
        ),
      )
      .returning();
    return row ?? null;
  },
};

// ── Proposal repository ───────────────────────────────────────────────────────

export const proposalRepository = {
  async findProposal(
    db: ProposalDatabase,
    organizationId: string,
    projectId: string,
    proposalId: string,
    forUpdate = false,
  ) {
    const query = db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.id, proposalId),
          eq(proposals.organizationId, organizationId),
          eq(proposals.projectId, projectId),
        ),
      );
    if (forUpdate) query.for('update');
    const [row] = await query.limit(1);
    return row ?? null;
  },

  async listProposals(
    db: ProposalDatabase,
    organizationId: string,
    projectId: string,
    options: {
      status?: string;
      tenderId?: string;
      cursor?: { updatedAt: Date; id: string };
      limit: number;
    },
  ) {
    return db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.organizationId, organizationId),
          eq(proposals.projectId, projectId),
          options.status ? eq(proposals.status, options.status) : undefined,
          options.tenderId ? eq(proposals.tenderId, options.tenderId) : undefined,
          options.cursor
            ? or(
                lt(proposals.updatedAt, options.cursor.updatedAt),
                and(
                  eq(proposals.updatedAt, options.cursor.updatedAt),
                  lt(proposals.id, options.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(proposals.updatedAt), desc(proposals.id))
      .limit(options.limit + 1);
  },

  async insertProposal(tx: DatabaseTransaction, data: NewProposal) {
    const [row] = await tx.insert(proposals).values(data).returning();
    return row!;
  },

  async updateProposalVersioned(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    proposalId: string,
    expectedVersion: number,
    patch: Partial<NewProposal>,
  ) {
    const [row] = await tx
      .update(proposals)
      .set({ ...patch, version: expectedVersion + 1 })
      .where(
        and(
          eq(proposals.id, proposalId),
          eq(proposals.organizationId, organizationId),
          eq(proposals.projectId, projectId),
          eq(proposals.version, expectedVersion),
        ),
      )
      .returning();
    return row ?? null;
  },

  // ── Revisions ────────────────────────────────────────────────────────────────

  async insertRevision(tx: DatabaseTransaction, data: NewProposalRevision) {
    const [row] = await tx.insert(proposalRevisions).values(data).returning();
    return row!;
  },

  async findRevisionByNumber(
    db: ProposalDatabase,
    organizationId: string,
    projectId: string,
    proposalId: string,
    revisionNumber: number,
  ) {
    const [row] = await db
      .select()
      .from(proposalRevisions)
      .where(
        and(
          eq(proposalRevisions.proposalId, proposalId),
          eq(proposalRevisions.organizationId, organizationId),
          eq(proposalRevisions.projectId, projectId),
          eq(proposalRevisions.revisionNumber, revisionNumber),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async findRevisionById(
    db: ProposalDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    const [row] = await db
      .select()
      .from(proposalRevisions)
      .where(
        and(
          eq(proposalRevisions.id, revisionId),
          eq(proposalRevisions.organizationId, organizationId),
          eq(proposalRevisions.projectId, projectId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async listRevisions(
    db: ProposalDatabase,
    organizationId: string,
    projectId: string,
    proposalId: string,
    options: {
      cursor?: { revisionNumber: number };
      limit: number;
    },
  ) {
    return db
      .select()
      .from(proposalRevisions)
      .where(
        and(
          eq(proposalRevisions.proposalId, proposalId),
          eq(proposalRevisions.organizationId, organizationId),
          eq(proposalRevisions.projectId, projectId),
          options.cursor
            ? lt(proposalRevisions.revisionNumber, options.cursor.revisionNumber)
            : undefined,
        ),
      )
      .orderBy(desc(proposalRevisions.revisionNumber))
      .limit(options.limit + 1);
  },

  async updateRevision(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    revisionId: string,
    patch: Partial<NewProposalRevision>,
  ) {
    const [row] = await tx
      .update(proposalRevisions)
      .set(patch)
      .where(
        and(
          eq(proposalRevisions.id, revisionId),
          eq(proposalRevisions.organizationId, organizationId),
          eq(proposalRevisions.projectId, projectId),
        ),
      )
      .returning();
    return row ?? null;
  },

  // ── Lines ─────────────────────────────────────────────────────────────────

  async insertLines(tx: DatabaseTransaction, data: NewProposalLine[]) {
    if (data.length === 0) return [];
    return tx.insert(proposalLines).values(data).returning();
  },

  async findLines(
    db: ProposalDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    return db
      .select()
      .from(proposalLines)
      .where(
        and(
          eq(proposalLines.revisionId, revisionId),
          eq(proposalLines.organizationId, organizationId),
          eq(proposalLines.projectId, projectId),
        ),
      )
      .orderBy(proposalLines.sortOrder);
  },

  // ── Client events ─────────────────────────────────────────────────────────

  async insertClientEvent(tx: DatabaseTransaction, data: NewProposalClientEvent) {
    const [row] = await tx.insert(proposalClientEvents).values(data).returning();
    return row!;
  },

  async listClientEvents(
    db: ProposalDatabase,
    organizationId: string,
    projectId: string,
    proposalId: string,
  ) {
    return db
      .select()
      .from(proposalClientEvents)
      .where(
        and(
          eq(proposalClientEvents.proposalId, proposalId),
          eq(proposalClientEvents.organizationId, organizationId),
          eq(proposalClientEvents.projectId, projectId),
        ),
      )
      .orderBy(desc(proposalClientEvents.recordedAt));
  },

  // ── Conversions ───────────────────────────────────────────────────────────

  async insertConversion(tx: DatabaseTransaction, data: NewProposalConversion) {
    const [row] = await tx.insert(proposalConversions).values(data).returning();
    return row!;
  },

  async findConversionByIdempotencyHash(
    db: ProposalDatabase,
    organizationId: string,
    projectId: string,
    proposalRevisionId: string,
    idempotencyKeyHash: string,
  ) {
    const [row] = await db
      .select()
      .from(proposalConversions)
      .where(
        and(
          eq(proposalConversions.organizationId, organizationId),
          eq(proposalConversions.projectId, projectId),
          eq(proposalConversions.proposalRevisionId, proposalRevisionId),
          eq(proposalConversions.idempotencyKeyHash, idempotencyKeyHash),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async updateConversion(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    conversionId: string,
    patch: Partial<NewProposalConversion>,
  ) {
    const [row] = await tx
      .update(proposalConversions)
      .set(patch)
      .where(
        and(
          eq(proposalConversions.id, conversionId),
          eq(proposalConversions.organizationId, organizationId),
          eq(proposalConversions.projectId, projectId),
        ),
      )
      .returning();
    return row ?? null;
  },
};
