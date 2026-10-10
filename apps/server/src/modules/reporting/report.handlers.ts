// apps/server/src/modules/reporting/report.handlers.ts
// F.16 — HTTP Handlers for reporting endpoints.

import type { FastifyRequest, FastifyReply } from 'fastify';
import { reportService } from './report.service.js';
import { createSuccessResponse } from '../../shared/response.js';

export async function getHealthReportHandler(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params as { organizationId: string; projectId: string };
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
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params as { organizationId: string; projectId: string };
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
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params as { organizationId: string; projectId: string };
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
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params as { organizationId: string; projectId: string };
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
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params as { organizationId: string; projectId: string };
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
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { organizationId, projectId } = req.params as { organizationId: string; projectId: string };
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
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const portfolioQuery = req.query as { limit?: number; cursor?: string };
  const { organizationId } = req.params as { organizationId: string };
  const actor = req.orgContext;
  if (!actor) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Organization context required.' },
    });
  }
  const result = await reportService.getPortfolioReport(
    organizationId,
    {
      userId: actor.userId,
      organizationMembership: {
        id: actor.membershipId,
        roleId: actor.roleId,
        permissions: actor.permissions,
      },
    },
    {
      limit: portfolioQuery.limit,
      cursor: portfolioQuery.cursor,
    },
  );
  return reply.send(createSuccessResponse(result));
}
