import { eq } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { projects } from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { CommercialVersionConflictError } from '../../../lib/commercial/commercial.errors.js';
import { assertFinancialActorSeparation } from '../../../lib/commercial/financial-policy.js';
import { normalizeCurrencyCode } from '../../../lib/commercial/money.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import { calculateEstimate, type EstimateDraftInput } from './estimate.calculation.js';
import { EstimateConflictError, EstimateNotFoundError } from './estimate.errors.js';
import { projectEstimateRepository as repository } from './estimate.repository.js';
import type {
  CreateEstimateInput,
  EstimateRejectInput,
  EstimateTransitionInput,
  UpdateEstimateInput,
} from './estimate.schemas.js';

type EstimateScope = { organizationId: string; projectId: string };
function toDraft(input: CreateEstimateInput | UpdateEstimateInput): EstimateDraftInput {
  return {
    title: input.title,
    description: input.description ?? null,
    terms: input.terms,
    sections: input.sections,
  };
}

export class ProjectEstimateService {
  private get db() {
    return getDb();
  }

  private async assertProjectCurrency(
    tx: DatabaseTransaction,
    scope: EstimateScope,
  ): Promise<string> {
    const [project] = await tx
      .select({ currencyCode: projects.currency })
      .from(projects)
      .where(eq(projects.id, scope.projectId))
      .limit(1);
    return normalizeCurrencyCode(project?.currencyCode ?? 'USD');
  }

  private async persistRevision(
    tx: DatabaseTransaction,
    estimateId: string,
    scope: EstimateScope,
    revisionNumber: number,
    input: CreateEstimateInput | UpdateEstimateInput,
    currencyCode: string,
    actorUserId: string,
  ) {
    const draft = toDraft(input);
    const calc = calculateEstimate(draft, currencyCode);

    const revision = await repository.createRevision(tx, {
      id: generateId(),
      estimateId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      revisionNumber,
      status: 'DRAFT',
      currencyCode,
      overheadPercent: input.terms.overheadPercent,
      contingencyPercent: input.terms.contingencyPercent,
      markupMode: input.terms.markupMode,
      markupPercent: input.terms.markupPercent,
      discountPercent: input.terms.discountPercent,
      taxPercent: input.terms.taxPercent,
      taxSource: input.terms.taxSource ?? null,
      directCostTotal: calc.directCostTotal,
      overheadAmount: calc.overheadAmount,
      contingencyAmount: calc.contingencyAmount,
      markupAmount: calc.markupAmount,
      discountAmount: calc.discountAmount,
      taxableAmount: calc.taxableAmount,
      taxAmount: calc.taxAmount,
      totalAmount: calc.totalAmount,
      createdBy: actorUserId,
    });

    for (const [sIndex, section] of calc.sections.entries()) {
      const sectionId = generateId();
      await repository.createSection(tx, {
        id: sectionId,
        revisionId: revision.id,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        sectionNumber: sIndex + 1,
        title: section.title,
        description: section.description ?? null,
      });

      const lineRows = section.lines.map((line, lIndex) => ({
        id: generateId(),
        revisionId: revision.id,
        sectionId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        costCodeId: line.costCodeId ?? null,
        lineNumber: lIndex + 1,
        category: line.category,
        description: line.description,
        specification: line.specification ?? null,
        quantity: line.quantity,
        unit: line.unit,
        unitRate: line.unitRate ?? null,
        directAmount: line.directAmount,
      }));
      await repository.createLines(tx, lineRows);

      const resourceRows = section.lines.flatMap((line, lIndex) =>
        line.resources.map((resource, rIndex) => ({
          id: generateId(),
          estimateLineId: lineRows[lIndex]!.id,
          revisionId: revision.id,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          resourceNumber: rIndex + 1,
          category: resource.category,
          description: resource.description,
          unit: resource.unit,
          quantityPerLineUnit: resource.quantityPerLineUnit,
          unitRate: resource.unitRate,
          wastePercent: resource.wastePercent,
          extendedAmount: resource.extendedAmount,
          rateSource: resource.rateSource ?? null,
        })),
      );
      await repository.createResources(tx, resourceRows);
    }

    return revision;
  }

