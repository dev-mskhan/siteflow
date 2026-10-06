import type { FastifyReply, FastifyRequest } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { commercialSummaryService } from './commercial-summary.service.js';

type SummaryParams = {
  organizationId: string;
  projectId: string;
  costCodeId?: string;
};

export async function handleGetProjectCommercialSummary(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = request.params as SummaryParams;
  const summary = await commercialSummaryService.getProjectSummary(organizationId, projectId);
  return reply.send(createSuccessResponse(summary));
}

export async function handleGetCostCodeCommercialSummary(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { organizationId, projectId, costCodeId } = request.params as SummaryParams;
  const summary = await commercialSummaryService.getCostCodeSummary(
    organizationId,
    projectId,
    costCodeId!,
  );
  return reply.send(createSuccessResponse(summary));
}
