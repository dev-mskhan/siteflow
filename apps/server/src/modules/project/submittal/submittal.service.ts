import { and, eq } from 'drizzle-orm';
import {
  projectMembers,
} from '@siteflow/database/schema';
import type {
  CreateSubmittalInput,
  ListSubmittalsQuery,
  ReviewSubmittalInput,
  UpdateSubmittalInput,
} from '@siteflow/shared';
import { getDb } from '../../../lib/db/index.js';
import { yyyymm } from '../../../lib/date.js';
import { generateId } from '../../../lib/id.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { auditService } from '../../audit/audit.service.js';
import { documentNumberService } from '../../procurement/document-number/document-number.service.js';
import { linkDocument } from '../documents/document.service.js';
import {
  SubmittalInvalidStateError,
  SubmittalNotFoundError,
  SubmittalOwnershipError,
  SubmittalRevisionNotFoundError,
  SubmittalReviewerForbiddenError,
} from './submittal.errors.js';
import { encodeSubmittalCursor, SubmittalRepository } from './submittal.repository.js';
import type { Submittal } from '@siteflow/database/schema';

export interface SubmittalScope {
  organizationId: string;
  projectId: string;
}

export class SubmittalService {
  constructor(private readonly repo = new SubmittalRepository()) {}

  private get db() {
    return getDb();
  }

  private async validateMember(tx: any, scope: SubmittalScope, memberId?: string | null) {
    if (!memberId) return;
    const [member] = await tx.select({ id: projectMembers.id }).from(projectMembers).where(and(
      eq(projectMembers.id, memberId),
      eq(projectMembers.organizationId, scope.organizationId),
      eq(projectMembers.projectId, scope.projectId),
      eq(projectMembers.status, 'ACTIVE'),
    )).limit(1);
    if (!member) throw new SubmittalOwnershipError();
  }

