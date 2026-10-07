import { and, eq } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import {
  paymentApplicationLines,
  type PaymentApplication,
  type PaymentApplicationLine,
} from '@siteflow/database/schema';
import type {
  ApprovePaymentApplicationInput,
  CreatePaymentApplicationInput,
  ListPaymentApplicationsQuery,
  UpdatePaymentApplicationInput,
} from '@siteflow/shared';
import { assertFinancialActorSeparation } from '../../../lib/commercial/financial-policy.js';
import { CommercialVersionConflictError } from '../../../lib/commercial/commercial.errors.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import { normalizeCurrencyCode, parseMoney } from '../../../lib/commercial/money.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import {
  InvalidPaymentApplicationReferenceError,
  PaymentApplicationConflictError,
  PaymentApplicationNotFoundError,
  PaymentApplicationReconciliationError,
} from './payment-application.errors.js';
import { paymentApplicationRepository as repository } from './payment-application.repository.js';
import type { PaymentApplicationCursor } from './payment-application.repository.js';
import type {
  PaymentApplicationDTO,
  PaymentApplicationLineDTO,
} from './payment-application.types.js';

function money(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

function validDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function encodeCursor(row: PaymentApplication) {
  return Buffer.from(`${row.createdAt.toISOString()}\n${row.id}`, 'utf8').toString('base64url');
}

function decodeCursor(value: string | undefined): PaymentApplicationCursor | undefined {
  if (!value) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid cursor');
    const decoded = Buffer.from(value, 'base64url').toString('utf8').split('\n');
    const createdAt = new Date(decoded[0] ?? '');
    const id = decoded[1];
    if (
      decoded.length !== 2 ||
      Number.isNaN(createdAt.getTime()) ||
      createdAt.toISOString() !== decoded[0] ||
      !id ||
      id.length > 128
    ) {
      throw new Error('invalid cursor');
    }
    return { createdAt, id };
  } catch {
    throw new PaymentApplicationConflictError('The list cursor is invalid.');
  }
}

function mapLine(row: PaymentApplicationLine): PaymentApplicationLineDTO {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

function mapApplication(
  row: PaymentApplication,
  lines: PaymentApplicationLine[],
  eligibleChangeOrders: PaymentApplicationDTO['eligibleChangeOrders'],
): PaymentApplicationDTO {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    lines: lines.map(mapLine),
    eligibleChangeOrders,
  };
}

function jsonState(row: PaymentApplication) {
  return {
    status: row.status,
    version: row.version,
    grossRequested: row.grossRequested,
    retainageRequested: row.retainageRequested,
    requestedAmount: row.requestedAmount,
    approvedAmount: row.approvedAmount,
  };
}

type LineInput = CreatePaymentApplicationInput['lines'][number];

export class PaymentApplicationService {
  private get db() {
    return getDb();
  }

  private async getDTO(organizationId: string, projectId: string, id: string) {
    const [row] = await repository.findById(this.db, organizationId, projectId, id);
    if (!row) throw new PaymentApplicationNotFoundError();
    const lines = await repository.findLines(this.db, organizationId, projectId, id);
    const sovLines = await repository.findSovLines(
      this.db,
      organizationId,
      projectId,
      row.revisionId,
      lines.map((line) => line.scheduleOfValueLineId),
    );
    const eligibleChangeOrders = await repository.findEligibleChangeOrders(
      this.db,
      organizationId,
      projectId,
      row.currencyCode,
      [...new Set(sovLines.map((line) => line.costCodeId))],
    );
    return mapApplication(row, lines, eligibleChangeOrders);
  }

  private validatePeriod(start: string, end: string) {
    if (!validDate(start) || !validDate(end) || start > end) {
      throw new PaymentApplicationReconciliationError('Billing period dates are invalid.');
    }
  }

