// apps/server/src/modules/organization/settings/settings.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { OrgSettingsService } from './settings.service.js';
import { updateSettingsSchema } from './settings.validation.js';
import { createSuccessResponse } from '../../../shared/response.js';

const settingsService = new OrgSettingsService();

export async function handleGetSettings(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const settings = await settingsService.getSettings(organizationId);
  return reply.send(createSuccessResponse({ settings }));
}

export async function handleUpdateSettings(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const body = updateSettingsSchema.parse(request.body);
  const settings = await settingsService.updateSettings(organizationId, request.orgContext!, body);
  return reply.send(createSuccessResponse({ settings }));
}
