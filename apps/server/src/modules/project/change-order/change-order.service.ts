import { and, eq } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import {
  changeOrders,
  projectBudgetRevisions,
  projectBudgets,
  type ChangeOrder,
  type ChangeOrderLine,
} from '@siteflow/database/schema';
import type {
  CreateChangeOrderInput,
  ListChangeOrdersQuery,
  UpdateChangeOrderInput,
} from '@siteflow/shared';
import { assertFinancialActorSeparation } from '../../../lib/commercial/financial-policy.js';
import {
  CommercialVersionConflictError,
  InvalidMoneyValueError,
} from '../../../lib/commercial/commercial.errors.js';
import { executeIdempotently, type JsonValue } from '../../../lib/commercial/idempotency.service.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import { addMoney, formatMoney, normalizeCurrencyCode, parseMoney } from '../../../lib/commercial/money.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { yyyymm } from '../../../lib/date.js';
import { documentNumberService } from '../../procurement/document-number/document-number.service.js';
import {
  ChangeOrderConflictError,
  ChangeOrderNotFoundError,
  InvalidChangeOrderReferenceError,
} from './change-order.errors.js';
import { changeOrderRepository as repository } from './change-order.repository.js';
import type { ChangeOrderDTO, ChangeOrderListDTO } from './change-order.types.js';

function mapDTO(row: ChangeOrder, lines: ChangeOrderLine[]): ChangeOrderDTO {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    clientApprovedAt: row.clientApprovedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    effectedAt: row.effectedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    lines,
  };
}

function encodeCursor(row: ChangeOrder): string {
  return Buffer.from(`${row.createdAt.toISOString()}\n${row.id}`, 'utf8').toString('base64url');
}

function decodeCursor(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parts = Buffer.from(value, 'base64url').toString('utf8').split('\n');
    const createdAt = new Date(parts[0] ?? '');
    if (parts.length !== 2 || !parts[1] || parts[1].length > 128 || Number.isNaN(createdAt.getTime())) {
      throw new Error('invalid cursor');
    }
    return { createdAt, id: parts[1] };
  } catch {
    throw new ChangeOrderConflictError('The list cursor is invalid.');
  }
}

