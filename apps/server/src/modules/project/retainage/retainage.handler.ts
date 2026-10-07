import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  listRetainageQuerySchema,
  releaseRetainageSchema,
  retainageParamsSchema,
} from '@siteflow/shared';
import { createSuccessResponse } from '../../../shared/response.js';
import { RetainageConflictError } from './retainage.errors.js';
import { retainageService } from './retainage.service.js';

function scope(request: FastifyRequest) {
  const params = retainageParamsSchema.parse(request.params);
  return {
    organizationId: request.orgContext!.organizationId,
    projectId: params.projectId,
    retainageId: params.retainageId,
    paymentApplicationId: params.paymentApplicationId,
  };
}

function idempotencyKey(request: FastifyRequest) {
  const value = request.headers['idempotency-key'];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 255) {
    const error = new RetainageConflictError(
      'A valid Idempotency-Key header is required for this command.',
    ) as RetainageConflictError & { statusCode: number; code: string };
    error.statusCode = 400;
    error.code = 'IDEMPOTENCY_KEY_REQUIRED';
    throw error;
  }
  return value;
}

export async function handleListRetainage(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = scope(request);
  const result = await retainageService.list(
    organizationId,
    projectId,
    listRetainageQuerySchema.parse(request.query),
  );
  return reply.send(
    createSuccessResponse(result.retainageRecords, { nextCursor: result.nextCursor }),
  );
}

export async function handleHoldRetainage(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, paymentApplicationId } = scope(request);
  const result = await retainageService.hold(
    request.user!.sub,
    organizationId,
    projectId,
    paymentApplicationId!,
    request.id,
    idempotencyKey(request),
  );
  return reply.status(201).send(createSuccessResponse(result));
}

export async function handleListRetainageReleases(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, retainageId } = scope(request);
  const result = await retainageService.listReleases(organizationId, projectId, retainageId!);
  return reply.send(createSuccessResponse(result));
}

export async function handleReleaseRetainage(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, retainageId } = scope(request);
  const result = await retainageService.release(
    request.user!.sub,
    organizationId,
    projectId,
    retainageId!,
    releaseRetainageSchema.parse(request.body),
    request.id,
    idempotencyKey(request),
  );
  return reply.send(createSuccessResponse(result));
}
