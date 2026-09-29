import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { PurchaseOrderService } from './purchase-order.service.js';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  listPurchaseOrdersQuerySchema,
} from './purchase-order.schemas.js';

const svc = new PurchaseOrderService();

export async function handleListPurchaseOrders(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = req.params as any;
  const query = listPurchaseOrdersQuerySchema.parse(req.query);
  const result = await svc.listPurchaseOrders(organizationId, projectId, query);
  reply.send(createSuccessResponse(result.data, { nextCursor: result.nextCursor }));
}

export async function handleCreatePurchaseOrder(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = req.params as any;
  const actorUserId = req.user!.sub;
  const input = createPurchaseOrderSchema.parse(req.body);
  const result = await svc.createPurchaseOrder(actorUserId, organizationId, projectId, input);
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetPurchaseOrder(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, poId } = req.params as any;
  const result = await svc.getPurchaseOrder(organizationId, projectId, poId);
  reply.send(createSuccessResponse(result));
}

export async function handleUpdatePurchaseOrder(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, poId } = req.params as any;
  const actorUserId = req.user!.sub;
  const input = updatePurchaseOrderSchema.parse(req.body);
  const result = await svc.updatePurchaseOrder(actorUserId, organizationId, projectId, poId, input);
  reply.send(createSuccessResponse(result));
}

export async function handleSubmitPurchaseOrder(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, poId } = req.params as any;
  const actorUserId = req.user!.sub;
  const result = await svc.submitPurchaseOrder(actorUserId, organizationId, projectId, poId);
  reply.send(createSuccessResponse(result));
}

export async function handleApprovePurchaseOrder(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, poId } = req.params as any;
  const actorUserId = req.user!.sub;
  const result = await svc.approvePurchaseOrder(actorUserId, organizationId, projectId, poId);
  reply.send(createSuccessResponse(result));
}

export async function handleSendPurchaseOrder(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, poId } = req.params as any;
  const actorUserId = req.user!.sub;
  const result = await svc.sendPurchaseOrder(actorUserId, organizationId, projectId, poId);
  reply.send(createSuccessResponse(result));
}

export async function handleCancelPurchaseOrder(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, poId } = req.params as any;
  const actorUserId = req.user!.sub;
  const result = await svc.cancelPurchaseOrder(actorUserId, organizationId, projectId, poId);
  reply.send(createSuccessResponse(result));
}
