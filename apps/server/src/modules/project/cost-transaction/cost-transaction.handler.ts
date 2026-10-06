import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  costTransactionParamsSchema,
  costTransactionTransitionSchema,
  createCostTransactionSchema,
  listCostTransactionsQuerySchema,
  voidCostTransactionSchema,
} from '@siteflow/shared';
import { z } from 'zod';
import { createSuccessResponse } from '../../../shared/response.js';
import { costTransactionService } from './cost-transaction.service.js';

const idempotencyKeySchema = z.string().trim().min(1).max(255);

function getScope(request: FastifyRequest) {
  const params = costTransactionParamsSchema.parse(request.params);
  return {
    organizationId: request.orgContext!.organizationId,
    projectId: params.projectId,
    transactionId: params.transactionId,
  };
}

function getIdempotencyKey(request: FastifyRequest) {
  return idempotencyKeySchema.parse(request.headers['idempotency-key']);
}

export async function handleCreateCostTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = getScope(request);
  const input = createCostTransactionSchema.parse(request.body);
  const transaction = await costTransactionService.create(
    request.user!.sub,
    organizationId,
    projectId,
    input,
    request.id,
    getIdempotencyKey(request),
  );
  reply.status(201).send(createSuccessResponse({ transaction }));
}

export async function handleListCostTransactions(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = getScope(request);
  const query = listCostTransactionsQuerySchema.parse(request.query);
  const result = await costTransactionService.list(organizationId, projectId, query);
  reply.send(createSuccessResponse(result));
}

export async function handleGetCostTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, transactionId } = getScope(request);
  const transaction = await costTransactionService.get(
    organizationId,
    projectId,
    transactionId!,
  );
  reply.send(createSuccessResponse({ transaction }));
}

export async function handlePostCostTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, transactionId } = getScope(request);
  const { expectedVersion } = costTransactionTransitionSchema.parse(request.body);
  const transaction = await costTransactionService.post(
    request.user!.sub,
    organizationId,
    projectId,
    transactionId!,
    expectedVersion,
    request.id,
    getIdempotencyKey(request),
  );
  reply.send(createSuccessResponse({ transaction }));
}

export async function handleVoidCostTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, transactionId } = getScope(request);
  const { expectedVersion, reason } = voidCostTransactionSchema.parse(request.body);
  const transaction = await costTransactionService.void(
    request.user!.sub,
    organizationId,
    projectId,
    transactionId!,
    expectedVersion,
    reason,
    request.id,
    getIdempotencyKey(request),
  );
  reply.send(createSuccessResponse({ transaction }));
}
