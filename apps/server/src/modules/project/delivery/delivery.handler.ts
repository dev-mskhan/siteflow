import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { DeliveryService } from './delivery.service.js';
import { createDeliverySchema, updateDeliverySchema, createReceiptSchema, listDeliveryQuerySchema as listQuerySchema } from './delivery.schemas.js';

const svc = new DeliveryService();

export async function handleListDeliveries(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = req.params as any;
  const query = listQuerySchema.parse(req.query);
  const result = await svc.listDeliveries(organizationId, projectId, query);
  return reply.send(createSuccessResponse(result.data, { nextCursor: result.nextCursor }));
}

export async function handleCreateDelivery(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = req.params as any;
  const actorUserId = (req as any).user!.sub;
  const input = createDeliverySchema.parse(req.body);
  const result = await svc.createDelivery(actorUserId, organizationId, projectId, input);
  return reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetDelivery(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, deliveryId } = req.params as any;
  const result = await svc.getDelivery(organizationId, projectId, deliveryId);
  return reply.send(createSuccessResponse(result));
}

export async function handleUpdateDelivery(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, deliveryId } = req.params as any;
  const actorUserId = (req as any).user!.sub;
  const input = updateDeliverySchema.parse(req.body);
  const result = await svc.updateDelivery(actorUserId, organizationId, projectId, deliveryId, input);
  return reply.send(createSuccessResponse(result));
}

export async function handleListReceipts(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = req.params as any;
  const query = listQuerySchema.parse(req.query);
  const result = await svc.listReceipts(organizationId, projectId, query);
  return reply.send(createSuccessResponse(result.data, { nextCursor: result.nextCursor }));
}

export async function handleCreateReceipt(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = req.params as any;
  const actorUserId = (req as any).user!.sub;
  const input = createReceiptSchema.parse(req.body);
  const result = await svc.createReceipt(actorUserId, organizationId, projectId, input);
  return reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetReceipt(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, receiptId } = req.params as any;
  const result = await svc.getReceipt(organizationId, projectId, receiptId);
  return reply.send(createSuccessResponse(result));
}

export async function handlePostReceipt(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, receiptId } = req.params as any;
  const actorUserId = (req as any).user!.sub;
  const result = await svc.postReceipt(actorUserId, organizationId, projectId, receiptId);
  return reply.send(createSuccessResponse(result));
}

export async function handleVoidReceipt(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, receiptId } = req.params as any;
  const actorUserId = (req as any).user!.sub;
  const result = await svc.voidReceipt(actorUserId, organizationId, projectId, receiptId);
  return reply.send(createSuccessResponse(result));
}
