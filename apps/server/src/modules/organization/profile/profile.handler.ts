// apps/server/src/modules/organization/profile/profile.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { OrgProfileService } from './profile.service.js';
import { updateProfileSchema } from './profile.validation.js';
import { createSuccessResponse } from '../../../shared/response.js';

const profileService = new OrgProfileService();

export async function handleGetProfile(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const profile = await profileService.getProfile(organizationId);
  return reply.send(createSuccessResponse({ profile }));
}

export async function handleUpdateProfile(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const body = updateProfileSchema.parse(request.body);
  const profile = await profileService.updateProfile(organizationId, request.orgContext!, body);
  return reply.send(createSuccessResponse({ profile }));
}
