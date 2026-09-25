// apps/server/src/modules/organization/sequences/sequences.repository.ts
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { documentSequences, type DocumentSequence } from '@siteflow/database/schema';
import type { UpdateSequenceInput, AllocateNextResult, DocumentSequenceType } from './sequences.types.js';

export class DocumentSequenceRepository {
  private get db() {
    return getDb();
  }

  async findByOrg(orgId: string): Promise<DocumentSequence[]> {
    return this.db
      .select()
      .from(documentSequences)
      .where(eq(documentSequences.organizationId, orgId));
  }

  async findByOrgAndType(orgId: string, type: DocumentSequenceType): Promise<DocumentSequence | undefined> {
    const result = await this.db
      .select()
      .from(documentSequences)
      .where(
        and(
          eq(documentSequences.organizationId, orgId),
          eq(documentSequences.type, type),
        ),
      )
      .limit(1);
    return result[0];
  }

  async updateConfig(orgId: string, type: DocumentSequenceType, data: UpdateSequenceInput, tx?: any): Promise<DocumentSequence | undefined> {
    const client = tx ?? this.db;
    const result = await client
      .update(documentSequences)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentSequences.organizationId, orgId),
          eq(documentSequences.type, type),
        ),
      )
      .returning();
    return result[0];
  }

  /**
   * Atomically allocates the next sequence number using SELECT FOR UPDATE.
   * MUST be called inside a transaction.
   */
  async allocateNext(orgId: string, type: DocumentSequenceType, tx: any): Promise<AllocateNextResult> {
    // Lock the row
    const locked = await tx
      .select()
      .from(documentSequences)
      .where(
        and(
          eq(documentSequences.organizationId, orgId),
          eq(documentSequences.type, type),
        ),
      )
      .for('update')
      .limit(1);

    if (!locked[0]) {
      throw new Error(`Document sequence '${type}' not found for organization`);
    }

    const seq = locked[0] as DocumentSequence;
    const allocatedNumber = seq.nextValue;

    // Increment nextValue
    await tx
      .update(documentSequences)
      .set({ nextValue: sql`${documentSequences.nextValue} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(documentSequences.organizationId, orgId),
          eq(documentSequences.type, type),
        ),
      );

    // Format: e.g. "PRJ-0001" with zero-padding
    const padded = String(allocatedNumber).padStart(seq.padding, '0');
    const formatted = `${seq.prefix}-${padded}`;

    return { number: allocatedNumber, formatted };
  }
}
