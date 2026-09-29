import {
  suppliers,
  supplierContacts,
  type Supplier,
  type SupplierContact,
} from '@siteflow/database/schema';
import { eq, and, lt, or, desc } from 'drizzle-orm';

export class SupplierRepository {
  async findById(db: any, id: string): Promise<Supplier | undefined> {
    const rows = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return rows[0];
  }

  async findByCode(
    db: any,
    organizationId: string,
    supplierCode: string,
  ): Promise<Supplier | undefined> {
    const rows = await db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.organizationId, organizationId),
          eq(suppliers.supplierCode, supplierCode),
        ),
      );
    return rows[0];
  }

  async create(
    db: any,
    data: {
      id: string;
      organizationId: string;
      supplierCode: string;
      legalName: string;
      displayName: string;
      supplierType?: string;
      taxReference?: string;
      email?: string;
      phone?: string;
      address?: string;
      website?: string;
      paymentTerms?: string;
      currencyCode?: string;
      notes?: string;
    },
  ): Promise<Supplier> {
    const rows = await db.insert(suppliers).values(data).returning();
    return rows[0]!;
  }

  async update(
    db: any,
    id: string,
    patch: Partial<{
      legalName: string;
      displayName: string;
      supplierType: string;
      status: string;
      taxReference: string;
      email: string | null;
      phone: string;
      address: string;
      website: string | null;
      paymentTerms: string;
      currencyCode: string;
      notes: string;
    }>,
  ): Promise<Supplier> {
    const rows = await db
      .update(suppliers)
      .set(patch)
      .where(eq(suppliers.id, id))
      .returning();
    return rows[0]!;
  }

  async listByOrg(
    db: any,
    organizationId: string,
    opts: { cursor?: string; limit: number; status?: string },
  ): Promise<Supplier[]> {
    const conditions: any[] = [eq(suppliers.organizationId, organizationId)];

    if (opts.status) {
      conditions.push(eq(suppliers.status, opts.status as any));
    }

    if (opts.cursor) {
      try {
        const { createdAt, id } = JSON.parse(
          Buffer.from(opts.cursor, 'base64').toString(),
        ) as { createdAt: string; id: string };
        conditions.push(
          or(
            lt(suppliers.createdAt, new Date(createdAt)),
            and(
              eq(suppliers.createdAt, new Date(createdAt)),
              lt(suppliers.id, id),
            ),
          ),
        );
      } catch {
        // malformed cursor — ignore
      }
    }

    return db
      .select()
      .from(suppliers)
      .where(and(...conditions))
      .orderBy(desc(suppliers.createdAt), desc(suppliers.id))
      .limit(opts.limit);
  }

  // ── Contacts ────────────────────────────────────────────────────────────────

  async findContactById(db: any, id: string): Promise<SupplierContact | undefined> {
    const rows = await db
      .select()
      .from(supplierContacts)
      .where(eq(supplierContacts.id, id));
    return rows[0];
  }

  async findPrimaryContact(
    db: any,
    supplierId: string,
  ): Promise<SupplierContact | undefined> {
    const rows = await db
      .select()
      .from(supplierContacts)
      .where(
        and(
          eq(supplierContacts.supplierId, supplierId),
          eq(supplierContacts.isPrimary, true),
        ),
      );
    return rows[0];
  }

  async createContact(
    db: any,
    data: {
      id: string;
      organizationId: string;
      supplierId: string;
      name: string;
      role?: string;
      email?: string;
      phone?: string;
      isPrimary: boolean;
    },
  ): Promise<SupplierContact> {
    const rows = await db.insert(supplierContacts).values(data).returning();
    return rows[0]!;
  }

  async updateContact(
    db: any,
    id: string,
    patch: Partial<{
      name: string;
      role: string;
      email: string | null;
      phone: string;
      isPrimary: boolean;
      isActive: boolean;
    }>,
  ): Promise<SupplierContact> {
    const rows = await db
      .update(supplierContacts)
      .set(patch)
      .where(eq(supplierContacts.id, id))
      .returning();
    return rows[0]!;
  }

  async listContactsBySupplier(db: any, supplierId: string): Promise<SupplierContact[]> {
    return db
      .select()
      .from(supplierContacts)
      .where(eq(supplierContacts.supplierId, supplierId));
  }
}
