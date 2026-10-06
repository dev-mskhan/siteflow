import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  closeSafetyEventSchema,
  createSafetyCorrectiveActionSchema,
  createSafetyEventSchema,
  createSafetyMeetingSchema,
  investigateSafetyEventSchema,
  listSafetyEventsQuerySchema,
  listSafetyMeetingsQuerySchema,
  updateSafetyEventSchema,
} from '@siteflow/shared';
import { createSuccessResponse } from '../../../shared/response.js';
import { ForbiddenError } from '../../auth/auth.errors.js';
import { safetyService } from './safety.service.js';

const idSchema = z.string().min(1).max(128);
const paramsSchema = z.object({
  organizationId: idSchema,
  projectId: idSchema,
}).passthrough();
const eventParamsSchema = paramsSchema.extend({ eventId: idSchema });
const meetingParamsSchema = paramsSchema.extend({ meetingId: idSchema });

function scope(request: FastifyRequest) {
  if (!request.projectCtx) throw new ForbiddenError('Project context not established');
  return {
    organizationId: request.projectCtx.organizationId,
    projectId: request.projectCtx.projectId,
  };
}

export async function createSafetyEventHandler(request: FastifyRequest, reply: FastifyReply) {
  paramsSchema.parse(request.params);
  const event = await safetyService.createEvent(
    request.user!.sub,
    scope(request),
    createSafetyEventSchema.parse(request.body),
  );
  reply.status(201).send(createSuccessResponse({ event }));
}

export async function listSafetyEventsHandler(request: FastifyRequest, reply: FastifyReply) {
  paramsSchema.parse(request.params);
  const result = await safetyService.listEvents(
    scope(request),
    listSafetyEventsQuerySchema.parse(request.query),
  );
  reply.send(createSuccessResponse(result));
}

export async function getSafetyEventHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = eventParamsSchema.parse(request.params);
  const event = await safetyService.getEvent(scope(request), params.eventId);
  reply.send(createSuccessResponse({ event }));
}

export async function updateSafetyEventHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = eventParamsSchema.parse(request.params);
  const event = await safetyService.updateEvent(
    request.user!.sub,
    scope(request),
    params.eventId,
    updateSafetyEventSchema.parse(request.body),
  );
  reply.send(createSuccessResponse({ event }));
}

export async function investigateSafetyEventHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = eventParamsSchema.parse(request.params);
  const input = investigateSafetyEventSchema.parse(request.body ?? {});
  const event = await safetyService.investigate(request.user!.sub, scope(request), params.eventId, input);
  reply.send(createSuccessResponse({ event }));
}

export async function closeSafetyEventHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = eventParamsSchema.parse(request.params);
  const event = await safetyService.closeEvent(
    request.user!.sub,
    scope(request),
    params.eventId,
    closeSafetyEventSchema.parse(request.body),
  );
  reply.send(createSuccessResponse({ event }));
}

export async function createSafetyCorrectiveActionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = eventParamsSchema.parse(request.params);
  const action = await safetyService.createCorrectiveAction(
    request.user!.sub,
    scope(request),
    params.eventId,
    createSafetyCorrectiveActionSchema.parse(request.body),
  );
  reply.status(201).send(createSuccessResponse({ action }));
}

export async function attachSafetyDocumentHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = eventParamsSchema.parse(request.params);
  const { documentId } = z.object({ documentId: idSchema }).parse(request.body);
  await safetyService.attachDocument(
    request.user!.sub,
    scope(request),
    params.eventId,
    documentId,
  );
  reply.status(204).send();
}

export async function createSafetyMeetingHandler(request: FastifyRequest, reply: FastifyReply) {
  paramsSchema.parse(request.params);
  const meeting = await safetyService.createMeeting(
    request.user!.sub,
    scope(request),
    createSafetyMeetingSchema.parse(request.body),
  );
  reply.status(201).send(createSuccessResponse({ meeting }));
}

export async function listSafetyMeetingsHandler(request: FastifyRequest, reply: FastifyReply) {
  paramsSchema.parse(request.params);
  const result = await safetyService.listMeetings(
    scope(request),
    listSafetyMeetingsQuerySchema.parse(request.query),
  );
  reply.send(createSuccessResponse(result));
}

export async function getSafetyMeetingHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = meetingParamsSchema.parse(request.params);
  const meeting = await safetyService.getMeeting(scope(request), params.meetingId);
  reply.send(createSuccessResponse({ meeting }));
}
