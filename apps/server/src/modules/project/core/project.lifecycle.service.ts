// apps/server/src/modules/project/core/project.lifecycle.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { auditService } from '../../audit/audit.service.js';
import { ProjectRepository } from './project.repository.js';
import { ProjectInvalidTransitionError } from './project.errors.js';
import { VALID_TRANSITIONS, TRANSITION_TO_STATUS } from './project.types.js';
import { toProjectDTO } from './project.mapper.js';
import { PROJECT_QUEUES } from './project.jobs.js';
import type { ProjectTransition, ProjectStatus, ProjectDTO } from './project.types.js';

const logger = createLogger({ name: 'project-lifecycle-service' });
const tracer = trace.getTracer('project-lifecycle-service');

export class ProjectLifecycleService {
  constructor(private projectRepo = new ProjectRepository()) {}

  private get db() {
    return getDb();
  }

  async transitionProject(
    actorUserId: string,
    orgId: string,
    projectId: string,
    transition: ProjectTransition,
    correlationId?: string,
  ): Promise<ProjectDTO> {
    return withSpan(tracer, 'project.transitionProject', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('user.id', actorUserId);
      span.setAttribute('project.transition', transition);

      const updated = await this.db.transaction(async (tx) => {
        // 1. Pessimistic lock — prevents concurrent double-transitions
        const project = await this.projectRepo.lockForUpdate(tx, orgId, projectId);
        const fromStatus = project.status as ProjectStatus;

        // 2. Validate transition against state machine
        const targetStatus = TRANSITION_TO_STATUS[transition];
        const allowedTargets = VALID_TRANSITIONS[fromStatus];

        if (!allowedTargets.includes(targetStatus)) {
          throw new ProjectInvalidTransitionError(
            `Cannot transition project from '${fromStatus}' via '${transition}' (target: '${targetStatus}')`,
          );
        }

        // 3. Build extra fields for certain transitions
        const extraFields: Partial<{ actualStartDate: string | null; actualEndDate: string | null }> = {};
        if (transition === 'activate' && !project.actualStartDate) {
          extraFields.actualStartDate = new Date().toISOString().split('T')[0]!;
        }
        if (transition === 'complete') {
          extraFields.actualEndDate = new Date().toISOString().split('T')[0]!;
        }

        // 4. Apply status change
        const result = await this.projectRepo.updateStatus(
          tx,
          orgId,
          projectId,
          targetStatus,
          extraFields,
        );

        // 5. Audit
        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.status_changed',
            resourceType: 'Project',
            resourceId: projectId,
            projectId,
            metadata: { fromStatus, toStatus: targetStatus, transition } as Record<string, unknown>,
          },
          tx,
        );

        // 6. Outbox event
        await writeOutboxEvent(
          tx,
          PROJECT_QUEUES.PROJECT_STATUS_CHANGED,
          {
            organizationId: orgId,
            projectId,
            fromStatus,
            toStatus: targetStatus,
            transition,
            actorUserId,
            correlationId: correlationId ?? generateId(),
            idempotencyKey: `project:${projectId}:status:${fromStatus}:${targetStatus}`,
          },
        );

        logger.info(
          { orgId, projectId, fromStatus, toStatus: targetStatus, actorUserId },
          'Project status transitioned',
        );

        return result;
      });

      return toProjectDTO(updated);
    });
  }
}

export const projectLifecycleService = new ProjectLifecycleService();
