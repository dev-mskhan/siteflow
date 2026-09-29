import { documentNumberAllocators } from '@siteflow/database/schema';
import { sql } from 'drizzle-orm';
import { generateId } from '../../../lib/id.js';

export class DocumentNumberService {
  /**
   * Allocates the next sequential document number for a given series/period/scope.
   * Uses INSERT ON CONFLICT DO NOTHING + UPDATE to serialize concurrent callers.
   * Returns a formatted string like 'MR-202506-007'.
   */
  async allocateDocumentNumber(
    tx: any,
    orgId: string,
    projectId: string | null,
    series: string,
    period: string,
  ): Promise<string> {
    // 1. Ensure the allocator row exists (upsert-safe insert)
    await tx
      .insert(documentNumberAllocators)
      .values({
        id: generateId(),
        organizationId: orgId,
        projectId: projectId ?? null,
        series,
        period,
        lastNumber: 0,
      })
      .onConflictDoNothing();

    // 2. Lock the row FOR UPDATE and increment atomically
    const rows = await tx.execute(
      sql`
        UPDATE app.document_number_allocators
        SET last_number = last_number + 1,
            updated_at  = now()
        WHERE organization_id = ${orgId}
          AND series = ${series}
          AND period = ${period}
          AND (
            (${projectId} IS NULL AND project_id IS NULL)
            OR project_id = ${projectId}
          )
        RETURNING last_number
      `,
    );

    const lastNumber: number = rows.rows?.[0]?.last_number ?? rows[0]?.last_number;

    // 3. Format: SERIES-PERIOD-NNN (zero-padded to 3 digits minimum)
    return `${series}-${period}-${String(lastNumber).padStart(3, '0')}`;
  }
}

export const documentNumberService = new DocumentNumberService();
