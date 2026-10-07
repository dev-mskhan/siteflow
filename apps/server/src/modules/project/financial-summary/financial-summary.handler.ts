import type { FastifyReply, FastifyRequest } from 'fastify';
import { financialAuditQuerySchema, financialSummaryParamsSchema } from '@siteflow/shared';
import { createSuccessResponse } from '../../../shared/response.js';
import { financialSummaryService } from './financial-summary.service.js';

export async function handleGetFinancialSummary(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = financialSummaryParamsSchema.parse(request.params);
  const summary = await financialSummaryService.getSummary(organizationId, projectId);
  return reply.send(createSuccessResponse(summary));
}

export async function handleGetCostSummary(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = financialSummaryParamsSchema.parse(request.params);
  const summary = await financialSummaryService.getCostSummary(organizationId, projectId);
  return reply.send(createSuccessResponse(summary));
}

export async function handleGetCommitmentSummary(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = financialSummaryParamsSchema.parse(request.params);
  const summary = await financialSummaryService.getCommitmentSummary(organizationId, projectId);
  return reply.send(createSuccessResponse(summary));
}

export async function handleGetBillingSummary(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = financialSummaryParamsSchema.parse(request.params);
  const summary = await financialSummaryService.getBillingSummary(organizationId, projectId);
  return reply.send(createSuccessResponse(summary));
}

export async function handleGetCashSummary(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = financialSummaryParamsSchema.parse(request.params);
  const summary = await financialSummaryService.getCashSummary(organizationId, projectId);
  return reply.send(createSuccessResponse(summary));
}

export async function handleListFinancialAudit(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, changeOrderId } = financialSummaryParamsSchema.parse(
    request.params,
  );
  const query = financialAuditQuerySchema.parse(request.query);
  const result = await financialSummaryService.listAuditEvents(
    organizationId,
    projectId,
    query,
    changeOrderId,
  );
  return reply.send(createSuccessResponse(result.events, { nextCursor: result.nextCursor }));
}
