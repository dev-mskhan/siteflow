// apps/server/src/modules/project/core/project.middleware.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, ValidationError } from '../../auth/auth.errors.js';
import { ProjectNotFoundError } from './project.errors.js';
import { projectPolicy } from './project.policy.js';
import { ProjectMemberRepository } from '../members/project-member.repository.js';
import { ProjectRepository } from './project.repository.js';
import type { ProjectContext } from './project.types.js';

const projectRepo = new ProjectRepository();
const memberRepo = new ProjectMemberRepository();

/**
 * Fastify preHandler — establishes ProjectContext on request.projectCtx.
 *
 * Prerequisites: authenticate → organizationContext must have run first.
 * Reads :projectId from route params, loads the project (scoped to orgContext.organizationId),
 * loads the user's project membership (may be null for org admins), and sets request.projectCtx.
 *
 * IDOR safety: wrong-org projectId returns 404, not 403.
 */
export async function projectContext(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.orgContext) {
    throw new ForbiddenError('Organization context required');
  }

  const params = request.params as Record<string, string | undefined>;
  const projectId = params['projectId'];

  if (!projectId) {
    throw new ValidationError('Project ID missing in request parameters');
  }

  const orgId = request.orgContext.organizationId;

  // Load project — scoped to org; returns null for wrong-org IDs
  const project = await projectRepo.findById(orgId, projectId);
  if (!project) {
    // Never 403 here — do not leak existence to wrong-org callers
    throw new ProjectNotFoundError();
  }

  // Belt-and-suspenders: explicit org boundary check (findById already scopes by orgId)
  if (project.organizationId !== orgId) {
    throw new ProjectNotFoundError();
  }

  // Load project membership — may be null (org admins bypass project membership)
  const projectMembership = await memberRepo.findActiveByProjectAndUser(
    orgId,
    projectId,
    request.orgContext.userId,
  );

  const ctx: ProjectContext = {
    organizationId: orgId,
    projectId,
    userId: request.orgContext.userId,
    organizationMembership: {
      id: request.orgContext.membershipId,
      roleId: request.orgContext.roleId,
      permissions: request.orgContext.permissions,
    },
    projectMembership: projectMembership
      ? { id: projectMembership.id, role: projectMembership.role, status: projectMembership.status }
      : null,
  };

  request.projectCtx = ctx;
}

/**
 * Factory for project-permission-checking preHandler hooks.
 * Requires projectContext to have run first.
 * Throws ProjectForbiddenError (403) via projectPolicy if denied.
 */
export function requireProjectPermission(action: string) {
  return async function projectPermissionGuard(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.projectCtx) {
      throw new ForbiddenError('Project context not established');
    }
    projectPolicy.authorize({ actor: request.projectCtx, action });
  };
}