function json(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function normalizedLines(input: CreateChangeOrderInput['lines']) {
  return input.map((line, index) => {
    const costDelta = formatMoney(parseMoney(line.costDelta));
    const revenueDelta = formatMoney(parseMoney(line.revenueDelta));
    return {
      id: generateId(),
      lineNumber: index + 1,
      description: line.description,
      costCodeId: line.costCodeId,
      phaseId: line.phaseId ?? null,
      taskId: line.taskId ?? null,
      documentId: line.documentId ?? null,
      boqLineId: line.boqLineId ?? null,
      costDelta,
      revenueDelta,
    };
  });
}

function headerAmounts(lines: Array<{ costDelta: string; revenueDelta: string }>) {
  return {
    costDelta: addMoney(...lines.map((line) => line.costDelta)),
    revenueDelta: addMoney(...lines.map((line) => line.revenueDelta)),
  };
}

export class ChangeOrderService {
  private get db() {
    return getDb();
  }

  private async getDTO(organizationId: string, projectId: string, changeOrderId: string) {
    const [row] = await repository.findById(this.db, organizationId, projectId, changeOrderId);
    if (!row) throw new ChangeOrderNotFoundError();
    const lines = await repository.findLines(this.db, organizationId, projectId, changeOrderId);
    return mapDTO(row, lines);
  }

  async create(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: CreateChangeOrderInput,
    requestId: string,
  ) {
    const currencyCode = normalizeCurrencyCode(input.currencyCode);
    const lines = normalizedLines(input.lines);
    const amounts = headerAmounts(lines);
    return this.db.transaction(async (tx) => {
      if (!await repository.validateLines(tx, organizationId, projectId, input.lines)) {
        throw new InvalidChangeOrderReferenceError();
      }
      const changeOrderNumber = await documentNumberService.allocateDocumentNumber(
        tx,
        organizationId,
        projectId,
        'CO',
        yyyymm(),
      );
      const id = generateId();
      const row = await repository.create(tx, {
        id,
        organizationId,
        projectId,
        changeOrderNumber,
        title: input.title,
        reason: input.reason,
        requesterId: actorUserId,
        status: 'DRAFT',
        currencyCode,
        costDelta: amounts.costDelta,
        revenueDelta: amounts.revenueDelta,
        scheduleDeltaDays: input.scheduleDeltaDays,
        clientApprovalRequired: input.clientApprovalRequired,
        version: 1,
      });
      const createdLines = await repository.createLines(
        tx,
        lines.map((line) => ({ ...line, changeOrderId: id, organizationId, projectId })),
      );
      await writeOutboxEvent(tx, 'commercial.change_order.created', {
        organizationId, projectId, changeOrderId: id, changeOrderNumber,
      }, organizationId);
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.CHANGE_ORDER_CREATED,
        entityType: 'ChangeOrder',
        entityId: id,
        newState: { status: row.status, changeOrderNumber, costDelta: amounts.costDelta, revenueDelta: amounts.revenueDelta },
        amount: amounts.costDelta,
        currencyCode,
        requestId,
      });
      return mapDTO(row, createdLines);
    });
  }

  async list(organizationId: string, projectId: string, query: ListChangeOrdersQuery): Promise<ChangeOrderListDTO> {
    const rows = await repository.list(this.db, organizationId, projectId, query, decodeCursor(query.cursor));
    const hasNext = rows.length > query.limit;
    const page = hasNext ? rows.slice(0, query.limit) : rows;
    const lines = await Promise.all(
      page.map((row) => repository.findLines(this.db, organizationId, projectId, row.id)),
    );
    return {
      changeOrders: page.map((row, index) => mapDTO(row, lines[index]!)),
      nextCursor: hasNext ? encodeCursor(page[page.length - 1]!) : null,
    };
  }

  get(organizationId: string, projectId: string, changeOrderId: string) {
    return this.getDTO(organizationId, projectId, changeOrderId);
  }

  async updateDraft(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    changeOrderId: string,
    input: UpdateChangeOrderInput,
    requestId: string,
  ) {
    const currencyCode = normalizeCurrencyCode(input.currencyCode);
    const lines = normalizedLines(input.lines);
    const amounts = headerAmounts(lines);
    return this.db.transaction(async (tx) => {
      const [row] = await repository.findById(tx, organizationId, projectId, changeOrderId, true);
      if (!row) throw new ChangeOrderNotFoundError();
      if (row.version !== input.expectedVersion) throw new CommercialVersionConflictError();
      if (row.status !== 'DRAFT' || row.requesterId !== actorUserId) {
        throw new ChangeOrderConflictError('Only the requester may edit a draft change order.');
      }
      if (!await repository.validateLines(tx, organizationId, projectId, input.lines)) {
        throw new InvalidChangeOrderReferenceError();
      }
      const updated = await repository.update(tx, organizationId, projectId, changeOrderId, input.expectedVersion, {
        title: input.title,
        reason: input.reason,
        currencyCode,
        costDelta: amounts.costDelta,
        revenueDelta: amounts.revenueDelta,
        scheduleDeltaDays: input.scheduleDeltaDays,
        clientApprovalRequired: input.clientApprovalRequired,
        version: row.version + 1,
      });
      if (!updated) throw new CommercialVersionConflictError();
      const updatedLines = await repository.replaceLines(
        tx,
        organizationId,
        projectId,
        changeOrderId,
        lines.map((line) => ({ ...line, changeOrderId, organizationId, projectId })),
      );
      await writeOutboxEvent(tx, 'commercial.change_order.updated', {
        organizationId, projectId, changeOrderId, version: updated.version,
      }, organizationId);
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.CHANGE_ORDER_UPDATED,
        entityType: 'ChangeOrder',
        entityId: changeOrderId,
        previousState: { status: row.status, version: row.version },
        newState: { status: updated.status, version: updated.version, costDelta: amounts.costDelta, revenueDelta: amounts.revenueDelta },
        amount: amounts.costDelta,
        currencyCode,
        requestId,
      });
      return mapDTO(updated, updatedLines);
    });
  }

  private async transition(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    changeOrderId: string,
    expectedVersion: number,
    requestId: string,
    operation: 'submit' | 'approve' | 'client-approve' | 'reject' | 'void',
    reason?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [row] = await repository.findById(tx, organizationId, projectId, changeOrderId, true);
      if (!row) throw new ChangeOrderNotFoundError();
      if (row.version !== expectedVersion) throw new CommercialVersionConflictError();
      const now = new Date();
      let status: ChangeOrder['status'];
      let action: (typeof FINANCIAL_AUDIT_ACTIONS)[keyof typeof FINANCIAL_AUDIT_ACTIONS];
      const patch: Partial<typeof row> = { version: row.version + 1 };
      if (operation === 'submit') {
        if (row.status !== 'DRAFT') throw new ChangeOrderConflictError();
        status = 'SUBMITTED';
        patch.submittedBy = actorUserId;
        patch.submittedAt = now;
        action = FINANCIAL_AUDIT_ACTIONS.CHANGE_ORDER_SUBMITTED;
      } else if (operation === 'approve') {
        if (row.status !== 'SUBMITTED') throw new ChangeOrderConflictError();
        assertFinancialActorSeparation('approve', {
          organizationId,
          projectId,
          actorUserId,
          requesterUserId: row.requesterId,
        });
        status = row.clientApprovalRequired ? 'PENDING_CLIENT_APPROVAL' : 'APPROVED';
        patch.approvedBy = actorUserId;
        patch.approvedAt = now;
        action = FINANCIAL_AUDIT_ACTIONS.CHANGE_ORDER_APPROVED;
      } else if (operation === 'client-approve') {
        if (row.status !== 'PENDING_CLIENT_APPROVAL') throw new ChangeOrderConflictError();
        assertFinancialActorSeparation('approve', {
          organizationId,
          projectId,
          actorUserId,
          requesterUserId: row.requesterId,
        });
        status = 'CLIENT_APPROVED';
        patch.clientApprovedBy = actorUserId;
        patch.clientApprovedAt = now;
        action = FINANCIAL_AUDIT_ACTIONS.CHANGE_ORDER_CLIENT_APPROVED;
      } else if (operation === 'reject') {
        if (row.status !== 'SUBMITTED' && row.status !== 'PENDING_CLIENT_APPROVAL') {
          throw new ChangeOrderConflictError();
        }
        assertFinancialActorSeparation('approve', {
          organizationId,
          projectId,
          actorUserId,
          requesterUserId: row.requesterId,
          approverUserId: row.approvedBy,
        });
        status = 'REJECTED';
        patch.rejectedBy = actorUserId;
        patch.rejectedAt = now;
        patch.rejectionReason = reason!;
        action = FINANCIAL_AUDIT_ACTIONS.CHANGE_ORDER_REJECTED;
      } else {
        if (row.status === 'EFFECTED' || row.status === 'VOIDED') throw new ChangeOrderConflictError();
        status = 'VOIDED';
        patch.voidedBy = actorUserId;
        patch.voidedAt = now;
        action = FINANCIAL_AUDIT_ACTIONS.CHANGE_ORDER_VOIDED;
      }
      const updated = await repository.update(
        tx, organizationId, projectId, changeOrderId, expectedVersion, { ...patch, status },
      );
      if (!updated) throw new CommercialVersionConflictError();
      const lines = await repository.findLines(tx, organizationId, projectId, changeOrderId);
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action,
        entityType: 'ChangeOrder',
        entityId: changeOrderId,
        previousState: { status: row.status, version: row.version },
        newState: { status, version: updated.version, reason: reason ?? null },
        amount: row.costDelta,
        currencyCode: row.currencyCode,
        reason: reason ?? null,
        requestId,
      });
      await writeOutboxEvent(tx, `commercial.change_order.${operation.replace('-', '_')}`, {
        organizationId, projectId, changeOrderId, status, version: updated.version,
      }, organizationId);
      return mapDTO(updated, lines);
    });
  }

  submit(actorUserId: string, organizationId: string, projectId: string, id: string, version: number, requestId: string) {
    return this.transition(actorUserId, organizationId, projectId, id, version, requestId, 'submit');
  }

  approve(actorUserId: string, organizationId: string, projectId: string, id: string, version: number, requestId: string) {
    return this.transition(actorUserId, organizationId, projectId, id, version, requestId, 'approve');
  }

  approveByClient(actorUserId: string, organizationId: string, projectId: string, id: string, version: number, requestId: string) {
    return this.transition(actorUserId, organizationId, projectId, id, version, requestId, 'client-approve');
  }

  reject(actorUserId: string, organizationId: string, projectId: string, id: string, version: number, reason: string, requestId: string) {
    return this.transition(actorUserId, organizationId, projectId, id, version, requestId, 'reject', reason);
  }

  void(actorUserId: string, organizationId: string, projectId: string, id: string, version: number, requestId: string) {
    return this.transition(actorUserId, organizationId, projectId, id, version, requestId, 'void');
  }

  async effect(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    changeOrderId: string,
    expectedVersion: number,
    requestId: string,
    idempotencyKey: string,
  ) {
    return executeIdempotently({
      organizationId,
      operation: 'change_order.effect',
      key: idempotencyKey,
      request: { projectId, changeOrderId, expectedVersion },
    }, async (tx) => {
      const [row] = await repository.findById(tx, organizationId, projectId, changeOrderId, true);
      if (!row) throw new ChangeOrderNotFoundError();
      if (row.version !== expectedVersion) throw new CommercialVersionConflictError();
      const eligible = row.clientApprovalRequired
        ? row.status === 'CLIENT_APPROVED'
        : row.status === 'APPROVED';
      if (!eligible) throw new ChangeOrderConflictError('The change order must be approved before it can take effect.');

      const budget = await repository.getCurrentBudgetForUpdate(tx, organizationId, projectId);
      if (!budget || !budget.revision || budget.revision.status !== 'APPROVED' || budget.budget.status !== 'APPROVED') {
        throw new ChangeOrderConflictError('An approved project budget is required to effect this change order.');
      }
      if (budget.budget.currencyCode !== row.currencyCode) {
        throw new ChangeOrderConflictError('Change order and project budget currencies must match.');
      }

      const orderLines = await repository.findLines(tx, organizationId, projectId, changeOrderId);
      const totals = headerAmounts(orderLines);
      if (
        !new Decimal(totals.costDelta).eq(row.costDelta) ||
        !new Decimal(totals.revenueDelta).eq(row.revenueDelta)
      ) {
        throw new InvalidMoneyValueError();
      }
      const currentAmounts = new Map<string, Decimal>();
      for (const line of budget.lines) {
        currentAmounts.set(line.costCodeId, (currentAmounts.get(line.costCodeId) ?? new Decimal(0)).plus(line.amount));
      }
      for (const line of orderLines) {
        currentAmounts.set(line.costCodeId, (currentAmounts.get(line.costCodeId) ?? new Decimal(0)).plus(line.costDelta));
      }
      const nextAmounts = [...currentAmounts.entries()].sort(([a], [b]) => a.localeCompare(b));
      if (nextAmounts.some(([, amount]) => amount.isNegative())) {
        throw new ChangeOrderConflictError('The change order would make a cost-code budget negative.');
      }
      const nextRevisionNumber = budget.budget.currentRevisionNumber + 1;
      const revisionId = generateId();
      await repository.createBudgetRevision(tx, {
        id: revisionId,
        budgetId: budget.budget.id,
        organizationId,
        projectId,
        revisionNumber: nextRevisionNumber,
        status: 'DRAFT',
        createdBy: actorUserId,
      });
      await repository.insertBudgetLines(tx, nextAmounts.map(([costCodeId, amount], index) => ({
        id: generateId(),
        revisionId,
        organizationId,
        projectId,
        costCodeId,
        lineNumber: index + 1,
        description: `Change order ${row.changeOrderNumber} effective budget`,
        amount: formatMoney(amount),
      })));

      const now = new Date();
      await tx.update(projectBudgetRevisions)
        .set({ status: 'SUPERSEDED' })
        .where(and(
          eq(projectBudgetRevisions.id, budget.revision.id),
          eq(projectBudgetRevisions.organizationId, organizationId),
          eq(projectBudgetRevisions.projectId, projectId),
        ));
      await tx.update(projectBudgetRevisions)
        .set({ status: 'APPROVED', approvedBy: actorUserId, approvedAt: now })
        .where(eq(projectBudgetRevisions.id, revisionId));
      const budgetUpdate = await tx.update(projectBudgets)
        .set({
          currentRevisionNumber: nextRevisionNumber,
          version: budget.budget.version + 1,
          updatedAt: now,
        })
        .where(and(
          eq(projectBudgets.id, budget.budget.id),
          eq(projectBudgets.organizationId, organizationId),
          eq(projectBudgets.projectId, projectId),
          eq(projectBudgets.version, budget.budget.version),
        ))
        .returning({ id: projectBudgets.id });
      if (budgetUpdate.length === 0) throw new CommercialVersionConflictError();

      const [updated] = await tx.update(changeOrders).set({
        status: 'EFFECTED',
        effectedBy: actorUserId,
        effectedAt: now,
        effectedBudgetRevisionId: revisionId,
        version: row.version + 1,
        updatedAt: now,
      }).where(and(
        eq(changeOrders.id, changeOrderId),
        eq(changeOrders.organizationId, organizationId),
        eq(changeOrders.projectId, projectId),
        eq(changeOrders.version, expectedVersion),
      )).returning();
      if (!updated) throw new CommercialVersionConflictError();
      const lines = await repository.findLines(tx, organizationId, projectId, changeOrderId);
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.CHANGE_ORDER_EFFECTIVE,
        entityType: 'ChangeOrder',
        entityId: changeOrderId,
        previousState: { status: row.status, budgetRevisionNumber: budget.budget.currentRevisionNumber },
        newState: { status: 'EFFECTED', budgetRevisionNumber: nextRevisionNumber, budgetRevisionId: revisionId },
        amount: row.costDelta,
        currencyCode: row.currencyCode,
        requestId,
      });
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BUDGET_REVISED,
        entityType: 'ProjectBudget',
        entityId: budget.budget.id,
        previousState: { revisionNumber: budget.budget.currentRevisionNumber },
        newState: { revisionNumber: nextRevisionNumber, changeOrderId },
        amount: row.costDelta,
        currencyCode: row.currencyCode,
        requestId,
      });
      await writeOutboxEvent(tx, 'commercial.change_order.effected', {
        organizationId, projectId, changeOrderId, budgetId: budget.budget.id,
        budgetRevisionId: revisionId, scheduleDeltaDays: row.scheduleDeltaDays,
      }, organizationId);
      return json(mapDTO(updated, lines));
    }) as unknown as Promise<ChangeOrderDTO>;
  }
}

export const changeOrderService = new ChangeOrderService();