  private async normalizeLines(
    tx: Parameters<typeof repository.findSchedule>[0],
    organizationId: string,
    projectId: string,
    revisionId: string,
    inputs: LineInput[],
    currentApplicationId?: string,
  ) {
    const lineIds = inputs.map((line) => line.scheduleOfValueLineId);
    if (new Set(lineIds).size !== lineIds.length)
      throw new InvalidPaymentApplicationReferenceError();
    const sovLines = await repository.findSovLines(
      tx,
      organizationId,
      projectId,
      revisionId,
      lineIds,
    );
    const byId = new Map(sovLines.map((line) => [line.id, line]));
    if (byId.size !== inputs.length) throw new InvalidPaymentApplicationReferenceError();
    const prior = await repository.priorApprovedGross(
      tx,
      organizationId,
      projectId,
      lineIds,
      currentApplicationId,
    );
    const normalized = inputs.map((input, index) => {
      const sovLine = byId.get(input.scheduleOfValueLineId)!;
      const currentWork = new Decimal(parseMoney(input.currentWork));
      const storedMaterials = new Decimal(parseMoney(input.storedMaterials));
      const grossCompleted = currentWork.plus(storedMaterials);
      const retainagePercent = new Decimal(sovLine.retainagePercent);
      const retainageRequested = grossCompleted
        .times(retainagePercent)
        .dividedBy(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      return {
        id: generateId(),
        scheduleOfValueLineId: sovLine.id,
        lineNumber: index + 1,
        currentWork: money(currentWork),
        storedMaterials: money(storedMaterials),
        grossCompleted: money(grossCompleted),
        retainagePercent: money(retainagePercent),
        retainageRequested: money(retainageRequested),
        priorApprovedGross: money(prior.get(sovLine.id) ?? '0'),
        requestedAmount: money(grossCompleted.minus(retainageRequested)),
        approvedCurrentWork: '0.00',
        approvedStoredMaterials: '0.00',
        approvedGross: '0.00',
        approvedRetainage: '0.00',
        approvedAmount: '0.00',
        _sovLine: sovLine,
      };
    });
    if (!normalized.some((line) => new Decimal(line.grossCompleted).gt(0))) {
      throw new PaymentApplicationReconciliationError(
        'At least one line must request a positive amount.',
      );
    }
    const totals = normalized.reduce(
      (result, line) => ({
        gross: result.gross.plus(line.grossCompleted),
        retainage: result.retainage.plus(line.retainageRequested),
        prior: result.prior.plus(line.priorApprovedGross),
        requested: result.requested.plus(line.requestedAmount),
      }),
      {
        gross: new Decimal(0),
        retainage: new Decimal(0),
        prior: new Decimal(0),
        requested: new Decimal(0),
      },
    );
    return {
      lines: normalized,
      totals: {
        grossRequested: money(totals.gross),
        retainageRequested: money(totals.retainage),
        priorApprovedGross: money(totals.prior),
        requestedAmount: money(totals.requested),
      },
    };
  }

  private lineInsertValues(
    applicationId: string,
    organizationId: string,
    projectId: string,
    lines: Awaited<ReturnType<PaymentApplicationService['normalizeLines']>>['lines'],
  ) {
    return lines.map(({ _sovLine: _line, ...line }) => ({
      ...line,
      paymentApplicationId: applicationId,
      organizationId,
      projectId,
    }));
  }

  async create(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: CreatePaymentApplicationInput,
    requestId: string,
  ) {
    this.validatePeriod(input.billingPeriodStart, input.billingPeriodEnd);
    return this.db.transaction(async (tx) => {
      const [schedule] = await repository.findSchedule(tx, organizationId, projectId, true);
      if (!schedule)
        throw new PaymentApplicationConflictError('An approved schedule of values is required.');
      const [revision] = await repository.findApprovedRevision(
        tx,
        organizationId,
        projectId,
        schedule.id,
        schedule.currentRevisionNumber,
      );
      if (!revision)
        throw new PaymentApplicationConflictError('An approved schedule of values is required.');
      const normalized = await this.normalizeLines(
        tx,
        organizationId,
        projectId,
        revision.id,
        input.lines,
      );
      const id = generateId();
      const applicationNumber = await repository.nextApplicationNumber(tx, projectId);
      const row = await repository.create(tx, {
        id,
        organizationId,
        projectId,
        revisionId: revision.id,
        applicationNumber,
        billingPeriodStart: input.billingPeriodStart,
        billingPeriodEnd: input.billingPeriodEnd,
        currencyCode: normalizeCurrencyCode(revision.currencyCode),
        status: 'DRAFT',
        version: 1,
        createdBy: actorUserId,
        ...normalized.totals,
      });
      const lines = await repository.insertLines(
        tx,
        this.lineInsertValues(id, organizationId, projectId, normalized.lines),
      );
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.PAYMENT_APPLICATION_CREATED,
        entityType: 'PaymentApplication',
        entityId: id,
        newState: jsonState(row),
        amount: row.requestedAmount,
        currencyCode: row.currencyCode,
        requestId,
      });
      await writeOutboxEvent(
        tx,
        'commercial.payment_application.created',
        {
          organizationId,
          projectId,
          paymentApplicationId: id,
          applicationNumber,
        },
        organizationId,
      );
      const eligibleChangeOrders = await repository.findEligibleChangeOrders(
        tx,
        organizationId,
        projectId,
        row.currencyCode,
        [...new Set(normalized.lines.map((line) => line._sovLine.costCodeId))],
      );
      return mapApplication(row, lines, eligibleChangeOrders);
    });
  }

  async list(organizationId: string, projectId: string, query: ListPaymentApplicationsQuery) {
    const rows = await repository.list(
      this.db,
      organizationId,
      projectId,
      query.limit,
      decodeCursor(query.cursor),
    );
    const hasNext = rows.length > query.limit;
    const page = hasNext ? rows.slice(0, query.limit) : rows;
    const pageIds = page.map((row) => row.id);
    const lines = await repository.findLinesForApplications(
      this.db,
      organizationId,
      projectId,
      pageIds,
    );
    const sovLines = await repository.findSovLinesByIds(this.db, organizationId, projectId, [
      ...new Set(lines.map((line) => line.scheduleOfValueLineId)),
    ]);
    const costCodeByLine = new Map(sovLines.map((line) => [line.id, line.costCodeId]));
    const costCodeIds = [...new Set(sovLines.map((line) => line.costCodeId))];
    const eligibleChangeOrders = await repository.findEligibleChangeOrdersByCostCode(
      this.db,
      organizationId,
      projectId,
      [...new Set(page.map((row) => row.currencyCode))],
      costCodeIds,
    );
    const linesByApplication = new Map<string, PaymentApplicationLine[]>();
    for (const line of lines) {
      const applicationLines = linesByApplication.get(line.paymentApplicationId) ?? [];
      applicationLines.push(line);
      linesByApplication.set(line.paymentApplicationId, applicationLines);
    }
    const changeOrdersByScope = new Map<string, PaymentApplicationDTO['eligibleChangeOrders']>();
    for (const changeOrder of eligibleChangeOrders) {
      const key = `${changeOrder.currencyCode}:${changeOrder.costCodeId}`;
      const scopedChangeOrders = changeOrdersByScope.get(key) ?? [];
      scopedChangeOrders.push({
        changeOrderId: changeOrder.changeOrderId,
        changeOrderNumber: changeOrder.changeOrderNumber,
        revenueDelta: changeOrder.revenueDelta,
      });
      changeOrdersByScope.set(key, scopedChangeOrders);
    }
    return {
      paymentApplications: page.map((row) => {
        const applicationLines = linesByApplication.get(row.id) ?? [];
        const applicationCostCodes = new Set(
          applicationLines
            .map((line) => costCodeByLine.get(line.scheduleOfValueLineId))
            .filter((costCodeId): costCodeId is string => costCodeId !== undefined),
        );
        const applicationChangeOrders = [
          ...new Map(
            [...applicationCostCodes].flatMap((costCodeId) =>
              (changeOrdersByScope.get(`${row.currencyCode}:${costCodeId}`) ?? []).map(
                (changeOrder) => [changeOrder.changeOrderId, changeOrder] as const,
              ),
            ),
          ).values(),
        ].sort((left, right) => left.changeOrderNumber.localeCompare(right.changeOrderNumber));
        return mapApplication(row, applicationLines, applicationChangeOrders);
      }),
      nextCursor: hasNext ? encodeCursor(page[page.length - 1]!) : null,
    };
  }

  get(organizationId: string, projectId: string, id: string) {
    return this.getDTO(organizationId, projectId, id);
  }

  async updateDraft(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    id: string,
    input: UpdatePaymentApplicationInput,
    requestId: string,
  ) {
    this.validatePeriod(input.billingPeriodStart, input.billingPeriodEnd);
    return this.db.transaction(async (tx) => {
      const [row] = await repository.findById(tx, organizationId, projectId, id, true);
      if (!row) throw new PaymentApplicationNotFoundError();
      if (row.version !== input.expectedVersion) throw new CommercialVersionConflictError();
      if (row.status !== 'DRAFT' || row.createdBy !== actorUserId) {
        throw new PaymentApplicationConflictError(
          'Only the preparer may edit a draft payment application.',
        );
      }
      const [schedule] = await repository.findSchedule(tx, organizationId, projectId, true);
      if (!schedule)
        throw new PaymentApplicationConflictError('The schedule of values is no longer available.');
      const [revision] = await repository.findApprovedRevision(
        tx,
        organizationId,
        projectId,
        schedule.id,
        schedule.currentRevisionNumber,
      );
      if (!revision || revision.id !== row.revisionId) {
        throw new PaymentApplicationConflictError(
          'The approved schedule of values changed; create a new application.',
        );
      }
      const normalized = await this.normalizeLines(
        tx,
        organizationId,
        projectId,
        revision.id,
        input.lines,
        id,
      );
      const updated = await repository.update(
        tx,
        organizationId,
        projectId,
        id,
        input.expectedVersion,
        {
          billingPeriodStart: input.billingPeriodStart,
          billingPeriodEnd: input.billingPeriodEnd,
          ...normalized.totals,
          version: row.version + 1,
        },
      );
      if (!updated) throw new CommercialVersionConflictError();
      const lines = await repository.replaceLines(
        tx,
        organizationId,
        projectId,
        id,
        this.lineInsertValues(id, organizationId, projectId, normalized.lines),
      );
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.PAYMENT_APPLICATION_UPDATED,
        entityType: 'PaymentApplication',
        entityId: id,
        previousState: jsonState(row),
        newState: jsonState(updated),
        amount: updated.requestedAmount,
        currencyCode: updated.currencyCode,
        requestId,
      });
      await writeOutboxEvent(
        tx,
        'commercial.payment_application.updated',
        {
          organizationId,
          projectId,
          paymentApplicationId: id,
          version: updated.version,
        },
        organizationId,
      );
      const eligibleChangeOrders = await repository.findEligibleChangeOrders(
        tx,
        organizationId,
        projectId,
        updated.currencyCode,
        [...new Set(normalized.lines.map((line) => line._sovLine.costCodeId))],
      );
      return mapApplication(updated, lines, eligibleChangeOrders);
    });
  }

  private async transition(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    id: string,
    expectedVersion: number,
    requestId: string,
    operation: 'submit' | 'under-review' | 'approve' | 'reject' | 'void',
    approval?: ApprovePaymentApplicationInput,
    reason?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [row] = await repository.findById(tx, organizationId, projectId, id, true);
      if (!row) throw new PaymentApplicationNotFoundError();
      if (row.version !== expectedVersion) throw new CommercialVersionConflictError();
      const lines = await repository.findLines(tx, organizationId, projectId, id);
      const now = new Date();
      let status = row.status;
      let action: string;
      let amount: string = row.requestedAmount;
      let refreshedPriorApprovedGross: string | undefined;
      if (operation === 'submit') {
        if (row.status !== 'DRAFT' || row.createdBy !== actorUserId) {
          throw new PaymentApplicationConflictError(
            'Only the preparer may submit a draft payment application.',
          );
        }
        const [schedule] = await repository.findSchedule(tx, organizationId, projectId, true);
        const [revision] = schedule
          ? await repository.findApprovedRevision(
              tx,
              organizationId,
              projectId,
              schedule.id,
              schedule.currentRevisionNumber,
            )
          : [];
        if (!revision || revision.id !== row.revisionId) {
          throw new PaymentApplicationConflictError(
            'The approved schedule of values changed; create a new application.',
          );
        }
        status = 'PENDING_REVIEW';
        action = FINANCIAL_AUDIT_ACTIONS.PAYMENT_APPLICATION_SUBMITTED;
        const currentLines = await repository.findLines(tx, organizationId, projectId, id);
        const refreshedPrior = await repository.priorApprovedGross(
          tx,
          organizationId,
          projectId,
          currentLines.map((line) => line.scheduleOfValueLineId),
          id,
        );
        const priorTotal = currentLines.reduce(
          (sum, line) => sum.plus(refreshedPrior.get(line.scheduleOfValueLineId) ?? '0'),
          new Decimal(0),
        );
        for (const line of currentLines) {
          await tx
            .update(paymentApplicationLines)
            .set({
              priorApprovedGross: money(refreshedPrior.get(line.scheduleOfValueLineId) ?? '0'),
            })
            .where(
              and(
                eq(paymentApplicationLines.id, line.id),
                eq(paymentApplicationLines.organizationId, organizationId),
                eq(paymentApplicationLines.projectId, projectId),
              ),
            );
        }
        refreshedPriorApprovedGross = money(priorTotal);
      } else if (operation === 'under-review') {
        if (row.status !== 'PENDING_REVIEW') throw new PaymentApplicationConflictError();
        assertFinancialActorSeparation('approve', {
          organizationId,
          projectId,
          actorUserId,
          creatorUserId: row.createdBy,
          requesterUserId: row.submittedBy,
        });
        status = 'UNDER_REVIEW';
        action = FINANCIAL_AUDIT_ACTIONS.PAYMENT_APPLICATION_UNDER_REVIEW;
      } else if (operation === 'approve') {
        if (row.status !== 'UNDER_REVIEW' || !approval) throw new PaymentApplicationConflictError();
        assertFinancialActorSeparation('approve', {
          organizationId,
          projectId,
          actorUserId,
          creatorUserId: row.createdBy,
          requesterUserId: row.submittedBy,
          preparerUserId: row.createdBy,
        });
        const [schedule] = await repository.findSchedule(tx, organizationId, projectId, true);
        const [revision] = schedule
          ? await repository.findApprovedRevision(
              tx,
              organizationId,
              projectId,
              schedule.id,
              schedule.currentRevisionNumber,
            )
          : [];
        if (!revision || revision.id !== row.revisionId) {
          throw new PaymentApplicationConflictError(
            'The approved schedule of values changed; this application cannot be approved.',
          );
        }
        const lineById = new Map(lines.map((line) => [line.scheduleOfValueLineId, line]));
        if (
          approval.lines.length !== lines.length ||
          approval.lines.some((line) => !lineById.has(line.scheduleOfValueLineId))
        ) {
          throw new InvalidPaymentApplicationReferenceError();
        }
        const allSovLines = await repository.findSovLines(
          tx,
          organizationId,
          projectId,
          revision.id,
          undefined,
          true,
        );
        const progress = await repository.findProgress(
          tx,
          organizationId,
          projectId,
          allSovLines.map((line) => line.id),
          true,
        );
        const progressByLineId = new Map(
          progress.map((item) => [item.scheduleOfValueLineId, item]),
        );
        const approvalById = new Map(
          approval.lines.map((item) => [item.scheduleOfValueLineId, item]),
        );
        const currentTotalsByCode = new Map<string, Decimal>();
        const scheduledByCode = new Map<string, Decimal>();
        for (const sovLine of allSovLines) {
          const currentProgress = progressByLineId.get(sovLine.id);
          if (!currentProgress) {
            throw new PaymentApplicationConflictError(
              'Schedule-of-values progress is not initialized.',
            );
          }
          const progressTotal = new Decimal(currentProgress.completedToDate).plus(
            currentProgress.storedMaterials,
          );
          currentTotalsByCode.set(
            sovLine.costCodeId,
            (currentTotalsByCode.get(sovLine.costCodeId) ?? new Decimal(0)).plus(progressTotal),
          );
          scheduledByCode.set(
            sovLine.costCodeId,
            (scheduledByCode.get(sovLine.costCodeId) ?? new Decimal(0)).plus(
              sovLine.scheduledValue,
            ),
          );
        }
        const costCodes = [...new Set(allSovLines.map((line) => line.costCodeId))];
        const effectedRevenue = await repository.effectiveChangeOrderRevenueByCostCode(
          tx,
          organizationId,
          projectId,
          row.currencyCode,
          costCodes,
        );
        const approvedValues = new Map<
          string,
          {
            currentWork: string;
            storedMaterials: string;
            gross: string;
            retainage: string;
            amount: string;
          }
        >();
        const requestedByCode = new Map<string, Decimal>();
        for (const line of lines) {
          const proposed = approvalById.get(line.scheduleOfValueLineId)!;
          const currentWork = new Decimal(parseMoney(proposed.approvedCurrentWork));
          const storedMaterials = new Decimal(parseMoney(proposed.approvedStoredMaterials));
          const gross = currentWork.plus(storedMaterials);
          const requestedGross = new Decimal(line.grossCompleted);
          if (
            currentWork.gt(line.currentWork) ||
            storedMaterials.gt(line.storedMaterials) ||
            gross.gt(requestedGross)
          ) {
            throw new PaymentApplicationReconciliationError(
              'Approved line amounts cannot exceed the submitted amounts.',
            );
          }
          const retainage = gross
            .times(line.retainagePercent)
            .dividedBy(100)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          const source = allSovLines.find((item) => item.id === line.scheduleOfValueLineId)!;
          requestedByCode.set(
            source.costCodeId,
            (requestedByCode.get(source.costCodeId) ?? new Decimal(0)).plus(gross),
          );
          approvedValues.set(line.scheduleOfValueLineId, {
            currentWork: money(currentWork),
            storedMaterials: money(storedMaterials),
            gross: money(gross),
            retainage: money(retainage),
            amount: money(gross.minus(retainage)),
          });
        }
        for (const costCodeId of costCodes) {
          const limit = (scheduledByCode.get(costCodeId) ?? new Decimal(0)).plus(
            effectedRevenue.get(costCodeId) ?? '0',
          );
          const afterApproval = (currentTotalsByCode.get(costCodeId) ?? new Decimal(0)).plus(
            requestedByCode.get(costCodeId) ?? new Decimal(0),
          );
          if (afterApproval.gt(limit)) throw new PaymentApplicationReconciliationError();
        }
        for (const line of lines) {
          const value = approvedValues.get(line.scheduleOfValueLineId)!;
          await tx
            .update(paymentApplicationLines)
            .set({
              approvedCurrentWork: value.currentWork,
              approvedStoredMaterials: value.storedMaterials,
              approvedGross: value.gross,
              approvedRetainage: value.retainage,
              approvedAmount: value.amount,
            })
            .where(
              and(
                eq(paymentApplicationLines.id, line.id),
                eq(paymentApplicationLines.organizationId, organizationId),
                eq(paymentApplicationLines.projectId, projectId),
              ),
            );
          const previous = progressByLineId.get(line.scheduleOfValueLineId)!;
          await repository.updateProgress(
            tx,
            organizationId,
            projectId,
            line.scheduleOfValueLineId,
            {
              completedToDate: money(new Decimal(previous.completedToDate).plus(value.currentWork)),
              storedMaterials: money(
                new Decimal(previous.storedMaterials).plus(value.storedMaterials),
              ),
              retainageAccrued: money(new Decimal(previous.retainageAccrued).plus(value.retainage)),
              updatedAt: now,
            },
          );
        }
        const finalApprovedGross = lines.reduce(
          (sum, line) => sum.plus(approvedValues.get(line.scheduleOfValueLineId)!.gross),
          new Decimal(0),
        );
        const finalApprovedRetainage = lines.reduce(
          (sum, line) => sum.plus(approvedValues.get(line.scheduleOfValueLineId)!.retainage),
          new Decimal(0),
        );
        const finalApprovedAmount = finalApprovedGross.minus(finalApprovedRetainage);
        if (finalApprovedGross.lte(0)) {
          throw new PaymentApplicationReconciliationError(
            'At least one line must be approved for a positive amount.',
          );
        }
        const isFullyApproved = lines.every((line) => {
          const value = approvedValues.get(line.scheduleOfValueLineId)!;
          return (
            new Decimal(value.currentWork).eq(line.currentWork) &&
            new Decimal(value.storedMaterials).eq(line.storedMaterials)
          );
        });
        status = isFullyApproved ? 'APPROVED' : 'PARTIALLY_APPROVED';
        amount = money(finalApprovedAmount);
        const updated = await repository.update(
          tx,
          organizationId,
          projectId,
          id,
          expectedVersion,
          {
            status,
            approvedBy: actorUserId,
            approvedAt: now,
            approvedGross: money(finalApprovedGross),
            approvedRetainage: money(finalApprovedRetainage),
            approvedAmount: amount,
            version: row.version + 1,
          },
        );
        if (!updated) throw new CommercialVersionConflictError();
        await this.writeTransitionEvents(
          tx,
          row,
          updated,
          actorUserId,
          actionForApproval(status),
          amount,
          requestId,
        );
        const updatedLines = await repository.findLines(tx, organizationId, projectId, id);
        const eligibleChangeOrders = await repository.findEligibleChangeOrders(
          tx,
          organizationId,
          projectId,
          updated.currencyCode,
          [
            ...new Set(
              allSovLines
                .filter((line) =>
                  lines.some((appLine) => appLine.scheduleOfValueLineId === line.id),
                )
                .map((line) => line.costCodeId),
            ),
          ],
        );
        return mapApplication(updated, updatedLines, eligibleChangeOrders);
      } else if (operation === 'reject') {
        if (!['PENDING_REVIEW', 'UNDER_REVIEW'].includes(row.status) || !reason) {
          throw new PaymentApplicationConflictError();
        }
        assertFinancialActorSeparation('approve', {
          organizationId,
          projectId,
          actorUserId,
          creatorUserId: row.createdBy,
          requesterUserId: row.submittedBy,
        });
        status = 'REJECTED';
        action = FINANCIAL_AUDIT_ACTIONS.PAYMENT_APPLICATION_REJECTED;
      } else {
        if (!['DRAFT', 'REJECTED'].includes(row.status)) {
          throw new PaymentApplicationConflictError(
            'Only draft or rejected applications may be voided.',
          );
        }
        status = 'VOIDED';
        action = FINANCIAL_AUDIT_ACTIONS.PAYMENT_APPLICATION_VOIDED;
      }
      const updated = await repository.update(tx, organizationId, projectId, id, expectedVersion, {
        status,
        version: row.version + 1,
        ...(operation === 'submit' ? { submittedBy: actorUserId, submittedAt: now } : {}),
        ...(refreshedPriorApprovedGross !== undefined
          ? { priorApprovedGross: refreshedPriorApprovedGross }
          : {}),
        ...(operation === 'under-review' ? { reviewedBy: actorUserId, reviewedAt: now } : {}),
        ...(operation === 'reject'
          ? { rejectedBy: actorUserId, rejectedAt: now, rejectionReason: reason }
          : {}),
        ...(operation === 'void' ? { voidedBy: actorUserId, voidedAt: now } : {}),
      });
      if (!updated) throw new CommercialVersionConflictError();
      await this.writeTransitionEvents(tx, row, updated, actorUserId, action!, amount, requestId);
      const sovLines = await repository.findSovLines(
        tx,
        organizationId,
        projectId,
        updated.revisionId,
        lines.map((line) => line.scheduleOfValueLineId),
      );
      const eligibleChangeOrders = await repository.findEligibleChangeOrders(
        tx,
        organizationId,
        projectId,
        updated.currencyCode,
        [...new Set(sovLines.map((line) => line.costCodeId))],
      );
      return mapApplication(
        updated,
        await repository.findLines(tx, organizationId, projectId, id),
        eligibleChangeOrders,
      );
    });
  }

  private async writeTransitionEvents(
    tx: Parameters<typeof writeFinancialAuditEvent>[0],
    previous: PaymentApplication,
    next: PaymentApplication,
    actorUserId: string,
    action: string,
    amount: string,
    requestId: string,
  ) {
    await writeFinancialAuditEvent(tx, {
      organizationId: next.organizationId,
      projectId: next.projectId,
      actorUserId,
      action: action as (typeof FINANCIAL_AUDIT_ACTIONS)[keyof typeof FINANCIAL_AUDIT_ACTIONS],
      entityType: 'PaymentApplication',
      entityId: next.id,
      previousState: jsonState(previous),
      newState: jsonState(next),
      amount,
      currencyCode: next.currencyCode,
      requestId,
    });
    await writeOutboxEvent(
      tx,
      `commercial.payment_application.${next.status.toLowerCase()}`,
      {
        organizationId: next.organizationId,
        projectId: next.projectId,
        paymentApplicationId: next.id,
        previousStatus: previous.status,
        status: next.status,
        version: next.version,
      },
      next.organizationId,
    );
  }

  submit(
    actor: string,
    organization: string,
    project: string,
    id: string,
    version: number,
    request: string,
  ) {
    return this.transition(actor, organization, project, id, version, request, 'submit');
  }

  underReview(
    actor: string,
    organization: string,
    project: string,
    id: string,
    version: number,
    request: string,
  ) {
    return this.transition(actor, organization, project, id, version, request, 'under-review');
  }

  approve(
    actor: string,
    organization: string,
    project: string,
    id: string,
    input: ApprovePaymentApplicationInput,
    request: string,
  ) {
    return this.transition(
      actor,
      organization,
      project,
      id,
      input.expectedVersion,
      request,
      'approve',
      input,
    );
  }

  reject(
    actor: string,
    organization: string,
    project: string,
    id: string,
    version: number,
    reason: string,
    request: string,
  ) {
    return this.transition(
      actor,
      organization,
      project,
      id,
      version,
      request,
      'reject',
      undefined,
      reason,
    );
  }

  void(
    actor: string,
    organization: string,
    project: string,
    id: string,
    version: number,
    request: string,
  ) {
    return this.transition(actor, organization, project, id, version, request, 'void');
  }
}

function actionForApproval(status: string) {
  return status === 'APPROVED'
    ? FINANCIAL_AUDIT_ACTIONS.PAYMENT_APPLICATION_APPROVED
    : FINANCIAL_AUDIT_ACTIONS.PAYMENT_APPLICATION_PARTIALLY_APPROVED;
}

export const paymentApplicationService = new PaymentApplicationService();
