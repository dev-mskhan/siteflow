import { and, eq } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import {
  scheduleOfValues,
  scheduleOfValueRevisions,
  type ScheduleOfValueProgress,
  type ScheduleOfValueLine,
  type ScheduleOfValueRevision,
  type ScheduleOfValues,
} from '@siteflow/database/schema';
import type { CreateScheduleOfValuesInput, UpdateScheduleOfValuesInput } from '@siteflow/shared';
import { assertFinancialActorSeparation } from '../../../lib/commercial/financial-policy.js';
import { CommercialVersionConflictError } from '../../../lib/commercial/commercial.errors.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import { normalizeCurrencyCode, parseMoney } from '../../../lib/commercial/money.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import {
  InvalidScheduleOfValuesReferenceError,
  ScheduleOfValuesConflictError,
  ScheduleOfValuesNotFoundError,
  ScheduleOfValuesReconciliationError,
} from './schedule-of-values.errors.js';
import { scheduleOfValuesRepository as repository } from './schedule-of-values.repository.js';
import type { ScheduleOfValueLineDTO, ScheduleOfValuesDTO } from './schedule-of-values.types.js';

function money(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

function totalScheduled(lines: Array<{ scheduledValue: string }>) {
  return lines.reduce((sum, line) => sum.plus(line.scheduledValue), new Decimal(0));
}

function lineDTO(
  line: ScheduleOfValueLine,
  progress: ScheduleOfValueProgress | undefined,
): ScheduleOfValueLineDTO {
  const completedToDate = progress?.completedToDate ?? '0.00';
  const storedMaterials = progress?.storedMaterials ?? '0.00';
  const retainageAccrued = progress?.retainageAccrued ?? '0.00';
  const progressed = new Decimal(completedToDate).plus(storedMaterials);
  const retainageAmount =
    progress?.retainageAccrued ?? money(progressed.times(line.retainagePercent).dividedBy(100));
  return {
    ...line,
    completedToDate,
    storedMaterials,
    retainageAccrued,
    createdAt: line.createdAt.toISOString(),
    remainingValue: money(new Decimal(line.scheduledValue).minus(progressed)),
    retainageAmount: money(retainageAmount),
  };
}

function revisionDTO(revision: ScheduleOfValueRevision) {
  return {
    ...revision,
    createdAt: revision.createdAt.toISOString(),
    submittedAt: revision.submittedAt?.toISOString() ?? null,
    approvedAt: revision.approvedAt?.toISOString() ?? null,
  };
}

function headerDTO(
  header: ScheduleOfValues,
  revision: ScheduleOfValueRevision,
  lines: ScheduleOfValueLine[],
  effectiveChangeOrderRevenue: string,
  progress: ScheduleOfValueProgress[],
): ScheduleOfValuesDTO {
  const baseContractValue = money(revision.contractValue);
  return {
    ...header,
    createdAt: header.createdAt.toISOString(),
    updatedAt: header.updatedAt.toISOString(),
    revision: revisionDTO(revision),
    lines: lines.map((line) =>
      lineDTO(
        line,
        progress.find((row) => row.scheduleOfValueLineId === line.id),
      ),
    ),
    baseContractValue,
    effectiveChangeOrderRevenue,
    currentContractValue: money(new Decimal(baseContractValue).plus(effectiveChangeOrderRevenue)),
  };
}

function normalizeLines(input: CreateScheduleOfValuesInput['lines']) {
  return input.map((line, index) => {
    const scheduledValue = new Decimal(parseMoney(line.scheduledValue));
    const retainagePercent = new Decimal(line.retainagePercent);
    if (scheduledValue.lte(0) || retainagePercent.lt(0) || retainagePercent.gt(100)) {
      throw new ScheduleOfValuesReconciliationError();
    }
    return {
      id: generateId(),
      lineNumber: index + 1,
      description: line.description,
      costCodeId: line.costCodeId,
      phaseId: line.phaseId ?? null,
      boqLineId: line.boqLineId ?? null,
      scheduledValue: money(scheduledValue),
      retainagePercent: money(retainagePercent),
      completedToDate: '0.00',
      storedMaterials: '0.00',
    };
  });
}

export class ScheduleOfValuesService {
  private get db() {
    return getDb();
  }

  private async getDTO(
    organizationId: string,
    projectId: string,
    scheduleOfValuesId: string,
    tx: Parameters<typeof repository.findHeader>[0] = this.db,
  ): Promise<ScheduleOfValuesDTO> {
    const [header] = await tx
      .select()
      .from(scheduleOfValues)
      .where(
        and(
          eq(scheduleOfValues.id, scheduleOfValuesId),
          eq(scheduleOfValues.organizationId, organizationId),
          eq(scheduleOfValues.projectId, projectId),
        ),
      )
      .limit(1);
    if (!header) throw new ScheduleOfValuesNotFoundError();
    const [revision] = await repository.findRevision(
      tx,
      organizationId,
      projectId,
      scheduleOfValuesId,
      header.currentRevisionNumber,
    );
    if (!revision) throw new ScheduleOfValuesNotFoundError();
    const lines = await repository.findLines(tx, organizationId, projectId, revision.id);
    const progress = await repository.findProgress(
      tx,
      organizationId,
      projectId,
      lines.map((line) => line.id),
    );
    const adjustments = await repository.findEffectedChangeOrders(
      tx,
      organizationId,
      projectId,
      revision.currencyCode,
    );
    const effectiveChangeOrderRevenue = money(
      adjustments.reduce((sum, row) => sum.plus(row.revenueDelta), new Decimal(0)),
    );
    return headerDTO(header, revision, lines, effectiveChangeOrderRevenue, progress);
  }

  private async validate(
    tx: Parameters<typeof repository.validateReferences>[0],
    organizationId: string,
    projectId: string,
    currencyCode: string,
    input: CreateScheduleOfValuesInput,
  ) {
    const lines = normalizeLines(input.lines);
    if (!totalScheduled(lines).eq(input.contractValue)) {
      throw new ScheduleOfValuesReconciliationError();
    }
    const valid = await repository.validateReferences(
      tx,
      organizationId,
      projectId,
      [...new Set(lines.map((line) => line.costCodeId))],
      [...new Set(lines.flatMap((line) => (line.phaseId ? [line.phaseId] : [])))],
      lines.some((line) => line.boqLineId !== null),
    );
    if (!valid) throw new InvalidScheduleOfValuesReferenceError();
    const projectCurrency = await repository.findProjectCurrency(tx, organizationId, projectId);
    if (!projectCurrency || normalizeCurrencyCode(projectCurrency) !== currencyCode) {
      throw new ScheduleOfValuesConflictError(
        'Schedule of values currency must match the project currency.',
      );
    }
    return lines;
  }

  async create(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: CreateScheduleOfValuesInput,
    requestId: string,
  ) {
    const currencyCode = normalizeCurrencyCode(input.currencyCode);
    return this.db.transaction(async (tx) => {
      const lines = await this.validate(tx, organizationId, projectId, currencyCode, input);
      const [existing] = await repository.findHeader(tx, organizationId, projectId, true);
      if (existing)
        throw new ScheduleOfValuesConflictError('This project already has a schedule of values.');
      const scheduleId = generateId();
      const revisionId = generateId();
      const header = await repository.createHeader(tx, {
        id: scheduleId,
        organizationId,
        projectId,
        currentRevisionNumber: 1,
        version: 1,
        createdBy: actorUserId,
      });
      const revision = await repository.createRevision(tx, {
        id: revisionId,
        scheduleOfValuesId: scheduleId,
        organizationId,
        projectId,
        revisionNumber: 1,
        contractValue: money(input.contractValue),
        currencyCode,
        status: 'DRAFT',
        createdBy: actorUserId,
      });
      const createdLines = await repository.insertLines(
        tx,
        lines.map((line) => ({
          ...line,
          revisionId,
          organizationId,
          projectId,
        })),
      );
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.SCHEDULE_OF_VALUES_CREATED,
        entityType: 'ScheduleOfValues',
        entityId: scheduleId,
        newState: { status: 'DRAFT', revisionNumber: 1, contractValue: revision.contractValue },
        amount: revision.contractValue,
        currencyCode,
        requestId,
      });
      await writeOutboxEvent(
        tx,
        'commercial.schedule_of_values.created',
        {
          organizationId,
          projectId,
          scheduleOfValuesId: scheduleId,
          revisionId,
        },
        organizationId,
      );
      const adjustments = await repository.findEffectedChangeOrders(
        tx,
        organizationId,
        projectId,
        currencyCode,
      );
      const adjustmentTotal = money(
        adjustments.reduce((sum, row) => sum.plus(row.revenueDelta), new Decimal(0)),
      );
      return headerDTO(header, revision, createdLines, adjustmentTotal, []);
    });
  }

  async list(organizationId: string, projectId: string, limit: number) {
    const headers = await repository.listHeaders(this.db, organizationId, projectId, limit);
    return Promise.all(headers.map((header) => this.getDTO(organizationId, projectId, header.id)));
  }

  get(organizationId: string, projectId: string, id: string) {
    return this.getDTO(organizationId, projectId, id);
  }

  getProgress(organizationId: string, projectId: string, id: string) {
    return this.getDTO(organizationId, projectId, id);
  }

  async update(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    scheduleOfValuesId: string,
    input: UpdateScheduleOfValuesInput,
    requestId: string,
  ) {
    const currencyCode = normalizeCurrencyCode(input.currencyCode);
    return this.db.transaction(async (tx) => {
      const [header] = await repository.findHeader(tx, organizationId, projectId, true);
      if (!header || header.id !== scheduleOfValuesId) throw new ScheduleOfValuesNotFoundError();
      if (header.version !== input.expectedVersion) throw new CommercialVersionConflictError();
      const [currentRevision] = await repository.findRevision(
        tx,
        organizationId,
        projectId,
        scheduleOfValuesId,
        header.currentRevisionNumber,
        true,
      );
      if (!currentRevision) throw new ScheduleOfValuesNotFoundError();
      if (header.createdBy !== actorUserId) {
        throw new ScheduleOfValuesConflictError('Only the schedule-of-values creator may edit it.');
      }
      if (currentRevision.status !== 'DRAFT' && currentRevision.status !== 'APPROVED') {
        throw new ScheduleOfValuesConflictError(
          'Only a draft or approved schedule-of-values revision may be updated.',
        );
      }
      if (
        currentRevision.status === 'APPROVED' &&
        (await repository.hasApprovedPaymentApplications(
          tx,
          organizationId,
          projectId,
          currentRevision.id,
        ))
      ) {
        throw new ScheduleOfValuesConflictError(
          'A schedule-of-values revision with approved payment applications cannot be replaced.',
        );
      }
      const lines = await this.validate(tx, organizationId, projectId, currencyCode, input);
      const revisionNumber =
        currentRevision.status === 'APPROVED'
          ? header.currentRevisionNumber + 1
          : header.currentRevisionNumber;
      const revisionId = currentRevision.status === 'APPROVED' ? generateId() : currentRevision.id;
      if (currentRevision.status === 'APPROVED') {
        await repository.createRevision(tx, {
          id: revisionId,
          scheduleOfValuesId,
          organizationId,
          projectId,
          revisionNumber,
          contractValue: money(input.contractValue),
          currencyCode,
          status: 'DRAFT',
          createdBy: actorUserId,
        });
      } else {
        await tx
          .update(scheduleOfValueRevisions)
          .set({
            contractValue: money(input.contractValue),
            currencyCode,
          })
          .where(
            and(
              eq(scheduleOfValueRevisions.id, revisionId),
              eq(scheduleOfValueRevisions.organizationId, organizationId),
              eq(scheduleOfValueRevisions.projectId, projectId),
            ),
          );
      }
      const updatedHeader = await repository.updateHeader(
        tx,
        organizationId,
        projectId,
        scheduleOfValuesId,
        input.expectedVersion,
        {
          currentRevisionNumber: revisionNumber,
          version: header.version + 1,
        },
      );
      if (!updatedHeader) throw new CommercialVersionConflictError();
      const updatedLines = await repository.replaceLines(
        tx,
        organizationId,
        projectId,
        revisionId,
        lines.map((line) => ({ ...line, revisionId, organizationId, projectId })),
      );
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: FINANCIAL_AUDIT_ACTIONS.SCHEDULE_OF_VALUES_UPDATED,
        entityType: 'ScheduleOfValues',
        entityId: scheduleOfValuesId,
        previousState: {
          status: currentRevision.status,
          revisionNumber: currentRevision.revisionNumber,
        },
        newState: { status: 'DRAFT', revisionNumber, contractValue: money(input.contractValue) },
        amount: money(new Decimal(input.contractValue).minus(currentRevision.contractValue)),
        currencyCode,
        requestId,
      });
      await writeOutboxEvent(
        tx,
        'commercial.schedule_of_values.updated',
        {
          organizationId,
          projectId,
          scheduleOfValuesId,
          revisionId,
          revisionNumber,
        },
        organizationId,
      );
      const adjustments = await repository.findEffectedChangeOrders(
        tx,
        organizationId,
        projectId,
        currencyCode,
      );
      const adjustmentTotal = money(
        adjustments.reduce((sum, row) => sum.plus(row.revenueDelta), new Decimal(0)),
      );
      return headerDTO(
        updatedHeader,
        {
          ...currentRevision,
          id: revisionId,
          revisionNumber,
          contractValue: money(input.contractValue),
          currencyCode,
          status: 'DRAFT',
          createdBy: actorUserId,
          submittedBy: null,
          submittedAt: null,
          approvedBy: null,
          approvedAt: null,
          createdAt: new Date(),
        },
        updatedLines,
        adjustmentTotal,
        [],
      );
    });
  }

  private async transition(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    scheduleOfValuesId: string,
    expectedVersion: number,
    requestId: string,
    operation: 'submit' | 'approve',
  ) {
    return this.db.transaction(async (tx) => {
      const [header] = await repository.findHeader(tx, organizationId, projectId, true);
      if (!header || header.id !== scheduleOfValuesId) throw new ScheduleOfValuesNotFoundError();
      if (header.version !== expectedVersion) throw new CommercialVersionConflictError();
      const [revision] = await repository.findRevision(
        tx,
        organizationId,
        projectId,
        scheduleOfValuesId,
        header.currentRevisionNumber,
        true,
      );
      if (!revision) throw new ScheduleOfValuesNotFoundError();
      const lines = await repository.findLines(tx, organizationId, projectId, revision.id);
      if (!totalScheduled(lines).eq(revision.contractValue)) {
        throw new ScheduleOfValuesReconciliationError();
      }
      let status: 'PENDING_APPROVAL' | 'APPROVED';
      let action: string;
      const now = new Date();
      if (operation === 'submit') {
        if (revision.status !== 'DRAFT') throw new ScheduleOfValuesConflictError();
        status = 'PENDING_APPROVAL';
        action = FINANCIAL_AUDIT_ACTIONS.SCHEDULE_OF_VALUES_SUBMITTED;
        await repository.updateRevision(tx, organizationId, projectId, revision.id, {
          status,
          submittedBy: actorUserId,
          submittedAt: now,
        });
      } else {
        if (revision.status !== 'PENDING_APPROVAL') throw new ScheduleOfValuesConflictError();
        assertFinancialActorSeparation('approve', {
          organizationId,
          projectId,
          actorUserId,
          creatorUserId: revision.createdBy,
          requesterUserId: revision.submittedBy,
        });
        const [olderApprovals] = await tx
          .select()
          .from(scheduleOfValueRevisions)
          .where(
            and(
              eq(scheduleOfValueRevisions.scheduleOfValuesId, scheduleOfValuesId),
              eq(scheduleOfValueRevisions.organizationId, organizationId),
              eq(scheduleOfValueRevisions.projectId, projectId),
              eq(scheduleOfValueRevisions.status, 'APPROVED'),
            ),
          )
          .limit(1);
        if (olderApprovals) {
          await tx
            .update(scheduleOfValueRevisions)
            .set({ status: 'SUPERSEDED' })
            .where(
              and(
                eq(scheduleOfValueRevisions.scheduleOfValuesId, scheduleOfValuesId),
                eq(scheduleOfValueRevisions.organizationId, organizationId),
                eq(scheduleOfValueRevisions.projectId, projectId),
                eq(scheduleOfValueRevisions.status, 'APPROVED'),
              ),
            );
        }
        status = 'APPROVED';
        action = FINANCIAL_AUDIT_ACTIONS.SCHEDULE_OF_VALUES_APPROVED;
        await repository.updateRevision(tx, organizationId, projectId, revision.id, {
          status,
          approvedBy: actorUserId,
          approvedAt: now,
        });
        const progress = await repository.findProgress(
          tx,
          organizationId,
          projectId,
          lines.map((line) => line.id),
        );
        const initialized = new Set(progress.map((item) => item.scheduleOfValueLineId));
        await repository.initializeProgress(
          tx,
          lines
            .filter((line) => !initialized.has(line.id))
            .map((line) => ({
              id: generateId(),
              scheduleOfValueLineId: line.id,
              organizationId,
              projectId,
            })),
        );
      }
      const updatedHeader = await repository.updateHeader(
        tx,
        organizationId,
        projectId,
        scheduleOfValuesId,
        expectedVersion,
        {
          version: header.version + 1,
        },
      );
      if (!updatedHeader) throw new CommercialVersionConflictError();
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId,
        action: action as (typeof FINANCIAL_AUDIT_ACTIONS)[keyof typeof FINANCIAL_AUDIT_ACTIONS],
        entityType: 'ScheduleOfValues',
        entityId: scheduleOfValuesId,
        previousState: { status: revision.status, revisionNumber: revision.revisionNumber },
        newState: { status, revisionNumber: revision.revisionNumber },
        amount: revision.contractValue,
        currencyCode: revision.currencyCode,
        requestId,
      });
      await writeOutboxEvent(
        tx,
        `commercial.schedule_of_values.${operation}`,
        {
          organizationId,
          projectId,
          scheduleOfValuesId,
          revisionId: revision.id,
          status,
        },
        organizationId,
      );
      return this.getDTO(organizationId, projectId, scheduleOfValuesId, tx);
    });
  }

  submit(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    id: string,
    version: number,
    requestId: string,
  ) {
    return this.transition(
      actorUserId,
      organizationId,
      projectId,
      id,
      version,
      requestId,
      'submit',
    );
  }

  approve(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    id: string,
    version: number,
    requestId: string,
  ) {
    return this.transition(
      actorUserId,
      organizationId,
      projectId,
      id,
      version,
      requestId,
      'approve',
    );
  }
}

export const scheduleOfValuesService = new ScheduleOfValuesService();
