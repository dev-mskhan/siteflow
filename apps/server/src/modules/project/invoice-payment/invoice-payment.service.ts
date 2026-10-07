import { Decimal } from 'decimal.js';
import type {
  CreateInvoiceInput,
  CreatePaymentInput,
  ListInvoicesQuery,
  ListPaymentsQuery,
  UpdateInvoiceInput,
} from '@siteflow/shared';
import type { Invoice, Payment } from '@siteflow/database/schema';
import { assertFinancialActorSeparation } from '../../../lib/commercial/financial-policy.js';
import { CommercialVersionConflictError } from '../../../lib/commercial/commercial.errors.js';
import { FINANCIAL_AUDIT_ACTIONS } from '../../../lib/commercial/financial-audit.types.js';
import { writeFinancialAuditEvent } from '../../../lib/commercial/financial-audit.service.js';
import {
  executeIdempotently,
  type JsonValue,
} from '../../../lib/commercial/idempotency.service.js';
import {
  normalizeCurrencyCode,
  parseMoney,
  parseNonNegativeMoney,
} from '../../../lib/commercial/money.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import {
  InvoicePaymentBalanceError,
  InvoicePaymentConflictError,
  InvoicePaymentNotFoundError,
  InvoicePaymentReferenceError,
} from './invoice-payment.errors.js';
import {
  invoicePaymentRepository as repository,
  type Cursor,
} from './invoice-payment.repository.js';

type InvoiceDTO = Omit<
  Invoice,
  'createdAt' | 'updatedAt' | 'submittedAt' | 'approvedAt' | 'rejectedAt' | 'voidedAt'
> & {
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  voidedAt: string | null;
  paidAmount: string;
  outstandingAmount: string;
};

type PaymentDTO = Omit<
  Payment,
  | 'createdAt'
  | 'updatedAt'
  | 'submittedAt'
  | 'approvedAt'
  | 'rejectedAt'
  | 'executedAt'
  | 'voidedAt'
> & {
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  executedAt: string | null;
  voidedAt: string | null;
};

function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function money(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

function cursorEncode(row: Invoice | Payment) {
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
    throw new InvoicePaymentConflictError('The list cursor is invalid.');
  }
}

function invoiceState(row: Invoice) {
  return {
    status: row.status,
    version: row.version,
    direction: row.direction,
    totalAmount: row.totalAmount,
    currencyCode: row.currencyCode,
  };
}

function paymentState(row: Payment) {
  return {
    status: row.status,
    version: row.version,
    amount: row.amount,
    currencyCode: row.currencyCode,
    invoiceId: row.invoiceId,
  };
}

function invoiceDTO(row: Invoice, paidAmount: string): InvoiceDTO {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    paidAmount,
    outstandingAmount: money(Decimal.max(new Decimal(row.totalAmount).minus(paidAmount), 0)),
  };
}

function paymentDTO(row: Payment): PaymentDTO {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    executedAt: row.executedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
  };
}

function validateInvoiceAmounts(input: CreateInvoiceInput) {
  const subtotal = new Decimal(parseNonNegativeMoney(input.subtotal));
  const taxAmount = new Decimal(parseNonNegativeMoney(input.taxAmount));
  const retainageAmount = new Decimal(parseNonNegativeMoney(input.retainageAmount));
  const totalAmount = subtotal.plus(taxAmount).minus(retainageAmount);
  if (retainageAmount.gt(subtotal.plus(taxAmount)) || totalAmount.lte(0)) {
    throw new InvoicePaymentBalanceError('Invoice total must be positive after tax and retainage.');
  }
  return {
    subtotal: money(subtotal),
    taxAmount: money(taxAmount),
    retainageAmount: money(retainageAmount),
    totalAmount: money(totalAmount),
  };
}

export class InvoicePaymentService {
  private get db() {
    return getDb();
  }

  private async invoiceDTO(organizationId: string, projectId: string, row: Invoice) {
    const totals = await repository.paidTotals(this.db, organizationId, projectId, [row.id]);
    return invoiceDTO(row, totals.get(row.id) ?? '0.00');
  }

