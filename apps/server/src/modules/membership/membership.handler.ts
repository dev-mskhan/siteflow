// apps/server/src/modules/membership/membership.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { MembershipService } from './membership.service.js';
import { createSuccessResponse } from '../../shared/response.js';
import { updateMemberSchema } from './membership.validation.js';

const membershipService = new MembershipService();

export async function handleListMembers(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const members = await membershipService.listMembers(organizationId);

  return reply.send(createSuccessResponse({ members }));
}

export async function handleGetMember(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, memberId } = request.params as {
    organizationId: string;
    memberId: string;
  };
  const member = await membershipService.getMember(organizationId, memberId);

  return reply.send(createSuccessResponse({ member }));
}

export async function handleUpdateMember(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, memberId } = request.params as {
    organizationId: string;
    memberId: string;
  };
  const body = updateMemberSchema.parse(request.body);

  const member = await membershipService.updateMember(
    organizationId,
    memberId,
    request.orgContext!,
    body,
  );

  return reply.send(createSuccessResponse({ member }));
}

export async function handleRemoveMember(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId, memberId } = request.params as {
    organizationId: string;
    memberId: string;
  };

  await membershipService.removeMember(organizationId, memberId, request.orgContext!);

  return reply.send(createSuccessResponse({ message: 'Member removed successfully' }));
}
