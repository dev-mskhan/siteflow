// apps/server/src/modules/ai/okf/okf.repository.ts
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { okfPages, type OkfPage, type NewOkfPage } from '@siteflow/database/schema';

export class OkfRepository {
  async create(page: NewOkfPage): Promise<OkfPage> {
    const db = getDb();
    const [created] = await db.insert(okfPages).values(page).returning();
    return created!;
  }

  async list(
    organizationId: string,
    filters?: { status?: string; pagePath?: string }
  ): Promise<OkfPage[]> {
    const db = getDb();
    const conditions = [eq(okfPages.organizationId, organizationId)];

    if (filters?.status) {
      conditions.push(eq(okfPages.status, filters.status as any));
    }

    if (filters?.pagePath) {
      conditions.push(eq(okfPages.pagePath, filters.pagePath));
    }

    return db.select().from(okfPages).where(and(...conditions));
  }

  async getById(pageId: string, organizationId: string): Promise<OkfPage | null> {
    const db = getDb();
    const [page] = await db
      .select()
      .from(okfPages)
      .where(and(eq(okfPages.id, pageId), eq(okfPages.organizationId, organizationId)));

    return page || null;
  }

  async approve(
    pageId: string,
    organizationId: string,
    approvedBy: string,
    approvalNotes?: string
  ): Promise<OkfPage> {
    const db = getDb();
    const [updated] = await db
      .update(okfPages)
      .set({
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
        approvalNotes,
      })
      .where(and(eq(okfPages.id, pageId), eq(okfPages.organizationId, organizationId)))
      .returning();

    if (!updated) {
      throw new Error('OKF page not found');
    }

    return updated;
  }

  async reject(
    pageId: string,
    organizationId: string,
    approvedBy: string,
    approvalNotes?: string
  ): Promise<OkfPage> {
    const db = getDb();
    const [updated] = await db
      .update(okfPages)
      .set({
        status: 'REJECTED',
        approvedBy,
        approvedAt: new Date(),
        approvalNotes,
      })
      .where(and(eq(okfPages.id, pageId), eq(okfPages.organizationId, organizationId)))
      .returning();

    if (!updated) {
      throw new Error('OKF page not found');
    }

    return updated;
  }

  async delete(pageId: string, organizationId: string): Promise<void> {
    const db = getDb();
    await db
      .delete(okfPages)
      .where(and(eq(okfPages.id, pageId), eq(okfPages.organizationId, organizationId)));
  }
}
