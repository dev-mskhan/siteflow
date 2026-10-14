import { and, desc, eq, gt, gte, isNull, lt, lte, max, or, sql } from 'drizzle-orm';
import { materialRateVersions, materials, quoteItems, quotes } from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import type { getDb } from '../../../lib/db/index.js';

type PricingDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

export class ProjectPricingRepository {
  async lockMaterial(tx: DatabaseTransaction, organizationId: string, materialId: string) {
    const [material] = await tx
      .select({ id: materials.id, defaultUnitCode: materials.defaultUnitCode })
      .from(materials)
      .where(and(eq(materials.id, materialId), eq(materials.organizationId, organizationId)))
      .limit(1)
      .for('update');
    return material ?? null;
  }

  async findRateVersion(
    db: PricingDatabase,
    organizationId: string,
    rateId: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(materialRateVersions)
      .where(
        and(
          eq(materialRateVersions.id, rateId),
          eq(materialRateVersions.organizationId, organizationId),
        ),
      )
      .limit(1);
    const [row] = await (lock ? query.for('update') : query);
    return row ?? null;
  }

  async nextVersionNumber(
    tx: DatabaseTransaction,
    organizationId: string,
    materialId: string,
    scope: string,
    projectId: string | null,
  ) {
    const [row] = await tx
      .select({ value: max(materialRateVersions.versionNumber) })
      .from(materialRateVersions)
      .where(
        and(
          eq(materialRateVersions.organizationId, organizationId),
          eq(materialRateVersions.materialId, materialId),
          eq(materialRateVersions.scope, scope),
          projectId == null
            ? isNull(materialRateVersions.projectId)
            : eq(materialRateVersions.projectId, projectId),
        ),
      );
    return (row?.value ?? 0) + 1;
  }

  async createRateVersion(tx: DatabaseTransaction, data: typeof materialRateVersions.$inferInsert) {
    const [row] = await tx.insert(materialRateVersions).values(data).returning();
    return row!;
  }

  async updateRateVersion(
    tx: DatabaseTransaction,
    organizationId: string,
    rateId: string,
    data: Partial<typeof materialRateVersions.$inferInsert>,
  ) {
    const [row] = await tx
      .update(materialRateVersions)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(materialRateVersions.id, rateId),
          eq(materialRateVersions.organizationId, organizationId),
        ),
      )
      .returning();
    return row ?? null;
  }

  async listApprovedForMaterial(
    tx: DatabaseTransaction,
    organizationId: string,
    materialId: string,
    scope: string,
    projectId: string | null,
  ) {
    return tx
      .select()
      .from(materialRateVersions)
      .where(
        and(
          eq(materialRateVersions.organizationId, organizationId),
          eq(materialRateVersions.materialId, materialId),
          eq(materialRateVersions.scope, scope),
          eq(materialRateVersions.status, 'APPROVED'),
          projectId == null
            ? isNull(materialRateVersions.projectId)
            : eq(materialRateVersions.projectId, projectId),
        ),
      );
  }

  async listRateVersions(
    db: PricingDatabase,
    organizationId: string,
    materialId: string,
    projectId: string | null,
    limit: number,
  ) {
    return db
      .select()
      .from(materialRateVersions)
      .where(
        and(
          eq(materialRateVersions.organizationId, organizationId),
          eq(materialRateVersions.materialId, materialId),
          projectId == null
            ? isNull(materialRateVersions.projectId)
            : or(
                isNull(materialRateVersions.projectId),
                eq(materialRateVersions.projectId, projectId),
              ),
        ),
      )
      .orderBy(desc(materialRateVersions.versionNumber))
      .limit(limit);
  }

  async findEffectiveApproved(
    db: PricingDatabase,
    organizationId: string,
    materialId: string,
    scope: string,
    projectId: string | null,
    asOf: string,
  ) {
    const [row] = await db
      .select()
      .from(materialRateVersions)
      .where(
        and(
          eq(materialRateVersions.organizationId, organizationId),
          eq(materialRateVersions.materialId, materialId),
          eq(materialRateVersions.scope, scope),
          eq(materialRateVersions.status, 'APPROVED'),
          projectId == null
            ? isNull(materialRateVersions.projectId)
            : eq(materialRateVersions.projectId, projectId),
          lte(materialRateVersions.effectiveFrom, asOf),
          or(
            isNull(materialRateVersions.effectiveTo),
            gt(materialRateVersions.effectiveTo, asOf),
          ),
        ),
      )
      .orderBy(desc(materialRateVersions.effectiveFrom))
      .limit(1);
    return row ?? null;
  }

  async overlappingApproved(
    tx: DatabaseTransaction,
    organizationId: string,
    materialId: string,
    scope: string,
    projectId: string | null,
    effectiveFrom: string,
    effectiveTo: string | null,
    excludeId?: string,
  ) {
    const [row] = await tx
      .select({ id: materialRateVersions.id })
      .from(materialRateVersions)
      .where(
        and(
          eq(materialRateVersions.organizationId, organizationId),
          eq(materialRateVersions.materialId, materialId),
          eq(materialRateVersions.scope, scope),
          eq(materialRateVersions.status, 'APPROVED'),
          projectId == null
            ? isNull(materialRateVersions.projectId)
            : eq(materialRateVersions.projectId, projectId),
          effectiveTo == null
            ? sql`true`
            : lt(materialRateVersions.effectiveFrom, effectiveTo),
          or(
            isNull(materialRateVersions.effectiveTo),
            gt(materialRateVersions.effectiveTo, effectiveFrom),
          ),
          ...(excludeId ? [sql`${materialRateVersions.id} <> ${excludeId}`] : []),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findAcceptedQuoteRate(
    db: PricingDatabase,
    organizationId: string,
    projectId: string,
    materialId: string,
    asOf: string,
  ) {
    const [row] = await db
      .select({
        quoteId: quotes.id,
        quoteItemId: quoteItems.id,
        unitPrice: quoteItems.unitPrice,
        unitCode: quoteItems.unitCode,
        currencyCode: quotes.currencyCode,
        acceptedAt: quotes.acceptedAt,
      })
      .from(quoteItems)
      .innerJoin(quotes, eq(quotes.id, quoteItems.quoteId))
      .where(
        and(
          eq(quoteItems.organizationId, organizationId),
          eq(quotes.organizationId, organizationId),
          eq(quotes.projectId, projectId),
          eq(quoteItems.materialId, materialId),
          eq(quotes.status, 'ACCEPTED'),
          or(isNull(quotes.validUntil), gte(quotes.validUntil, asOf)),
        ),
      )
      .orderBy(desc(quotes.acceptedAt))
      .limit(1);
    return row ?? null;
  }
}

export const projectPricingRepository = new ProjectPricingRepository();
