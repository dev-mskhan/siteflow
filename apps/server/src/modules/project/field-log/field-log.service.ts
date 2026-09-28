// apps/server/src/modules/project/field-log/field-log.service.ts
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { FieldLogRepository } from './field-log.repository.js';
import {
  FieldLogNotFoundError,
  FieldLogImmutableError,
  FieldLogDuplicateDateError,
  FieldLogInvalidTransitionError,
} from './field-log.errors.js';
import type {
  FieldLogDTO,
  FieldLogTaskEntryDTO,
  CreateFieldLogInput,
  UpdateFieldLogInput,
} from './field-log.types.js';
import type { DailyFieldLog, FieldLogTaskEntry } from '@siteflow/database/schema';

const tracer = trace.getTracer('field-log-service');

function toEntryDTO(e: FieldLogTaskEntry): FieldLogTaskEntryDTO {
  return {
    id: e.id,
    logId: e.logId,
    taskId: e.taskId,
    completionPctRecorded: e.completionPctRecorded,
    quantityCompleted: e.quantityCompleted ?? null,
    unit: e.unit ?? null,
    notes: e.notes ?? null,
  };
}

function toFieldLogDTO(log: DailyFieldLog, entries?: FieldLogTaskEntry[]): FieldLogDTO {
  return {
    id: log.id,
    organizationId: log.organizationId,
    projectId: log.projectId,
    logDate: log.logDate,
    supervisorId: log.supervisorId,
    status: log.status,
    notes: log.notes ?? null,
    lockedAt: log.lockedAt ? log.lockedAt.toISOString() : null,
    createdAt: log.createdAt.toISOString(),
    entries: entries?.map(toEntryDTO),
  };
}

export class FieldLogService {
  constructor(private repo = new FieldLogRepository()) {}

  private get db() {
    return getDb();
  }

