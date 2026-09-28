// apps/server/src/modules/project/field-log/field-log-amendment.service.ts
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { FieldLogRepository } from './field-log.repository.js';
import { FieldLogAmendmentRepository } from './field-log-amendment.repository.js';
import { AmendmentNotAllowedError, AmendmentNotFoundError } from './field-log-amendment.errors.js';
import { FieldLogNotFoundError } from './field-log.errors.js';
import type {
  FieldLogAmendmentDTO,
  CreateAmendmentInput,
} from './field-log-amendment.types.js';
import type { FieldLogAmendment } from '@siteflow/database/schema';

const tracer = trace.getTracer('field-log-amendment-service');

function toDTO(a: FieldLogAmendment): FieldLogAmendmentDTO {
  return {
    id: a.id,
    logId: a.logId,
    organizationId: a.organizationId,
    projectId: a.projectId,
    requestedBy: a.requestedBy,
    approvedBy: a.approvedBy ?? null,
    approvedAt: a.approvedAt ? a.approvedAt.toISOString() : null,
    reason: a.reason,
    correction: a.correction,
    createdAt: a.createdAt.toISOString(),
  };
}

export class FieldLogAmendmentService {
  constructor(
    private logRepo = new FieldLogRepository(),
    private amendmentRepo = new FieldLogAmendmentRepository(),
  ) {}

  private get db() {
    return getDb();
  }

  /**
   * Create a correction amendment for a LOCKED field log.
   *
   * The locked log row is never mutated. The amendment records a structured
   * delta (e.g. { taskId, oldPct, newPct }) alongside the original log.
   * Aggregation queries must apply amendments on top of the locked base values.
   */
  async createAmendment(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    logId: string,
    input: CreateAmendmentInput,
  ): Promise<FieldLogAmendmentDTO> {
    return withSpan(tracer, 'field-log-amendment.create', async (span) => {
      span.setAttributes({ organizationId, projectId, logId });

      const log = await this.logRepo.findById(this.db, logId);
      if (!log || log.organizationId !== organizationId || log.projectId !== projectId) {
        throw new FieldLogNotFoundError(logId);
      }

      // Amendments are only valid on LOCKED logs; DRAFT/SUBMITTED logs can be
      // edited directly.
      if (log.status !== 'LOCKED') {
        throw new AmendmentNotAllowedError(log.status);
      }

      const amendmentId = generateId();

      const amendment = await this.db.transaction(async (tx) => {
        const created = await this.amendmentRepo.insert(tx as any, {
          id: amendmentId,
          logId,
          organizationId,
          projectId,
          requestedBy: actorUserId,
          reason: input.reason,
          correction: input.correction,
        });

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'field_log_amendment.created',
            resourceType: 'FieldLogAmendment',
            resourceId: amendmentId,
            metadata: { projectId, logId, reason: input.reason },
          },
          tx,
        );

        return created;
      });

      return toDTO(amendment);
    });
  }

  /**
   * List all amendments for a specific locked log.
   */
  async listAmendments(
    organizationId: string,
    projectId: string,
    logId: string,
  ): Promise<FieldLogAmendmentDTO[]> {
    return withSpan(tracer, 'field-log-amendment.list', async (span) => {
      span.setAttributes({ organizationId, projectId, logId });

      const log = await this.logRepo.findById(this.db, logId);
      if (!log || log.organizationId !== organizationId || log.projectId !== projectId) {
        throw new FieldLogNotFoundError(logId);
      }

      const rows = await this.amendmentRepo.listByLog(this.db, logId, organizationId);
      return rows.map(toDTO);
    });
  }

  /**
   * Get a single amendment by ID.
   */
  async getAmendment(
    organizationId: string,
    _projectId: string,
    amendmentId: string,
  ): Promise<FieldLogAmendmentDTO> {
    return withSpan(tracer, 'field-log-amendment.get', async (span) => {
      span.setAttributes({ organizationId, amendmentId });

      const amendment = await this.amendmentRepo.findById(this.db, amendmentId, organizationId);
      if (!amendment) {
        throw new AmendmentNotFoundError(amendmentId);
      }

      return toDTO(amendment);
    });
  }
}