  async listInvoices(organizationId: string, projectId: string, query: ListInvoicesQuery) {
    const rows = await repository.listInvoices(
      this.db,
      organizationId,
      projectId,
      query,
      cursorDecode(query.cursor),
    );
    const hasNext = rows.length > query.limit;
    const page = hasNext ? rows.slice(0, query.limit) : rows;
    const paidTotals = await repository.paidTotals(
      this.db,
      organizationId,
      projectId,
      page.map((row) => row.id),
    );
    return {
      invoices: page.map((row) => invoiceDTO(row, paidTotals.get(row.id) ?? '0.00')),
      nextCursor: hasNext ? cursorEncode(page[page.length - 1]!) : null,
    };
  }

  async getInvoice(organizationId: string, projectId: string, id: string) {
    const [row] = await repository.findInvoice(this.db, organizationId, projectId, id);
    if (!row) throw new InvoicePaymentNotFoundError();
    return this.invoiceDTO(organizationId, projectId, row);
  }

  async createInvoice(
    actor: string,
    organizationId: string,
    projectId: string,
    input: CreateInvoiceInput,
    requestId: string,
    idempotencyKey: string,
  ) {
    const amounts = validateInvoiceAmounts(input);
    const id = generateId();
    try {
      return (await executeIdempotently(
        {
          organizationId,
          operation: 'invoice.create',
          key: idempotencyKey,
          request: asJson({ projectId, input }),
        },
        async (tx) => {
          let sourceCurrency: string;
          let supplierId: string | null = null;
          if (input.direction === 'RECEIVABLE') {
            const [application] = await repository.findPaymentApplication(
              tx,
              organizationId,
              projectId,
              input.paymentApplicationId,
            );
            if (
              !application ||
              !['APPROVED', 'PARTIALLY_APPROVED'].includes(application.status) ||
              !new Decimal(amounts.totalAmount).eq(application.approvedAmount)
            ) {
              throw new InvoicePaymentReferenceError(
                'A receivable invoice must match an approved payment application.',
              );
            }
            sourceCurrency = application.currencyCode;
          } else {
            const [purchaseOrder] = await repository.findPurchaseOrder(
              tx,
              organizationId,
              projectId,
              input.purchaseOrderId,
            );
            if (
              !purchaseOrder ||
              !purchaseOrder.approvedAt ||
              ['DRAFT', 'PENDING_APPROVAL', 'CANCELLED'].includes(purchaseOrder.status)
            ) {
              throw new InvoicePaymentReferenceError(
                'Payable invoices require a purchase order with an approved source.',
              );
            }
            supplierId = purchaseOrder.supplierId;
            sourceCurrency = purchaseOrder.currencyCode;
          }
          const row = (
            await repository.createInvoice(tx, {
              id,
              organizationId,
              projectId,
              direction: input.direction,
              invoiceNumber: input.invoiceNumber,
              supplierId,
              purchaseOrderId: input.direction === 'PAYABLE' ? input.purchaseOrderId : null,
              paymentApplicationId:
                input.direction === 'RECEIVABLE' ? input.paymentApplicationId : null,
              billToName: input.direction === 'RECEIVABLE' ? input.billToName : null,
              invoiceDate: input.invoiceDate,
              dueDate: input.dueDate ?? null,
              currencyCode: normalizeCurrencyCode(sourceCurrency),
              ...amounts,
              status: 'DRAFT',
              version: 1,
              createdBy: actor,
            })
          )[0]!;
          await writeFinancialAuditEvent(tx, {
            organizationId,
            projectId,
            actorUserId: actor,
            action: FINANCIAL_AUDIT_ACTIONS.INVOICE_CREATED,
            entityType: 'Invoice',
            entityId: id,
            newState: invoiceState(row),
            amount: row.totalAmount,
            currencyCode: row.currencyCode,
            requestId,
          });
          await writeOutboxEvent(
            tx,
            'commercial.invoice.created',
            { organizationId, projectId, invoiceId: id, direction: row.direction },
            organizationId,
          );
          return asJson(invoiceDTO(row, '0.00'));
        },
      )) as unknown as InvoiceDTO;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new InvoicePaymentConflictError(
          'An invoice with this number or source already exists.',
        );
      }
      throw error;
    }
  }

  async updateInvoice(
    actor: string,
    organizationId: string,
    projectId: string,
    id: string,
    input: UpdateInvoiceInput,
    requestId: string,
  ) {
    const amounts = validateInvoiceAmounts(input);
    return this.db.transaction(async (tx) => {
      const [row] = await repository.findInvoice(tx, organizationId, projectId, id, true);
      if (!row) throw new InvoicePaymentNotFoundError();
      if (row.version !== input.expectedVersion) throw new CommercialVersionConflictError();
      if (row.status !== 'DRAFT' || row.createdBy !== actor) {
        throw new InvoicePaymentConflictError('Only the creator may update a draft invoice.');
      }
      if (row.direction !== input.direction) {
        throw new InvoicePaymentConflictError('Invoice direction cannot be changed.');
      }
      let sourceValues: {
        supplierId: string | null;
        purchaseOrderId: string | null;
        paymentApplicationId: string | null;
        billToName: string | null;
        currencyCode: string;
      };
      if (input.direction === 'RECEIVABLE') {
        const [application] = await repository.findPaymentApplication(
          tx,
          organizationId,
          projectId,
          input.paymentApplicationId,
        );
        if (
          !application ||
          !['APPROVED', 'PARTIALLY_APPROVED'].includes(application.status) ||
          !new Decimal(amounts.totalAmount).eq(application.approvedAmount)
        ) {
          throw new InvoicePaymentReferenceError(
            'A receivable invoice must match an approved payment application.',
          );
        }
        sourceValues = {
          supplierId: null,
          purchaseOrderId: null,
          paymentApplicationId: application.id,
          billToName: input.billToName,
          currencyCode: normalizeCurrencyCode(application.currencyCode),
        };
      } else {
        const [purchaseOrder] = await repository.findPurchaseOrder(
          tx,
          organizationId,
          projectId,
          input.purchaseOrderId,
        );
        if (
          !purchaseOrder ||
          !purchaseOrder.approvedAt ||
          ['DRAFT', 'PENDING_APPROVAL', 'CANCELLED'].includes(purchaseOrder.status)
        ) {
          throw new InvoicePaymentReferenceError(
            'Payable invoices require a purchase order with an approved source.',
          );
        }
        sourceValues = {
          supplierId: purchaseOrder.supplierId,
          purchaseOrderId: purchaseOrder.id,
          paymentApplicationId: null,
          billToName: null,
          currencyCode: normalizeCurrencyCode(purchaseOrder.currencyCode),
        };
      }
      const updated = (
        await repository.updateInvoice(tx, organizationId, projectId, id, row.version, {
          invoiceNumber: input.invoiceNumber,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate ?? null,
          ...amounts,
          ...sourceValues,
          version: row.version + 1,
        })
      )[0];
      if (!updated) throw new CommercialVersionConflictError();
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId: actor,
        action: FINANCIAL_AUDIT_ACTIONS.INVOICE_UPDATED,
        entityType: 'Invoice',
        entityId: id,
        previousState: invoiceState(row),
        newState: invoiceState(updated),
        amount: updated.totalAmount,
        currencyCode: updated.currencyCode,
        requestId,
      });
      await writeOutboxEvent(
        tx,
        'commercial.invoice.updated',
        { organizationId, projectId, invoiceId: id, version: updated.version },
        organizationId,
      );
      return invoiceDTO(updated, '0.00');
    });
  }

  async invoiceTransition(
    actor: string,
    organizationId: string,
    projectId: string,
    id: string,
    expectedVersion: number,
    requestId: string,
    operation: 'submit' | 'approve' | 'reject' | 'void',
    reason?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [row] = await repository.findInvoice(tx, organizationId, projectId, id, true);
      if (!row) throw new InvoicePaymentNotFoundError();
      if (row.version !== expectedVersion) throw new CommercialVersionConflictError();
      const now = new Date();
      let action: (typeof FINANCIAL_AUDIT_ACTIONS)[keyof typeof FINANCIAL_AUDIT_ACTIONS];
      let values: Record<string, unknown> = { version: row.version + 1 };
      if (operation === 'submit') {
        if (row.status !== 'DRAFT' || row.createdBy !== actor)
          throw new InvoicePaymentConflictError();
        values = { ...values, status: 'PENDING_APPROVAL', submittedBy: actor, submittedAt: now };
        action = FINANCIAL_AUDIT_ACTIONS.INVOICE_SUBMITTED;
      } else if (operation === 'approve') {
        if (row.status !== 'PENDING_APPROVAL') throw new InvoicePaymentConflictError();
        assertFinancialActorSeparation('approve', {
          organizationId,
          projectId,
          actorUserId: actor,
          creatorUserId: row.createdBy,
          requesterUserId: row.submittedBy,
        });
        if (row.direction === 'PAYABLE') {
          const [purchaseOrder] = await repository.findPurchaseOrder(
            tx,
            organizationId,
            projectId,
            row.purchaseOrderId!,
          );
          if (
            !purchaseOrder ||
            !purchaseOrder.approvedAt ||
            ['DRAFT', 'PENDING_APPROVAL', 'CANCELLED'].includes(purchaseOrder.status) ||
            purchaseOrder.supplierId !== row.supplierId ||
            purchaseOrder.currencyCode !== row.currencyCode
          ) {
            throw new InvoicePaymentReferenceError(
              'The approved purchase order is no longer valid.',
            );
          }
          const alreadyInvoiced = new Decimal(
            await repository.approvedPurchaseOrderInvoiceTotal(
              tx,
              organizationId,
              projectId,
              purchaseOrder.id,
            ),
          );
          if (alreadyInvoiced.plus(row.totalAmount).gt(purchaseOrder.totalAmount)) {
            throw new InvoicePaymentBalanceError(
              'Approved payable invoices exceed the approved PO total.',
            );
          }
        } else {
          const [application] = await repository.findPaymentApplication(
            tx,
            organizationId,
            projectId,
            row.paymentApplicationId!,
          );
          if (
            !application ||
            !['APPROVED', 'PARTIALLY_APPROVED'].includes(application.status) ||
            application.currencyCode !== row.currencyCode ||
            !new Decimal(application.approvedAmount).eq(row.totalAmount)
          ) {
            throw new InvoicePaymentReferenceError(
              'The approved payment application is no longer a valid invoice source.',
            );
          }
        }
        values = { ...values, status: 'APPROVED', approvedBy: actor, approvedAt: now };
        action = FINANCIAL_AUDIT_ACTIONS.INVOICE_APPROVED;
      } else if (operation === 'reject') {
        if (row.status !== 'PENDING_APPROVAL' || !reason) throw new InvoicePaymentConflictError();
        assertFinancialActorSeparation('approve', {
          organizationId,
          projectId,
          actorUserId: actor,
          creatorUserId: row.createdBy,
          requesterUserId: row.submittedBy,
        });
        values = {
          ...values,
          status: 'REJECTED',
          rejectedBy: actor,
          rejectedAt: now,
          rejectionReason: reason,
        };
        action = FINANCIAL_AUDIT_ACTIONS.INVOICE_REJECTED;
      } else {
        if (!['DRAFT', 'REJECTED'].includes(row.status)) throw new InvoicePaymentConflictError();
        values = { ...values, status: 'VOIDED', voidedBy: actor, voidedAt: now };
        action = FINANCIAL_AUDIT_ACTIONS.INVOICE_VOIDED;
      }
      const [updated] = await repository.updateInvoice(
        tx,
        organizationId,
        projectId,
        id,
        row.version,
        values,
      );
      if (!updated) throw new CommercialVersionConflictError();
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId: actor,
        action,
        entityType: 'Invoice',
        entityId: id,
        previousState: invoiceState(row),
        newState: invoiceState(updated),
        amount: updated.totalAmount,
        currencyCode: updated.currencyCode,
        requestId,
      });
      await writeOutboxEvent(
        tx,
        `commercial.invoice.${operation === 'void' ? 'voided' : updated.status.toLowerCase()}`,
        {
          organizationId,
          projectId,
          invoiceId: id,
          status: updated.status,
          version: updated.version,
        },
        organizationId,
      );
      return invoiceDTO(updated, '0.00');
    });
  }

  async listPayments(organizationId: string, projectId: string, query: ListPaymentsQuery) {
    const rows = await repository.listPayments(
      this.db,
      organizationId,
      projectId,
      query,
      cursorDecode(query.cursor),
    );
    const hasNext = rows.length > query.limit;
    const page = hasNext ? rows.slice(0, query.limit) : rows;
    return {
      payments: page.map(paymentDTO),
      nextCursor: hasNext ? cursorEncode(page[page.length - 1]!) : null,
    };
  }

  async getPayment(organizationId: string, projectId: string, id: string) {
    const [row] = await repository.findPayment(this.db, organizationId, projectId, id);
    if (!row) throw new InvoicePaymentNotFoundError();
    return paymentDTO(row);
  }

  async createPayment(
    actor: string,
    organizationId: string,
    projectId: string,
    invoiceId: string,
    input: CreatePaymentInput,
    requestId: string,
    idempotencyKey: string,
  ) {
    const amount = money(parseMoney(input.amount));
    if (new Decimal(amount).lte(0))
      throw new InvoicePaymentBalanceError('Payment amount must be positive.');
    const id = generateId();
    return (await executeIdempotently(
      {
        organizationId,
        operation: 'payment.create',
        key: idempotencyKey,
        request: asJson({ projectId, invoiceId, input }),
      },
      async (tx) => {
        const [invoice] = await repository.findInvoice(
          tx,
          organizationId,
          projectId,
          invoiceId,
          true,
        );
        if (!invoice || invoice.status !== 'APPROVED') {
          throw new InvoicePaymentReferenceError('Payments require an approved invoice.');
        }
        const [row] = await repository.createPayment(tx, {
          id,
          organizationId,
          projectId,
          invoiceId,
          direction: invoice.direction,
          amount,
          currencyCode: invoice.currencyCode,
          paymentDate: input.paymentDate,
          method: input.method,
          reference: input.reference ?? null,
          status: 'DRAFT',
          version: 1,
          createdBy: actor,
        });
        await writeFinancialAuditEvent(tx, {
          organizationId,
          projectId,
          actorUserId: actor,
          action: FINANCIAL_AUDIT_ACTIONS.PAYMENT_CREATED,
          entityType: 'Payment',
          entityId: id,
          newState: paymentState(row),
          amount,
          currencyCode: row.currencyCode,
          requestId,
        });
        await writeOutboxEvent(
          tx,
          'commercial.payment.created',
          { organizationId, projectId, invoiceId, paymentId: id },
          organizationId,
        );
        return asJson(paymentDTO(row));
      },
    )) as unknown as PaymentDTO;
  }

  async paymentTransition(
    actor: string,
    organizationId: string,
    projectId: string,
    id: string,
    expectedVersion: number,
    requestId: string,
    operation: 'submit' | 'approve' | 'reject' | 'execute' | 'void',
    reason?: string,
    idempotencyKey?: string,
  ) {
    const run = async (tx: Parameters<typeof writeFinancialAuditEvent>[0]) => {
      const [row] = await repository.findPayment(tx, organizationId, projectId, id, true);
      if (!row) throw new InvoicePaymentNotFoundError();
      if (row.version !== expectedVersion) throw new CommercialVersionConflictError();
      const now = new Date();
      let action: (typeof FINANCIAL_AUDIT_ACTIONS)[keyof typeof FINANCIAL_AUDIT_ACTIONS];
      let values: Record<string, unknown> = { version: row.version + 1 };
      if (operation === 'submit') {
        if (row.status !== 'DRAFT' || row.createdBy !== actor)
          throw new InvoicePaymentConflictError();
        values = { ...values, status: 'PENDING_APPROVAL', submittedBy: actor, submittedAt: now };
        action = FINANCIAL_AUDIT_ACTIONS.PAYMENT_SUBMITTED;
      } else if (operation === 'approve') {
        if (row.status !== 'PENDING_APPROVAL') throw new InvoicePaymentConflictError();
        assertFinancialActorSeparation('approve', {
          organizationId,
          projectId,
          actorUserId: actor,
          creatorUserId: row.createdBy,
          requesterUserId: row.submittedBy,
        });
        values = { ...values, status: 'APPROVED', approvedBy: actor, approvedAt: now };
        action = FINANCIAL_AUDIT_ACTIONS.PAYMENT_APPROVED;
      } else if (operation === 'reject') {
        if (row.status !== 'PENDING_APPROVAL' || !reason) throw new InvoicePaymentConflictError();
        assertFinancialActorSeparation('approve', {
          organizationId,
          projectId,
          actorUserId: actor,
          creatorUserId: row.createdBy,
          requesterUserId: row.submittedBy,
        });
        values = {
          ...values,
          status: 'REJECTED',
          rejectedBy: actor,
          rejectedAt: now,
          rejectionReason: reason,
        };
        action = FINANCIAL_AUDIT_ACTIONS.PAYMENT_REJECTED;
      } else if (operation === 'execute') {
        if (row.status !== 'APPROVED') throw new InvoicePaymentConflictError();
        assertFinancialActorSeparation('execute', {
          organizationId,
          projectId,
          actorUserId: actor,
          creatorUserId: row.createdBy,
          approverUserId: row.approvedBy,
        });
        const [invoice] = await repository.findInvoice(
          tx,
          organizationId,
          projectId,
          row.invoiceId,
          true,
        );
        if (
          !invoice ||
          invoice.status !== 'APPROVED' ||
          invoice.currencyCode !== row.currencyCode
        ) {
          throw new InvoicePaymentReferenceError('The approved invoice is no longer payable.');
        }
        const paid = new Decimal(
          (await repository.paidTotals(tx, organizationId, projectId, [invoice.id])).get(
            invoice.id,
          ) ?? '0',
        );
        if (paid.plus(row.amount).gt(invoice.totalAmount)) {
          throw new InvoicePaymentBalanceError('Payment exceeds the invoice outstanding balance.');
        }
        values = { ...values, status: 'EXECUTED', executedBy: actor, executedAt: now };
        action = FINANCIAL_AUDIT_ACTIONS.PAYMENT_EXECUTED;
      } else {
        if (!['DRAFT', 'REJECTED'].includes(row.status)) throw new InvoicePaymentConflictError();
        values = { ...values, status: 'VOIDED', voidedBy: actor, voidedAt: now };
        action = FINANCIAL_AUDIT_ACTIONS.PAYMENT_VOIDED;
      }
      const [updated] = await repository.updatePayment(
        tx,
        organizationId,
        projectId,
        id,
        row.version,
        values,
      );
      if (!updated) throw new CommercialVersionConflictError();
      await writeFinancialAuditEvent(tx, {
        organizationId,
        projectId,
        actorUserId: actor,
        action,
        entityType: 'Payment',
        entityId: id,
        previousState: paymentState(row),
        newState: paymentState(updated),
        amount: updated.amount,
        currencyCode: updated.currencyCode,
        requestId,
      });
      await writeOutboxEvent(
        tx,
        `commercial.payment.${operation === 'void' ? 'voided' : updated.status.toLowerCase()}`,
        {
          organizationId,
          projectId,
          invoiceId: updated.invoiceId,
          paymentId: id,
          status: updated.status,
        },
        organizationId,
      );
      return asJson(paymentDTO(updated));
    };
    if (operation === 'execute') {
      if (!idempotencyKey)
        throw new InvoicePaymentConflictError('An idempotency key is required to execute payment.');
      return (await executeIdempotently(
        {
          organizationId,
          operation: 'payment.execute',
          key: idempotencyKey,
          request: { projectId, paymentId: id, expectedVersion },
        },
        run,
      )) as unknown as PaymentDTO;
    }
    return this.db.transaction(run) as Promise<PaymentDTO>;
  }
}

export const invoicePaymentService = new InvoicePaymentService();
