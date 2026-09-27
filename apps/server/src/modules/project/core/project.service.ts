// apps/server/src/modules/project/core/project.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { auditService } from '../../audit/audit.service.js';
import { OrgSettingsRepository } from '../../organization/settings/settings.repository.js';
import { ProjectRepository } from './project.repository.js';
import { ProjectMemberRepository } from '../members/project-member.repository.js';
import { ProjectSettingsRepository } from '../settings/project-settings.repository.js';
import { ProjectForbiddenError } from './project.errors.js';
import { toProjectDTO } from './project.mapper.js';
import { PROJECT_QUEUES } from './project.jobs.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsFilter,
  ProjectDTO,
  ProjectListDTO,
} from './project.types.js';
import type { Project } from '@siteflow/database/schema';

const logger = createLogger({ name: 'project-service' });
const tracer = trace.getTracer('project-service');

export class ProjectService {
  constructor(
    private projectRepo = new ProjectRepository(),
    private memberRepo = new ProjectMemberRepository(),
    private settingsRepo = new ProjectSettingsRepository(),
    private orgSettingsRepo = new OrgSettingsRepository(),
  ) {}

  private get db() {
    return getDb();
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createProject(
    actorUserId: string,
    orgId: string,
    input: CreateProjectInput,
    correlationId?: string,
  ): Promise<ProjectDTO> {
    return withSpan(tracer, 'project.createProject', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('user.id', actorUserId);
      logger.info({ orgId, actorUserId }, 'Creating new project');

      const project = await this.db.transaction(async (tx) => {
        // 1. Allocate project number
        const projectNumber = await this.projectRepo.generateProjectNumber(tx, orgId);

        // 2. Resolve currency: explicit input → org default
        let currency = input.currency;
        if (!currency) {
          const orgSettings = await this.orgSettingsRepo.findByOrgId(orgId);
          currency = orgSettings?.currency ?? 'USD';
        }

        // 3. INSERT project (version=1)
        const projectId = generateId();
        const newProject = await this.projectRepo.create(tx, {
          id: projectId,
          organizationId: orgId,
          projectNumber,
          name: input.name,
          description: input.description ?? null,
          status: 'DRAFT',
          projectType: input.projectType ?? null,
          contractValue: input.contractValue ?? null,
          currency,
          plannedStartDate: input.plannedStartDate ?? null,
          plannedEndDate: input.plannedEndDate ?? null,
          actualStartDate: null,
          actualEndDate: null,
          version: 1,
          createdBy: actorUserId,
        });

        // 4. INSERT project_settings (all nulls — override-only)
        await this.settingsRepo.upsert(tx, orgId, projectId, {}, generateId());

        // 5. INSERT project_member — creator becomes PROJECT_MANAGER
        await this.memberRepo.add(tx, {
          id: generateId(),
          projectId,
          organizationId: orgId,
          userId: actorUserId,
          role: 'PROJECT_MANAGER',
          status: 'ACTIVE',
          addedBy: actorUserId,
        });

        // 6. Audit log
        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.created',
            resourceType: 'Project',
            resourceId: projectId,
            projectId,
            metadata: { projectNumber, name: input.name } as Record<string, unknown>,
          },
          tx,
        );

        // 7. Outbox event
        await writeOutboxEvent(
          tx,
          PROJECT_QUEUES.PROJECT_CREATED,
          {
            organizationId: orgId,
            projectId,
            projectNumber,
            actorUserId,
            correlationId: correlationId ?? generateId(),
            idempotencyKey: `project:${projectId}:created`,
          },
        );

        return newProject;
      });

      logger.info({ orgId, projectId: project.id, projectNumber: project.projectNumber }, 'Project created');
      return toProjectDTO(project);
    });
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async getProject(orgId: string, projectId: string): Promise<ProjectDTO> {
    return withSpan(tracer, 'project.getProject', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      const project = await this.projectRepo.findByIdOrThrow(orgId, projectId);
      return toProjectDTO(project);
    });
  }

  /** Returns domain object (with version) — for internal use by other services. */
  async requireProject(orgId: string, projectId: string): Promise<Project> {
    return withSpan(tracer, 'project.requireProject', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      return this.projectRepo.findByIdOrThrow(orgId, projectId);
    });
  }

  async listProjects(orgId: string, filters: ListProjectsFilter): Promise<ProjectListDTO> {
    return withSpan(tracer, 'project.listProjects', async (span) => {
      span.setAttribute('organization.id', orgId);
      const { rows, nextCursor } = await this.projectRepo.findAll(orgId, filters);
      return {
        data: rows.map(toProjectDTO),
        nextCursor,
      };
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateProject(
    actorUserId: string,
    orgId: string,
    projectId: string,
    input: UpdateProjectInput,
    correlationId?: string,
  ): Promise<ProjectDTO> {
    return withSpan(tracer, 'project.updateProject', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('user.id', actorUserId);

      const { expectedVersion, ...fields } = input;

      const updated = await this.db.transaction(async (tx) => {
        const project = await this.projectRepo.update(
          tx,
          orgId,
          projectId,
          {
            name: fields.name,
            description: fields.description !== undefined ? fields.description : undefined,
            projectType: fields.projectType ?? undefined,
            contractValue: fields.contractValue ?? undefined,
            plannedStartDate: fields.plannedStartDate ?? undefined,
            plannedEndDate: fields.plannedEndDate ?? undefined,
          },
          expectedVersion,
        );

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.updated',
            resourceType: 'Project',
            resourceId: projectId,
            projectId,
            metadata: fields as Record<string, unknown>,
          },
          tx,
        );

        await writeOutboxEvent(
          tx,
          PROJECT_QUEUES.PROJECT_UPDATED,
          {
            organizationId: orgId,
            projectId,
            actorUserId,
            correlationId: correlationId ?? generateId(),
          },
        );

        return project;
      });

      return toProjectDTO(updated);
    });
  }

  // ── Authorization helpers ─────────────────────────────────────────────────

  /**
   * Verifies a user has active membership on this project (or an explicit required role).
   * Throws ProjectForbiddenError if not.
   */
  async assertProjectAccess(
    orgId: string,
    projectId: string,
    userId: string,
    requiredRole?: string,
  ): Promise<void> {
    return withSpan(tracer, 'project.assertProjectAccess', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('user.id', userId);

      const membership = await this.memberRepo.findActiveByProjectAndUser(orgId, projectId, userId);

      if (!membership) {
        throw new ProjectForbiddenError('User is not an active member of this project');
      }

      if (requiredRole && membership.role !== requiredRole) {
        throw new ProjectForbiddenError(
          `Action requires role '${requiredRole}', user has '${membership.role}'`,
        );
      }
    });
  }
}

export const projectService = new ProjectService();
