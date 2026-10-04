import { documentNumberAllocators } from '@siteflow/database/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { generateId } from '../../../lib/id.js';

export class DocumentNumberService {
  /**
   * Allocates the next sequential document number for a given series/period/scope.
   * Uses a scoped atomic upsert to serialize concurrent callers.
   * Returns a formatted string like 'MR-202506-007'.
   */
  async allocateDocumentNumber(
    tx: any,
    orgId: string,
    projectId: string | null,
    series: string,
    period: string,
  ): Promise<string> {
    const lockKey = `${orgId}:${projectId ?? 'organization'}:${series}:${period}`;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);

    const scope = projectId === null
      ? isNull(documentNumberAllocators.projectId)
      : eq(documentNumberAllocators.projectId, projectId);
    const [allocator] = await tx
      .select()
      .from(documentNumberAllocators)
      .where(and(
        eq(documentNumberAllocators.organizationId, orgId),
        eq(documentNumberAllocators.series, series),
        eq(documentNumberAllocators.period, period),
        scope,
      ))
      .limit(1)
      .for('update');

    const rows = allocator
      ? await tx
          .update(documentNumberAllocators)
          .set({ lastNumber: allocator.lastNumber + 1, updatedAt: new Date() })
          .where(eq(documentNumberAllocators.id, allocator.id))
          .returning({ lastNumber: documentNumberAllocators.lastNumber })
      : await tx
          .insert(documentNumberAllocators)
          .values({
            id: generateId(),
            organizationId: orgId,
            projectId,
            series,
            period,
            lastNumber: 1,
          })
          .returning({ lastNumber: documentNumberAllocators.lastNumber });

    const lastNumber = rows[0]?.lastNumber;
    if (lastNumber === undefined) {
      throw new Error(`Could not allocate ${series} document number`);
    }

    // Format: SERIES-PERIOD-NNN (zero-padded to 3 digits minimum)
    return `${series}-${period}-${String(lastNumber).padStart(3, '0')}`;
  }
}

export const documentNumberService = new DocumentNumberService();