  /**
   * Create a new DRAFT field log for a project+date.
   * Only one log per project per date is allowed.
   */
  async createFieldLog(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: CreateFieldLogInput,
  ): Promise<FieldLogDTO> {
    return withSpan(tracer, 'field-log.create', async (span) => {
      span.setAttributes({ organizationId, projectId, logDate: input.logDate });

      return this.db.transaction(async (tx) => {
        // Enforce one log per project per date
        const existing = await this.repo.findByProjectAndDate(tx as any, projectId, input.logDate);
        if (existing) {
          throw new FieldLogDuplicateDateError(input.logDate);
        }

        const logId = generateId();
        const log = await this.repo.create(tx as any, {
          id: logId,
          organizationId,
          projectId,
          logDate: input.logDate,
          supervisorId: actorUserId,
          notes: input.notes,
        });

        // Insert task entries if provided
        let insertedEntries: FieldLogTaskEntry[] = [];
        if (input.entries && input.entries.length > 0) {
          insertedEntries = await this.repo.insertEntries(
            tx as any,
            input.entries.map((e) => ({
              id: generateId(),
              logId,
              taskId: e.taskId,
              completionPctRecorded: e.completionPctRecorded,
              quantityCompleted: e.quantityCompleted?.toString(),
              unit: e.unit,
              notes: e.notes,
            })),
          );
        }

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'field_log.created',
            resourceType: 'daily_field_log',
            resourceId: logId,
            metadata: { projectId, logDate: input.logDate },
          },
          tx,
        );

        return toFieldLogDTO(log, insertedEntries);
      });
    });
  }

  /**
   * Get a single field log with entries.
   */
  async getFieldLog(
    organizationId: string,
    projectId: string,
    logId: string,
  ): Promise<FieldLogDTO> {
    return withSpan(tracer, 'field-log.get', async (span) => {
      span.setAttributes({ organizationId, projectId, logId });

      const log = await this.repo.findById(this.db, logId);
      if (!log || log.organizationId !== organizationId || log.projectId !== projectId) {
        throw new FieldLogNotFoundError(logId);
      }

      const entries = await this.repo.listEntriesByLog(this.db, logId);
      return toFieldLogDTO(log, entries);
    });
  }

  /**
   * List all field logs for a project.
   */
  async listFieldLogs(organizationId: string, projectId: string): Promise<FieldLogDTO[]> {
    return withSpan(tracer, 'field-log.list', async (span) => {
      span.setAttributes({ organizationId, projectId });

      const logs = await this.repo.listByProject(this.db, organizationId, projectId);
      return logs.map((l) => toFieldLogDTO(l));
    });
  }

  /**
   * Update a DRAFT field log (notes + replace all entries).
   */
  async updateFieldLog(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    logId: string,
    input: UpdateFieldLogInput,
  ): Promise<FieldLogDTO> {
    return withSpan(tracer, 'field-log.update', async (span) => {
      span.setAttributes({ organizationId, projectId, logId });

      return this.db.transaction(async (tx) => {
        const log = await this.repo.findById(tx as any, logId);
        if (!log || log.organizationId !== organizationId || log.projectId !== projectId) {
          throw new FieldLogNotFoundError(logId);
        }
        if (log.status !== 'DRAFT') {
          throw new FieldLogImmutableError(log.status);
        }

        const updated = await this.repo.update(tx as any, logId, {
          notes: input.notes,
        });

        // Replace all entries
        await this.repo.deleteEntriesByLog(tx as any, logId);
        let newEntries: FieldLogTaskEntry[] = [];
        if (input.entries && input.entries.length > 0) {
          newEntries = await this.repo.insertEntries(
            tx as any,
            input.entries.map((e) => ({
              id: generateId(),
              logId,
              taskId: e.taskId,
              completionPctRecorded: e.completionPctRecorded,
              quantityCompleted: e.quantityCompleted?.toString(),
              unit: e.unit,
              notes: e.notes,
            })),
          );
        }

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'field_log.updated',
            resourceType: 'daily_field_log',
            resourceId: logId,
            metadata: { projectId },
          },
          tx,
        );

        return toFieldLogDTO(updated, newEntries);
      });
    });
  }

  /**
   * Submit a DRAFT log → SUBMITTED.
   */
  async submitFieldLog(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    logId: string,
  ): Promise<FieldLogDTO> {
    return withSpan(tracer, 'field-log.submit', async (span) => {
      span.setAttributes({ organizationId, projectId, logId });

      return this.db.transaction(async (tx) => {
        const log = await this.repo.findById(tx as any, logId);
        if (!log || log.organizationId !== organizationId || log.projectId !== projectId) {
          throw new FieldLogNotFoundError(logId);
        }
        if (log.status !== 'DRAFT') {
          throw new FieldLogInvalidTransitionError(log.status, 'SUBMITTED');
        }

        const updated = await this.repo.update(tx as any, logId, { status: 'SUBMITTED' });

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'field_log.submitted',
            resourceType: 'daily_field_log',
            resourceId: logId,
            metadata: { projectId },
          },
          tx,
        );

        const entries = await this.repo.listEntriesByLog(tx as any, logId);
        return toFieldLogDTO(updated, entries);
      });
    });
  }

  /**
   * Lock a SUBMITTED log → LOCKED. Locked logs are strictly immutable.
   */
  async lockFieldLog(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    logId: string,
  ): Promise<FieldLogDTO> {
    return withSpan(tracer, 'field-log.lock', async (span) => {
      span.setAttributes({ organizationId, projectId, logId });

      return this.db.transaction(async (tx) => {
        const log = await this.repo.findById(tx as any, logId);
        if (!log || log.organizationId !== organizationId || log.projectId !== projectId) {
          throw new FieldLogNotFoundError(logId);
        }
        if (log.status !== 'SUBMITTED') {
          throw new FieldLogInvalidTransitionError(log.status, 'LOCKED');
        }

        const updated = await this.repo.update(tx as any, logId, {
          status: 'LOCKED',
          lockedAt: new Date(),
        });

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'field_log.locked',
            resourceType: 'daily_field_log',
            resourceId: logId,
            metadata: { projectId },
          },
          tx,
        );

        const entries = await this.repo.listEntriesByLog(tx as any, logId);
        return toFieldLogDTO(updated, entries);
      });
    });
  }
}
