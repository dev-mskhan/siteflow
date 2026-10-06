import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  completeComplianceInspectionSchema,
  createComplianceInspectionSchema,
  createComplianceRecordSchema,
  createPermitSchema,
  listComplianceInspectionsQuerySchema,
  listComplianceRecordsQuerySchema,
  listExpiringItemsQuerySchema,
  listPermitsQuerySchema,
  permitTransitionSchema,
  updateComplianceInspectionSchema,
  updateComplianceRecordSchema,
  updatePermitSchema,
  verifyComplianceRecordSchema,
} from '@siteflow/shared';
import { createSuccessResponse } from '../../../shared/response.js';
import { ForbiddenError } from '../../auth/auth.errors.js';
import { complianceService } from './compliance.service.js';
import { expiryScannerService } from './expiry-scanner.service.js';
import type { ComplianceEntityType } from './compliance.repository.js';

const pathId = z.string().min(1).max(128);
const paramsSchema = z.object({
  organizationId: pathId,
  projectId: pathId,
}).passthrough();

function scopeFromRequest(request: FastifyRequest) {
  if (!request.projectCtx) throw new ForbiddenError('Project context not established');
  return {
    organizationId: request.projectCtx.organizationId,
    projectId: request.projectCtx.projectId,
  };
}

function resourceId(request: FastifyRequest, entity: ComplianceEntityType): string {
  const params = paramsSchema.passthrough().parse(request.params);
  const idKey = entity === 'permit' ? 'permitId' : entity === 'inspection' ? 'inspectionId' : 'recordId';
  return pathId.parse(params[idKey]);
}

export function createComplianceHandler(entity: ComplianceEntityType, schema: z.ZodTypeAny) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    paramsSchema.parse(request.params);
    const input = schema.parse(request.body);
    const row = await complianceService.create(
      request.user!.sub,
      scopeFromRequest(request),
      entity,
      input,
    );
    reply.status(201).send(createSuccessResponse({ [entity]: row }));
  };
}

export function listComplianceHandler(entity: ComplianceEntityType) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    paramsSchema.parse(request.params);
    const querySchema = entity === 'permit'
      ? listPermitsQuerySchema
      : entity === 'inspection'
        ? listComplianceInspectionsQuerySchema
        : listComplianceRecordsQuerySchema;
    const query = querySchema.parse(request.query);
    const result = await complianceService.list(scopeFromRequest(request), entity, query);
    reply.send(createSuccessResponse(result));
  };
}

export function getComplianceHandler(entity: ComplianceEntityType) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    paramsSchema.parse(request.params);
    const row = await complianceService.get(
      scopeFromRequest(request),
      entity,
      resourceId(request, entity),
    );
    reply.send(createSuccessResponse({ [entity]: row }));
  };
}

export function updateComplianceHandler(
  entity: ComplianceEntityType,
  schema: z.ZodTypeAny,
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    paramsSchema.parse(request.params);
    const row = await complianceService.update(
      request.user!.sub,
      scopeFromRequest(request),
      entity,
      resourceId(request, entity),
      schema.parse(request.body),
    );
    reply.send(createSuccessResponse({ [entity]: row }));
  };
}

export function deleteComplianceHandler(entity: ComplianceEntityType) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    paramsSchema.parse(request.params);
    await complianceService.remove(
      request.user!.sub,
      scopeFromRequest(request),
      entity,
      resourceId(request, entity),
    );
    reply.status(204).send();
  };
}

export async function transitionPermitHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const { status } = permitTransitionSchema.parse(request.body);
  const permit = await complianceService.transitionPermit(
    request.user!.sub,
    scopeFromRequest(request),
    resourceId(request, 'permit'),
    status,
  );
  reply.send(createSuccessResponse({ permit }));
}

export async function completeComplianceInspectionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const input = completeComplianceInspectionSchema.parse(request.body);
  const inspection = await complianceService.completeInspection(
    request.user!.sub,
    scopeFromRequest(request),
    resourceId(request, 'inspection'),
    input,
  );
  reply.send(createSuccessResponse({ inspection }));
}

export async function verifyComplianceRecordHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const input = verifyComplianceRecordSchema.parse(request.body);
  const record = await complianceService.verifyRecord(
    request.user!.sub,
    scopeFromRequest(request),
    resourceId(request, 'record'),
    input.verificationRef,
  );
  reply.send(createSuccessResponse({ record }));
}

export async function listExpiringItemsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  paramsSchema.parse(request.params);
  const result = await expiryScannerService.listExpiring(
    scopeFromRequest(request),
    listExpiringItemsQuerySchema.parse(request.query),
  );
  reply.send(createSuccessResponse(result));
}

export function attachComplianceDocumentHandler(entity: ComplianceEntityType) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    paramsSchema.parse(request.params);
    const { documentId } = z.object({ documentId: pathId }).parse(request.body);
    await complianceService.attachDocument(
      request.user!.sub,
      scopeFromRequest(request),
      entity,
      resourceId(request, entity),
      documentId,
    );
    reply.status(204).send();
  };
}

export const complianceSchemas = {
  createPermitSchema,
  updatePermitSchema,
  createComplianceInspectionSchema,
  updateComplianceInspectionSchema,
  createComplianceRecordSchema,
  updateComplianceRecordSchema,
};