  async create(actorUserId: string, scope: SubmittalScope, input: CreateSubmittalInput) {
    return this.db.transaction(async (tx) => {
      await this.validateMember(tx, scope, input.responsibleMemberId);
      await this.validateMember(tx, scope, input.reviewerMemberId);
      const id = generateId();
      const submittalNumber = await documentNumberService.allocateDocumentNumber(
        tx,
        scope.organizationId,
        scope.projectId,
        'SUB',
        yyyymm(),
      );
      const row = await this.repo.create(tx, {
        id,
        ...scope,
        submittalNumber,
        ...input,
        status: 'DRAFT',
        createdBy: actorUserId,
      });
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'submittal.created',
        resourceType: 'submittal',
        resourceId: id,
        metadata: { projectId: scope.projectId, submittalNumber },
      }, tx);
      return row;
    });
  }

  async list(scope: SubmittalScope, options: ListSubmittalsQuery) {
    const rows = await this.repo.list(this.db, scope.organizationId, scope.projectId, options);
    const hasMore = rows.length > options.limit;
    const data = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      data,
      nextCursor: hasMore && data.length
        ? encodeSubmittalCursor(data[data.length - 1]!)
        : null,
    };
  }

  async get(scope: SubmittalScope, id: string) {
    const row = await this.repo.findById(this.db, scope.organizationId, scope.projectId, id);
    if (!row) throw new SubmittalNotFoundError();
    return row;
  }

  async update(
    actorUserId: string,
    scope: SubmittalScope,
    id: string,
    input: UpdateSubmittalInput,
  ) {
    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!row) throw new SubmittalNotFoundError();
      if (row.status !== 'DRAFT') throw new SubmittalInvalidStateError(row.status, 'UPDATED');
      await this.validateMember(tx, scope, input.responsibleMemberId);
      await this.validateMember(tx, scope, input.reviewerMemberId);
      const updated = await this.repo.update(tx, scope.organizationId, scope.projectId, id, input);
      if (!updated) throw new SubmittalNotFoundError();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'submittal.updated',
        resourceType: 'submittal',
        resourceId: id,
        metadata: { projectId: scope.projectId },
      }, tx);
      return updated;
    });
  }

  async submit(
    actorUserId: string,
    scope: SubmittalScope,
    id: string,
    isResubmission = false,
  ): Promise<Submittal> {
    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!row) throw new SubmittalNotFoundError();
      if (row.status === 'SUBMITTED' || row.status === 'UNDER_REVIEW') return row;
      const isResubmit = row.status === 'REVISE_AND_RESUBMIT';
      if (isResubmit !== isResubmission || (!isResubmit && row.status !== 'DRAFT')) {
        throw new SubmittalInvalidStateError(row.status, 'SUBMITTED');
      }
      const revisionNumber = await this.repo.nextRevisionNumber(tx, id, scope.organizationId);
      await this.repo.createRevision(tx, {
        id: generateId(),
        submittalId: id,
        organizationId: scope.organizationId,
        revisionNumber,
        status: 'SUBMITTED',
        submittedBy: actorUserId,
      });
      const updated = await this.repo.update(tx, scope.organizationId, scope.projectId, id, {
        status: 'SUBMITTED',
      });
      if (!updated) throw new SubmittalNotFoundError();
      const eventType = isResubmit ? 'submittal.resubmitted' : 'submittal.submitted';
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: eventType,
        resourceType: 'submittal',
        resourceId: id,
        metadata: { projectId: scope.projectId, revisionNumber },
      }, tx);
      await writeOutboxEvent(tx, eventType, {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        submittalId: id,
        ...(isResubmit
          ? { revisionNumber }
          : { submittalNumber: row.submittalNumber, revisionNumber }),
      }, scope.organizationId);
      return updated;
    });
  }

  async review(
    actorUserId: string,
    scope: SubmittalScope,
    id: string,
    input: ReviewSubmittalInput,
  ) {
    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!row) throw new SubmittalNotFoundError();
      if (row.status !== 'SUBMITTED' && row.status !== 'UNDER_REVIEW') {
        throw new SubmittalInvalidStateError(row.status, 'REVIEWED');
      }
      if (row.reviewerMemberId) {
        const [reviewer] = await tx.select({
          userId: projectMembers.userId,
          status: projectMembers.status,
        }).from(projectMembers).where(and(
          eq(projectMembers.id, row.reviewerMemberId),
          eq(projectMembers.organizationId, scope.organizationId),
          eq(projectMembers.projectId, scope.projectId),
        )).limit(1);
        if (!reviewer || reviewer.status !== 'ACTIVE' || reviewer.userId !== actorUserId) {
          throw new SubmittalReviewerForbiddenError();
        }
      }
      const revision = await this.repo.latestRevisionForUpdate(tx, scope.organizationId, id);
      if (!revision) throw new SubmittalInvalidStateError(row.status, 'REVIEWED');
      if (row.status === 'SUBMITTED') {
        const reviewing = await this.repo.update(tx, scope.organizationId, scope.projectId, id, {
          status: 'UNDER_REVIEW',
        });
        if (!reviewing) throw new SubmittalNotFoundError();
        await auditService.log({
          organizationId: scope.organizationId,
          actorUserId,
          action: 'submittal.under_review',
          resourceType: 'submittal',
          resourceId: id,
          metadata: { projectId: scope.projectId, revisionNumber: revision.revisionNumber },
        }, tx);
        await writeOutboxEvent(tx, 'submittal.under_review', {
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          submittalId: id,
        }, scope.organizationId);
      }
      const statusByResponse = {
        APPROVED: 'APPROVED',
        APPROVED_WITH_COMMENTS: 'APPROVED',
        REVISE_AND_RESUBMIT: 'REVISE_AND_RESUBMIT',
        REJECTED: 'REJECTED',
      } as const;
      const headerStatus = statusByResponse[input.response];
      const revisionStatus = headerStatus as 'APPROVED' | 'REJECTED' | 'REVISE_AND_RESUBMIT';
      await this.repo.createReview(tx, {
        id: generateId(),
        submittalRevisionId: revision.id,
        submittalId: id,
        organizationId: scope.organizationId,
        status: revisionStatus,
        reviewedBy: actorUserId,
        response: input.response,
        responseNotes: input.responseNotes ?? null,
      });
      const updated = await this.repo.update(tx, scope.organizationId, scope.projectId, id, {
        status: headerStatus,
      });
      if (!updated) throw new SubmittalNotFoundError();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'submittal.reviewed',
        resourceType: 'submittal',
        resourceId: id,
        metadata: {
          projectId: scope.projectId,
          revisionNumber: revision.revisionNumber,
          response: input.response,
        },
      }, tx);
      await writeOutboxEvent(tx, 'submittal.reviewed', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        submittalId: id,
        response: input.response,
      }, scope.organizationId);
      return updated;
    });
  }

  async resubmit(actorUserId: string, scope: SubmittalScope, id: string) {
    return this.submit(actorUserId, scope, id, true);
  }

  async close(actorUserId: string, scope: SubmittalScope, id: string) {
    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!row) throw new SubmittalNotFoundError();
      if (row.status === 'CLOSED') return row;
      if (row.status !== 'APPROVED' && row.status !== 'REJECTED') {
        throw new SubmittalInvalidStateError(row.status, 'CLOSED');
      }
      const updated = await this.repo.update(tx, scope.organizationId, scope.projectId, id, {
        status: 'CLOSED',
      });
      if (!updated) throw new SubmittalNotFoundError();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'submittal.closed',
        resourceType: 'submittal',
        resourceId: id,
        metadata: { projectId: scope.projectId, fromStatus: row.status, toStatus: 'CLOSED' },
      }, tx);
      await writeOutboxEvent(tx, 'submittal.closed', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        submittalId: id,
      }, scope.organizationId);
      return updated;
    });
  }

  async revisions(scope: SubmittalScope, id: string) {
    await this.get(scope, id);
    const records = await this.repo.listRevisions(this.db, scope.organizationId, id);
    return records.map(({ revision, review }) => ({
      ...revision,
      status: review?.status ?? revision.status,
      reviewedBy: review?.reviewedBy ?? revision.reviewedBy,
      reviewedAt: review?.reviewedAt ?? revision.reviewedAt,
      response: review?.response ?? revision.response,
      responseNotes: review?.responseNotes ?? revision.responseNotes,
    }));
  }

  async revision(scope: SubmittalScope, submittalId: string, revisionId: string) {
    await this.get(scope, submittalId);
    const record = await this.repo.findRevision(
      this.db,
      scope.organizationId,
      submittalId,
      revisionId,
    );
    if (!record) throw new SubmittalRevisionNotFoundError();
    return {
      ...record.revision,
      status: record.review?.status ?? record.revision.status,
      reviewedBy: record.review?.reviewedBy ?? record.revision.reviewedBy,
      reviewedAt: record.review?.reviewedAt ?? record.revision.reviewedAt,
      response: record.review?.response ?? record.revision.response,
      responseNotes: record.review?.responseNotes ?? record.revision.responseNotes,
    };
  }

  async attachDocument(
    actorUserId: string,
    scope: SubmittalScope,
    id: string,
    documentId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!row) throw new SubmittalNotFoundError();
      await linkDocument(tx, {
        orgId: scope.organizationId,
        projectId: scope.projectId,
        docId: documentId,
        entityType: 'submittal',
        entityId: id,
        createdBy: actorUserId,
      });
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'submittal.document_attached',
        resourceType: 'submittal',
        resourceId: id,
        metadata: { projectId: scope.projectId, documentId },
      }, tx);
    });
  }
}

export const submittalService = new SubmittalService();
