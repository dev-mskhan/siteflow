// apps/server/src/modules/project/members/project-member.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { auditService } from '../../audit/audit.service.js';
import { rbacCacheService } from '../../rbac/rbac.cache.service.js';
import { RbacRepository } from '../../rbac/rbac.repository.js';
import { ProjectMemberRepository } from './project-member.repository.js';
import { ProjectMemberConflictError,
  ProjectMemberNotFoundError,
  ProjectLastManagerError,
} from '../core/project.errors.js';
import { ValidationError } from '../../auth/auth.errors.js';
import { toProjectMemberDTO } from '../core/project.mapper.js';
import { PROJECT_QUEUES } from '../core/project.jobs.js';
import { invalidateProjectContextCache } from '../core/project.middleware.js';
import type { ProjectMemberDTO } from './project-member.types.js';
import type { ProjectRole } from '../core/project.types.js';

const logger = createLogger({ name: 'project-member-service' });
const tracer = trace.getTracer('project-member-service');
const rbacRepo = new RbacRepository();

export class ProjectMemberService {
  constructor(private memberRepo = new ProjectMemberRepository()) {}

  private get db() {
    return getDb();
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async listProjectMembers(orgId: string, projectId: string): Promise<ProjectMemberDTO[]> {
    return withSpan(tracer, 'project-member.listProjectMembers', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      const members = await this.memberRepo.findActiveMembers(orgId, projectId);
      return members.map(toProjectMemberDTO);
    });
  }

  // ── Add ───────────────────────────────────────────────────────────────────

  async addProjectMember(
    actorUserId: string,
    orgId: string,
    projectId: string,
    targetUserId: string,
    role: ProjectRole,
    correlationId?: string,
  ): Promise<ProjectMemberDTO> {
    return withSpan(tracer, 'project-member.addProjectMember', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('target.user.id', targetUserId);

      // 1. Verify target is an ACTIVE org member (422 if not, not 403)
      const orgMembership = await rbacRepo.findActiveMembership(orgId, targetUserId);
      if (!orgMembership) {
        throw new ValidationError(
          `User '${targetUserId}' is not an active member of this organization`,
        );
      }

      // 2. Check existing membership state
      const existing = await this.memberRepo.findByProjectAndUser(orgId, projectId, targetUserId);

      let membership: any;
      await this.db.transaction(async (tx) => {
        if (existing?.status === 'ACTIVE') {
          throw new ProjectMemberConflictError();
        }

        if (existing?.status === 'REMOVED') {
          // Reactivate the removed member
          membership = await this.memberRepo.reactivate(tx, orgId, projectId, targetUserId, role);
          logger.info({ orgId, projectId, targetUserId, role }, 'Reactivated removed project member');
        } else {
          // Fresh insert
          membership = await this.memberRepo.add(tx, {
            id: generateId(),
            projectId,
            organizationId: orgId,
            userId: targetUserId,
            role,
            status: 'ACTIVE',
            addedBy: actorUserId,
          });
        }

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.member.added',
            resourceType: 'ProjectMember',
            resourceId: membership.id,
            projectId,
            metadata: { targetUserId, role } as Record<string, unknown>,
          },
          tx,
        );

        await writeOutboxEvent(
          tx,
          PROJECT_QUEUES.PROJECT_MEMBER_ADDED,
          {
            organizationId: orgId,
            projectId,
            targetUserId,
            role,
            actorUserId,
            correlationId: correlationId ?? generateId(),
          },
          orgId,
        );
      });

      // 3. Invalidate RBAC cache after commit
      await rbacCacheService.invalidate(orgId, targetUserId);
      // 4. Invalidate project context cache so next request re-fetches from DB
      await invalidateProjectContextCache(orgId, projectId, targetUserId);

