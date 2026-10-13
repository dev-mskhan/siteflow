import type { FastifyReply, FastifyRequest } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { EstimateValidationError } from './estimate.errors.js';
import {
  createEstimateSchema,
  estimateCompareQuerySchema,
  estimateListQuerySchema,
  estimateParamsSchema,
  rejectEstimateSchema,
  transitionEstimateSchema,
  updateEstimateSchema,
} from './estimate.schemas.js';
import { projectEstimateService } from './estimate.service.js';

function scope(request: FastifyRequest) {
  const params = estimateParamsSchema.parse(request.params);
  return {
    organizationId: request.orgContext!.organizationId,
    projectId: params.projectId,
    estimateId: params.estimateId,
  };
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      createdAt?: string;
      id?: string;
    };
    if (!parsed.createdAt || !parsed.id) throw new Error('invalid cursor');
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new Error('invalid cursor');
    return { createdAt, id: parsed.id };
  } catch {
    throw new EstimateValidationError('Invalid pagination cursor.');
  }
}

function encodeCursor(row: { createdAt: string; id: string }) {
  return Buffer.from(JSON.stringify(row), 'utf8').toString('base64url');
}

export async function handleCreateEstimate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId } = scope(request);
  const input = createEstimateSchema.parse(request.body);
  const estimate = await projectEstimateService.create(
    { organizationId, projectId },
    input,
    request.user!.sub,
    request.id,
  );
  reply.status(201).send(createSuccessResponse({ estimate }));
}

export async function handleListEstimates(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId } = scope(request);
  const query = estimateListQuerySchema.parse(request.query);
  const result = await projectEstimateService.list(
    { organizationId, projectId },
    { status: query.status, cursor: decodeCursor(query.cursor), limit: query.limit },
  );
  reply.send(
    createSuccessResponse({
      items: result.items,
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : null,
    }),
  );
}

export async function handleGetEstimate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, estimateId } = scope(request);
  const estimate = await projectEstimateService.getById({ organizationId, projectId }, estimateId!);
  reply.send(createSuccessResponse({ estimate }));
}

export async function handleCompareEstimate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, estimateId } = scope(request);
  const query = estimateCompareQuerySchema.parse(request.query);
  const result = await projectEstimateService.compare(
    { organizationId, projectId },
    estimateId!,
    query.fromRevision,
    query.toRevision,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleUpdateEstimate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, estimateId } = scope(request);
  const input = updateEstimateSchema.parse(request.body);
  const estimate = await projectEstimateService.update(
    { organizationId, projectId },
    estimateId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ estimate }));
}

export async function handleSubmitEstimate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, estimateId } = scope(request);
  const input = transitionEstimateSchema.parse(request.body);
  const estimate = await projectEstimateService.submit(
    { organizationId, projectId },
    estimateId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ estimate }));
}

export async function handleApproveEstimate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, estimateId } = scope(request);
  const input = transitionEstimateSchema.parse(request.body);
  const estimate = await projectEstimateService.approve(
    { organizationId, projectId },
    estimateId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ estimate }));
}

export async function handleRejectEstimate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, estimateId } = scope(request);
  const input = rejectEstimateSchema.parse(request.body);
  const estimate = await projectEstimateService.reject(
    { organizationId, projectId },
    estimateId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ estimate }));
}
