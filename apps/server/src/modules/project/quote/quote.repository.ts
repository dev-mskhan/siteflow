import { quotes, quoteItems, type Quote, type QuoteItem } from '@siteflow/database/schema';
import { eq, and, desc, lt, or, inArray } from 'drizzle-orm';

export class QuoteRepository {
  async findById(db: any, id: string): Promise<Quote | undefined> {
    const rows = await db.select().from(quotes).where(eq(quotes.id, id));
    return rows[0];
  }

  async findByIdForUpdate(db: any, id: string): Promise<Quote | undefined> {
    const rows = await db.select().from(quotes).where(eq(quotes.id, id)).for('update');
    return rows[0];
  }

  async create(db: any, data: any): Promise<Quote> {
    const rows = await db.insert(quotes).values(data).returning();
    return rows[0]!;
  }

  async update(db: any, id: string, patch: any): Promise<Quote> {
    const rows = await db.update(quotes).set(patch).where(eq(quotes.id, id)).returning();
    return rows[0]!;
  }

  async findAcceptedForRequest(db: any, materialRequestId: string): Promise<Quote | undefined> {
    const rows = await db
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.materialRequestId, materialRequestId),
          eq(quotes.status, 'ACCEPTED'),
        ),
      );
    return rows[0];
  }

  async listByProject(
    db: any,
    organizationId: string,
    projectId: string,
    opts: { cursor?: string; limit: number; status?: string },
  ): Promise<Quote[]> {
    const conditions: any[] = [
      eq(quotes.organizationId, organizationId),
      eq(quotes.projectId, projectId),
    ];
    if (opts.status) conditions.push(eq(quotes.status, opts.status as any));
    if (opts.cursor) {
      try {
        const { createdAt, id } = JSON.parse(
          Buffer.from(opts.cursor, 'base64').toString(),
        ) as any;
        conditions.push(
          or(
            lt(quotes.createdAt, new Date(createdAt)),
            and(eq(quotes.createdAt, new Date(createdAt)), lt(quotes.id, id)),
          ),
        );
      } catch {
        // ignore invalid cursor
      }
    }
    return db
      .select()
      .from(quotes)
      .where(and(...conditions))
      .orderBy(desc(quotes.createdAt), desc(quotes.id))
      .limit(opts.limit);
  }

  async createItems(db: any, items: any[]): Promise<QuoteItem[]> {
    if (!items.length) return [];
    return db.insert(quoteItems).values(items).returning();
  }

  async findItemsByQuoteId(db: any, quoteId: string): Promise<QuoteItem[]> {
    return db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  }

  async findItemsByQuoteIds(db: any, quoteIds: string[]): Promise<QuoteItem[]> {
    if (quoteIds.length === 0) return [];
    return db
      .select()
      .from(quoteItems)
      .where(inArray(quoteItems.quoteId, quoteIds));
  }
}
