import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createSubmittalSchema,
  listSubmittalsQuerySchema,
  reviewSubmittalSchema,
  updateSubmittalSchema,
} from '@siteflow/shared';
import { createSuccessResponse } from '../../../shared/response.js';
import { ForbiddenError } from '../../auth/auth.errors.js';
import { submittalService } from './submittal.service.js';

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

function submittalId(request: FastifyRequest): string {
  const params = paramsSchema.parse(request.params);
  return idSchema.parse(params['submittalId']);
}

export async function createSubmittalHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const submittal = await submittalService.create(
    request.user!.sub,
    scope(request),
    createSubmittalSchema.parse(request.body),
  );
  reply.status(201).send(createSuccessResponse({ submittal }));
}

export async function listSubmittalsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const result = await submittalService.list(
    scope(request),
    listSubmittalsQuerySchema.parse(request.query),
  );
  reply.send(createSuccessResponse(result));
}

export async function getSubmittalHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const submittal = await submittalService.get(scope(request), submittalId(request));
  reply.send(createSuccessResponse({ submittal }));
}

export async function updateSubmittalHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const submittal = await submittalService.update(
    request.user!.sub,
    scope(request),
    submittalId(request),
    updateSubmittalSchema.parse(request.body),
  );
  reply.send(createSuccessResponse({ submittal }));
}

export async function submitSubmittalHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const submittal = await submittalService.submit(
    request.user!.sub,
    scope(request),
    submittalId(request),
  );
  reply.send(createSuccessResponse({ submittal }));
}

export async function reviewSubmittalHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const submittal = await submittalService.review(
    request.user!.sub,
    scope(request),
    submittalId(request),
    reviewSubmittalSchema.parse(request.body),
  );
  reply.send(createSuccessResponse({ submittal }));
}

export async function resubmitSubmittalHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const submittal = await submittalService.resubmit(
    request.user!.sub,
    scope(request),
    submittalId(request),
  );
  reply.send(createSuccessResponse({ submittal }));
}

export async function closeSubmittalHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const submittal = await submittalService.close(
    request.user!.sub,
    scope(request),
    submittalId(request),
  );
  reply.send(createSuccessResponse({ submittal }));
}

export async function listSubmittalRevisionsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const revisions = await submittalService.revisions(scope(request), submittalId(request));
  reply.send(createSuccessResponse({ revisions }));
}

export async function getSubmittalRevisionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const params = z.object({ revisionId: idSchema }).passthrough().parse(request.params);
  const revision = await submittalService.revision(
    scope(request),
    submittalId(request),
    params.revisionId,
  );
  reply.send(createSuccessResponse({ revision }));
}

export async function attachSubmittalDocumentHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const { documentId } = z.object({ documentId: idSchema }).parse(request.body);
  await submittalService.attachDocument(
    request.user!.sub,
    scope(request),
    submittalId(request),
    documentId,
  );
  reply.status(204).send();
}
