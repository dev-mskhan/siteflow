import type { FastifyReply, FastifyRequest } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import {
  boqExportQuerySchema,
  boqImportCommitSchema,
  boqImportPreviewSchema,
  boqItemMappingSchema,
  boqListQuerySchema,
  boqParamsSchema,
  boqRevisionListQuerySchema,
  boqTransitionSchema,
  createBoqSchema,
  reviseBoqSchema,
} from './boq.schemas.js';
import { projectBoqService } from './boq.service.js';

function scope(request: FastifyRequest) {
  const params = boqParamsSchema.parse(request.params);
  return {
    organizationId: request.orgContext!.organizationId,
    projectId: params.projectId,
    boqId: params.boqId,
    revisionId: params.revisionId,
    itemId: params.itemId,
  };
}

export async function handleCreateBoq(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId } = scope(request);
  const input = createBoqSchema.parse(request.body);
  const boq = await projectBoqService.create(
    { organizationId, projectId },
    input,
    request.user!.sub,
    request.id,
  );
  reply.status(201).send(createSuccessResponse({ boq }));
}

export async function handleListBoqs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId } = scope(request);
  const query = boqListQuerySchema.parse(request.query);
  const result = await projectBoqService.listBoqs({ organizationId, projectId }, query);
  reply.send(createSuccessResponse(result));
}

export async function handleGetBoq(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, boqId } = scope(request);
  const boq = await projectBoqService.getBoq({ organizationId, projectId }, boqId!);
  reply.send(createSuccessResponse({ boq }));
}

export async function handleReviseBoq(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, boqId } = scope(request);
  const input = reviseBoqSchema.parse(request.body);
  const boq = await projectBoqService.revise(
    { organizationId, projectId },
    boqId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ boq }));
}

export async function handleListBoqRevisions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, boqId } = scope(request);
  const query = boqRevisionListQuerySchema.parse(request.query);
  const result = await projectBoqService.listRevisions(
    { organizationId, projectId },
    boqId!,
    query,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleGetBoqRevision(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, boqId, revisionId } = scope(request);
  const result = await projectBoqService.getRevision(
    { organizationId, projectId },
    boqId!,
    revisionId!,
  );
  reply.send(createSuccessResponse(result));
}

export async function handlePreviewBoqImport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, boqId } = scope(request);
  const input = boqImportPreviewSchema.parse(request.body);
  const preview = await projectBoqService.previewImport(
    { organizationId, projectId },
    boqId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ preview }));
}

export async function handleCommitBoqImport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, boqId } = scope(request);
  const input = boqImportCommitSchema.parse(request.body);
  const boq = await projectBoqService.commitImport(
    { organizationId, projectId },
    boqId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ boq }));
}

export async function handleSubmitBoq(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, boqId } = scope(request);
  const input = boqTransitionSchema.parse(request.body);
  const boq = await projectBoqService.submit(
    { organizationId, projectId },
    boqId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ boq }));
}

export async function handleApproveBoq(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, boqId } = scope(request);
  const input = boqTransitionSchema.parse(request.body);
  const boq = await projectBoqService.approve(
    { organizationId, projectId },
    boqId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ boq }));
}

export async function handleLockBoq(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, boqId } = scope(request);
  const input = boqTransitionSchema.parse(request.body);
  const boq = await projectBoqService.lock(
    { organizationId, projectId },
    boqId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ boq }));
}

export async function handleMapBoqItem(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, boqId, itemId } = scope(request);
  const input = boqItemMappingSchema.parse(request.body);
  const item = await projectBoqService.mapItem(
    { organizationId, projectId },
    boqId!,
    itemId!,
    input,
    request.user!.sub,
    request.id,
  );
  reply.send(createSuccessResponse({ item }));
}

export async function handleExportBoqCsv(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { organizationId, projectId, boqId } = scope(request);
  const query = boqExportQuerySchema.parse(request.query);
  const file = await projectBoqService.exportCsv(
    { organizationId, projectId },
    boqId!,
    query.revisionId,
  );
  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${file.filename}"`)
    .header('Cache-Control', 'no-store')
    .send(file.content);
}
