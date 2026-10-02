// apps/server/src/modules/project/project.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createSuccessResponse } from '../../shared/response.js';
import { projectService } from './core/project.service.js';
import { projectLifecycleService } from './core/project.lifecycle.service.js';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
} from './core/project.schemas.js';
import type { ProjectTransition } from './core/project.types.js';

import { projectMemberService } from './members/project-member.service.js';
import { addMemberSchema, updateMemberRoleSchema } from './members/project-member.schemas.js';

import { projectSettingsService } from './settings/project-settings.service.js';
import { updateProjectSettingsSchema } from './settings/project-settings.schemas.js';

import { projectPhaseService } from './phases/project-phase.service.js';
import {
  createPhaseSchema,
  updatePhaseSchema,
  reorderPhasesSchema,
  listPhasesQuerySchema,
} from './phases/project-phase.schemas.js';

import { projectCostCodeService } from './cost-codes/project-cost-code.service.js';
import {
  createCostCodeSchema,
  updateCostCodeSchema,
  listCostCodesQuerySchema,
} from './cost-codes/project-cost-code.schemas.js';

import { projectAuditRepository } from './audit/project-audit.repository.js';

const projectAuditQuerySchema = z.object({
  resourceType: z.string().optional(),
  actorUserId: z.string().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  action: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ── CRUD Handlers ─────────────────────────────────────────────────────────────

export async function handleCreateProject(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId } = request.params as { organizationId: string };
  const body = createProjectSchema.parse(request.body);
  const userId = request.user!.sub;

  const project = await projectService.createProject(userId, organizationId, body, request.id);
  return reply.status(201).send(createSuccessResponse({ project }));
}

export async function handleListProjects(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId } = request.params as { organizationId: string };
  const query = listProjectsQuerySchema.parse(request.query);

  const result = await projectService.listProjects(organizationId, {
    cursor: query.cursor,
    limit: query.limit,
    status: query.status,
    search: query.search,
  });

  return reply.send(
    createSuccessResponse({ projects: result.data, nextCursor: result.nextCursor }),
  );
}

export async function handleGetProject(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };

  const project = await projectService.getProject(organizationId, projectId);
  return reply.send(createSuccessResponse({ project }));
}

export async function handleUpdateProject(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const body = updateProjectSchema.parse(request.body);
  const userId = request.user!.sub;

  const project = await projectService.updateProject(
    userId,
    organizationId,
    projectId,
    {
      ...body,
      // Zod strict schema rejects 'status' — safe to pass through
      expectedVersion: body.expectedVersion,
    },
    request.id,
  );
  return reply.send(createSuccessResponse({ project }));
}

// ── Lifecycle Handlers ────────────────────────────────────────────────────────

function handleTransition(transition: ProjectTransition) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, projectId } = request.params as {
      organizationId: string;
      projectId: string;
    };
    const userId = request.user!.sub;

    const project = await projectLifecycleService.transitionProject(
      userId,
      organizationId,
      projectId,
      transition,
      request.id,
    );
    return reply.send(createSuccessResponse({ project }));
  };
}

export const handleActivateProject = handleTransition('activate');
export const handleHoldProject = handleTransition('hold');
export const handleResumeProject = handleTransition('resume');
export const handleCompleteProject = handleTransition('complete');
export const handleCancelProject = handleTransition('cancel');
export const handleArchiveProject = handleTransition('archive');

// ── Member Handlers ───────────────────────────────────────────────────────────

export async function handleListMembers(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const members = await projectMemberService.listProjectMembers(organizationId, projectId);
  return reply.send(createSuccessResponse({ members }));
}

export async function handleAddMember(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const body = addMemberSchema.parse(request.body);
  const actorUserId = request.user!.sub;

  const member = await projectMemberService.addProjectMember(
    actorUserId,
    organizationId,
    projectId,
    body.userId,
    body.role,
    request.id,
  );
  return reply.status(201).send(createSuccessResponse({ member }));
}

export async function handleUpdateMemberRole(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, userId } = request.params as {
    organizationId: string;
    projectId: string;
    userId: string;
  };
  const body = updateMemberRoleSchema.parse(request.body);
  const actorUserId = request.user!.sub;

  const member = await projectMemberService.updateMemberRole(
    actorUserId,
    organizationId,
    projectId,
    userId,
    body.role,
    request.id,
  );
  return reply.send(createSuccessResponse({ member }));
}

export async function handleRemoveMember(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, userId } = request.params as {
    organizationId: string;
    projectId: string;
    userId: string;
  };
  const actorUserId = request.user!.sub;

  await projectMemberService.removeProjectMember(
    actorUserId,
    organizationId,
    projectId,
    userId,
    request.id,
  );
  return reply.status(204).send();
}

