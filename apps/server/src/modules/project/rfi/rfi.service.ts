import { and, eq } from 'drizzle-orm';
import { rfis, tasks } from '@siteflow/database/schema';
import type {
  CreateRfiInput,
  ListRfisQuery,
  RespondRfiInput,
  UpdateRfiInput,
} from '@siteflow/shared';
import { getDb } from '../../../lib/db/index.js';
import { yyyymm } from '../../../lib/date.js';
import { generateId } from '../../../lib/id.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { auditService } from '../../audit/audit.service.js';
import { documentNumberService } from '../../procurement/document-number/document-number.service.js';
import { linkDocument } from '../documents/document.service.js';
import {
  RfiInvalidStateError,
  RfiNotFoundError,
  RfiOwnershipError,
} from './rfi.errors.js';
import { encodeRfiCursor, RfiRepository } from './rfi.repository.js';
import type { Rfi } from '@siteflow/database/schema';

export interface RfiScope {
  organizationId: string;
  projectId: string;
}

export class RfiService {
  constructor(private readonly repo = new RfiRepository()) {}

  private get db() {
    return getDb();
  }

  private async validateLinkedTask(tx: any, scope: RfiScope, linkedTaskId?: string | null) {
    if (!linkedTaskId) return;
    const [task] = await tx.select({ id: tasks.id }).from(tasks).where(and(
      eq(tasks.id, linkedTaskId),
      eq(tasks.organizationId, scope.organizationId),
      eq(tasks.projectId, scope.projectId),
    )).limit(1);
    if (!task) throw new RfiOwnershipError();
  }

