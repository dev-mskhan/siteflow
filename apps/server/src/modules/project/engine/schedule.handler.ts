// apps/server/src/modules/project/engine/schedule.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { ScheduleService } from './schedule.service.js';
import { z } from 'zod';

const scheduleService = new ScheduleService();

const recalculateQuerySchema = z.object({
  expectedRevision: z.coerce.number().int().optional(),
});

export async function handleRecalculateSchedule(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const actorUserId = request.user!.sub;
  const query = recalculateQuerySchema.parse(request.query);

  const result = await scheduleService.recalculateProjectSchedule(
    actorUserId,
    organizationId,
    projectId,
    query.expectedRevision,
  );

  const statusCode = result.queued ? 202 : 200;
  reply.status(statusCode).send(createSuccessResponse(result));
}
