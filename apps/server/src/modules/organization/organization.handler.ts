// apps/server/src/modules/organization/organization.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { OrganizationService } from './organization.service.js';
import { createSuccessResponse } from '../../shared/response.js';
import {
  createOrgSchema,
  updateOrgSchema,
  updateSettingsSchema,
} from './organization.validation.js';

const orgService = new OrganizationService();

export async function handleCreateOrg(request: FastifyRequest, reply: FastifyReply) {
  const body = createOrgSchema.parse(request.body);
  const userId = request.user!.sub;

  const org = await orgService.createOrganization(userId, body);

  return reply.status(201).send(createSuccessResponse({ organization: org }));
}

export async function handleListOrgs(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.sub;
  const orgs = await orgService.listOrganizations(userId);

  return reply.send(createSuccessResponse({ organizations: orgs }));
}

export async function handleGetOrg(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const org = await orgService.getOrganization(organizationId);

  return reply.send(createSuccessResponse({ organization: org }));
}

export async function handleUpdateOrg(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const body = updateOrgSchema.parse(request.body);
  const userId = request.user!.sub;

  const org = await orgService.updateOrganization(organizationId, userId, body);

  return reply.send(createSuccessResponse({ organization: org }));
}

export async function handleGetSettings(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const org = await orgService.getOrganization(organizationId);

  return reply.send(createSuccessResponse({ settings: org.settings }));
}

export async function handleUpdateSettings(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const body = updateSettingsSchema.parse(request.body);
  const userId = request.user!.sub;

  const settings = await orgService.updateSettings(organizationId, userId, body);

  return reply.send(createSuccessResponse({ settings }));
}
