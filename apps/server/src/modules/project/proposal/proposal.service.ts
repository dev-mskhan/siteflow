import { createHash } from 'node:crypto';
import { Decimal } from 'decimal.js';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { assertFinancialActorSeparation } from '../../../lib/commercial/financial-policy.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import { CommercialVersionConflictError } from '../../../lib/commercial/commercial.errors.js';
import {
  ProposalConflictError,
  ProposalConversionIncompleteError,
  ProposalNotFoundError,
  ProposalVersionConflictError,
  TenderConflictError,
  TenderNotFoundError,
  TenderVersionConflictError,
} from './proposal.errors.js';
import {
  nextProposalNumber,
  nextTenderNumber,
  proposalRepository as repo,
  tenderRepository,
} from './proposal.repository.js';
import type {
  ConvertProposalInput,
  CreateProposalInput,
  CreateTenderInput,
  IssueProposalInput,
  RecordClientResponseInput,
  RejectProposalInput,
  TransitionProposalInput,
  UpdateProposalInput,
  UpdateTenderInput,
  WithdrawProposalInput,
} from './proposal.schemas.js';
import type { DatabaseTransaction } from '@siteflow/database';
import type { FinancialAuditAction } from '../../../lib/commercial/financial-audit.types.js';

type Scope = { organizationId: string; projectId: string };
type Db = DatabaseTransaction | ReturnType<typeof getDb>;

// Shared draft fields subset (lines only) typed explicitly for map usage
type ProposalLine = CreateProposalInput['lines'][number];

// ── SHA-256 for idempotency key hashing ───────────────────────────────────────
function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

// ── Cursor helpers ─────────────────────────────────────────────────────────────
function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursorSafe<T>(
  cursor: string | undefined,
  parse: (raw: Record<string, unknown>) => T,
): { decoded: T } | undefined {
  if (!cursor) return undefined;
  try {
    return { decoded: parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))) };
  } catch {
    return undefined;
  }
}

