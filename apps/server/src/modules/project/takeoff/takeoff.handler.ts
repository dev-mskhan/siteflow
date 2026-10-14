import type { FastifyReply, FastifyRequest } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import {
  createTakeoffMeasurementSchema,
  createTakeoffSheetSchema,
  takeoffCompareQuerySchema,
  takeoffFormulaPreviewSchema,
  takeoffListQuerySchema,
  takeoffParamsSchema,
  takeoffRejectSchema,
  takeoffRevisionQuerySchema,
  takeoffSourceCreateSchema,
  takeoffSummaryQuerySchema,
  takeoffTransitionSchema,
  updateTakeoffMeasurementSchema,
  updateTakeoffSheetSchema,
} from '@siteflow/shared';
import { projectTakeoffService } from './takeoff.service.js';

function scope(request: FastifyRequest) {
  const params = takeoffParamsSchema.parse(request.params);
  return {
    scope: {
      organizationId: request.orgContext!.organizationId,
      projectId: params.projectId,
      actorUserId: request.user!.sub,
      requestId: request.id,
    },
    sheetId: params.sheetId,
    measurementId: params.measurementId,
  };
}

function requireSheetId(sheetId: string | undefined): string {
  if (!sheetId) {
    throw new Error('sheetId route parameter is missing');
  }
  return sheetId;
}

export async function handleCreateTakeoffSheet(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s } = scope(request);
  const input = createTakeoffSheetSchema.parse(request.body);
  const sheet = await projectTakeoffService.createSheet(s, input);
  reply.status(201).send(createSuccessResponse({ sheet }));
}

export async function handleListTakeoffSheets(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s } = scope(request);
  const query = takeoffListQuerySchema.parse(request.query);
  const result = await projectTakeoffService.listSheets(s, query);
  reply.send(createSuccessResponse(result));
}

export async function handleGetTakeoffSheet(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const sheet = await projectTakeoffService.getSheet(s, requireSheetId(sheetId));
  reply.send(createSuccessResponse({ sheet }));
}

export async function handleUpdateTakeoffSheet(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const input = updateTakeoffSheetSchema.parse(request.body);
  const sheet = await projectTakeoffService.updateSheet(s, requireSheetId(sheetId), input);
  reply.send(createSuccessResponse({ sheet }));
}

export async function handleSubmitTakeoffSheet(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const { expectedVersion } = takeoffTransitionSchema.parse(request.body);
  const sheet = await projectTakeoffService.submitSheet(s, requireSheetId(sheetId), expectedVersion);
  reply.send(createSuccessResponse({ sheet }));
}

export async function handleApproveTakeoffSheet(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const { expectedVersion } = takeoffTransitionSchema.parse(request.body);
  const sheet = await projectTakeoffService.approveSheet(s, requireSheetId(sheetId), expectedVersion);
  reply.send(createSuccessResponse({ sheet }));
}

export async function handleRejectTakeoffSheet(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const { expectedVersion, reason } = takeoffRejectSchema.parse(request.body);
  const sheet = await projectTakeoffService.rejectSheet(s, requireSheetId(sheetId), expectedVersion, reason);
  reply.send(createSuccessResponse({ sheet }));
}

export async function handleCreateTakeoffRevision(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const { expectedVersion } = takeoffTransitionSchema.parse(request.body);
  const revision = await projectTakeoffService.createRevision(s, requireSheetId(sheetId), expectedVersion);
  reply.status(201).send(createSuccessResponse({ revision }));
}

export async function handleListTakeoffRevisions(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const revisions = await projectTakeoffService.listRevisions(s, requireSheetId(sheetId));
  reply.send(createSuccessResponse({ revisions }));
}

export async function handleCompareTakeoffRevisions(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const { fromRevision, toRevision } = takeoffCompareQuerySchema.parse(request.query);
  const comparison = await projectTakeoffService.compareRevisions(
    s,
    requireSheetId(sheetId),
    fromRevision,
    toRevision,
  );
  reply.send(createSuccessResponse(comparison));
}

export async function handleListTakeoffMeasurements(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const { revisionNumber } = takeoffRevisionQuerySchema.parse(request.query);
  const measurements = await projectTakeoffService.listMeasurements(s, requireSheetId(sheetId), revisionNumber);
  reply.send(createSuccessResponse({ measurements }));
}

export async function handleCreateTakeoffMeasurement(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const input = createTakeoffMeasurementSchema.parse(request.body);
  const measurement = await projectTakeoffService.createMeasurement(s, requireSheetId(sheetId), input);
  reply.status(201).send(createSuccessResponse({ measurement }));
}

export async function handleUpdateTakeoffMeasurement(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId, measurementId } = scope(request);
  const input = updateTakeoffMeasurementSchema.parse(request.body);
  const measurement = await projectTakeoffService.updateMeasurement(
    s,
    requireSheetId(sheetId),
    measurementId!,
    input,
  );
  reply.send(createSuccessResponse({ measurement }));
}

export async function handleListTakeoffSources(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const { revisionNumber } = takeoffRevisionQuerySchema.parse(request.query);
  const sources = await projectTakeoffService.listSources(s, requireSheetId(sheetId), revisionNumber);
  reply.send(createSuccessResponse({ sources }));
}

export async function handleCreateTakeoffSource(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s, sheetId } = scope(request);
  const input = takeoffSourceCreateSchema.parse(request.body);
  const source = await projectTakeoffService.createSource(s, requireSheetId(sheetId), input);
  reply.status(201).send(createSuccessResponse({ source }));
}

export async function handlePreviewTakeoffFormula(request: FastifyRequest, reply: FastifyReply) {
  scope(request);
  const input = takeoffFormulaPreviewSchema.parse(request.body);
  const preview = projectTakeoffService.previewFormula(input);
  reply.send(createSuccessResponse(preview));
}

export async function handleTakeoffSummary(request: FastifyRequest, reply: FastifyReply) {
  const { scope: s } = scope(request);
  const { groupBy } = takeoffSummaryQuerySchema.parse(request.query);
  const summary = await projectTakeoffService.summary(s, groupBy);
  reply.send(createSuccessResponse(summary));
}
