import { and, eq } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { projectBudgetRevisions, projects } from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import {
  CommercialVersionConflictError,
} from '../../../lib/commercial/commercial.errors.js';
import { assertFinancialActorSeparation } from '../../../lib/commercial/financial-policy.js';
import {
  addMoney,
  formatMoney,
  normalizeCurrencyCode,
  parseNonNegativeMoney,
} from '../../../lib/commercial/money.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import {
  InvalidProjectBudgetReferenceError,
  ProjectBudgetConflictError,
  ProjectBudgetNotFoundError,
} from './budget.errors.js';
import { projectBudgetRepository as repository } from './budget.repository.js';
import type {
  ProjectBudgetDTO,
  ProjectBudgetLineDTO,
  ProjectBudgetSummaryDTO,
  CreateProjectBudgetInput,
  UpdateProjectBudgetInput,
} from './budget.types.js';

function mapLine(line: {
  id: string;
  lineNumber: number;
  costCodeId: string;
  phaseId: string | null;
  description: string | null;
  amount: string;
}): ProjectBudgetLineDTO {
  return { ...line, amount: formatMoney(parseNonNegativeMoney(line.amount)) };
}

function totalLines(lines: Array<{ amount: string }>): string {
  return addMoney(...lines.map((line) => line.amount));
}

export class ProjectBudgetService {
  private get db() {
    return getDb();
  }

  private async getBudgetDto(
    organizationId: string,
    projectId: string,
    budgetId?: string,
    tx: DatabaseTransaction | ReturnType<typeof getDb> = this.db,
  ): Promise<ProjectBudgetDTO | null> {
    const [budget] = await repository.findBudget(tx, organizationId, projectId, budgetId);
    if (!budget) return null;

    const [revision] = await repository.findRevision(
      tx,
      organizationId,
      projectId,
      budget.id,
      budget.currentRevisionNumber,
    );
    if (!revision) return null;
    const lines = await repository.findLines(tx, organizationId, projectId, revision.id);
    const mappedLines = lines.map(mapLine);

    return {
      id: budget.id,
      organizationId: budget.organizationId,
      projectId: budget.projectId,
      currencyCode: budget.currencyCode,
      status: budget.status as ProjectBudgetDTO['status'],
      version: budget.version,
      currentRevisionNumber: budget.currentRevisionNumber,
      createdBy: budget.createdBy,
      submittedBy: budget.submittedBy,
      submittedAt: budget.submittedAt?.toISOString() ?? null,
      approvedBy: budget.approvedBy,
      approvedAt: budget.approvedAt?.toISOString() ?? null,
      closedAt: budget.closedAt?.toISOString() ?? null,
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
      revision: {
        id: revision.id,
        revisionNumber: revision.revisionNumber,
        status: revision.status as ProjectBudgetDTO['status'],
        createdBy: revision.createdBy,
        submittedBy: revision.submittedBy,
        submittedAt: revision.submittedAt?.toISOString() ?? null,
        approvedBy: revision.approvedBy,
        approvedAt: revision.approvedAt?.toISOString() ?? null,
      },
      lines: mappedLines,
      total: totalLines(mappedLines),
    };
  }

  private async validateLines(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    input: CreateProjectBudgetInput['lines'],
  ) {
    const lines = input.map((line) => ({
      ...line,
      amount: formatMoney(parseNonNegativeMoney(line.amount)),
    }));
    const costCodeIds = [...new Set(lines.map((line) => line.costCodeId))];
    const phaseIds = [...new Set(lines.flatMap((line) => (line.phaseId ? [line.phaseId] : [])))];
    const { codes, phases } = await repository.validateReferences(
      tx,
      organizationId,
      projectId,
      costCodeIds,
      phaseIds,
    );
    if (codes.length !== costCodeIds.length || phases.length !== phaseIds.length) {
      throw new InvalidProjectBudgetReferenceError();
    }
    return lines;
  }

  private makeLineRows(
    organizationId: string,
    projectId: string,
    revisionId: string,
    lines: CreateProjectBudgetInput['lines'],
  ) {
    return lines.map((line, index) => ({
      id: generateId(),
      revisionId,
      organizationId,
      projectId,
      costCodeId: line.costCodeId,
      phaseId: line.phaseId ?? null,
      lineNumber: index + 1,
      description: line.description ?? null,
      amount: formatMoney(parseNonNegativeMoney(line.amount)),
    }));
  }

