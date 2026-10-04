import { trace } from '@opentelemetry/api';
import { withSpan } from '@siteflow/observability/server';
import { Decimal } from 'decimal.js';
import { sql, eq, and } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { auditService } from '../../audit/audit.service.js';
import {
  projectInventoryItems,
  inventoryTransactions,
  inventoryTransfers,
  materials,
} from '@siteflow/database/schema';

const tracer = trace.getTracer('inventory-service');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsertInventoryItem(
  tx: any,
  orgId: string,
  projectId: string,
  materialId: string,
  location: string,
): Promise<string> {
  await tx
    .insert(projectInventoryItems)
    .values({ id: generateId(), organizationId: orgId, projectId, materialId, location })
    .onConflictDoNothing();
  const rows = await tx
    .select()
    .from(projectInventoryItems)
    .where(
      and(
        eq(projectInventoryItems.projectId, projectId),
        eq(projectInventoryItems.materialId, materialId),
        eq(projectInventoryItems.location, location),
      ),
    );
  return rows[0]!.id;
}

async function lockItem(tx: any, itemId: string): Promise<void> {
  await tx
    .select({ id: projectInventoryItems.id })
    .from(projectInventoryItems)
    .where(eq(projectInventoryItems.id, itemId))
    .for('update');
}

async function computeBalance(tx: any, itemId: string): Promise<Decimal> {
  const r = await tx.execute(
    sql`SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('RECEIPT','RETURN','ADJUSTMENT_IN','TRANSFER_IN') THEN quantity ELSE -quantity END), 0) AS bal
        FROM app.inventory_transactions WHERE inventory_item_id = ${itemId}`,
  ) as any;
  return new Decimal((r.rows ?? r)[0]?.bal ?? '0');
}

