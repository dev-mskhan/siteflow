// apps/server/src/modules/project/phases/project-phase.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { ProjectPhaseRepository } from './project-phase.repository.js';
import { ValidationError } from '../../auth/auth.errors.js';
import type { ProjectPhase } from '@siteflow/database/schema';

const logger = createLogger({ name: 'project-phase-service' });
const tracer = trace.getTracer('project-phase-service');

export interface CreatePhaseInput {
  name: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
}

export interface UpdatePhaseInput {
  name?: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface ReorderPhasesInput {
  orderedIds: string[];
}

export class ProjectPhaseService {
  constructor(private phaseRepo = new ProjectPhaseRepository()) {}

  private get db() {
    return getDb();
  }

  async listPhases(
    orgId: string,
    projectId: string,
    includeArchived = false,
  ): Promise<ProjectPhase[]> {
    return withSpan(tracer, 'project-phase.listPhases', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      return this.phaseRepo.findAll(orgId, projectId, includeArchived);
    });
  }

  async createPhase(
    actorUserId: string,
    orgId: string,
    projectId: string,
    input: CreatePhaseInput,
  ): Promise<ProjectPhase> {
    return withSpan(tracer, 'project-phase.createPhase', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      const phase = await this.db.transaction(async (tx) => {
        // Auto-increment sortOrder
        const maxOrder = await this.phaseRepo.getMaxSortOrder(orgId, projectId);
        const sortOrder = maxOrder + 1;

        const newPhase = await this.phaseRepo.create(tx, {
          id: generateId(),
          projectId,
          organizationId: orgId,
          name: input.name,
          description: input.description ?? null,
          status: 'ACTIVE',
          sortOrder,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          createdBy: actorUserId,
        });

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.phase.created',
            resourceType: 'ProjectPhase',
            resourceId: newPhase.id,
            projectId,
            metadata: { name: input.name, sortOrder } as Record<string, unknown>,
          },
          tx,
        );

        return newPhase;
      });

      logger.info({ orgId, projectId, phaseId: phase.id }, 'Project phase created');
      return phase;
    });
  }

  async updatePhase(
    actorUserId: string,
    orgId: string,
    projectId: string,
    phaseId: string,
    input: UpdatePhaseInput,
  ): Promise<ProjectPhase> {
    return withSpan(tracer, 'project-phase.updatePhase', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      const updated = await this.db.transaction(async (tx) => {
        // Verify phase belongs to this project+org (IDOR)
        const existing = await this.phaseRepo.findByIdOrThrow(orgId, projectId, phaseId);

        const phase = await this.phaseRepo.update(tx, orgId, projectId, phaseId, {
          name: input.name ?? existing.name,
          description: input.description !== undefined ? input.description : existing.description,
          startsAt: input.startsAt !== undefined ? input.startsAt : existing.startsAt,
          endsAt: input.endsAt !== undefined ? input.endsAt : existing.endsAt,
        });

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.phase.updated',
            resourceType: 'ProjectPhase',
            resourceId: phaseId,
            projectId,
            metadata: input as Record<string, unknown>,
          },
          tx,
        );

        return phase;
      });

      return updated;
    });
  }

  async archivePhase(
    actorUserId: string,
    orgId: string,
    projectId: string,
    phaseId: string,
  ): Promise<void> {
    return withSpan(tracer, 'project-phase.archivePhase', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      await this.db.transaction(async (tx) => {
        // Verify ownership (IDOR)
        await this.phaseRepo.findByIdOrThrow(orgId, projectId, phaseId);
        await this.phaseRepo.archive(tx, orgId, projectId, phaseId);

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.phase.archived',
            resourceType: 'ProjectPhase',
            resourceId: phaseId,
            projectId,
            metadata: {} as Record<string, unknown>,
          },
          tx,
        );
      });

      logger.info({ orgId, projectId, phaseId, actorUserId }, 'Project phase archived');
    });
  }

  async reorderPhases(
    actorUserId: string,
    orgId: string,
    projectId: string,
    input: ReorderPhasesInput,
  ): Promise<ProjectPhase[]> {
    return withSpan(tracer, 'project-phase.reorderPhases', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      // Load all active phases to validate ownership of every supplied ID
      const existingPhases = await this.phaseRepo.findAll(orgId, projectId, false);
      const existingIds = new Set(existingPhases.map((p) => p.id));

      for (const id of input.orderedIds) {
        if (!existingIds.has(id)) {
          throw new ValidationError(
            `Phase '${id}' does not belong to this project or is archived`,
          );
        }
      }

      const updates = input.orderedIds.map((id, idx) => ({ id, sortOrder: idx }));

      await this.db.transaction(async (tx) => {
        await this.phaseRepo.batchUpdateSortOrder(tx, updates);

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.phase.reordered',
            resourceType: 'ProjectPhase',
            resourceId: projectId,
            projectId,
            metadata: { orderedIds: input.orderedIds } as Record<string, unknown>,
          },
          tx,
        );
      });

      return this.phaseRepo.findAll(orgId, projectId, false);
    });
  }
}

export const projectPhaseService = new ProjectPhaseService();
