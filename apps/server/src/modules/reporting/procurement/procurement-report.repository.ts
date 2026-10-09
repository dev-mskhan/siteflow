// apps/server/src/modules/reporting/procurement/procurement-report.repository.ts
// F.14 — Repository for procurement report facts.
// Scoped strictly by organizationId and projectId.

import { getDb } from '../../../lib/db/index.js';
import {
  materialRequests,
  purchaseOrders,
  deliveries,
  receipts,
  projectInventoryItems,
} from '@siteflow/database/schema';
import { and, eq, count } from 'drizzle-orm';

export interface ProcurementFacts {
  materialRequestsByStatus: Record<string, number>;
  purchaseOrdersByStatus: Record<string, number>;
  deliveriesByStatus: Record<string, number>;
  receiptsByStatus: Record<string, number>;
  inventoryItemCount: number;
}

export class ProcurementReportRepository {
  private get db() {
    return getDb();
  }

  async getProcurementFacts(
    organizationId: string,
    projectId: string,
  ): Promise<ProcurementFacts> {
    const [mrRows, poRows, delRows, recRows, invRows] = await Promise.all([
      this.db
        .select({ status: materialRequests.status, count: count() })
        .from(materialRequests)
        .where(
          and(
            eq(materialRequests.organizationId, organizationId),
            eq(materialRequests.projectId, projectId),
          ),
        )
        .groupBy(materialRequests.status),

      this.db
        .select({ status: purchaseOrders.status, count: count() })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.organizationId, organizationId),
            eq(purchaseOrders.projectId, projectId),
          ),
        )
        .groupBy(purchaseOrders.status),

      this.db
        .select({ status: deliveries.status, count: count() })
        .from(deliveries)
        .where(
          and(
            eq(deliveries.organizationId, organizationId),
            eq(deliveries.projectId, projectId),
          ),
        )
        .groupBy(deliveries.status),

      this.db
        .select({ status: receipts.status, count: count() })
        .from(receipts)
        .where(
          and(
            eq(receipts.organizationId, organizationId),
            eq(receipts.projectId, projectId),
          ),
        )
        .groupBy(receipts.status),

      this.db
        .select({ count: count() })
        .from(projectInventoryItems)
        .where(
          and(
            eq(projectInventoryItems.organizationId, organizationId),
            eq(projectInventoryItems.projectId, projectId),
          ),
        ),
    ]);

    const materialRequestsByStatus: Record<string, number> = {};
    for (const r of mrRows) materialRequestsByStatus[r.status] = Number(r.count);

    const purchaseOrdersByStatus: Record<string, number> = {};
    for (const r of poRows) purchaseOrdersByStatus[r.status] = Number(r.count);

    const deliveriesByStatus: Record<string, number> = {};
    for (const r of delRows) deliveriesByStatus[r.status] = Number(r.count);

    const receiptsByStatus: Record<string, number> = {};
    for (const r of recRows) receiptsByStatus[r.status] = Number(r.count);

    const inventoryItemCount = Number(invRows[0]?.count ?? 0);

    return {
      materialRequestsByStatus,
      purchaseOrdersByStatus,
      deliveriesByStatus,
      receiptsByStatus,
      inventoryItemCount,
    };
  }
}
