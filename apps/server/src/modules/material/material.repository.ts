import { materials, type Material } from '@siteflow/database/schema';
import { eq, and, lt, or, desc } from 'drizzle-orm';

export class MaterialRepository {
  async findById(db: any, id: string): Promise<Material | undefined> {
    const rows = await db.select().from(materials).where(eq(materials.id, id));
    return rows[0];
  }

  async findByCode(db: any, organizationId: string, materialCode: string): Promise<Material | undefined> {
    const rows = await db
      .select()
      .from(materials)
      .where(and(eq(materials.organizationId, organizationId), eq(materials.materialCode, materialCode)));
    return rows[0];
  }

  async create(
    db: any,
    data: {
      id: string;
      organizationId: string;
      materialCode: string;
      name: string;
      description?: string;
      category?: string;
      defaultUnitCode: string;
      materialType?: string;
      defaultTaxCode?: string;
      defaultCurrencyCode?: string;
    },
  ): Promise<Material> {
    const rows = await db.insert(materials).values(data).returning();
    return rows[0]!;
  }

  async update(
    db: any,
    id: string,
    patch: Partial<{
      name: string;
      description: string;
      category: string;
      defaultUnitCode: string;
      materialType: string;
      status: string;
      defaultTaxCode: string;
      defaultCurrencyCode: string;
    }>,
  ): Promise<Material> {
    const rows = await db.update(materials).set(patch).where(eq(materials.id, id)).returning();
    return rows[0]!;
  }

  async listByOrg(
    db: any,
    organizationId: string,
    opts: {
      cursor?: string;
      limit: number;
      status?: string;
      category?: string;
    },
  ): Promise<Material[]> {
    const conditions: any[] = [eq(materials.organizationId, organizationId)];
    if (opts.status) conditions.push(eq(materials.status, opts.status as any));
    if (opts.category) conditions.push(eq(materials.category, opts.category));
    if (opts.cursor) {
      try {
        const { createdAt, id } = JSON.parse(Buffer.from(opts.cursor, 'base64').toString()) as {
          createdAt: string;
          id: string;
        };
        conditions.push(
          or(
            lt(materials.createdAt, new Date(createdAt)),
            and(eq(materials.createdAt, new Date(createdAt)), lt(materials.id, id)),
          ),
        );
      } catch {
        // invalid cursor — ignore and return from start
      }
    }
    return db
      .select()
      .from(materials)
      .where(and(...conditions))
      .orderBy(desc(materials.createdAt), desc(materials.id))
      .limit(opts.limit);
  }
}