  async create(
    scope: EstimateScope,
    input: CreateEstimateInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const currencyCode = await this.assertProjectCurrency(tx, scope);
      const estimateId = generateId();

      await repository.createEstimate(tx, {
        id: estimateId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        title: input.title,
        description: input.description ?? null,
        status: 'DRAFT',
        currentRevisionNumber: 1,
        version: 1,
        createdBy: actorUserId,
      });
      await this.persistRevision(tx, estimateId, scope, 1, input, currencyCode, actorUserId);

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.ESTIMATE_CREATED,
        entityType: 'estimate',
        entityId: estimateId,
        newState: { status: 'DRAFT', revisionNumber: 1 },
        requestId,
      });

      return this.getById(scope, estimateId, tx);
    });
  }

  async getById(scope: EstimateScope, estimateId: string, tx: DatabaseTransaction | ReturnType<typeof getDb> = this.db) {
    const [estimate] = await repository.findEstimate(tx, scope.organizationId, scope.projectId, estimateId);
    if (!estimate) throw new EstimateNotFoundError();

    const [revision] = await repository.findRevisionsByEstimate(tx, scope.organizationId, scope.projectId, estimateId)
      .then((rows) => rows.filter((row) => row.revisionNumber === estimate.currentRevisionNumber));
    if (!revision) throw new EstimateNotFoundError();

    const sections = await repository.findSections(tx, scope.organizationId, scope.projectId, revision.id);
    const lines = await repository.findLines(tx, scope.organizationId, scope.projectId, revision.id);
    const resources = await repository.findResourcesByLineIds(
      tx,
      scope.organizationId,
      scope.projectId,
      lines.map((line) => line.id),
    );

    return {
      ...estimate,
      revision,
      sections: sections.map((section) => ({
        ...section,
        lines: lines
          .filter((line) => line.sectionId === section.id)
          .map((line) => ({
            ...line,
            resources: resources.filter((resource) => resource.estimateLineId === line.id),
          })),
      })),
    };
  }

  async compare(
    scope: EstimateScope,
    estimateId: string,
    fromRevisionNumber: number,
    toRevisionNumber: number,
  ) {
    const [estimate] = await repository.findEstimate(this.db, scope.organizationId, scope.projectId, estimateId);
    if (!estimate) throw new EstimateNotFoundError();

    const [fromRevision, toRevision] = await Promise.all([
      repository.findRevision(this.db, scope.organizationId, scope.projectId, estimateId, fromRevisionNumber),
      repository.findRevision(this.db, scope.organizationId, scope.projectId, estimateId, toRevisionNumber),
    ]);
    if (!fromRevision || !toRevision) throw new EstimateNotFoundError();

    const [fromLines, toLines, actualRows] = await Promise.all([
      repository.findLines(this.db, scope.organizationId, scope.projectId, fromRevision.id),
      repository.findLines(this.db, scope.organizationId, scope.projectId, toRevision.id),
      repository.sumPostedCostByCostCode(this.db, scope.organizationId, scope.projectId),
    ]);

    type Row = { costCodeId: string | null; fromAmount: Decimal; toAmount: Decimal };
    const rows = new Map<string, Row>();
    const keyOf = (costCodeId: string | null) => costCodeId ?? 'unmapped';
    const ensure = (costCodeId: string | null) => {
      const key = keyOf(costCodeId);
      let row = rows.get(key);
      if (!row) {
        row = { costCodeId, fromAmount: new Decimal(0), toAmount: new Decimal(0) };
        rows.set(key, row);
      }
      return row;
    };

    for (const line of fromLines) ensure(line.costCodeId).fromAmount = ensure(line.costCodeId).fromAmount.plus(line.directAmount);
    for (const line of toLines) ensure(line.costCodeId).toAmount = ensure(line.costCodeId).toAmount.plus(line.directAmount);

    const actualByCostCode = new Map(actualRows.map((row) => [row.costCodeId, new Decimal(row.actualSubtotal)]));

    const items = [...rows.values()]
      .map((row) => {
        const actual = row.costCodeId ? actualByCostCode.get(row.costCodeId) : undefined;
        return {
          costCodeId: row.costCodeId,
          isUnmapped: row.costCodeId === null,
          fromEstimate: row.fromAmount.toFixed(2),
          toEstimate: row.toAmount.toFixed(2),
          revisionDelta: row.toAmount.minus(row.fromAmount).toFixed(2),
          hasActivity: actual !== undefined && !actual.isZero(),
          actualPosted: actual === undefined ? '0.00' : actual.toFixed(2),
          variance: row.toAmount.minus(actual ?? 0).toFixed(2),
        };
      })
      .sort((a, b) => (a.costCodeId ?? '~').localeCompare(b.costCodeId ?? '~'));

    return {
      estimateId,
      fromRevision: fromRevision.revisionNumber,
      toRevision: toRevision.revisionNumber,
      items,
    };
  }

  async list(
    scope: EstimateScope,
    options: { status?: string; cursor?: { createdAt: Date; id: string }; limit: number },
  ) {
    const rows = await repository.listEstimates(this.db, scope.organizationId, scope.projectId, options);
    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null,
    };
  }

  async update(
    scope: EstimateScope,
    estimateId: string,
    input: UpdateEstimateInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [estimate] = await repository.findEstimate(tx, scope.organizationId, scope.projectId, estimateId, true);
      if (!estimate) throw new EstimateNotFoundError();
      if (estimate.status === 'PENDING_APPROVAL' || estimate.status === 'APPROVED') {
        throw new EstimateConflictError('Only draft or rejected estimates can be edited.');
      }
      if (estimate.version !== input.expectedVersion) throw new CommercialVersionConflictError();

      const currencyCode = await this.assertProjectCurrency(tx, scope);
      const nextRevision = estimate.currentRevisionNumber + 1;

      const updated = await repository.updateEstimate(
        tx,
        scope.organizationId,
        scope.projectId,
        estimateId,
        input.expectedVersion,
        {
          title: input.title,
          description: input.description ?? null,
          status: 'DRAFT',
          currentRevisionNumber: nextRevision,
          version: estimate.version + 1,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
        },
      );
      if (!updated) throw new CommercialVersionConflictError();

      await this.persistRevision(tx, estimateId, scope, nextRevision, input, currencyCode, actorUserId);

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.ESTIMATE_REVISED,
        entityType: 'estimate',
        entityId: estimateId,
        previousState: { status: estimate.status, revisionNumber: estimate.currentRevisionNumber },
        newState: { status: 'DRAFT', revisionNumber: nextRevision },
        requestId,
      });

      return this.getById(scope, estimateId, tx);
    });
  }

  async submit(
    scope: EstimateScope,
    estimateId: string,
    input: EstimateTransitionInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [estimate] = await repository.findEstimate(tx, scope.organizationId, scope.projectId, estimateId, true);
      if (!estimate) throw new EstimateNotFoundError();
      if (estimate.status !== 'DRAFT') {
        throw new EstimateConflictError('Only draft estimates can be submitted.');
      }
      if (estimate.version !== input.expectedVersion) throw new CommercialVersionConflictError();

      const now = new Date();
      const updated = await repository.updateEstimate(
        tx,
        scope.organizationId,
        scope.projectId,
        estimateId,
        input.expectedVersion,
        { status: 'PENDING_APPROVAL', submittedBy: actorUserId, submittedAt: now, version: estimate.version + 1 },
      );
      if (!updated) throw new CommercialVersionConflictError();

      await repository.updateRevision(tx, scope.organizationId, scope.projectId, await this.currentRevisionId(tx, scope, estimate), {
        status: 'PENDING_APPROVAL',
        submittedBy: actorUserId,
        submittedAt: now,
      });

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.ESTIMATE_SUBMITTED,
        entityType: 'estimate',
        entityId: estimateId,
        previousState: { status: 'DRAFT' },
        newState: { status: 'PENDING_APPROVAL' },
        requestId,
      });

      return this.getById(scope, estimateId, tx);
    });
  }

  async approve(
    scope: EstimateScope,
    estimateId: string,
    input: EstimateTransitionInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [estimate] = await repository.findEstimate(tx, scope.organizationId, scope.projectId, estimateId, true);
      if (!estimate) throw new EstimateNotFoundError();
      if (estimate.status !== 'PENDING_APPROVAL') {
        throw new EstimateConflictError('Only estimates pending approval can be approved.');
      }
      if (estimate.version !== input.expectedVersion) throw new CommercialVersionConflictError();

      assertFinancialActorSeparation('approve', {
        ...scope,
        actorUserId,
        creatorUserId: estimate.createdBy,
        requesterUserId: estimate.submittedBy,
      });

      const now = new Date();
      const updated = await repository.updateEstimate(
        tx,
        scope.organizationId,
        scope.projectId,
        estimateId,
        input.expectedVersion,
        { status: 'APPROVED', approvedBy: actorUserId, approvedAt: now, version: estimate.version + 1 },
      );
      if (!updated) throw new CommercialVersionConflictError();

      await repository.updateRevision(tx, scope.organizationId, scope.projectId, await this.currentRevisionId(tx, scope, estimate), {
        status: 'APPROVED',
        approvedBy: actorUserId,
        approvedAt: now,
      });

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.ESTIMATE_APPROVED,
        entityType: 'estimate',
        entityId: estimateId,
        previousState: { status: 'PENDING_APPROVAL' },
        newState: { status: 'APPROVED' },
        requestId,
      });

      return this.getById(scope, estimateId, tx);
    });
  }

  async reject(
    scope: EstimateScope,
    estimateId: string,
    input: EstimateRejectInput,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [estimate] = await repository.findEstimate(tx, scope.organizationId, scope.projectId, estimateId, true);
      if (!estimate) throw new EstimateNotFoundError();
      if (estimate.status !== 'PENDING_APPROVAL') {
        throw new EstimateConflictError('Only estimates pending approval can be rejected.');
      }
      if (estimate.version !== input.expectedVersion) throw new CommercialVersionConflictError();

      assertFinancialActorSeparation('approve', {
        ...scope,
        actorUserId,
        creatorUserId: estimate.createdBy,
        requesterUserId: estimate.submittedBy,
      });

      const now = new Date();
      const updated = await repository.updateEstimate(
        tx,
        scope.organizationId,
        scope.projectId,
        estimateId,
        input.expectedVersion,
        {
          status: 'REJECTED',
          rejectedBy: actorUserId,
          rejectedAt: now,
          rejectionReason: input.reason,
          version: estimate.version + 1,
        },
      );
      if (!updated) throw new CommercialVersionConflictError();

      await repository.updateRevision(tx, scope.organizationId, scope.projectId, await this.currentRevisionId(tx, scope, estimate), {
        status: 'REJECTED',
        rejectedBy: actorUserId,
        rejectedAt: now,
        rejectionReason: input.reason,
      });

      await writeFinancialAuditEvent(tx, {
        ...scope,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.ESTIMATE_REJECTED,
        entityType: 'estimate',
        entityId: estimateId,
        previousState: { status: 'PENDING_APPROVAL' },
        newState: { status: 'REJECTED' },
        reason: input.reason,
        requestId,
      });

      return this.getById(scope, estimateId, tx);
    });
  }

  private async currentRevisionId(
    tx: DatabaseTransaction,
    scope: EstimateScope,
    estimate: { id: string; currentRevisionNumber: number },
  ): Promise<string> {
    const revision = await repository.findRevision(
      tx,
      scope.organizationId,
      scope.projectId,
      estimate.id,
      estimate.currentRevisionNumber,
    );
    if (!revision) throw new EstimateNotFoundError();
    return revision.id;
  }
}

export const projectEstimateService = new ProjectEstimateService();