// ── Amount calculation helpers ────────────────────────────────────────────────
function computeTotals(
  lines: { amount: string }[],
  markupPercent: string,
  overheadPercent: string,
  contingencyPercent: string,
  discountPercent: string,
  taxPercent: string,
) {
  const subtotal = lines.reduce(
    (acc, l) => acc.plus(new Decimal(l.amount)),
    new Decimal('0'),
  );
  const overhead = subtotal.mul(new Decimal(overheadPercent).div(100));
  const contingency = subtotal.mul(new Decimal(contingencyPercent).div(100));
  const subtotalWithAdjustments = subtotal.plus(overhead).plus(contingency);
  const markup = subtotalWithAdjustments.mul(new Decimal(markupPercent).div(100));
  const afterMarkup = subtotalWithAdjustments.plus(markup);
  const discount = afterMarkup.mul(new Decimal(discountPercent).div(100));
  const taxable = afterMarkup.minus(discount);
  const tax = taxable.mul(new Decimal(taxPercent).div(100));
  const total = taxable.plus(tax);
  return {
    subtotalAmount: subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    taxAmount: tax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    totalAmount: total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ProposalService
// ─────────────────────────────────────────────────────────────────────────────

export class ProposalService {
  private get db() {
    return getDb();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async getProposalRecord(db: Db, scope: Scope, proposalId: string) {
    const proposal = await repo.findProposal(db, scope.organizationId, scope.projectId, proposalId);
    if (!proposal) throw new ProposalNotFoundError();
    return proposal;
  }

  private async lockProposal(
    tx: DatabaseTransaction,
    scope: Scope,
    proposalId: string,
    expectedVersion: number,
    allowedStatuses: string[],
  ) {
    const proposal = await repo.findProposal(tx, scope.organizationId, scope.projectId, proposalId, true);
    if (!proposal) throw new ProposalNotFoundError();
    if (proposal.version !== expectedVersion) throw new ProposalVersionConflictError();
    if (!allowedStatuses.includes(proposal.status)) {
      throw new ProposalConflictError(
        `This action is not allowed while the proposal is ${proposal.status}.`,
      );
    }
    return proposal;
  }

  private async persistRevision(
    tx: DatabaseTransaction,
    proposalId: string,
    scope: Scope,
    revisionNumber: number,
    input: CreateProposalInput | UpdateProposalInput,
    actorUserId: string,
  ) {
    const { subtotalAmount, taxAmount, totalAmount } = computeTotals(
      input.lines,
      input.markupPercent ?? '0',
      input.overheadPercent ?? '0',
      input.contingencyPercent ?? '0',
      input.discountPercent ?? '0',
      input.taxPercent ?? '0',
    );

    const revisionId = generateId();
    await repo.insertRevision(tx, {
      id: revisionId,
      proposalId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      revisionNumber,
      status: 'DRAFT',
      sourceEstimateId: input.sourceEstimateId ?? null,
      sourceEstimateRevisionId: input.sourceEstimateRevisionId ?? null,
      sourceBoqId: input.sourceBoqId ?? null,
      sourceBoqRevisionId: input.sourceBoqRevisionId ?? null,
      currencyCode: input.currencyCode,
      taxPercent: input.taxPercent ?? '0',
      taxSource: input.taxSource ?? null,
      overheadPercent: input.overheadPercent ?? '0',
      contingencyPercent: input.contingencyPercent ?? '0',
      markupPercent: input.markupPercent ?? '0',
      discountPercent: input.discountPercent ?? '0',
      subtotalAmount,
      taxAmount,
      totalAmount,
      scope: input.scope ?? null,
      inclusions: input.inclusions ?? null,
      exclusions: input.exclusions ?? null,
      assumptions: input.assumptions ?? null,
      clarifications: input.clarifications ?? null,
      validUntil: input.validUntil ?? null,
      estimatedDurationDays: input.estimatedDurationDays ?? null,
      scheduleSummary: input.scheduleSummary ?? null,
      commercialTerms: (input.commercialTerms as Record<string, unknown>) ?? null,
      deliveryMethod: 'INTERNAL',
      createdBy: actorUserId,
    });

    if (input.lines.length > 0) {
      await repo.insertLines(
        tx,
        input.lines.map((line: ProposalLine, idx: number) => ({
          id: generateId(),
          revisionId,
          proposalId,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          sortOrder: line.sortOrder ?? idx + 1,
          itemKey: line.itemKey,
          sectionKey: line.sectionKey ?? null,
          description: line.description,
          specification: line.specification ?? null,
          unit: line.unit,
          quantity: line.quantity,
          unitRate: line.unitRate,
          amount: line.amount,
          currencyCode: line.currency,
          costCodeId: line.costCodeId ?? null,
        })),
      );
    }

    return revisionId;
  }

  private async buildDetail(scope: Scope, proposalId: string, tx: Db = this.db) {
    const proposal = await this.getProposalRecord(tx, scope, proposalId);
    const revision = await repo.findRevisionByNumber(
      tx,
      scope.organizationId,
      scope.projectId,
      proposalId,
      proposal.currentRevisionNumber,
    );
    if (!revision) throw new ProposalNotFoundError();
    const lines = await repo.findLines(tx, scope.organizationId, scope.projectId, revision.id);
    return { proposal, revision, lines };
  }

  // ── Tender operations ────────────────────────────────────────────────────────

  async createTender(
    organizationId: string,
    input: CreateTenderInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const tenderId = generateId();
      const tenderNumber = await nextTenderNumber(tx, organizationId);
      await tenderRepository.insertTender(tx, {
        id: tenderId,
        organizationId,
        projectId: input.projectId ?? null,
        tenderNumber,
        title: input.title,
        description: input.description ?? null,
        clientName: input.clientName,
        clientReference: input.clientReference ?? null,
        issuerName: input.issuerName ?? null,
        status: 'OPEN',
        submissionDeadline: new Date(input.submissionDeadline),
        submissionTimezone: input.submissionTimezone,
        requirements: input.requirements ?? null,
        requiredDocuments: (input.requiredDocuments as string[]) ?? null,
        estimatedValue: input.estimatedValue ?? null,
        currencyCode: input.currencyCode ?? null,
        notes: input.notes ?? null,
        version: 1,
        createdBy: actorUserId,
      });

      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId: input.projectId ?? null,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.TENDER_CREATED,
        entityType: 'tender',
        entityId: tenderId,
        newState: { status: 'OPEN', tenderNumber },
        requestId,
      });

      return tenderRepository.findTender(tx, organizationId, tenderId);
    });
  }

  async getTender(organizationId: string, tenderId: string) {
    const tender = await tenderRepository.findTender(this.db, organizationId, tenderId);
    if (!tender) throw new TenderNotFoundError();
    return tender;
  }

  async listTenders(
    organizationId: string,
    query: { limit: number; cursor?: string; status?: string },
  ) {
    const cursor = decodeCursorSafe(query.cursor, (raw) => ({
      updatedAt: new Date(String(raw.updatedAt)),
      id: String(raw.id),
    }));
    const rows = await tenderRepository.listTenders(this.db, organizationId, {
      status: query.status,
      cursor: cursor?.decoded,
      limit: query.limit,
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
          : null,
    };
  }

  async updateTender(
    organizationId: string,
    tenderId: string,
    input: UpdateTenderInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const tender = await tenderRepository.findTender(tx, organizationId, tenderId, true);
      if (!tender) throw new TenderNotFoundError();
      if (tender.version !== input.expectedVersion) throw new TenderVersionConflictError();
      if (!['OPEN'].includes(tender.status)) {
        throw new TenderConflictError('Only open tenders can be edited.');
      }

      const updated = await tenderRepository.updateTenderVersioned(
        tx,
        organizationId,
        tenderId,
        input.expectedVersion,
        {
          title: input.title,
          description: input.description ?? null,
          clientName: input.clientName,
          clientReference: input.clientReference ?? null,
          issuerName: input.issuerName ?? null,
          submissionDeadline: new Date(input.submissionDeadline),
          submissionTimezone: input.submissionTimezone,
          requirements: input.requirements ?? null,
          requiredDocuments: (input.requiredDocuments as string[]) ?? null,
          estimatedValue: input.estimatedValue ?? null,
          currencyCode: input.currencyCode ?? null,
          notes: input.notes ?? null,
        },
      );
      if (!updated) throw new TenderVersionConflictError();

      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId: tender.projectId ?? organizationId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.TENDER_UPDATED,
        entityType: 'tender',
        entityId: tenderId,
        previousState: { status: tender.status, version: tender.version },
        newState: { status: updated.status, version: updated.version },
        requestId,
      });

      return updated;
    });
  }

  async transitionTender(
    organizationId: string,
    tenderId: string,
    targetStatus: 'SUBMITTED' | 'AWARDED' | 'LOST' | 'WITHDRAWN' | 'EXPIRED',
    expectedVersion: number,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const tender = await tenderRepository.findTender(tx, organizationId, tenderId, true);
      if (!tender) throw new TenderNotFoundError();
      if (tender.version !== expectedVersion) throw new TenderVersionConflictError();

      const allowed: Record<string, string[]> = {
        SUBMITTED: ['OPEN'],
        AWARDED: ['SUBMITTED'],
        LOST: ['SUBMITTED'],
        WITHDRAWN: ['OPEN', 'SUBMITTED'],
        EXPIRED: ['OPEN', 'SUBMITTED'],
      };
      if (!allowed[targetStatus]?.includes(tender.status)) {
        throw new TenderConflictError(
          `Cannot transition tender from ${tender.status} to ${targetStatus}.`,
        );
      }

      const now = new Date();
      const patch: Record<string, unknown> = { status: targetStatus };
      if (targetStatus === 'SUBMITTED') patch.submittedAt = now;
      if (targetStatus === 'AWARDED') patch.awardedAt = now;
      if (['LOST', 'WITHDRAWN', 'EXPIRED'].includes(targetStatus)) patch.closedAt = now;

      const updated = await tenderRepository.updateTenderVersioned(
        tx,
        organizationId,
        tenderId,
        expectedVersion,
        patch as Parameters<typeof tenderRepository.updateTenderVersioned>[4],
      );
      if (!updated) throw new TenderVersionConflictError();

      const auditActions: Record<string, FinancialAuditAction> = {
        SUBMITTED: FINANCIAL_AUDIT_ACTIONS.TENDER_SUBMITTED,
        AWARDED: FINANCIAL_AUDIT_ACTIONS.TENDER_AWARDED,
        LOST: FINANCIAL_AUDIT_ACTIONS.TENDER_LOST,
        WITHDRAWN: FINANCIAL_AUDIT_ACTIONS.TENDER_WITHDRAWN,
        EXPIRED: FINANCIAL_AUDIT_ACTIONS.TENDER_EXPIRED,
      };

      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId: tender.projectId ?? organizationId,
        actorUserId,
        action: auditActions[targetStatus]!,
        entityType: 'tender',
        entityId: tenderId,
        previousState: { status: tender.status },
        newState: { status: targetStatus },
        requestId,
      });

      return updated;
    });
  }

  // ── Proposal CRUD ────────────────────────────────────────────────────────────

  async create(
    scope: Scope,
    input: CreateProposalInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const proposalId = generateId();
      const proposalNumber = await nextProposalNumber(tx, scope.organizationId, scope.projectId);

      await repo.insertProposal(tx, {
        id: proposalId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        tenderId: input.tenderId ?? null,
        proposalNumber,
        title: input.title,
        description: input.description ?? null,
        status: 'DRAFT',
        currentRevisionNumber: 1,
        version: 1,
        clientName: input.clientName ?? null,
        clientReference: input.clientReference ?? null,
        sourceEstimateId: input.sourceEstimateId ?? null,
        sourceEstimateRevisionId: input.sourceEstimateRevisionId ?? null,
        sourceBoqId: input.sourceBoqId ?? null,
        sourceBoqRevisionId: input.sourceBoqRevisionId ?? null,
        createdBy: actorUserId,
      });

      await this.persistRevision(tx, proposalId, scope, 1, input, actorUserId);

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.PROPOSAL_CREATED,
        entityType: 'proposal',
        entityId: proposalId,
        newState: { status: 'DRAFT', revisionNumber: 1, proposalNumber },
        requestId,
      });

      return this.buildDetail(scope, proposalId, tx);
    });
  }

  async getById(scope: Scope, proposalId: string, tx: Db = this.db) {
    return this.buildDetail(scope, proposalId, tx);
  }

  async list(
    scope: Scope,
    query: { limit: number; cursor?: string; status?: string; tenderId?: string },
  ) {
    const cursor = decodeCursorSafe(query.cursor, (raw) => ({
      updatedAt: new Date(String(raw.updatedAt)),
      id: String(raw.id),
    }));
    const rows = await repo.listProposals(this.db, scope.organizationId, scope.projectId, {
      status: query.status,
      tenderId: query.tenderId,
      cursor: cursor?.decoded,
      limit: query.limit,
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
          : null,
    };
  }

  async update(
    scope: Scope,
    proposalId: string,
    input: UpdateProposalInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const proposal = await repo.findProposal(tx, scope.organizationId, scope.projectId, proposalId, true);
      if (!proposal) throw new ProposalNotFoundError();
      if (!['DRAFT', 'REJECTED'].includes(proposal.status)) {
        throw new ProposalConflictError('Only draft or rejected proposals can be edited.');
      }
      if (proposal.version !== input.expectedVersion) throw new CommercialVersionConflictError();

      const nextRevision = proposal.currentRevisionNumber + 1;

      const updated = await repo.updateProposalVersioned(
        tx,
        scope.organizationId,
        scope.projectId,
        proposalId,
        input.expectedVersion,
        {
          title: input.title,
          description: input.description ?? null,
          tenderId: input.tenderId ?? null,
          clientName: input.clientName ?? null,
          clientReference: input.clientReference ?? null,
          sourceEstimateId: input.sourceEstimateId ?? null,
          sourceEstimateRevisionId: input.sourceEstimateRevisionId ?? null,
          sourceBoqId: input.sourceBoqId ?? null,
          sourceBoqRevisionId: input.sourceBoqRevisionId ?? null,
          status: 'DRAFT',
          currentRevisionNumber: nextRevision,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
        },
      );
      if (!updated) throw new CommercialVersionConflictError();

      await this.persistRevision(tx, proposalId, scope, nextRevision, input, actorUserId);

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.PROPOSAL_UPDATED,
        entityType: 'proposal',
        entityId: proposalId,
        previousState: { status: proposal.status, revisionNumber: proposal.currentRevisionNumber },
        newState: { status: 'DRAFT', revisionNumber: nextRevision },
        requestId,
      });

      return this.buildDetail(scope, proposalId, tx);
    });
  }

  // ── Lifecycle transitions ────────────────────────────────────────────────────

  async submit(
    scope: Scope,
    proposalId: string,
    input: TransitionProposalInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const proposal = await this.lockProposal(tx, scope, proposalId, input.expectedVersion, ['DRAFT']);
      const now = new Date();

      const updated = await repo.updateProposalVersioned(
        tx,
        scope.organizationId,
        scope.projectId,
        proposalId,
        input.expectedVersion,
        { status: 'PENDING_APPROVAL', submittedBy: actorUserId, submittedAt: now },
      );
      if (!updated) throw new ProposalVersionConflictError();

      const revision = await repo.findRevisionByNumber(
        tx,
        scope.organizationId,
        scope.projectId,
        proposalId,
        proposal.currentRevisionNumber,
      );
      if (revision) {
        await repo.updateRevision(tx, scope.organizationId, scope.projectId, revision.id, {
          status: 'PENDING_APPROVAL',
          submittedBy: actorUserId,
          submittedAt: now,
        });
      }

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.PROPOSAL_SUBMITTED,
        entityType: 'proposal',
        entityId: proposalId,
        previousState: { status: 'DRAFT' },
        newState: { status: 'PENDING_APPROVAL' },
        requestId,
      });

      return this.buildDetail(scope, proposalId, tx);
    });
  }

  async approve(
    scope: Scope,
    proposalId: string,
    input: TransitionProposalInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const proposal = await this.lockProposal(tx, scope, proposalId, input.expectedVersion, ['PENDING_APPROVAL']);

      assertFinancialActorSeparation('approve', {
        ...scope,
        actorUserId,
        creatorUserId: proposal.createdBy,
        requesterUserId: proposal.submittedBy,
      });

      const now = new Date();
      const updated = await repo.updateProposalVersioned(
        tx,
        scope.organizationId,
        scope.projectId,
        proposalId,
        input.expectedVersion,
        { status: 'APPROVED', approvedBy: actorUserId, approvedAt: now },
      );
      if (!updated) throw new ProposalVersionConflictError();

      const revision = await repo.findRevisionByNumber(
        tx,
        scope.organizationId,
        scope.projectId,
        proposalId,
        proposal.currentRevisionNumber,
      );
      if (revision) {
        await repo.updateRevision(tx, scope.organizationId, scope.projectId, revision.id, {
          status: 'APPROVED',
          approvedBy: actorUserId,
          approvedAt: now,
        });
      }

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.PROPOSAL_APPROVED,
        entityType: 'proposal',
        entityId: proposalId,
        previousState: { status: 'PENDING_APPROVAL' },
        newState: { status: 'APPROVED' },
        requestId,
      });

      return this.buildDetail(scope, proposalId, tx);
    });
  }

  async reject(
    scope: Scope,
    proposalId: string,
    input: RejectProposalInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const proposal = await this.lockProposal(tx, scope, proposalId, input.expectedVersion, ['PENDING_APPROVAL']);

      assertFinancialActorSeparation('approve', {
        ...scope,
        actorUserId,
        creatorUserId: proposal.createdBy,
        requesterUserId: proposal.submittedBy,
      });

      const now = new Date();
      const updated = await repo.updateProposalVersioned(
        tx,
        scope.organizationId,
        scope.projectId,
        proposalId,
        input.expectedVersion,
        {
          status: 'REJECTED',
          rejectedBy: actorUserId,
          rejectedAt: now,
          rejectionReason: input.reason,
        },
      );
      if (!updated) throw new ProposalVersionConflictError();

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.PROPOSAL_REJECTED,
        entityType: 'proposal',
        entityId: proposalId,
        previousState: { status: 'PENDING_APPROVAL' },
        newState: { status: 'REJECTED', reason: input.reason },
        requestId,
      });

      return this.buildDetail(scope, proposalId, tx);
    });
  }

  async issue(
    scope: Scope,
    proposalId: string,
    input: IssueProposalInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const proposal = await this.lockProposal(tx, scope, proposalId, input.expectedVersion, ['APPROVED']);
      const now = new Date();

      const updated = await repo.updateProposalVersioned(
        tx,
        scope.organizationId,
        scope.projectId,
        proposalId,
        input.expectedVersion,
        { status: 'ISSUED', issuedBy: actorUserId, issuedAt: now },
      );
      if (!updated) throw new ProposalVersionConflictError();

      const revision = await repo.findRevisionByNumber(
        tx,
        scope.organizationId,
        scope.projectId,
        proposalId,
        proposal.currentRevisionNumber,
      );
      if (revision) {
        await repo.updateRevision(tx, scope.organizationId, scope.projectId, revision.id, {
          status: 'ISSUED',
          issuedBy: actorUserId,
          issuedAt: now,
          deliveryMethod: input.deliveryMethod,
          deliveryNotes: input.deliveryNotes ?? null,
        });
      }

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.PROPOSAL_ISSUED,
        entityType: 'proposal',
        entityId: proposalId,
        previousState: { status: 'APPROVED' },
        newState: { status: 'ISSUED', deliveryMethod: input.deliveryMethod },
        requestId,
      });

      return this.buildDetail(scope, proposalId, tx);
    });
  }

  async recordClientResponse(
    scope: Scope,
    proposalId: string,
    input: RecordClientResponseInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const proposal = await this.lockProposal(tx, scope, proposalId, input.expectedVersion, ['ISSUED']);

      const targetStatus = input.event === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED';
      const now = new Date();

      const patch: Record<string, unknown> = {
        status: targetStatus,
        clientResponseEvent: input.event,
        clientResponseAt: now,
        clientSignatoryName: input.clientSignatoryName ?? null,
        clientResponseReference: input.responseReference ?? null,
      };
      if (input.event === 'ACCEPTED') {
        patch.acceptedBy = actorUserId;
        patch.acceptedAt = now;
      }

      const updated = await repo.updateProposalVersioned(
        tx,
        scope.organizationId,
        scope.projectId,
        proposalId,
        input.expectedVersion,
        patch as Parameters<typeof repo.updateProposalVersioned>[5],
      );
      if (!updated) throw new ProposalVersionConflictError();

      // Record immutable client event
      await repo.insertClientEvent(tx, {
        id: generateId(),
        proposalId,
        proposalRevisionId: (await repo.findRevisionByNumber(
          tx,
          scope.organizationId,
          scope.projectId,
          proposalId,
          proposal.currentRevisionNumber,
        ))!.id,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        event: input.event,
        clientSignatoryName: input.clientSignatoryName ?? null,
        responseReference: input.responseReference ?? null,
        notes: input.notes ?? null,
        recordedBy: actorUserId,
      });

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.PROPOSAL_CLIENT_RESPONSE,
        entityType: 'proposal',
        entityId: proposalId,
        previousState: { status: 'ISSUED' },
        newState: { status: targetStatus, event: input.event },
        requestId,
      });

      return this.buildDetail(scope, proposalId, tx);
    });
  }

  async withdraw(
    scope: Scope,
    proposalId: string,
    input: WithdrawProposalInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await this.lockProposal(tx, scope, proposalId, input.expectedVersion, [
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'ISSUED',
      ]);
      const now = new Date();

      const updated = await repo.updateProposalVersioned(
        tx,
        scope.organizationId,
        scope.projectId,
        proposalId,
        input.expectedVersion,
        {
          status: 'WITHDRAWN',
          withdrawnBy: actorUserId,
          withdrawnAt: now,
          withdrawalReason: input.reason,
        },
      );
      if (!updated) throw new ProposalVersionConflictError();

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.PROPOSAL_WITHDRAWN,
        entityType: 'proposal',
        entityId: proposalId,
        newState: { status: 'WITHDRAWN', reason: input.reason },
        requestId,
      });

      return this.buildDetail(scope, proposalId, tx);
    });
  }

  // ── Revision history ─────────────────────────────────────────────────────────

  async listRevisions(
    scope: Scope,
    proposalId: string,
    query: { limit: number; cursor?: string },
  ) {
    await this.getProposalRecord(this.db, scope, proposalId);
    const cursor = decodeCursorSafe(query.cursor, (raw) => ({
      revisionNumber: Number(raw.revisionNumber),
    }));
    const rows = await repo.listRevisions(this.db, scope.organizationId, scope.projectId, proposalId, {
      cursor: cursor?.decoded,
      limit: query.limit,
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor({ revisionNumber: last.revisionNumber }) : null,
    };
  }

  async getRevision(scope: Scope, proposalId: string, revisionId: string) {
    await this.getProposalRecord(this.db, scope, proposalId);
    const revision = await repo.findRevisionById(
      this.db,
      scope.organizationId,
      scope.projectId,
      revisionId,
    );
    if (!revision || revision.proposalId !== proposalId) throw new ProposalNotFoundError();
    const lines = await repo.findLines(this.db, scope.organizationId, scope.projectId, revisionId);
    return { revision, lines };
  }

  // ── Client events ─────────────────────────────────────────────────────────────

  async listClientEvents(scope: Scope, proposalId: string) {
    await this.getProposalRecord(this.db, scope, proposalId);
    return repo.listClientEvents(this.db, scope.organizationId, scope.projectId, proposalId);
  }

  // ── Convert accepted proposal ─────────────────────────────────────────────────

  async convert(
    scope: Scope,
    proposalId: string,
    input: ConvertProposalInput,
    actorUserId: string,
    requestId: string,
  ) {
    const keyHash = sha256(input.idempotencyKey);

    // Check idempotency without a transaction first (read-only fast path)
    const proposal = await this.getProposalRecord(this.db, scope, proposalId);
    if (proposal.status !== 'ACCEPTED') {
      throw new ProposalConflictError('Only accepted proposals can be converted.');
    }
    if (proposal.version !== input.expectedVersion) throw new ProposalVersionConflictError();

    const revision = await repo.findRevisionByNumber(
      this.db,
      scope.organizationId,
      scope.projectId,
      proposalId,
      proposal.currentRevisionNumber,
    );
    if (!revision) throw new ProposalNotFoundError();

    // Idempotency read
    const existing = await repo.findConversionByIdempotencyHash(
      this.db,
      scope.organizationId,
      scope.projectId,
      revision.id,
      keyHash,
    );
    if (existing) {
      if (existing.status === 'PENDING') throw new ProposalConversionIncompleteError();
      if (existing.status === 'COMPLETED') {
        return { conversion: existing, alreadyConverted: true };
      }
      // FAILED — allow retry, fall through to re-attempt
    }

    return this.db.transaction(async (tx) => {
      // Re-lock inside transaction
      const lockedProposal = await repo.findProposal(
        tx,
        scope.organizationId,
        scope.projectId,
        proposalId,
        true,
      );
      if (!lockedProposal) throw new ProposalNotFoundError();
      if (lockedProposal.version !== input.expectedVersion) throw new ProposalVersionConflictError();
      if (lockedProposal.status !== 'ACCEPTED') {
        throw new ProposalConflictError('Only accepted proposals can be converted.');
      }

      const conversionId = generateId();
      const conversion = await repo.insertConversion(tx, {
        id: conversionId,
        proposalId,
        proposalRevisionId: revision.id,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        idempotencyKeyHash: keyHash,
        status: 'PENDING',
        createdBy: actorUserId,
      });

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.PROPOSAL_CONVERSION_STARTED,
        entityType: 'proposal',
        entityId: proposalId,
        newState: {
          conversionId,
          status: 'PENDING',
          projectName: input.projectName,
        },
        requestId,
      });

      return { conversion, alreadyConverted: false };
    });
  }
}

export const proposalService = new ProposalService();
