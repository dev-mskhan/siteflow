import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  changeOrderParamsSchema,
  changeOrderTransitionSchema,
  createChangeOrderSchema,
  listChangeOrdersQuerySchema,
  rejectChangeOrderSchema,
  updateChangeOrderSchema,
} from '@siteflow/shared';
import { createSuccessResponse } from '../../../shared/response.js';
import { changeOrderService } from './change-order.service.js';

function scope(request: FastifyRequest) {
  const params = changeOrderParamsSchema.parse(request.params);
  return {
    organizationId: request.orgContext!.organizationId,
    projectId: params.projectId,
    changeOrderId: params.changeOrderId,
  };
}

function idempotencyKey(request: FastifyRequest) {
  const value = request.headers['idempotency-key'];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 255) {
    const error = new Error('A valid Idempotency-Key header is required for this command.') as Error & {
      statusCode: number;
      code: string;
    };
    error.statusCode = 400;
    error.code = 'IDEMPOTENCY_KEY_REQUIRED';
    throw error;
  }
  return value;
}

export async function handleCreateChangeOrder(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = scope(request);
  const changeOrder = await changeOrderService.create(
    request.user!.sub,
    organizationId,
    projectId,
    createChangeOrderSchema.parse(request.body),
    request.id,
  );
  return reply.status(201).send(createSuccessResponse({ changeOrder }));
}

export async function handleListChangeOrders(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = scope(request);
  const result = await changeOrderService.list(
    organizationId,
    projectId,
    listChangeOrdersQuerySchema.parse(request.query),
  );
  return reply.send(createSuccessResponse(result.changeOrders, { nextCursor: result.nextCursor }));
}

export async function handleGetChangeOrder(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, changeOrderId } = scope(request);
  const changeOrder = await changeOrderService.get(organizationId, projectId, changeOrderId!);
  return reply.send(createSuccessResponse({ changeOrder }));
}

export async function handleUpdateChangeOrder(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, changeOrderId } = scope(request);
  const changeOrder = await changeOrderService.updateDraft(
    request.user!.sub,
    organizationId,
    projectId,
    changeOrderId!,
    updateChangeOrderSchema.parse(request.body),
    request.id,
  );
  return reply.send(createSuccessResponse({ changeOrder }));
}

async function transition(request: FastifyRequest, operation: string, reason?: string) {
  const { organizationId, projectId, changeOrderId } = scope(request);
  const expectedVersion = operation === 'reject'
    ? rejectChangeOrderSchema.parse(request.body).expectedVersion
    : changeOrderTransitionSchema.parse(request.body).expectedVersion;
  const actor = request.user!.sub;
  const service = changeOrderService;
  if (operation === 'submit') return service.submit(actor, organizationId, projectId, changeOrderId!, expectedVersion, request.id);
  if (operation === 'approve') return service.approve(actor, organizationId, projectId, changeOrderId!, expectedVersion, request.id);
  if (operation === 'client-approve') return service.approveByClient(actor, organizationId, projectId, changeOrderId!, expectedVersion, request.id);
  if (operation === 'reject') {
    const input = rejectChangeOrderSchema.parse(request.body);
    return service.reject(actor, organizationId, projectId, changeOrderId!, expectedVersion, input.reason, request.id);
  }
  if (operation === 'void') return service.void(actor, organizationId, projectId, changeOrderId!, expectedVersion, request.id);
  if (operation === 'effect') {
    return service.effect(
      actor,
      organizationId,
      projectId,
      changeOrderId!,
      expectedVersion,
      request.id,
      idempotencyKey(request),
    );
  }
  throw new Error(`Unsupported change order operation: ${operation}${reason ?? ''}`);
}

async function sendTransition(
  request: FastifyRequest,
  reply: FastifyReply,
  operation: string,
) {
  const changeOrder = await transition(request, operation);
  return reply.send(createSuccessResponse({ changeOrder }));
}

export const handleSubmitChangeOrder = (request: FastifyRequest, reply: FastifyReply) =>
  sendTransition(request, reply, 'submit');
export const handleApproveChangeOrder = (request: FastifyRequest, reply: FastifyReply) =>
  sendTransition(request, reply, 'approve');
export const handleClientApproveChangeOrder = (request: FastifyRequest, reply: FastifyReply) =>
  sendTransition(request, reply, 'client-approve');
export const handleRejectChangeOrder = (request: FastifyRequest, reply: FastifyReply) =>
  sendTransition(request, reply, 'reject');
export const handleEffectChangeOrder = (request: FastifyRequest, reply: FastifyReply) =>
  sendTransition(request, reply, 'effect');
export const handleVoidChangeOrder = (request: FastifyRequest, reply: FastifyReply) =>
  sendTransition(request, reply, 'void');
