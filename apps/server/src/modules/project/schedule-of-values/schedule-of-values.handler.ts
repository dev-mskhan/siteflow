import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createScheduleOfValuesSchema,
  listScheduleOfValuesQuerySchema,
  scheduleOfValuesParamsSchema,
  scheduleOfValuesTransitionSchema,
  updateScheduleOfValuesSchema,
} from '@siteflow/shared';
import { createSuccessResponse } from '../../../shared/response.js';
import { scheduleOfValuesService } from './schedule-of-values.service.js';

function scope(request: FastifyRequest) {
  const params = scheduleOfValuesParamsSchema.parse(request.params);
  return {
    organizationId: request.orgContext!.organizationId,
    projectId: params.projectId,
    scheduleOfValuesId: params.scheduleOfValuesId,
  };
}

export async function handleCreateScheduleOfValues(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = scope(request);
  const schedule = await scheduleOfValuesService.create(
    request.user!.sub,
    organizationId,
    projectId,
    createScheduleOfValuesSchema.parse(request.body),
    request.id,
  );
  return reply.status(201).send(createSuccessResponse({ scheduleOfValues: schedule }));
}

export async function handleListScheduleOfValues(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = scope(request);
  const query = listScheduleOfValuesQuerySchema.parse(request.query);
  const schedules = await scheduleOfValuesService.list(organizationId, projectId, query.limit);
  return reply.send(createSuccessResponse({ scheduleOfValues: schedules, nextCursor: null }));
}

export async function handleGetScheduleOfValues(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, scheduleOfValuesId } = scope(request);
  const schedule = await scheduleOfValuesService.get(organizationId, projectId, scheduleOfValuesId!);
  return reply.send(createSuccessResponse({ scheduleOfValues: schedule }));
}

export async function handleUpdateScheduleOfValues(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, scheduleOfValuesId } = scope(request);
  const schedule = await scheduleOfValuesService.update(
    request.user!.sub,
    organizationId,
    projectId,
    scheduleOfValuesId!,
    updateScheduleOfValuesSchema.parse(request.body),
    request.id,
  );
  return reply.send(createSuccessResponse({ scheduleOfValues: schedule }));
}

async function transition(
  request: FastifyRequest,
  operation: 'submit' | 'approve',
) {
  const { organizationId, projectId, scheduleOfValuesId } = scope(request);
  const { expectedVersion } = scheduleOfValuesTransitionSchema.parse(request.body);
  const actorUserId = request.user!.sub;
  if (operation === 'submit') {
    return scheduleOfValuesService.submit(
      actorUserId, organizationId, projectId, scheduleOfValuesId!, expectedVersion, request.id,
    );
  }
  return scheduleOfValuesService.approve(
    actorUserId, organizationId, projectId, scheduleOfValuesId!, expectedVersion, request.id,
  );
}

export async function handleSubmitScheduleOfValues(request: FastifyRequest, reply: FastifyReply) {
  const schedule = await transition(request, 'submit');
  return reply.send(createSuccessResponse({ scheduleOfValues: schedule }));
}

export async function handleApproveScheduleOfValues(request: FastifyRequest, reply: FastifyReply) {
  const schedule = await transition(request, 'approve');
  return reply.send(createSuccessResponse({ scheduleOfValues: schedule }));
}

export async function handleScheduleOfValuesProgress(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, scheduleOfValuesId } = scope(request);
  const progress = await scheduleOfValuesService.getProgress(
    organizationId, projectId, scheduleOfValuesId!,
  );
  return reply.send(createSuccessResponse({ progress }));
}
