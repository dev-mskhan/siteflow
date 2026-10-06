import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createSuccessResponse } from '../../../shared/response.js';
import { ForbiddenError } from '../../auth/auth.errors.js';
import {
  completeDocumentSchema,
  completeDocumentVersionSchema,
  createDocumentSchema,
  createDocumentVersionSchema,
  listDocumentsQuerySchema,
  updateDocumentSchema,
} from '@siteflow/shared';
import { documentService } from './document.service.js';

const pathId = z.string().min(1).max(128);

const projectParamsSchema = z.object({ organizationId: pathId, projectId: pathId });
const documentParamsSchema = projectParamsSchema.extend({ documentId: pathId });
const documentVersionParamsSchema = documentParamsSchema.extend({ versionId: pathId });

function getProjectAccess(request: FastifyRequest) {
  const ctx = request.projectCtx;
  if (!ctx) throw new ForbiddenError('Project context not established');
  return {
    organizationId: ctx.organizationId,
    projectId: ctx.projectId,
    projectMembership: ctx.projectMembership,
    organizationPermissions: ctx.organizationMembership.permissions,
  };
}

export async function handleInitiateDocumentUpload(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = projectParamsSchema.parse(request.params);
  const input = createDocumentSchema.parse(request.body);
  const result = await documentService.initiateUpload(
    request.user!.sub,
    organizationId,
    projectId,
    input,
  );
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleCompleteDocumentUpload(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, documentId } = documentParamsSchema.parse(request.params);
  const { checksum } = completeDocumentSchema.parse(request.body);
  const document = await documentService.completeUpload(
    request.user!.sub,
    organizationId,
    projectId,
    documentId,
    checksum,
    request.ip,
  );
  reply.send(createSuccessResponse({ document }));
}

export async function handleListDocuments(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = projectParamsSchema.parse(request.params);
  const query = listDocumentsQuerySchema.parse(request.query);
  const result = await documentService.listDocuments(organizationId, projectId, query);
  reply.send(createSuccessResponse(result));
}

export async function handleGetDocument(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, documentId } = documentParamsSchema.parse(request.params);
  const document = await documentService.getDocument(organizationId, projectId, documentId);
  reply.send(createSuccessResponse({ document }));
}

export async function handleGetDocumentDownload(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { documentId } = documentParamsSchema.parse(request.params);
  const result = await documentService.getDownloadUrl(
    request.user!.sub,
    getProjectAccess(request),
    documentId,
    request.ip,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleUpdateDocument(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, documentId } = documentParamsSchema.parse(request.params);
  const input = updateDocumentSchema.parse(request.body);
  const document = await documentService.updateDocument(
    request.user!.sub,
    organizationId,
    projectId,
    documentId,
    input,
  );
  reply.send(createSuccessResponse({ document }));
}

export async function handleDeleteDocument(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, documentId } = documentParamsSchema.parse(request.params);
  await documentService.deleteDocument(
    request.user!.sub,
    organizationId,
    projectId,
    documentId,
  );
  reply.status(204).send();
}

export async function handleInitiateDocumentVersion(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, documentId } = documentParamsSchema.parse(request.params);
  const input = createDocumentVersionSchema.parse(request.body);
  const result = await documentService.initiateNewVersion(
    request.user!.sub,
    organizationId,
    projectId,
    documentId,
    input,
  );
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleCompleteDocumentVersion(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, documentId, versionId } = documentVersionParamsSchema.parse(request.params);
  const { checksum } = completeDocumentVersionSchema.parse(request.body);
  const result = await documentService.completeVersion(
    request.user!.sub,
    organizationId,
    projectId,
    documentId,
    versionId,
    checksum,
    request.ip,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleListDocumentVersions(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, documentId } = documentParamsSchema.parse(request.params);
  const versions = await documentService.listVersions(organizationId, projectId, documentId);
  reply.send(createSuccessResponse({ versions }));
}
