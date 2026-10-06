import { Decimal } from 'decimal.js';
import type { DatabaseTransaction } from '@siteflow/database';
import type { CostTransaction } from '@siteflow/database/schema';
import type {
  CreateCostTransactionInput,
  ListCostTransactionsQuery,
} from '@siteflow/shared';
import type { JsonValue } from '../../../lib/commercial/idempotency.service.js';
import { executeIdempotently } from '../../../lib/commercial/idempotency.service.js';
import {
  CommercialVersionConflictError,
  InvalidMoneyValueError,
} from '../../../lib/commercial/commercial.errors.js';
import {
  addMoney,
  formatMoney,
  multiplyQuantityByUnitPrice,
  normalizeCurrencyCode,
  parseNonNegativeMoney,
} from '../../../lib/commercial/money.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import {
  CostTransactionConflictError,
  CostTransactionNotFoundError,
  InvalidCostTransactionReferenceError,
} from './cost-transaction.errors.js';
import {
  costTransactionRepository as repository,
  type CostTransactionCursor,
} from './cost-transaction.repository.js';
import type { CostTransactionDTO, CostTransactionListDTO } from './cost-transaction.types.js';

function mapDTO(row: CostTransaction, reversalId: string | null = null): CostTransactionDTO {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    postedAt: row.postedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    reversalId,
  };
}

function encodeCursor(row: CostTransaction): string {
  return Buffer.from(`${row.createdAt.toISOString()}\n${row.id}`, 'utf8').toString('base64url');
}

function decodeCursor(value: string | undefined): CostTransactionCursor | undefined {
  if (!value) return undefined;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8').split('\n');
    const createdAt = new Date(decoded[0] ?? '');
    const id = decoded[1];
    if (decoded.length !== 2 || Number.isNaN(createdAt.getTime()) || !id || id.length > 128) {
      throw new Error('invalid cursor');
    }
    return { createdAt, id };
  } catch {
    throw new CostTransactionConflictError('The list cursor is invalid.');
  }
}

function asJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function mapUniqueViolation(error: unknown): never {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  ) {
    throw new CostTransactionConflictError(
      'A cost transaction already exists for this source or reversal.',
    );
  }
  throw error;
}

export class CostTransactionService {
  private get db() {
    return getDb();
  }

  private async requireTransaction(
    db: DatabaseTransaction | ReturnType<typeof getDb>,
    organizationId: string,
    projectId: string,
    transactionId: string,
    lock = false,
  ) {
    const [row] = await repository.findById(db, organizationId, projectId, transactionId, lock);
    if (!row) throw new CostTransactionNotFoundError();
    return row;
  }

  private async requireValidReferences(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    input: CreateCostTransactionInput,
    lockCostCode = false,
  ) {
    const references = await repository.validateReferences(
      tx,
      organizationId,
      projectId,
      input,
      lockCostCode,
    );
    if (!references.valid || !references.costCode) throw new InvalidCostTransactionReferenceError();
    if (!references.costCode.isActive) {
      throw new CostTransactionConflictError('Posting requires an active project cost code.');
    }
  }

  private async dto(
    db: DatabaseTransaction | ReturnType<typeof getDb>,
    organizationId: string,
    projectId: string,
    transactionId: string,
  ): Promise<CostTransactionDTO> {
    const row = await this.requireTransaction(db, organizationId, projectId, transactionId);
    const [reversal] = await repository.findReversal(db, organizationId, projectId, transactionId);
    return mapDTO(row, reversal?.id ?? null);
  }

