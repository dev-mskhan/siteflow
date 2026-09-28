// apps/server/src/modules/project/calendar/calendar.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { CalendarService } from './calendar.service.js';
import { updateCalendarSchema, addCalendarExceptionSchema } from './calendar.schemas.js';

const calendarService = new CalendarService();

export async function handleGetCalendar(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const result = await calendarService.getCalendar(organizationId, projectId);
  reply.send(createSuccessResponse(result));
}

export async function handleUpdateCalendar(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const actorUserId = request.user!.sub;
  const input = updateCalendarSchema.parse(request.body);

  const result = await calendarService.updateCalendar(
    actorUserId,
    organizationId,
    projectId,
    input,
  );

  reply.send(createSuccessResponse(result));
}

export async function handleAddCalendarException(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const actorUserId = request.user!.sub;
  const input = addCalendarExceptionSchema.parse(request.body);

  const result = await calendarService.addException(
    actorUserId,
    organizationId,
    projectId,
    input,
  );

  reply.status(201).send(createSuccessResponse(result));
}

export async function handleRemoveCalendarException(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, exceptionId } = request.params as {
    organizationId: string;
    projectId: string;
    exceptionId: string;
  };
  const actorUserId = request.user!.sub;

  const result = await calendarService.removeException(
    actorUserId,
    organizationId,
    projectId,
    exceptionId,
  );

  reply.send(createSuccessResponse(result));
}