      const withUser = await this.memberRepo.findActiveMembers(orgId, projectId);
      const added = withUser.find((m) => m.userId === targetUserId);
      if (!added) throw new ProjectMemberNotFoundError();
      return toProjectMemberDTO(added);
    });
  }

  // ── Update role ───────────────────────────────────────────────────────────

  async updateMemberRole(
    actorUserId: string,
    orgId: string,
    projectId: string,
    targetUserId: string,
    newRole: ProjectRole,
    correlationId?: string,
  ): Promise<ProjectMemberDTO> {
    return withSpan(tracer, 'project-member.updateMemberRole', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('target.user.id', targetUserId);

      const current = await this.memberRepo.findActiveByProjectAndUser(orgId, projectId, targetUserId);
      if (!current) throw new ProjectMemberNotFoundError();

      // Last-PM guard: if current role is PM and new role is not, check remaining PMs
      if (current.role === 'PROJECT_MANAGER' && newRole !== 'PROJECT_MANAGER') {
        const pmCount = await this.memberRepo.countActiveByRole(orgId, projectId, 'PROJECT_MANAGER');
        if (pmCount <= 1) throw new ProjectLastManagerError();
      }

      const fromRole = current.role;

      await this.db.transaction(async (tx) => {
        await this.memberRepo.updateRole(tx, orgId, projectId, targetUserId, newRole);

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.member.role_changed',
            resourceType: 'ProjectMember',
            resourceId: current.id,
            projectId,
            metadata: { targetUserId, fromRole, toRole: newRole } as Record<string, unknown>,
          },
          tx,
        );

        await writeOutboxEvent(
          tx,
          PROJECT_QUEUES.PROJECT_MEMBER_ROLE_CHANGED,
          {
            organizationId: orgId,
            projectId,
            targetUserId,
            fromRole,
            toRole: newRole,
            actorUserId,
            correlationId: correlationId ?? generateId(),
          },
          orgId,
        );
      });

      await rbacCacheService.invalidate(orgId, targetUserId);
      await invalidateProjectContextCache(orgId, projectId, targetUserId);

      const updated = await this.memberRepo.findActiveMembers(orgId, projectId);
      const member = updated.find((m) => m.userId === targetUserId);
      if (!member) throw new ProjectMemberNotFoundError();
      return toProjectMemberDTO(member);
    });
  }

  // ── Remove ────────────────────────────────────────────────────────────────

  async removeProjectMember(
    actorUserId: string,
    orgId: string,
    projectId: string,
    targetUserId: string,
    correlationId?: string,
  ): Promise<void> {
    return withSpan(tracer, 'project-member.removeProjectMember', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('target.user.id', targetUserId);

      const current = await this.memberRepo.findActiveByProjectAndUser(orgId, projectId, targetUserId);
      if (!current) throw new ProjectMemberNotFoundError();

      // Last-PM guard
      if (current.role === 'PROJECT_MANAGER') {
        const pmCount = await this.memberRepo.countActiveByRole(orgId, projectId, 'PROJECT_MANAGER');
        if (pmCount <= 1) throw new ProjectLastManagerError();
      }

      await this.db.transaction(async (tx) => {
        await this.memberRepo.deactivate(tx, orgId, projectId, targetUserId);

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.member.removed',
            resourceType: 'ProjectMember',
            resourceId: current.id,
            projectId,
            metadata: { targetUserId, role: current.role } as Record<string, unknown>,
          },
          tx,
        );

        await writeOutboxEvent(
          tx,
          PROJECT_QUEUES.PROJECT_MEMBER_REMOVED,
          {
            organizationId: orgId,
            projectId,
            targetUserId,
            actorUserId,
            correlationId: correlationId ?? generateId(),
          },
          orgId,
        );
      });

      await rbacCacheService.invalidate(orgId, targetUserId);
      await invalidateProjectContextCache(orgId, projectId, targetUserId);
      logger.info({ orgId, projectId, targetUserId, actorUserId }, 'Project member removed');
    });
  }
}

export const projectMemberService = new ProjectMemberService();
