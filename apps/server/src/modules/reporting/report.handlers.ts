// apps/server/src/modules/reporting/report.handlers.ts
// F.16 — HTTP Handlers for reporting endpoints.

import type { FastifyRequest, FastifyReply } from 'fastify';
import { reportService } from './report.service.js';
import { createSuccessResponse } from '../../shared/response.js';

export async function getHealthReportHandler(
  req: FastifyRequest<{ Params: { organizationId: string; projectId: string } }>,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params;
  const result = await reportService.getHealthReport(organizationId, projectId);
  if (!result) {
    return reply.status(404).send({
      success: false,
      error: { code: 'REPORT_NOT_FOUND', message: 'Project or report data not found.' },
    });
  }
  return reply.send(createSuccessResponse(result));
}

export async function getScheduleReportHandler(
  req: FastifyRequest<{ Params: { organizationId: string; projectId: string }; Querystring: unknown }>,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params;
  const result = await reportService.getScheduleReport(organizationId, projectId, req.query);
  if (!result) {
    return reply.status(404).send({
      success: false,
      error: { code: 'REPORT_NOT_FOUND', message: 'Project or report data not found.' },
    });
  }
  return reply.send(createSuccessResponse(result));
}

export async function getCostReportHandler(
  req: FastifyRequest<{ Params: { organizationId: string; projectId: string }; Querystring: unknown }>,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params;
  const result = await reportService.getCostReport(organizationId, projectId, req.query);
  if (!result) {
    return reply.status(404).send({
      success: false,
      error: { code: 'REPORT_NOT_FOUND', message: 'Project or report data not found.' },
    });
  }
  return reply.send(createSuccessResponse(result));
}

export async function getProcurementReportHandler(
  req: FastifyRequest<{ Params: { organizationId: string; projectId: string }; Querystring: unknown }>,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params;
  const result = await reportService.getProcurementReport(organizationId, projectId, req.query);
  if (!result) {
    return reply.status(404).send({
      success: false,
      error: { code: 'REPORT_NOT_FOUND', message: 'Project or report data not found.' },
    });
  }
  return reply.send(createSuccessResponse(result));
}

export async function getSubcontractorReportHandler(
  req: FastifyRequest<{ Params: { organizationId: string; projectId: string }; Querystring: unknown }>,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params;
  const result = await reportService.getSubcontractorReport(organizationId, projectId, req.query);
  if (!result) {
    return reply.status(404).send({
      success: false,
      error: { code: 'REPORT_NOT_FOUND', message: 'Project or report data not found.' },
    });
  }
  return reply.send(createSuccessResponse(result));
}

export async function getExecutiveSummaryReportHandler(
  req: FastifyRequest<{ Params: { organizationId: string; projectId: string }; Querystring: unknown }>,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params;
  const result = await reportService.getExecutiveSummaryReport(organizationId, projectId, req.query);
  if (!result) {
    return reply.status(404).send({
      success: false,
      error: { code: 'REPORT_NOT_FOUND', message: 'Project or report data not found.' },
    });
  }
  return reply.send(createSuccessResponse(result));
}

export async function getPortfolioReportHandler(
  req: FastifyRequest<{ Params: { organizationId: string }; Querystring: unknown }>,
  reply: FastifyReply,
) {
  const { organizationId } = req.params;
  const result = await reportService.getPortfolioReport(organizationId, req.query);
  return reply.send(createSuccessResponse(result));
}
