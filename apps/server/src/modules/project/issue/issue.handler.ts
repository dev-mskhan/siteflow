// apps/server/src/modules/project/issue/issue.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { IssueService } from './issue.service.js';
import { createIssueSchema, updateIssueSchema, transitionIssueSchema } from './issue.schemas.js';

const issueService = new IssueService();

export async function handleCreateIssue(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const actorUserId = request.user!.sub;
  const input = createIssueSchema.parse(request.body);

  const result = await issueService.createIssue(actorUserId, organizationId, projectId, input);
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetIssue(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, issueId } = request.params as {
    organizationId: string;
    projectId: string;
    issueId: string;
  };

  const result = await issueService.getIssue(organizationId, projectId, issueId);
  reply.send(createSuccessResponse(result));
}

export async function handleListIssues(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };

  const result = await issueService.listIssues(organizationId, projectId);
  reply.send(createSuccessResponse(result));
}

export async function handleUpdateIssue(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, issueId } = request.params as {
    organizationId: string;
    projectId: string;
    issueId: string;
  };
  const actorUserId = request.user!.sub;
  const input = updateIssueSchema.parse(request.body);

  const result = await issueService.updateIssue(
    actorUserId,
    organizationId,
    projectId,
    issueId,
    input,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleTransitionIssue(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, issueId } = request.params as {
    organizationId: string;
    projectId: string;
    issueId: string;
  };
  const actorUserId = request.user!.sub;
  const { status } = transitionIssueSchema.parse(request.body);

  const result = await issueService.transitionIssue(
    actorUserId,
    organizationId,
    projectId,
    issueId,
    status,
  );
  reply.send(createSuccessResponse(result));
}
