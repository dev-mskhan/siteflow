import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { InventoryService } from './inventory.service.js';
import { getDb } from '../../../lib/db/index.js';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const svc = new InventoryService();

const adjustSchema = z.object({
  materialId: z.string().min(1),
  location: z.string().min(1).default('default'),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/)
    .refine((v) => parseFloat(v) > 0, 'quantity must be > 0'),
  unitCode: z.string().trim().min(1).max(20).toUpperCase(),
  direction: z.enum(['IN', 'OUT']),
  reason: z.string().trim().min(1).max(2000),
});

const transferSchema = z.object({
  materialId: z.string().min(1),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/)
    .refine((v) => parseFloat(v) > 0, 'quantity must be > 0'),
  unitCode: z.string().trim().min(1).max(20).toUpperCase(),
  fromLocation: z.string().min(1),
  toLocation: z.string().min(1),
});

export async function handleListInventory(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = req.params as any;
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT pii.material_id AS "materialId",
           pii.location,
           COALESCE(SUM(
             CASE WHEN it.transaction_type IN ('RECEIPT','RETURN','ADJUSTMENT_IN','TRANSFER_IN')
                  THEN it.quantity::numeric ELSE -(it.quantity::numeric) END
           ), 0) AS balance
    FROM app.project_inventory_items pii
    LEFT JOIN app.inventory_transactions it ON it.inventory_item_id = pii.id
    WHERE pii.project_id = ${projectId} AND pii.organization_id = ${organizationId}
    GROUP BY pii.material_id, pii.location
    ORDER BY pii.material_id, pii.location
  `) as any;
  return reply.send(createSuccessResponse(rows.rows ?? rows));
}

export async function handleGetInventoryBalance(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, materialId } = req.params as any;
  const balance = await svc.getBalance(organizationId, projectId, materialId);
  return reply.send(createSuccessResponse({ materialId, balance }));
}

export async function handleListInventoryTransactions(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, materialId } = req.params as any;
  const txs = await svc.listTransactions(organizationId, projectId, materialId);
  return reply.send(createSuccessResponse(txs));
}

export async function handleAdjustInventory(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = req.params as any;
  const actorUserId = (req as any).user!.sub;
  const input = adjustSchema.parse(req.body);
  const db = getDb();
  await db.transaction(async (tx) => {
    await svc.adjust(actorUserId, tx, { organizationId, projectId, ...input });
  });
  return reply.status(201).send(createSuccessResponse({ message: 'Adjustment recorded' }));
}

export async function handleTransferInventory(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = req.params as any;
  const actorUserId = (req as any).user!.sub;
  const input = transferSchema.parse(req.body);
  const db = getDb();
  await db.transaction(async (tx) => {
    await svc.transfer(actorUserId, tx, { organizationId, projectId, ...input });
  });
  return reply.status(201).send(createSuccessResponse({ message: 'Transfer recorded' }));
}