// ── Settings Handlers ─────────────────────────────────────────────────────────

export async function handleGetSettings(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const settings = await projectSettingsService.getEffectiveSettings(organizationId, projectId);
  return reply.send(createSuccessResponse({ settings }));
}

export async function handleUpdateSettings(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const body = updateProjectSettingsSchema.parse(request.body);
  const actorUserId = request.user!.sub;

  const settings = await projectSettingsService.updateProjectSettings(
    actorUserId,
    organizationId,
    projectId,
    body,
  );
  return reply.send(createSuccessResponse({ settings }));
}

// ── Phase Handlers ────────────────────────────────────────────────────────────

export async function handleListPhases(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as { organizationId: string; projectId: string };
  const { includeArchived } = listPhasesQuerySchema.parse(request.query);
  const phases = await projectPhaseService.listPhases(organizationId, projectId, includeArchived);
  return reply.send(createSuccessResponse({ phases }));
}

export async function handleCreatePhase(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as { organizationId: string; projectId: string };
  const body = createPhaseSchema.parse(request.body);
  const actorUserId = request.user!.sub;
  const phase = await projectPhaseService.createPhase(actorUserId, organizationId, projectId, body);
  return reply.status(201).send(createSuccessResponse({ phase }));
}

export async function handleUpdatePhase(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, phaseId } = request.params as { organizationId: string; projectId: string; phaseId: string };
  const body = updatePhaseSchema.parse(request.body);
  const actorUserId = request.user!.sub;
  const phase = await projectPhaseService.updatePhase(actorUserId, organizationId, projectId, phaseId, body);
  return reply.send(createSuccessResponse({ phase }));
}

export async function handleArchivePhase(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, phaseId } = request.params as { organizationId: string; projectId: string; phaseId: string };
  const actorUserId = request.user!.sub;
  await projectPhaseService.archivePhase(actorUserId, organizationId, projectId, phaseId);
  return reply.status(204).send();
}

export async function handleReorderPhases(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as { organizationId: string; projectId: string };
  const body = reorderPhasesSchema.parse(request.body);
  const actorUserId = request.user!.sub;
  const phases = await projectPhaseService.reorderPhases(actorUserId, organizationId, projectId, body);
  return reply.send(createSuccessResponse({ phases }));
}

// ── Cost-Code Handlers ─────────────────────────────────────────────────────────

export async function handleListCostCodes(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as { organizationId: string; projectId: string };
  const { includeInactive } = listCostCodesQuerySchema.parse(request.query);
  const codes = await projectCostCodeService.listCostCodes(
    organizationId,
    projectId,
    includeInactive,
  );
  return reply.send(createSuccessResponse({ costCodes: codes }));
}

export async function handleCreateCostCode(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as { organizationId: string; projectId: string };
  const body = createCostCodeSchema.parse(request.body);
  const actorUserId = request.user!.sub;
  const code = await projectCostCodeService.createCostCode(
    actorUserId,
    organizationId,
    projectId,
    body,
  );
  return reply.status(201).send(createSuccessResponse({ costCode: code }));
}

export async function handleUpdateCostCode(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, codeId } = request.params as {
    organizationId: string;
    projectId: string;
    codeId: string;
  };
  const body = updateCostCodeSchema.parse(request.body);
  const actorUserId = request.user!.sub;
  const code = await projectCostCodeService.updateCostCode(
    actorUserId,
    organizationId,
    projectId,
    codeId,
    body,
  );
  return reply.send(createSuccessResponse({ costCode: code }));
}

export async function handleDeactivateCostCode(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId, codeId } = request.params as {
    organizationId: string;
    projectId: string;
    codeId: string;
  };
  const actorUserId = request.user!.sub;
  await projectCostCodeService.deactivateCostCode(actorUserId, organizationId, projectId, codeId);
  return reply.status(204).send();
}

// ── Audit Handlers ─────────────────────────────────────────────────────────────

export async function handleListProjectAudit(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, projectId } = request.params as {
    organizationId: string;
    projectId: string;
  };
  const q = projectAuditQuerySchema.parse(request.query);
  const result = await projectAuditRepository.findByProject(
    organizationId,
    projectId,
    {
      resourceType: q.resourceType,
      actorUserId: q.actorUserId,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      action: q.action,
    },
    q.cursor ?? null,
    q.limit,
  );
  return reply.send(createSuccessResponse({ auditLogs: result.rows, nextCursor: result.nextCursor }));
}
