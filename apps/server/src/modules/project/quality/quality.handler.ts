import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  completeCorrectiveActionSchema,
  completeQualityInspectionSchema,
  createCorrectiveActionSchema,
  createQualityDeficiencySchema,
  createQualityInspectionSchema,
  listCorrectiveActionsQuerySchema,
  listQualityDeficienciesQuerySchema,
  listQualityInspectionsQuerySchema,
  updateCorrectiveActionSchema,
  updateQualityDeficiencySchema,
  updateQualityInspectionSchema,
  verifyCorrectiveActionSchema,
} from '@siteflow/shared';
import { createSuccessResponse } from '../../../shared/response.js';
import { ForbiddenError } from '../../auth/auth.errors.js';
import type { QualityEntityType } from './quality.repository.js';
import { qualityService } from './quality.service.js';

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

function resourceId(request: FastifyRequest, entity: QualityEntityType): string {
  const params = paramsSchema.parse(request.params);
  const key = entity === 'inspection'
    ? 'inspectionId'
    : entity === 'deficiency' ? 'deficiencyId' : 'actionId';
  return idSchema.parse(params[key]);
}

function createSchema(entity: QualityEntityType) {
  if (entity === 'inspection') return createQualityInspectionSchema;
  if (entity === 'deficiency') return createQualityDeficiencySchema;
  return createCorrectiveActionSchema;
}

function updateSchema(entity: QualityEntityType) {
  if (entity === 'inspection') {
    return updateQualityInspectionSchema;
  }
  if (entity === 'deficiency') {
    return updateQualityDeficiencySchema;
  }
  return updateCorrectiveActionSchema;
}

function listSchema(entity: QualityEntityType) {
  if (entity === 'inspection') return listQualityInspectionsQuerySchema;
  if (entity === 'deficiency') return listQualityDeficienciesQuerySchema;
  return listCorrectiveActionsQuerySchema;
}

export function createQualityHandler(entity: QualityEntityType) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    paramsSchema.parse(request.params);
    const row = await qualityService.create(
      request.user!.sub,
      scope(request),
      entity,
      createSchema(entity).parse(request.body),
    );
    const key = entity === 'inspection' ? 'inspection' : entity === 'deficiency' ? 'deficiency' : 'action';
    reply.status(201).send(createSuccessResponse({ [key]: row }));
  };
}

export function listQualityHandler(entity: QualityEntityType) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    paramsSchema.parse(request.params);
    const result = await qualityService.list(scope(request), entity, listSchema(entity).parse(request.query));
    reply.send(createSuccessResponse(result));
  };
}

export function getQualityHandler(entity: QualityEntityType) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    paramsSchema.parse(request.params);
    const row = await qualityService.get(scope(request), entity, resourceId(request, entity));
    const key = entity === 'inspection' ? 'inspection' : entity === 'deficiency' ? 'deficiency' : 'action';
    reply.send(createSuccessResponse({ [key]: row }));
  };
}

export function updateQualityHandler(entity: QualityEntityType) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    paramsSchema.parse(request.params);
    const row = await qualityService.update(
      request.user!.sub,
      scope(request),
      entity,
      resourceId(request, entity),
      updateSchema(entity).parse(request.body),
    );
    const key = entity === 'inspection' ? 'inspection' : entity === 'deficiency' ? 'deficiency' : 'action';
    reply.send(createSuccessResponse({ [key]: row }));
  };
}

export async function startQualityInspectionHandler(request: FastifyRequest, reply: FastifyReply) {
  paramsSchema.parse(request.params);
  const row = await qualityService.startInspection(
    request.user!.sub,
    scope(request),
    resourceId(request, 'inspection'),
  );
  reply.send(createSuccessResponse({ inspection: row }));
}

export async function completeQualityInspectionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  paramsSchema.parse(request.params);
  const row = await qualityService.completeInspection(
    request.user!.sub,
    scope(request),
    resourceId(request, 'inspection'),
    completeQualityInspectionSchema.parse(request.body),
  );
  reply.send(createSuccessResponse({ inspection: row }));
}

export async function resolveQualityDeficiencyHandler(request: FastifyRequest, reply: FastifyReply) {
  paramsSchema.parse(request.params);
  const row = await qualityService.resolveDeficiency(
    request.user!.sub,
    scope(request),
    resourceId(request, 'deficiency'),
  );
  reply.send(createSuccessResponse({ deficiency: row }));
}

export async function closeQualityDeficiencyHandler(request: FastifyRequest, reply: FastifyReply) {
  paramsSchema.parse(request.params);
  const row = await qualityService.closeDeficiency(
    request.user!.sub,
    scope(request),
    resourceId(request, 'deficiency'),
  );
  reply.send(createSuccessResponse({ deficiency: row }));
}

export async function completeCorrectiveActionHandler(request: FastifyRequest, reply: FastifyReply) {
  paramsSchema.parse(request.params);
  completeCorrectiveActionSchema.parse(request.body);
  const row = await qualityService.completeCorrectiveAction(
    request.user!.sub,
    scope(request),
    resourceId(request, 'action'),
  );
  reply.send(createSuccessResponse({ action: row }));
}

export async function verifyCorrectiveActionHandler(request: FastifyRequest, reply: FastifyReply) {
  paramsSchema.parse(request.params);
  const row = await qualityService.verifyCorrectiveAction(
    request.user!.sub,
    scope(request),
    resourceId(request, 'action'),
    verifyCorrectiveActionSchema.parse(request.body),
  );
  reply.send(createSuccessResponse({ action: row }));
}

export async function attachQualityDocumentHandler(
  entity: 'inspection' | 'deficiency',
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const { documentId } = z.object({ documentId: idSchema }).parse(request.body);
  await qualityService.attachDocument(
    request.user!.sub,
    scope(request),
    entity,
    resourceId(request, entity),
    documentId,
  );
  reply.status(204).send();
}
