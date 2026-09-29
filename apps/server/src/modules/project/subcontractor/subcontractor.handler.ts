// apps/server/src/modules/project/subcontractor/subcontractor.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSuccessResponse } from '../../../shared/response.js';
import { SubcontractorService } from './subcontractor.service.js';
import {
  assignSubcontractorToProjectSchema,
  updateProjectSubcontractorSchema,
  createContactSchema,
  updateContactSchema,
  assignTaskSchema,
} from './subcontractor.schemas.js';

const subcontractorService = new SubcontractorService();

export async function handleListProjectSubcontractors(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = req.params as {
    organizationId: string;
    projectId: string;
  };
  const result = await subcontractorService.listProjectSubcontractors(organizationId, projectId);
  reply.send(createSuccessResponse(result));
}

export async function handleAssignSubcontractorToProject(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = req.params as {
    organizationId: string;
    projectId: string;
  };
  const actorUserId = req.user!.sub;
  const input = assignSubcontractorToProjectSchema.parse(req.body);
  const result = await subcontractorService.assignToProject(
    actorUserId,
    organizationId,
    projectId,
    input,
  );
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleGetProjectSubcontractor(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, subcontractorId } = req.params as {
    organizationId: string;
    projectId: string;
    subcontractorId: string;
  };
  const result = await subcontractorService.getProjectSubcontractor(
    organizationId,
    projectId,
    subcontractorId,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleUpdateProjectSubcontractor(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, subcontractorId } = req.params as {
    organizationId: string;
    projectId: string;
    subcontractorId: string;
  };
  const actorUserId = req.user!.sub;
  const input = updateProjectSubcontractorSchema.parse(req.body);
  const result = await subcontractorService.updateProjectSubcontractor(
    actorUserId,
    organizationId,
    projectId,
    subcontractorId,
    input,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleCreateContact(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, subcontractorId } = req.params as {
    organizationId: string;
    projectId: string;
    subcontractorId: string;
  };
  const actorUserId = req.user!.sub;
  const input = createContactSchema.parse(req.body);
  // Contact creation is org-scoped but accessed via project route for convenience
  const result = await subcontractorService.createContact(
    actorUserId,
    organizationId,
    subcontractorId,
    input,
  );
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleUpdateContact(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, subcontractorId, contactId } = req.params as {
    organizationId: string;
    projectId: string;
    subcontractorId: string;
    contactId: string;
  };
  const actorUserId = req.user!.sub;
  const input = updateContactSchema.parse(req.body);
  const result = await subcontractorService.updateContact(
    actorUserId,
    organizationId,
    subcontractorId,
    contactId,
    input,
  );
  reply.send(createSuccessResponse(result));
}

export async function handleAssignTask(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, subcontractorId } = req.params as {
    organizationId: string;
    projectId: string;
    subcontractorId: string;
  };
  const actorUserId = req.user!.sub;
  const input = assignTaskSchema.parse(req.body);
  const result = await subcontractorService.assignTask(
    actorUserId,
    organizationId,
    projectId,
    subcontractorId,
    input,
  );
  reply.status(201).send(createSuccessResponse(result));
}

export async function handleRemoveTaskAssignment(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, subcontractorId, taskId } = req.params as {
    organizationId: string;
    projectId: string;
    subcontractorId: string;
    taskId: string;
  };
  const actorUserId = req.user!.sub;
  await subcontractorService.removeTaskAssignment(
    actorUserId,
    organizationId,
    projectId,
    subcontractorId,
    taskId,
  );
  reply.status(204).send();
}
