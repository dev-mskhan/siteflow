// apps/server/src/modules/project/schedule-metrics/schedule-metrics.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { ScheduleMetricsService } from './schedule-metrics.service.js';

const scheduleMetricsService = new ScheduleMetricsService();

export async function handleGetScheduleMetrics(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };

  const result = await scheduleMetricsService.getMetrics(organizationId, projectId);
  reply.send(createSuccessResponse(result));
}
