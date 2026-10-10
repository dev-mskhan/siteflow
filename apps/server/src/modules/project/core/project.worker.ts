// apps/server/src/modules/project/core/project.worker.ts
import type PgBoss from 'pg-boss';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import {
  PROJECT_QUEUES,
  type ProjectCreatedPayload,
  type ProjectStatusChangedPayload,
  type ProjectUpdatedPayload,
  type ProjectMemberAddedPayload,
  type ProjectMemberRoleChangedPayload,
  type ProjectMemberRemovedPayload,
} from './project.jobs.js';

const logger = createLogger({ name: 'project-worker' });
const tracer = trace.getTracer('project-worker');

export async function registerProjectWorkers(boss: PgBoss): Promise<void> {
  // ── Project Created ─────────────────────────────────────────────────────────
  await boss.work<ProjectCreatedPayload>(
    PROJECT_QUEUES.PROJECT_CREATED,
    async ([job]) => {
      if (!job) return;
      const { organizationId, projectId, projectNumber, actorUserId, correlationId, idempotencyKey } =
        job.data;

      return withSpan(tracer, 'worker.project.created', async (span) => {
        span.setAttribute('organization.id', organizationId);
        span.setAttribute('project.id', projectId);
        span.setAttribute('project.number', projectNumber);

        logger.info(
          { organizationId, projectId, projectNumber, actorUserId, correlationId },
          'Processed project created event',
        );

        span.setAttribute('job.idempotency_key', idempotencyKey);
      });
    },
  );

  // ── Project Status Changed ──────────────────────────────────────────────────
  await boss.work<ProjectStatusChangedPayload>(
    PROJECT_QUEUES.PROJECT_STATUS_CHANGED,
    async ([job]) => {
      if (!job) return;
      const { organizationId, projectId, fromStatus, toStatus, transition, actorUserId, correlationId, idempotencyKey } =
        job.data;

      return withSpan(tracer, 'worker.project.status_changed', async (span) => {
        span.setAttribute('organization.id', organizationId);
        span.setAttribute('project.id', projectId);
        span.setAttribute('project.from_status', fromStatus);
        span.setAttribute('project.to_status', toStatus);

        logger.info(
          { organizationId, projectId, fromStatus, toStatus, transition, actorUserId, correlationId },
          'Processed project status changed event',
        );

        span.setAttribute('job.idempotency_key', idempotencyKey);
      });
    },
  );

  // ── Project Updated ─────────────────────────────────────────────────────────
  await boss.work<ProjectUpdatedPayload>(
    PROJECT_QUEUES.PROJECT_UPDATED,
    async ([job]) => {
      if (!job) return;
      const { organizationId, projectId, actorUserId, correlationId } = job.data;

      return withSpan(tracer, 'worker.project.updated', async (span) => {
        span.setAttribute('organization.id', organizationId);
        span.setAttribute('project.id', projectId);

        logger.info(
          { organizationId, projectId, actorUserId, correlationId },
          'Processed project updated event',
        );
      });
    },
  );

  // ── Project Member Added ────────────────────────────────────────────────────
  await boss.work<ProjectMemberAddedPayload>(
    PROJECT_QUEUES.PROJECT_MEMBER_ADDED,
    async ([job]) => {
      if (!job) return;
      const { organizationId, projectId, targetUserId, role, actorUserId, correlationId } = job.data;

      return withSpan(tracer, 'worker.project.member_added', async (span) => {
        span.setAttribute('organization.id', organizationId);
        span.setAttribute('project.id', projectId);
        span.setAttribute('target.user.id', targetUserId);

        logger.info(
          { organizationId, projectId, targetUserId, role, actorUserId, correlationId },
          'Processed project member added event',
        );
      });
    },
  );

  // ── Project Member Role Changed ─────────────────────────────────────────────
  await boss.work<ProjectMemberRoleChangedPayload>(
    PROJECT_QUEUES.PROJECT_MEMBER_ROLE_CHANGED,
    async ([job]) => {
      if (!job) return;
      const { organizationId, projectId, targetUserId, fromRole, toRole, actorUserId, correlationId } =
        job.data;

      return withSpan(tracer, 'worker.project.member_role_changed', async (span) => {
        span.setAttribute('organization.id', organizationId);
        span.setAttribute('project.id', projectId);
        span.setAttribute('target.user.id', targetUserId);

        logger.info(
          { organizationId, projectId, targetUserId, fromRole, toRole, actorUserId, correlationId },
          'Processed project member role changed event',
        );
      });
    },
  );

  // ── Project Member Removed ──────────────────────────────────────────────────
  await boss.work<ProjectMemberRemovedPayload>(
    PROJECT_QUEUES.PROJECT_MEMBER_REMOVED,
    async ([job]) => {
      if (!job) return;
      const { organizationId, projectId, targetUserId, actorUserId, correlationId } = job.data;

      return withSpan(tracer, 'worker.project.member_removed', async (span) => {
        span.setAttribute('organization.id', organizationId);
        span.setAttribute('project.id', projectId);
        span.setAttribute('target.user.id', targetUserId);

        logger.info(
          { organizationId, projectId, targetUserId, actorUserId, correlationId },
          'Processed project member removed event',
        );
      });
    },
  );

  logger.info('Registered all Project background workers');
}
