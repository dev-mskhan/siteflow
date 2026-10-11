// apps/server/src/modules/billing/trial.repository.ts
import { getDb } from '../../lib/db/index.js';
import { saasTrials, type SaasTrial, type NewSaasTrial } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';

export class TrialRepository {
  async findByOrganizationId(organizationId: string, tx?: any): Promise<SaasTrial | null> {
    const db = tx ?? getDb();
    const rows = await db
      .select()
      .from(saasTrials)
      .where(eq(saasTrials.organizationId, organizationId));
    return rows[0] ?? null;
  }

  async create(data: NewSaasTrial, tx?: any): Promise<SaasTrial> {
    const db = tx ?? getDb();
    const inserted = await db
      .insert(saasTrials)
      .values(data)
      .returning();
    return inserted[0]!;
  }

  async updateStatus(
    id: string,
    status: 'ACTIVE' | 'EXPIRED' | 'CONVERTED',
    tx?: any,
  ): Promise<SaasTrial> {
    const db = tx ?? getDb();
    const updated = await db
      .update(saasTrials)
      .set({ status, updatedAt: new Date() })
      .where(eq(saasTrials.id, id))
      .returning();
    return updated[0]!;
  }
}

export const trialRepository = new TrialRepository();