  async create(
    actorUserId: string,
    scope: RfiScope,
    input: CreateRfiInput,
  ): Promise<Rfi> {
    return this.db.transaction(async (tx) => {
      await this.validateLinkedTask(tx, scope, input.linkedTaskId);
      const id = generateId();
      const rfiNumber = await documentNumberService.allocateDocumentNumber(
        tx,
        scope.organizationId,
        scope.projectId,
        'RFI',
        yyyymm(),
      );
      const [row] = await tx.insert(rfis).values({
        id,
        ...scope,
        rfiNumber,
        ...input,
        costImpact: input.costImpact == null ? input.costImpact : String(input.costImpact),
        status: 'DRAFT',
        submittedBy: null,
        response: null,
        respondedBy: null,
        respondedAt: null,
        createdBy: actorUserId,
      }).returning();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'rfi.created',
        resourceType: 'rfi',
        resourceId: id,
        metadata: { projectId: scope.projectId, rfiNumber },
      }, tx);
      return row!;
    });
  }

  async list(
    scope: RfiScope,
    options: ListRfisQuery,
  ): Promise<{ data: Rfi[]; nextCursor: string | null }> {
    const rows = await this.repo.list(this.db, scope.organizationId, scope.projectId, options);
    const hasMore = rows.length > options.limit;
    const data = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      data,
      nextCursor: hasMore && data.length ? encodeRfiCursor(data[data.length - 1]!) : null,
    };
  }

  async get(scope: RfiScope, id: string): Promise<Rfi> {
    const row = await this.repo.findById(this.db, scope.organizationId, scope.projectId, id);
    if (!row) throw new RfiNotFoundError();
    return row;
  }

  async update(
    actorUserId: string,
    scope: RfiScope,
    id: string,
    input: UpdateRfiInput,
  ): Promise<Rfi> {
    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!row) throw new RfiNotFoundError();
      if (row.status !== 'DRAFT') throw new RfiInvalidStateError(row.status, 'UPDATED');
      await this.validateLinkedTask(tx, scope, input.linkedTaskId);
      const patch = {
        ...input,
        costImpact: input.costImpact === undefined
          ? undefined
          : input.costImpact === null ? null : String(input.costImpact),
      };
      const updated = await this.repo.update(tx, scope.organizationId, scope.projectId, id, patch);
      if (!updated) throw new RfiNotFoundError();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'rfi.updated',
        resourceType: 'rfi',
        resourceId: id,
        metadata: { projectId: scope.projectId },
      }, tx);
      return updated;
    });
  }

  async submit(actorUserId: string, scope: RfiScope, id: string): Promise<Rfi> {
    return this.transition(actorUserId, scope, id, 'OPEN', ['DRAFT'], {
      submittedBy: actorUserId,
    }, 'rfi.submitted');
  }

  async respond(
    actorUserId: string,
    scope: RfiScope,
    id: string,
    input: RespondRfiInput,
  ): Promise<Rfi> {
    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!row) throw new RfiNotFoundError();
      if (row.status !== 'OPEN' && row.status !== 'UNDER_REVIEW') {
        throw new RfiInvalidStateError(row.status, 'ANSWERED');
      }
      if (row.status === 'OPEN') {
        const reviewing = await this.repo.update(tx, scope.organizationId, scope.projectId, id, {
          status: 'UNDER_REVIEW',
        });
        if (!reviewing) throw new RfiNotFoundError();
        await auditService.log({
          organizationId: scope.organizationId,
          actorUserId,
          action: 'rfi.under_review',
          resourceType: 'rfi',
          resourceId: id,
          metadata: { projectId: scope.projectId, fromStatus: 'OPEN', toStatus: 'UNDER_REVIEW' },
        }, tx);
        await writeOutboxEvent(tx, 'rfi.under_review', {
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          rfiId: id,
        }, scope.organizationId);
      }
      const updated = await this.repo.update(tx, scope.organizationId, scope.projectId, id, {
        status: 'ANSWERED',
        response: input.response,
        scheduleImpactDays: input.scheduleImpactDays ?? row.scheduleImpactDays,
        costImpact: input.costImpact === undefined
          ? row.costImpact
          : input.costImpact === null ? null : String(input.costImpact),
        respondedBy: actorUserId,
        respondedAt: new Date(),
      });
      if (!updated) throw new RfiNotFoundError();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'rfi.responded',
        resourceType: 'rfi',
        resourceId: id,
        metadata: {
          projectId: scope.projectId,
          fromStatus: row.status === 'OPEN' ? 'UNDER_REVIEW' : row.status,
          toStatus: 'ANSWERED',
        },
      }, tx);
      await writeOutboxEvent(tx, 'rfi.responded', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        rfiId: id,
      }, scope.organizationId);
      return updated;
    });
  }

  async close(actorUserId: string, scope: RfiScope, id: string): Promise<Rfi> {
    return this.transition(actorUserId, scope, id, 'CLOSED', ['ANSWERED'], {}, 'rfi.closed');
  }

  async cancel(actorUserId: string, scope: RfiScope, id: string): Promise<Rfi> {
    return this.transition(
      actorUserId,
      scope,
      id,
      'CANCELLED',
      ['DRAFT', 'OPEN', 'UNDER_REVIEW', 'ANSWERED'],
      {},
      'rfi.cancelled',
    );
  }

  private async transition(
    actorUserId: string,
    scope: RfiScope,
    id: string,
    target: Rfi['status'],
    allowed: Rfi['status'][],
    extra: Record<string, unknown>,
    eventType?: string,
  ): Promise<Rfi> {
    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!row) throw new RfiNotFoundError();
      if (!allowed.includes(row.status)) throw new RfiInvalidStateError(row.status, target);
      const updated = await this.repo.update(tx, scope.organizationId, scope.projectId, id, {
        status: target,
        ...extra,
      });
      if (!updated) throw new RfiNotFoundError();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: eventType ?? `rfi.${target.toLowerCase()}`,
        resourceType: 'rfi',
        resourceId: id,
        metadata: { projectId: scope.projectId, fromStatus: row.status, toStatus: target },
      }, tx);
      if (eventType) {
        await writeOutboxEvent(tx, eventType, {
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          rfiId: id,
          ...(eventType === 'rfi.submitted' ? { rfiNumber: row.rfiNumber } : {}),
        }, scope.organizationId);
      }
      return updated;
    });
  }

  async attachDocument(
    actorUserId: string,
    scope: RfiScope,
    id: string,
    documentId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!row) throw new RfiNotFoundError();
      await linkDocument(tx, {
        orgId: scope.organizationId,
        projectId: scope.projectId,
        docId: documentId,
        entityType: 'rfi',
        entityId: id,
        createdBy: actorUserId,
      });
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'rfi.document_attached',
        resourceType: 'rfi',
        resourceId: id,
        metadata: { projectId: scope.projectId, documentId },
      }, tx);
    });
  }
}

export const rfiService = new RfiService();