async function writeTx(
  tx: any,
  data: {
    organizationId: string;
    projectId: string;
    inventoryItemId: string;
    materialId: string;
    transactionType: string;
    quantity: string;
    unitCode: string;
    sourceType: string;
    sourceId: string;
    transferId?: string | null;
    reversalOfTransactionId?: string | null;
    taskId?: string | null;
    costCodeId?: string | null;
    occurredAt: Date;
    createdByMemberId?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  await tx.insert(inventoryTransactions).values({ id: generateId(), ...data });
}

// ── Service ───────────────────────────────────────────────────────────────────

export class InventoryService {
  private get db() {
    return getDb();
  }

  /** Called from delivery.service inside its transaction — records accepted quantity as a RECEIPT ledger entry. */
  async recordReceipt(
    tx: any,
    args: {
      organizationId: string;
      projectId: string;
      materialId: string;
      quantity: string;
      unitCode: string;
      sourceId: string;
    },
  ): Promise<void> {
    return withSpan(tracer, 'inventory.record-receipt', async () => {
      const itemId = await upsertInventoryItem(
        tx,
        args.organizationId,
        args.projectId,
        args.materialId,
        'default',
      );
      await lockItem(tx, itemId);
      await writeTx(tx, {
        organizationId: args.organizationId,
        projectId: args.projectId,
        inventoryItemId: itemId,
        materialId: args.materialId,
        transactionType: 'RECEIPT',
        quantity: args.quantity,
        unitCode: args.unitCode,
        sourceType: 'RECEIPT',
        sourceId: args.sourceId,
        occurredAt: new Date(),
      });
    });
  }

  /** Called when a POSTED receipt is voided — inserts ADJUSTMENT_OUT reversals. */
  async reverseReceipt(
    tx: any,
    receiptId: string,
    organizationId: string,
    projectId: string,
  ): Promise<void> {
    return withSpan(tracer, 'inventory.reverse-receipt', async () => {
      const rows = await tx
        .select({
          id: inventoryTransactions.id,
          inventoryItemId: inventoryTransactions.inventoryItemId,
          materialId: inventoryTransactions.materialId,
          quantity: inventoryTransactions.quantity,
          unitCode: inventoryTransactions.unitCode,
        })
        .from(inventoryTransactions)
        .where(and(
          eq(inventoryTransactions.sourceType, 'RECEIPT'),
          eq(inventoryTransactions.sourceId, receiptId),
          eq(inventoryTransactions.transactionType, 'RECEIPT'),
        ));
      for (const r of rows) {
        await lockItem(tx, r.inventoryItemId);
        await writeTx(tx, {
          organizationId,
          projectId,
          inventoryItemId: r.inventoryItemId,
          materialId: r.materialId,
          transactionType: 'ADJUSTMENT_OUT',
          quantity: r.quantity,
          unitCode: r.unitCode,
          sourceType: 'RECEIPT',
          sourceId: receiptId,
          reversalOfTransactionId: r.id,
          occurredAt: new Date(),
        });
      }
    });
  }

  /** Called from inventory adjust endpoint. */
  async adjust(
    actorUserId: string,
    tx: any,
    args: {
      organizationId: string;
      projectId: string;
      materialId: string;
      location: string;
      quantity: string;
      unitCode: string;
      direction: 'IN' | 'OUT';
      reason: string;
    },
  ): Promise<void> {
    return withSpan(tracer, 'inventory.adjust', async () => {
      const materialRows = await tx
        .select({ id: materials.id })
        .from(materials)
        .where(and(eq(materials.id, args.materialId), eq(materials.organizationId, args.organizationId)));
      if (!materialRows[0]) {
        throw Object.assign(new Error('Material not found'), {
          statusCode: 404,
          code: 'MATERIAL_NOT_FOUND',
        });
      }
      const itemId = await upsertInventoryItem(
        tx,
        args.organizationId,
        args.projectId,
        args.materialId,
        args.location,
      );
      await lockItem(tx, itemId);
      if (args.direction === 'OUT') {
        const bal = await computeBalance(tx, itemId);
        if (bal.lt(args.quantity)) {
          throw Object.assign(new Error('Insufficient inventory'), {
            statusCode: 422,
            code: 'INSUFFICIENT_INVENTORY',
          });
        }
      }
      const txType = args.direction === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
      const sourceId = generateId();
      await writeTx(tx, {
        organizationId: args.organizationId,
        projectId: args.projectId,
        inventoryItemId: itemId,
        materialId: args.materialId,
        transactionType: txType,
        quantity: args.quantity,
        unitCode: args.unitCode,
        sourceType: 'ADJUSTMENT',
        sourceId,
        occurredAt: new Date(),
        notes: args.reason,
      });
      await writeOutboxEvent(
        tx,
        'procurement.inventory.adjusted',
        {
          organizationId: args.organizationId,
          projectId: args.projectId,
          materialId: args.materialId,
          direction: args.direction,
          quantity: args.quantity,
        },
        args.organizationId,
      );
      await auditService.log(
        {
          organizationId: args.organizationId,
          actorUserId,
          action: 'inventory.adjusted',
          resourceType: 'Inventory',
          resourceId: sourceId,
          metadata: {
            projectId: args.projectId,
            materialId: args.materialId,
            direction: args.direction,
            quantity: args.quantity,
            reason: args.reason,
          },
        },
        tx,
      );
    });
  }

  /** Atomic location-to-location transfer (two ledger entries). */
  async transfer(
    _actorUserId: string,
    tx: any,
    args: {
      organizationId: string;
      projectId: string;
      materialId: string;
      quantity: string;
      unitCode: string;
      fromLocation: string;
      toLocation: string;
    },
  ): Promise<void> {
    return withSpan(tracer, 'inventory.transfer', async () => {
      const materialRows = await tx
        .select({ id: materials.id })
        .from(materials)
        .where(and(eq(materials.id, args.materialId), eq(materials.organizationId, args.organizationId)));
      if (!materialRows[0]) {
        throw Object.assign(new Error('Material not found'), {
          statusCode: 404,
          code: 'MATERIAL_NOT_FOUND',
        });
      }
      const fromId = await upsertInventoryItem(
        tx,
        args.organizationId,
        args.projectId,
        args.materialId,
        args.fromLocation,
      );
      const toId = await upsertInventoryItem(
        tx,
        args.organizationId,
        args.projectId,
        args.materialId,
        args.toLocation,
      );
      // Lock in deterministic order to avoid deadlock
      const [first, second] = fromId < toId ? [fromId, toId] : [toId, fromId];
      await lockItem(tx, first!);
      await lockItem(tx, second!);
      const bal = await computeBalance(tx, fromId);
      if (bal.lt(args.quantity)) {
        throw Object.assign(new Error('Insufficient inventory for transfer'), {
          statusCode: 422,
          code: 'INSUFFICIENT_INVENTORY',
        });
      }
      const transferId = generateId();
      await tx.insert(inventoryTransfers).values({
        id: transferId,
        organizationId: args.organizationId,
        projectId: args.projectId,
        materialId: args.materialId,
        quantity: args.quantity,
        unitCode: args.unitCode,
        fromLocation: args.fromLocation,
        toLocation: args.toLocation,
        occurredAt: new Date(),
      });
      await writeTx(tx, {
        organizationId: args.organizationId,
        projectId: args.projectId,
        inventoryItemId: fromId,
        materialId: args.materialId,
        transactionType: 'TRANSFER_OUT',
        quantity: args.quantity,
        unitCode: args.unitCode,
        sourceType: 'TRANSFER',
        sourceId: transferId,
        transferId,
        occurredAt: new Date(),
      });
      await writeTx(tx, {
        organizationId: args.organizationId,
        projectId: args.projectId,
        inventoryItemId: toId,
        materialId: args.materialId,
        transactionType: 'TRANSFER_IN',
        quantity: args.quantity,
        unitCode: args.unitCode,
        sourceType: 'TRANSFER',
        sourceId: transferId,
        transferId,
        occurredAt: new Date(),
      });
    });
  }

  async getBalance(
    organizationId: string,
    projectId: string,
    materialId: string,
    location = 'default',
  ): Promise<string> {
    const rows = await this.db
      .select()
      .from(projectInventoryItems)
      .where(
        and(
          eq(projectInventoryItems.organizationId, organizationId),
          eq(projectInventoryItems.projectId, projectId),
          eq(projectInventoryItems.materialId, materialId),
          eq(projectInventoryItems.location, location),
        ),
      );
    if (!rows[0]) return '0.000';
    const bal = await computeBalance(this.db, rows[0].id);
    return bal.toFixed(3);
  }

  async listTransactions(
    organizationId: string,
    projectId: string,
    materialId: string,
  ): Promise<any[]> {
    const rows = await this.db.execute(
      sql`SELECT id, material_id, transaction_type, quantity, unit_code, source_type, source_id,
                 occurred_at, created_at
          FROM app.inventory_transactions
          WHERE organization_id = ${organizationId} AND project_id = ${projectId} AND material_id = ${materialId}
          ORDER BY occurred_at DESC, id DESC LIMIT 100`,
    ) as any;
    return (rows.rows ?? rows).map((r: any) => ({
      id: r.id,
      materialId: r.materialId,
      transactionType: r.transactionType,
      quantity: r.quantity,
      unitCode: r.unitCode,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      occurredAt: r.occurredAt,
      createdAt: r.createdAt,
    }));
  }
}

export const inventoryService = new InventoryService();