  async createBudget(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: CreateProjectBudgetInput,
    requestId: string,
  ): Promise<ProjectBudgetDTO> {
    const currencyCode = normalizeCurrencyCode(input.currencyCode);
    return this.db.transaction(async (tx) => {
      const [project] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .for('update');
      if (!project) throw new ProjectBudgetNotFoundError();

      const [existing] = await repository.findBudget(tx, organizationId, projectId);
      if (existing) throw new ProjectBudgetConflictError('This project already has a budget.');
      const lines = await this.validateLines(tx, organizationId, projectId, input.lines);

      const budgetId = generateId();
      const revisionId = generateId();
      await repository.createBudget(tx, {
        id: budgetId,
        organizationId,
        projectId,
        currencyCode,
        status: 'DRAFT',
        currentRevisionNumber: 1,
        version: 1,
        createdBy: actorUserId,
      });
      await repository.createRevision(tx, {
        id: revisionId,
        budgetId,
        organizationId,
        projectId,
        revisionNumber: 1,
        status: 'DRAFT',
        createdBy: actorUserId,
      });
      const insertedLines = await repository.insertLines(
        tx,
        this.makeLineRows(organizationId, projectId, revisionId, lines),
      );
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BUDGET_CREATED,
        entityType: 'ProjectBudget',
        entityId: budgetId,
        newState: { status: 'DRAFT', currencyCode, revisionNumber: 1, total: totalLines(insertedLines) },
        amount: totalLines(insertedLines),
        currencyCode,
        requestId,
      });
      return (await this.getBudgetDto(organizationId, projectId, budgetId, tx))!;
    });
  }

  async listBudgets(organizationId: string, projectId: string) {
    const [budget] = await repository.findBudget(this.db, organizationId, projectId);
    const dto = budget ? await this.getBudgetDto(organizationId, projectId, budget.id) : null;
    return { budgets: dto ? [dto] : [], nextCursor: null };
  }

  async getBudget(organizationId: string, projectId: string, budgetId: string) {
    const budget = await this.getBudgetDto(organizationId, projectId, budgetId);
    if (!budget) throw new ProjectBudgetNotFoundError();
    return budget;
  }

  async updateBudget(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    budgetId: string,
    input: UpdateProjectBudgetInput,
    requestId: string,
  ): Promise<ProjectBudgetDTO> {
    return this.db.transaction(async (tx) => {
      const [budget] = await repository.findBudget(tx, organizationId, projectId, budgetId, true);
      if (!budget) throw new ProjectBudgetNotFoundError();
      if (budget.version !== input.expectedVersion) throw new CommercialVersionConflictError();
      if (budget.status !== 'DRAFT' && budget.status !== 'APPROVED') {
        throw new ProjectBudgetConflictError();
      }
      const lines = await this.validateLines(tx, organizationId, projectId, input.lines);
      const previous = await this.getBudgetDto(organizationId, projectId, budgetId, tx);
      let revisionId: string;
      let revisionNumber = budget.currentRevisionNumber;
      if (budget.status === 'APPROVED') {
        revisionNumber += 1;
        revisionId = generateId();
        await repository.createRevision(tx, {
          id: revisionId,
          budgetId,
          organizationId,
          projectId,
          revisionNumber,
          status: 'DRAFT',
          createdBy: actorUserId,
        });
      } else {
        const [revision] = await repository.findRevision(
          tx,
          organizationId,
          projectId,
          budgetId,
          budget.currentRevisionNumber,
          true,
        );
        if (!revision || revision.status !== 'DRAFT') throw new ProjectBudgetConflictError();
        revisionId = revision.id;
      }

      const updated = await repository.updateBudget(
        tx,
        organizationId,
        projectId,
        budgetId,
        input.expectedVersion,
        {
          status: 'DRAFT',
          currentRevisionNumber: revisionNumber,
          version: budget.version + 1,
          submittedBy: null,
          submittedAt: null,
          approvedBy: null,
          approvedAt: null,
        },
      );
      if (!updated) throw new CommercialVersionConflictError();
      const insertedLines = await repository.replaceLines(
        tx,
        organizationId,
        projectId,
        revisionId,
        this.makeLineRows(organizationId, projectId, revisionId, lines),
      );
      const total = totalLines(insertedLines);
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BUDGET_REVISED,
        entityType: 'ProjectBudget',
        entityId: budgetId,
        previousState: previous ? { status: previous.status, revisionNumber: previous.currentRevisionNumber, total: previous.total } : null,
        newState: { status: 'DRAFT', revisionNumber, total },
        amount: formatMoney(new Decimal(total).minus(previous?.total ?? '0.00')),
        currencyCode: budget.currencyCode,
        requestId,
      });
      return (await this.getBudgetDto(organizationId, projectId, budgetId, tx))!;
    });
  }

  async submitBudget(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    budgetId: string,
    expectedVersion: number,
    requestId: string,
  ): Promise<ProjectBudgetDTO> {
    return this.db.transaction(async (tx) => {
      const [budget] = await repository.findBudget(tx, organizationId, projectId, budgetId, true);
      if (!budget) throw new ProjectBudgetNotFoundError();
      if (budget.status === 'PENDING_APPROVAL') {
        return (await this.getBudgetDto(organizationId, projectId, budgetId, tx))!;
      }
      if (budget.version !== expectedVersion) throw new CommercialVersionConflictError();
      if (budget.status !== 'DRAFT') throw new ProjectBudgetConflictError();
      const [revision] = await repository.findRevision(
        tx,
        organizationId,
        projectId,
        budgetId,
        budget.currentRevisionNumber,
        true,
      );
      if (!revision || revision.status !== 'DRAFT') throw new ProjectBudgetConflictError();
      const lines = await repository.findLines(tx, organizationId, projectId, revision.id);
      if (lines.length === 0) throw new ProjectBudgetConflictError('A budget requires at least one line.');

      const now = new Date();
      await repository.updateRevision(tx, revision.id, organizationId, projectId, {
        status: 'PENDING_APPROVAL',
        submittedBy: actorUserId,
        submittedAt: now,
      });
      const updated = await repository.updateBudget(
        tx,
        organizationId,
        projectId,
        budgetId,
        expectedVersion,
        { status: 'PENDING_APPROVAL', submittedBy: actorUserId, submittedAt: now, version: budget.version + 1 },
      );
      if (!updated) throw new CommercialVersionConflictError();
      const total = totalLines(lines);
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BUDGET_SUBMITTED,
        entityType: 'ProjectBudget',
        entityId: budgetId,
        previousState: { status: 'DRAFT' },
        newState: { status: 'PENDING_APPROVAL', revisionNumber: revision.revisionNumber },
        amount: total,
        currencyCode: budget.currencyCode,
        requestId,
      });
      return (await this.getBudgetDto(organizationId, projectId, budgetId, tx))!;
    });
  }

  async approveBudget(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    budgetId: string,
    expectedVersion: number,
    requestId: string,
  ): Promise<ProjectBudgetDTO> {
    return this.db.transaction(async (tx) => {
      const [budget] = await repository.findBudget(tx, organizationId, projectId, budgetId, true);
      if (!budget) throw new ProjectBudgetNotFoundError();
      if (budget.status === 'APPROVED') {
        return (await this.getBudgetDto(organizationId, projectId, budgetId, tx))!;
      }
      if (budget.version !== expectedVersion) throw new CommercialVersionConflictError();
      if (budget.status !== 'PENDING_APPROVAL') throw new ProjectBudgetConflictError();
      const [revision] = await repository.findRevision(
        tx,
        organizationId,
        projectId,
        budgetId,
        budget.currentRevisionNumber,
        true,
      );
      if (!revision || revision.status !== 'PENDING_APPROVAL') throw new ProjectBudgetConflictError();
      assertFinancialActorSeparation('approve', {
        organizationId,
        projectId,
        actorUserId,
        creatorUserId: revision.createdBy,
        requesterUserId: revision.submittedBy,
      });

      const lines = await repository.findLines(tx, organizationId, projectId, revision.id);
      const approvedRevisions = await repository.findApprovedRevisionTotals(
        tx,
        organizationId,
        projectId,
        budgetId,
      );
      const total = totalLines(lines);
      const now = new Date();
      if (approvedRevisions.length > 0) {
        await tx
          .update(projectBudgetRevisions)
          .set({ status: 'SUPERSEDED' })
          .where(
            and(
              eq(projectBudgetRevisions.budgetId, budgetId),
              eq(projectBudgetRevisions.status, 'APPROVED'),
            ),
          );
      }
      await repository.updateRevision(tx, revision.id, organizationId, projectId, {
        status: 'APPROVED',
        approvedBy: actorUserId,
        approvedAt: now,
      });
      const updated = await repository.updateBudget(
        tx,
        organizationId,
        projectId,
        budgetId,
        expectedVersion,
        {
          status: 'APPROVED',
          approvedBy: actorUserId,
          approvedAt: now,
          version: budget.version + 1,
        },
      );
      if (!updated) throw new CommercialVersionConflictError();
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BUDGET_APPROVED,
        entityType: 'ProjectBudget',
        entityId: budgetId,
        previousState: { status: 'PENDING_APPROVAL' },
        newState: { status: 'APPROVED', revisionNumber: revision.revisionNumber },
        amount: total,
        currencyCode: budget.currencyCode,
        requestId,
      });
      return (await this.getBudgetDto(organizationId, projectId, budgetId, tx))!;
    });
  }

  async closeBudget(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    budgetId: string,
    expectedVersion: number,
    requestId: string,
  ): Promise<ProjectBudgetDTO> {
    return this.db.transaction(async (tx) => {
      const [budget] = await repository.findBudget(tx, organizationId, projectId, budgetId, true);
      if (!budget) throw new ProjectBudgetNotFoundError();
      if (budget.status === 'CLOSED') {
        return (await this.getBudgetDto(organizationId, projectId, budgetId, tx))!;
      }
      if (budget.version !== expectedVersion) throw new CommercialVersionConflictError();
      if (budget.status !== 'APPROVED') throw new ProjectBudgetConflictError();
      const [revision] = await repository.findRevision(
        tx,
        organizationId,
        projectId,
        budgetId,
        budget.currentRevisionNumber,
        true,
      );
      if (!revision || revision.status !== 'APPROVED') throw new ProjectBudgetConflictError();
      await repository.updateRevision(tx, revision.id, organizationId, projectId, { status: 'CLOSED' });
      const updated = await repository.updateBudget(
        tx,
        organizationId,
        projectId,
        budgetId,
        expectedVersion,
        { status: 'CLOSED', closedAt: new Date(), version: budget.version + 1 },
      );
      if (!updated) throw new CommercialVersionConflictError();
      const lines = await repository.findLines(tx, organizationId, projectId, revision.id);
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.BUDGET_CLOSED,
        entityType: 'ProjectBudget',
        entityId: budgetId,
        previousState: { status: 'APPROVED' },
        newState: { status: 'CLOSED', revisionNumber: revision.revisionNumber },
        amount: totalLines(lines),
        currencyCode: budget.currencyCode,
        requestId,
      });
      return (await this.getBudgetDto(organizationId, projectId, budgetId, tx))!;
    });
  }

  async getSummary(
    organizationId: string,
    projectId: string,
    budgetId: string,
  ): Promise<ProjectBudgetSummaryDTO> {
    const [budget] = await repository.findBudget(this.db, organizationId, projectId, budgetId);
    if (!budget) throw new ProjectBudgetNotFoundError();
    const totals = await repository.getApprovedRevisionTotals(
      this.db,
      organizationId,
      projectId,
      budgetId,
    );
    if (totals.length === 0) {
      return {
        currencyCode: budget.currencyCode,
        original: '0.00',
        approvedChanges: '0.00',
        revised: '0.00',
        approvedRevisionNumber: null,
      };
    }
    const original = totals.find(({ revisionNumber }) => revisionNumber === 1)?.total ?? '0';
    const latest = totals[0]!;
    const originalAmount = formatMoney(new Decimal(original));
    const revisedAmount = formatMoney(new Decimal(latest.total ?? '0'));
    const approvedChanges = formatMoney(new Decimal(revisedAmount).minus(originalAmount));
    return {
      currencyCode: budget.currencyCode,
      original: originalAmount,
      approvedChanges,
      revised: revisedAmount,
      approvedRevisionNumber: latest.revisionNumber,
    };
  }
}

export const projectBudgetService = new ProjectBudgetService();
