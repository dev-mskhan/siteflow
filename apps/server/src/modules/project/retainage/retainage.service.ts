import { createHash } from 'node:crypto';
import { Decimal } from 'decimal.js';
import type { ListRetainageQuery, ReleaseRetainageInput } from '@siteflow/shared';
import type { RetainageRecord, RetainageRelease } from '@siteflow/database/schema';
import { assertFinancialActorSeparation } from '../../../lib/commercial/financial-policy.js';
import { CommercialVersionConflictError } from '../../../lib/commercial/commercial.errors.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import {
  executeIdempotently,
  type JsonValue,
} from '../../../lib/commercial/idempotency.service.js';
import { parseMoney, normalizeCurrencyCode } from '../../../lib/commercial/money.js';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import {
  RetainageBalanceError,
  RetainageConflictError,
  RetainageNotFoundError,
  RetainageSourceError,
} from './retainage.errors.js';
import { retainageRepository as repository, type Cursor } from './retainage.repository.js';

type RecordDTO = Omit<RetainageRecord, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};
type ReleaseDTO = Omit<RetainageRelease, 'releasedAt'> & { releasedAt: string };

function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function recordDTO(row: RetainageRecord): RecordDTO {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function releaseDTO(row: RetainageRelease): ReleaseDTO {
  return { ...row, releasedAt: row.releasedAt.toISOString() };
}

function cursorEncode(row: RetainageRecord) {
  return Buffer.from(`${row.createdAt.toISOString()}\n${row.id}`, 'utf8').toString('base64url');
}

function cursorDecode(value?: string): Cursor | undefined {
  if (!value) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid');
    const [date, id, ...rest] = Buffer.from(value, 'base64url').toString('utf8').split('\n');
    const createdAt = new Date(date ?? '');
    if (
      rest.length ||
      !id ||
      id.length > 128 ||
      Number.isNaN(createdAt.getTime()) ||
      createdAt.toISOString() !== date
    ) {
      throw new Error('invalid');
    }
    return { createdAt, id };
  } catch {
    throw new RetainageConflictError('The list cursor is invalid.');
  }
}

function recordState(row: RetainageRecord) {
  return {
    status: row.status,
    version: row.version,
    accruedAmount: row.accruedAmount,
    releasedAmount: row.releasedAmount,
    remainingAmount: row.remainingAmount,
  };
}

export class RetainageService {
  private get db() {
    return getDb();
  }

  async list(organizationId: string, projectId: string, query: ListRetainageQuery) {
    const rows = await repository.list(
      this.db,
      organizationId,
      projectId,
      query,
      cursorDecode(query.cursor),
    );
    const hasNext = rows.length > query.limit;
    const page = hasNext ? rows.slice(0, query.limit) : rows;
    return {
      retainageRecords: page.map(recordDTO),
      nextCursor: hasNext ? cursorEncode(page[page.length - 1]!) : null,
    };
  }

  async listReleases(organizationId: string, projectId: string, retainageId: string) {
    const [record] = await repository.findRecord(this.db, organizationId, projectId, retainageId);
    if (!record) throw new RetainageNotFoundError();
    const releases = await repository.listReleases(this.db, organizationId, projectId, retainageId);
    return { releases: releases.map(releaseDTO) };
  }

