// apps/server/src/modules/project/schedule-history/schedule-history.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { ScheduleHistoryService } from './schedule-history.service.js';

const scheduleHistoryService = new ScheduleHistoryService();

export async function handleListScheduleHistory(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const query = request.query as { taskId?: string };

  const result = query.taskId
    ? await scheduleHistoryService.listTaskHistory(organizationId, projectId, query.taskId)
    : await scheduleHistoryService.listProjectHistory(organizationId, projectId);

  reply.send(createSuccessResponse(result));
}