  async create(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: CreateCostTransactionInput,
    requestId: string,
    idempotencyKey: string,
  ): Promise<CostTransactionDTO> {
    const currencyCode = normalizeCurrencyCode(input.currencyCode);
    let subtotal: string;
    if (input.quantity !== undefined && input.unitCost !== undefined) {
      if (new Decimal(input.quantity).lte(0)) throw new InvalidMoneyValueError();
      const calculated = multiplyQuantityByUnitPrice(input.quantity, input.unitCost);
      if (input.subtotal !== undefined && !new Decimal(calculated).eq(input.subtotal)) {
        throw new InvalidMoneyValueError();
      }
      subtotal = calculated;
    } else if (input.subtotal !== undefined) {
      subtotal = formatMoney(parseNonNegativeMoney(input.subtotal));
    } else {
      throw new InvalidMoneyValueError();
    }
    const taxAmount = formatMoney(parseNonNegativeMoney(input.taxAmount));
    const totalAmount = addMoney(subtotal, taxAmount);
    const id = generateId();
    try {
      return await executeIdempotently(
        {
          organizationId,
          operation: 'cost_transaction.create',
          key: idempotencyKey,
          request: asJsonValue({ projectId, input }),
        },
        async (tx) => {
          await this.requireValidReferences(tx, organizationId, projectId, input);
          const row = await repository.insert(tx, {
            id,
            organizationId,
            projectId,
            costCodeId: input.costCodeId,
            phaseId: input.phaseId ?? null,
            taskId: input.taskId ?? null,
            documentId: input.documentId ?? null,
            sourceType: input.sourceType,
            sourceId: input.sourceId ?? null,
            transactionDate: input.transactionDate,
            postingDate: null,
            description: input.description,
            quantity: input.quantity ?? null,
            unit: input.unit ?? null,
            unitCost: input.unitCost === undefined
              ? null
              : formatMoney(parseNonNegativeMoney(input.unitCost)),
            subtotal,
            taxAmount,
            totalAmount,
            currencyCode,
            status: 'DRAFT',
            createdBy: actorUserId,
            version: 1,
          });
          const dto = mapDTO(row);
          await writeFinancialAuditEvent(tx, {
            organizationId,
            projectId,
            actorUserId,
            action: FINANCIAL_AUDIT_ACTIONS.COST_CREATED,
            entityType: 'CostTransaction',
            entityId: id,
            newState: { status: row.status, totalAmount, currencyCode },
            amount: totalAmount,
            currencyCode,
            requestId,
          });
          return asJsonValue(dto);
        },
      ) as unknown as CostTransactionDTO;
    } catch (error) {
      return mapUniqueViolation(error);
    }
  }

  async list(
    organizationId: string,
    projectId: string,
    query: ListCostTransactionsQuery,
  ): Promise<CostTransactionListDTO> {
    const rows = await repository.list(this.db, organizationId, projectId, query, decodeCursor(query.cursor));
    const hasNext = rows.length > query.limit;
    const page = hasNext ? rows.slice(0, query.limit) : rows;
    const reversals = await repository.findReversals(
      this.db,
      organizationId,
      projectId,
      page.map((row) => row.id),
    );
    const reversalBySource = new Map(
      reversals.map((reversal) => [reversal.reversalOfId!, reversal.id]),
    );
    return {
      transactions: page.map((row) => mapDTO(row, reversalBySource.get(row.id) ?? null)),
      nextCursor: hasNext ? encodeCursor(page[page.length - 1]!) : null,
    };
  }

  async get(organizationId: string, projectId: string, transactionId: string) {
    return this.dto(this.db, organizationId, projectId, transactionId);
  }

