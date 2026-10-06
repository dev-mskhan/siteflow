import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createRfiSchema,
  listRfisQuerySchema,
  respondRfiSchema,
  updateRfiSchema,
} from '@siteflow/shared';
import { createSuccessResponse } from '../../../shared/response.js';
import { ForbiddenError } from '../../auth/auth.errors.js';
import { rfiService } from './rfi.service.js';

const idSchema = z.string().min(1).max(128);
const paramsSchema = z.object({
  organizationId: idSchema,
  projectId: idSchema,
}).passthrough();

function scope(request: FastifyRequest) {
  if (!request.projectCtx) throw new ForbiddenError('Project context not established');
  return {
    organizationId: request.projectCtx.organizationId,
    projectId: request.projectCtx.projectId,
  };
}

function rfiId(request: FastifyRequest): string {
  const params = paramsSchema.parse(request.params);
  return idSchema.parse(params['rfiId']);
}

export async function createRfiHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  paramsSchema.parse(request.params);
  const rfi = await rfiService.create(
    request.user!.sub,
    scope(request),
    createRfiSchema.parse(request.body),
  );
  reply.status(201).send(createSuccessResponse({ rfi }));
}

export async function listRfisHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  paramsSchema.parse(request.params);
  const result = await rfiService.list(scope(request), listRfisQuerySchema.parse(request.query));
  reply.send(createSuccessResponse(result));
}

export async function getRfiHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  paramsSchema.parse(request.params);
  const rfi = await rfiService.get(scope(request), rfiId(request));
  reply.send(createSuccessResponse({ rfi }));
}

export async function updateRfiHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  paramsSchema.parse(request.params);
  const rfi = await rfiService.update(
    request.user!.sub,
    scope(request),
    rfiId(request),
    updateRfiSchema.parse(request.body),
  );
  reply.send(createSuccessResponse({ rfi }));
}

export async function submitRfiHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  paramsSchema.parse(request.params);
  const rfi = await rfiService.submit(request.user!.sub, scope(request), rfiId(request));
  reply.send(createSuccessResponse({ rfi }));
}

export async function respondRfiHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  paramsSchema.parse(request.params);
  const rfi = await rfiService.respond(
    request.user!.sub,
    scope(request),
    rfiId(request),
    respondRfiSchema.parse(request.body),
  );
  reply.send(createSuccessResponse({ rfi }));
}

export async function closeRfiHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  paramsSchema.parse(request.params);
  const rfi = await rfiService.close(request.user!.sub, scope(request), rfiId(request));
  reply.send(createSuccessResponse({ rfi }));
}

export async function cancelRfiHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  paramsSchema.parse(request.params);
  const rfi = await rfiService.cancel(request.user!.sub, scope(request), rfiId(request));
  reply.send(createSuccessResponse({ rfi }));
}

export async function attachRfiDocumentHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const { documentId } = z.object({ documentId: idSchema }).parse(request.body);
  await rfiService.attachDocument(
    request.user!.sub,
    scope(request),
    rfiId(request),
    documentId,
  );
  reply.status(204).send();
}
