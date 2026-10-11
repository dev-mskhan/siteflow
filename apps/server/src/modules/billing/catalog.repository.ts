// apps/server/src/modules/billing/catalog.repository.ts
// Phase 10 — SaaS Billing Catalog & Subscription Repository

import { getDb } from '../../lib/db/index.js';
import {
  saasPlans,
  saasPriceVersions,
  saasSubscriptions,
  saasSubscriptionHistory,
  type SaasPlan,
  type SaasPriceVersion,
  type SaasSubscription,
  type NewSaasSubscription,
  type SaasSubscriptionHistoryEntry,
  type NewSaasSubscriptionHistoryEntry,
} from '@siteflow/database/schema';
import { eq, and, desc } from 'drizzle-orm';

export class CatalogRepository {
  // ── Plans & Price Versions ──────────────────────────────────────────────────

  async listPlans(tx?: any): Promise<SaasPlan[]> {
    const db = tx ?? getDb();
    return db.select().from(saasPlans).where(eq(saasPlans.isActive, true));
  }

  async findPlanById(id: string, tx?: any): Promise<SaasPlan | null> {
    const db = tx ?? getDb();
    const rows = await db.select().from(saasPlans).where(eq(saasPlans.id, id));
    return rows[0] ?? null;
  }

  async listPriceVersions(planId?: string, tx?: any): Promise<SaasPriceVersion[]> {
    const db = tx ?? getDb();
    if (planId) {
      return db
        .select()
        .from(saasPriceVersions)
        .where(eq(saasPriceVersions.planId, planId));
    }
    return db.select().from(saasPriceVersions);
  }

  async findPriceVersionById(id: string, tx?: any): Promise<SaasPriceVersion | null> {
    const db = tx ?? getDb();
    const rows = await db
      .select()
      .from(saasPriceVersions)
      .where(eq(saasPriceVersions.id, id));
    return rows[0] ?? null;
  }

  async findPriceVersion(
    planId: string,
    interval: string,
    version = 'v1',
    tx?: any,
  ): Promise<SaasPriceVersion | null> {
    const db = tx ?? getDb();
    const rows = await db
      .select()
      .from(saasPriceVersions)
      .where(
        and(
          eq(saasPriceVersions.planId, planId),
          eq(saasPriceVersions.interval, interval),
          eq(saasPriceVersions.version, version),
        ),
      );
    return rows[0] ?? null;
  }

  async findPriceVersionByStripePriceId(
    stripePriceId: string,
    tx?: any,
  ): Promise<SaasPriceVersion | null> {
    const db = tx ?? getDb();
    const rows = await db
      .select()
      .from(saasPriceVersions)
      .where(eq(saasPriceVersions.stripePriceId, stripePriceId));
    return rows[0] ?? null;
  }

  // ── Subscriptions ───────────────────────────────────────────────────────────

  async findCurrentSubscription(
    organizationId: string,
    tx?: any,
  ): Promise<SaasSubscription | null> {
    const db = tx ?? getDb();
    const rows = await db
      .select()
      .from(saasSubscriptions)
      .where(
        and(
          eq(saasSubscriptions.organizationId, organizationId),
          eq(saasSubscriptions.isCurrent, true),
        ),
      );
    return rows[0] ?? null;
  }

  async findSubscriptionById(id: string, tx?: any): Promise<SaasSubscription | null> {
    const db = tx ?? getDb();
    const rows = await db
      .select()
      .from(saasSubscriptions)
      .where(eq(saasSubscriptions.id, id));
    return rows[0] ?? null;
  }

  async listSubscriptionsByOrg(
    organizationId: string,
    tx?: any,
  ): Promise<SaasSubscription[]> {
    const db = tx ?? getDb();
    return db
      .select()
      .from(saasSubscriptions)
      .where(eq(saasSubscriptions.organizationId, organizationId))
      .orderBy(desc(saasSubscriptions.createdAt));
  }

  async clearCurrentSubscription(organizationId: string, tx?: any): Promise<void> {
    const db = tx ?? getDb();
    await db
      .update(saasSubscriptions)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(
        and(
          eq(saasSubscriptions.organizationId, organizationId),
          eq(saasSubscriptions.isCurrent, true),
        ),
      );
  }

  async createSubscription(
    data: NewSaasSubscription,
    tx?: any,
  ): Promise<SaasSubscription> {
    const db = tx ?? getDb();
    const inserted = await db.insert(saasSubscriptions).values(data).returning();
    return inserted[0]!;
  }

  async updateSubscription(
    id: string,
    data: Partial<NewSaasSubscription>,
    tx?: any,
  ): Promise<SaasSubscription> {
    const db = tx ?? getDb();
    const updated = await db
      .update(saasSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(saasSubscriptions.id, id))
      .returning();
    return updated[0]!;
  }

  // ── History ─────────────────────────────────────────────────────────────────

  async recordHistory(
    data: NewSaasSubscriptionHistoryEntry,
    tx?: any,
  ): Promise<SaasSubscriptionHistoryEntry> {
    const db = tx ?? getDb();
    const inserted = await db
      .insert(saasSubscriptionHistory)
      .values(data)
      .returning();
    return inserted[0]!;
  }

  async listSubscriptionHistory(
    organizationId: string,
    tx?: any,
  ): Promise<SaasSubscriptionHistoryEntry[]> {
    const db = tx ?? getDb();
    return db
      .select()
      .from(saasSubscriptionHistory)
      .where(eq(saasSubscriptionHistory.organizationId, organizationId))
      .orderBy(desc(saasSubscriptionHistory.createdAt));
  }
}

export const catalogRepository = new CatalogRepository();