  async post(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    transactionId: string,
    expectedVersion: number,
    requestId: string,
    idempotencyKey: string,
  ): Promise<CostTransactionDTO> {
    try {
      return (await executeIdempotently(
        {
          organizationId,
          operation: 'cost_transaction.post',
          key: idempotencyKey,
          request: { projectId, transactionId, expectedVersion },
        },
        async (tx) => {
          const row = await this.requireTransaction(tx, organizationId, projectId, transactionId, true);
          if (row.status === 'POSTED') {
            return asJsonValue(await this.dto(tx, organizationId, projectId, transactionId));
          }
          if (row.version !== expectedVersion) throw new CommercialVersionConflictError();
          if (row.status !== 'DRAFT') throw new CostTransactionConflictError();
          await this.requireValidReferences(
            tx,
            organizationId,
            projectId,
            {
              costCodeId: row.costCodeId,
              ...(row.phaseId ? { phaseId: row.phaseId } : {}),
              ...(row.taskId ? { taskId: row.taskId } : {}),
              ...(row.documentId ? { documentId: row.documentId } : {}),
              sourceType: row.sourceType as CreateCostTransactionInput['sourceType'],
              ...(row.sourceId ? { sourceId: row.sourceId } : {}),
              transactionDate: row.transactionDate,
              description: row.description,
              currencyCode: row.currencyCode,
              subtotal: row.subtotal,
              taxAmount: row.taxAmount,
            } as CreateCostTransactionInput,
            true,
          );
          const postedAt = new Date();
          const postingDate = postedAt.toISOString().slice(0, 10);
          const updated = await repository.update(
            tx,
            organizationId,
            projectId,
            transactionId,
            expectedVersion,
            { status: 'POSTED', postedBy: actorUserId, postedAt, postingDate, version: row.version + 1 },
          );
          if (!updated) throw new CommercialVersionConflictError();
          const dto = await this.dto(tx, organizationId, projectId, transactionId);
          await writeFinancialAuditEvent(tx, {
            organizationId,
            projectId,
            actorUserId,
            action: FINANCIAL_AUDIT_ACTIONS.COST_POSTED,
            entityType: 'CostTransaction',
            entityId: transactionId,
            previousState: { status: row.status, version: row.version },
            newState: { status: updated.status, version: updated.version },
            amount: updated.totalAmount,
            currencyCode: updated.currencyCode,
            requestId,
          });
          return asJsonValue(dto);
        },
      )) as unknown as CostTransactionDTO;
    } catch (error) {
      return mapUniqueViolation(error);
    }
  }

  async void(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    transactionId: string,
    expectedVersion: number,
    reason: string,
    requestId: string,
    idempotencyKey: string,
  ): Promise<CostTransactionDTO> {
    try {
      return (await executeIdempotently(
        {
          organizationId,
          operation: 'cost_transaction.void',
          key: idempotencyKey,
          request: { projectId, transactionId, expectedVersion, reason },
        },
        async (tx) => {
          const row = await this.requireTransaction(tx, organizationId, projectId, transactionId, true);
          if (row.status === 'VOIDED') {
            return asJsonValue(await this.dto(tx, organizationId, projectId, transactionId));
          }
          if (row.version !== expectedVersion) throw new CommercialVersionConflictError();
          if (row.status !== 'POSTED') throw new CostTransactionConflictError('Only a posted cost transaction can be voided.');
          const voidedAt = new Date();
          const updated = await repository.update(
            tx,
            organizationId,
            projectId,
            transactionId,
            expectedVersion,
            { status: 'VOIDED', voidedBy: actorUserId, voidedAt, version: row.version + 1 },
          );
          if (!updated) throw new CommercialVersionConflictError();

          const reversalId = generateId();
          const reversal = await repository.insert(tx, {
            id: reversalId,
            organizationId,
            projectId,
            costCodeId: row.costCodeId,
            phaseId: row.phaseId,
            taskId: row.taskId,
            documentId: row.documentId,
            sourceType: 'VOID_REVERSAL',
            sourceId: null,
            transactionDate: row.transactionDate,
            postingDate: voidedAt.toISOString().slice(0, 10),
            description: `Void reversal: ${row.description}`.slice(0, 1000),
            quantity: null,
            unit: null,
            unitCost: null,
            subtotal: formatMoney(new Decimal(row.subtotal).negated()),
            taxAmount: formatMoney(new Decimal(row.taxAmount).negated()),
            totalAmount: formatMoney(new Decimal(row.totalAmount).negated()),
            currencyCode: row.currencyCode,
            status: 'POSTED',
            createdBy: actorUserId,
            postedBy: actorUserId,
            postedAt: voidedAt,
            version: 1,
            reversalOfId: row.id,
          });
          await writeFinancialAuditEvent(tx, {
            organizationId,
            projectId,
            actorUserId,
            action: FINANCIAL_AUDIT_ACTIONS.COST_VOIDED,
            entityType: 'CostTransaction',
            entityId: transactionId,
            previousState: { status: row.status, version: row.version },
            newState: { status: updated.status, version: updated.version, reversalId, reason },
            amount: reversal.totalAmount,
            currencyCode: row.currencyCode,
            reason,
            requestId,
          });
          return asJsonValue(mapDTO(updated, reversal.id));
        },
      )) as unknown as CostTransactionDTO;
    } catch (error) {
      return mapUniqueViolation(error);
    }
  }
}

export const costTransactionService = new CostTransactionService();