  async hold(
    actor: string,
    organizationId: string,
    projectId: string,
    paymentApplicationId: string,
    requestId: string,
    idempotencyKey: string,
  ) {
    try {
      return (await executeIdempotently(
        {
          organizationId,
          operation: 'retainage.hold',
          key: idempotencyKey,
          request: { projectId, paymentApplicationId },
        },
        async (tx) => {
          const [application] = await repository.findApplication(
            tx,
            organizationId,
            projectId,
            paymentApplicationId,
          );
          if (!application || !['APPROVED', 'PARTIALLY_APPROVED'].includes(application.status)) {
            throw new RetainageSourceError();
          }
          const lines = await repository.findApplicationLines(
            tx,
            organizationId,
            projectId,
            paymentApplicationId,
          );
          const eligible = lines.filter((line) => new Decimal(line.approvedRetainage).gt(0));
          if (eligible.length === 0) {
            throw new RetainageSourceError('The approved application has no retainage to hold.');
          }
          const rows = await repository.createRecords(
            tx,
            eligible.map((line) => {
              const id = generateId();
              const accruedAmount = new Decimal(line.approvedRetainage).toFixed(2);
              return {
                id,
                organizationId,
                projectId,
                paymentApplicationLineId: line.id,
                currencyCode: normalizeCurrencyCode(application.currencyCode),
                retainagePercent: line.retainagePercent,
                accruedAmount,
                releasedAmount: '0.00',
                remainingAmount: accruedAmount,
                status: 'HELD',
                version: 1,
                createdBy: actor,
              };
            }),
          );
          for (const row of rows) {
            await writeFinancialAuditEvent(tx, {
              organizationId,
              projectId,
              actorUserId: actor,
              action: FINANCIAL_AUDIT_ACTIONS.RETAINAGE_HELD,
              entityType: 'RetainageRecord',
              entityId: row.id,
              newState: recordState(row),
              amount: row.accruedAmount,
              currencyCode: row.currencyCode,
              requestId,
            });
          }
          return asJson({ retainageRecords: rows.map(recordDTO) });
        },
      )) as unknown as { retainageRecords: RecordDTO[] };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new RetainageConflictError(
          'Retainage has already been held for this application line.',
        );
      }
      throw error;
    }
  }

  async release(
    actor: string,
    organizationId: string,
    projectId: string,
    retainageId: string,
    input: ReleaseRetainageInput,
    requestId: string,
    idempotencyKey: string,
  ) {
    const amount = new Decimal(parseMoney(input.amount));
    if (!amount.gt(0)) throw new RetainageBalanceError('Release amount must be positive.');
    const idempotencyReference = createHash('sha256').update(idempotencyKey, 'utf8').digest('hex');
    return (await executeIdempotently(
      {
        organizationId,
        operation: 'retainage.release',
        key: idempotencyKey,
        request: asJson({ projectId, retainageId, input }),
      },
      async (tx) => {
        const [record] = await repository.findRecord(
          tx,
          organizationId,
          projectId,
          retainageId,
          true,
        );
        if (!record) throw new RetainageNotFoundError();
        if (record.version !== input.expectedVersion) {
          throw new CommercialVersionConflictError();
        }
        const [line] = await repository.findApplicationLine(
          tx,
          organizationId,
          projectId,
          record.paymentApplicationLineId,
        );
        if (!line || !new Decimal(line.approvedRetainage).eq(record.accruedAmount)) {
          throw new RetainageSourceError('The approved retainage source is no longer valid.');
        }
        const [application] = await repository.findApplication(
          tx,
          organizationId,
          projectId,
          line.paymentApplicationId,
        );
        if (
          !application ||
          !['APPROVED', 'PARTIALLY_APPROVED'].includes(application.status) ||
          application.currencyCode !== record.currencyCode
        ) {
          throw new RetainageSourceError('The approved payment application is no longer valid.');
        }
        assertFinancialActorSeparation('execute', {
          organizationId,
          projectId,
          actorUserId: actor,
          creatorUserId: application.createdBy,
          approverUserId: application.approvedBy,
        });
        const remaining = new Decimal(record.remainingAmount);
        if (amount.gt(remaining)) throw new RetainageBalanceError();
        const [progress] = await repository.findProgress(
          tx,
          organizationId,
          projectId,
          line.scheduleOfValueLineId,
        );
        if (!progress || new Decimal(progress.retainageAccrued).lt(amount)) {
          throw new RetainageBalanceError(
            'The authoritative SOV retainage balance is insufficient.',
          );
        }
        const nextReleased = new Decimal(record.releasedAmount).plus(amount);
        const nextRemaining = remaining.minus(amount);
        const nextStatus = nextRemaining.isZero() ? 'RELEASED' : 'PARTIALLY_RELEASED';
        const [updated] = await repository.updateRecord(
          tx,
          organizationId,
          projectId,
          retainageId,
          record.version,
          {
            releasedAmount: nextReleased.toFixed(2),
            remainingAmount: nextRemaining.toFixed(2),
            status: nextStatus,
            version: record.version + 1,
          },
        );
        if (!updated) throw new CommercialVersionConflictError();
        const [updatedProgress] = await repository.updateProgress(
          tx,
          progress.id,
          new Decimal(progress.retainageAccrued).minus(amount).toFixed(2),
        );
        if (!updatedProgress) throw new RetainageBalanceError();
        const [release] = await repository.createRelease(tx, {
          id: generateId(),
          organizationId,
          projectId,
          retainageRecordId: retainageId,
          amount: amount.toFixed(2),
          reason: input.reason,
          releasedBy: actor,
          idempotencyReference,
        });
        await writeFinancialAuditEvent(tx, {
          organizationId,
          projectId,
          actorUserId: actor,
          action: FINANCIAL_AUDIT_ACTIONS.RETAINAGE_RELEASED,
          entityType: 'RetainageRecord',
          entityId: retainageId,
          previousState: recordState(record),
          newState: recordState(updated),
          amount: amount.toFixed(2),
          currencyCode: updated.currencyCode,
          reason: input.reason,
          requestId,
        });
        return asJson({
          retainageRecord: recordDTO(updated),
          release: releaseDTO(release!),
        });
      },
    )) as unknown as { retainageRecord: RecordDTO; release: ReleaseDTO };
  }
}

export const retainageService = new RetainageService();
