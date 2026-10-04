import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { Decimal } from 'decimal.js';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { documentNumberService } from '../../procurement/document-number/document-number.service.js';
import { SupplierService } from '../../supplier/supplier.service.js';
import { QuoteRepository } from './quote.repository.js';
import { materialRequests } from '@siteflow/database/schema';
import {
  QuoteNotFoundError,
  QuoteInvalidStateError,
  QuoteExpiredError,
  QuoteAlreadyAcceptedForRequestError,
} from './quote.errors.js';
import type {
  QuoteDTO,
  QuoteItemDTO,
  CreateQuoteInput,
  UpdateQuoteInput,
  ListQuotesQuery,
  QuoteItemInput,
} from './quote.types.js';
import type { Quote, QuoteItem } from '@siteflow/database/schema';

const tracer = trace.getTracer('quote-service');
const supplierService = new SupplierService();

function currentYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function computeLineTotals(item: QuoteItemInput): { lineSubtotal: string; lineTotal: string } {
  const qty = new Decimal(item.quantity);
  const up = new Decimal(item.unitPrice);
  const disc = new Decimal(item.discountAmount ?? '0');
  const tax = new Decimal(item.taxAmount ?? '0');
  const lineSubtotal = qty.mul(up).toDecimalPlaces(2);
  const lineTotal = lineSubtotal.minus(disc).plus(tax).toDecimalPlaces(2);
  return { lineSubtotal: lineSubtotal.toFixed(2), lineTotal: lineTotal.toFixed(2) };
}

function computeDocumentTotals(
  items: Array<{ lineSubtotal: string; lineTotal: string; discountAmount: string; taxAmount: string }>,
): { subtotal: string; discountAmount: string; taxAmount: string; totalAmount: string } {
  let subtotal = new Decimal(0);
  let totalDiscount = new Decimal(0);
  let totalTax = new Decimal(0);
  for (const i of items) {
    subtotal = subtotal.plus(i.lineSubtotal);
    totalDiscount = totalDiscount.plus(i.discountAmount);
    totalTax = totalTax.plus(i.taxAmount);
  }
  const total = subtotal.minus(totalDiscount).plus(totalTax);
  return {
    subtotal: subtotal.toFixed(2),
    discountAmount: totalDiscount.toFixed(2),
    taxAmount: totalTax.toFixed(2),
    totalAmount: total.toFixed(2),
  };
}

function toItemDTO(row: QuoteItem): QuoteItemDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    quoteId: row.quoteId,
    materialRequestItemId: row.materialRequestItemId ?? null,
    materialId: row.materialId,
    description: row.description ?? null,
    quantity: row.quantity,
    unitCode: row.unitCode,
    unitPrice: row.unitPrice,
    discountAmount: row.discountAmount,
    taxAmount: row.taxAmount,
    lineSubtotal: row.lineSubtotal,
    lineTotal: row.lineTotal,
    expectedDeliveryDate: row.expectedDeliveryDate ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDTO(row: Quote, items: QuoteItem[]): QuoteDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    quoteNumber: row.quoteNumber,
    supplierId: row.supplierId,
    materialRequestId: row.materialRequestId ?? null,
    status: row.status as any,
    quoteDate: row.quoteDate,
    validUntil: row.validUntil ?? null,
    currencyCode: row.currencyCode,
    subtotal: row.subtotal,
    discountAmount: row.discountAmount,
    taxAmount: row.taxAmount,
    totalAmount: row.totalAmount,
    notes: row.notes ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    items: items.map(toItemDTO),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class QuoteService {
  constructor(private repo = new QuoteRepository()) {}

  private get db() {
    return getDb();
  }

  async createQuote(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: CreateQuoteInput,
  ): Promise<QuoteDTO> {
    return withSpan(tracer, 'quote.create', async (span) => {
      span.setAttributes({ organizationId, projectId });
      return this.db.transaction(async (tx) => {
        // Validate supplier is active and belongs to org
        await supplierService.findActiveById(tx as any, organizationId, input.supplierId);

        const quoteNumber = await documentNumberService.allocateDocumentNumber(
          tx,
          organizationId,
          projectId,
          'QT',
          currentYYYYMM(),
        );

        // Compute line and document totals (server always calculates)
        const computedItems = input.items.map((item) => {
          const { lineSubtotal, lineTotal } = computeLineTotals(item);
          return {
            id: generateId(),
            organizationId,
            quoteId: '', // set after quote insert
            materialRequestItemId: item.materialRequestItemId ?? null,
            materialId: item.materialId,
            description: item.description ?? null,
            quantity: item.quantity,
            unitCode: item.unitCode.toUpperCase(),
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount ?? '0.00',
            taxAmount: item.taxAmount ?? '0.00',
            lineSubtotal,
            lineTotal,
            expectedDeliveryDate: item.expectedDeliveryDate ?? null,
          };
        });
        const docTotals = computeDocumentTotals(computedItems);

        const id = generateId();
        const row = await this.repo.create(tx as any, {
          id,
          organizationId,
          projectId,
          quoteNumber,
          supplierId: input.supplierId,
          materialRequestId: input.materialRequestId ?? null,
          quoteDate: input.quoteDate,
          validUntil: input.validUntil ?? null,
          currencyCode: input.currencyCode,
          notes: input.notes ?? null,
          ...docTotals,
        });

        const itemsWithQuoteId = computedItems.map((i) => ({ ...i, quoteId: id }));
        const items = await this.repo.createItems(tx as any, itemsWithQuoteId);

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'quote.created',
            resourceType: 'Quote',
            resourceId: id,
            metadata: { projectId, quoteNumber },
          },
          tx,
        );
        return toDTO(row, items);
      });
    });
  }

  async getQuote(organizationId: string, projectId: string, quoteId: string): Promise<QuoteDTO> {
    return withSpan(tracer, 'quote.get', async (span) => {
      span.setAttributes({ organizationId, projectId, quoteId });
      const row = await this.repo.findById(this.db, quoteId);
      if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
        throw new QuoteNotFoundError(quoteId);
      }
      const items = await this.repo.findItemsByQuoteId(this.db, quoteId);
      return toDTO(row, items);
    });
  }

  async listQuotes(
    organizationId: string,
    projectId: string,
    query: ListQuotesQuery,
  ): Promise<{ data: QuoteDTO[]; nextCursor: string | null }> {
    return withSpan(tracer, 'quote.list', async (span) => {
      span.setAttributes({ organizationId, projectId });
      const limit = query.limit ?? 50;
      const rows = await this.repo.listByProject(this.db, organizationId, projectId, {
        cursor: query.cursor,
        limit: limit + 1,
        status: query.status,
      });
      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      let nextCursor: string | null = null;
      if (hasMore && data.length > 0) {
        const last = data[data.length - 1]!;
        nextCursor = Buffer.from(
          JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
        ).toString('base64');
      }
      const allItems = await this.repo.findItemsByQuoteIds(
        this.db,
        data.map((r) => r.id),
      );
      const itemsByQuoteId = new Map<string, QuoteItem[]>();
      for (const item of allItems) {
        const arr = itemsByQuoteId.get(item.quoteId) ?? [];
        arr.push(item);
        itemsByQuoteId.set(item.quoteId, arr);
      }
      const result = data.map((row) => toDTO(row, itemsByQuoteId.get(row.id) ?? []));
      return { data: result, nextCursor };
    });
  }

  async updateQuote(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    quoteId: string,
    input: UpdateQuoteInput,
  ): Promise<QuoteDTO> {
    return withSpan(tracer, 'quote.update', async (span) => {
      span.setAttributes({ organizationId, projectId, quoteId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findById(tx as any, quoteId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new QuoteNotFoundError(quoteId);
        }
        if (row.status === 'ACCEPTED') {
          throw new QuoteInvalidStateError(row.status, 'update');
        }
        const updated = await this.repo.update(tx as any, quoteId, input);
        const items = await this.repo.findItemsByQuoteId(tx as any, quoteId);
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'quote.updated',
            resourceType: 'Quote',
            resourceId: quoteId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }

  async submitQuote(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    quoteId: string,
  ): Promise<QuoteDTO> {
    return withSpan(tracer, 'quote.submit', async (span) => {
      span.setAttributes({ organizationId, projectId, quoteId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findByIdForUpdate(tx, quoteId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new QuoteNotFoundError(quoteId);
        }
        if (row.status !== 'DRAFT') {
          throw new QuoteInvalidStateError(row.status, 'submit');
        }
        const updated = await this.repo.update(tx as any, quoteId, {
          status: 'SUBMITTED',
          submittedAt: new Date(),
        });
        const items = await this.repo.findItemsByQuoteId(tx as any, quoteId);
        await writeOutboxEvent(
          tx,
          'procurement.quote.submitted',
          { organizationId, projectId, quoteId },
          organizationId,
        );
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'quote.submitted',
            resourceType: 'Quote',
            resourceId: quoteId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }

  async acceptQuote(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    quoteId: string,
  ): Promise<QuoteDTO> {
    return withSpan(tracer, 'quote.accept', async (span) => {
      span.setAttributes({ organizationId, projectId, quoteId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findByIdForUpdate(tx, quoteId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new QuoteNotFoundError(quoteId);
        }
        // Idempotency: already accepted
        if (row.status === 'ACCEPTED') {
          const items = await this.repo.findItemsByQuoteId(tx as any, quoteId);
          return toDTO(row, items);
        }
        if (row.status !== 'SUBMITTED') {
          throw new QuoteInvalidStateError(row.status, 'accept');
        }
        // Expiry check
        if (row.validUntil) {
          const today = new Date().toISOString().split('T')[0]!;
          if (row.validUntil < today) throw new QuoteExpiredError();
        }
        // At-most-one-accepted invariant per material request
        if (row.materialRequestId) {
          await tx
            .select({ id: materialRequests.id })
            .from(materialRequests)
            .where(eq(materialRequests.id, row.materialRequestId))
            .for('update');
          const existing = await this.repo.findAcceptedForRequest(tx as any, row.materialRequestId);
          if (existing && existing.id !== quoteId) throw new QuoteAlreadyAcceptedForRequestError();
        }
        const updated = await this.repo.update(tx as any, quoteId, {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        });
        const items = await this.repo.findItemsByQuoteId(tx as any, quoteId);
        await writeOutboxEvent(
          tx,
          'procurement.quote.accepted',
          { organizationId, projectId, quoteId },
          organizationId,
        );
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'quote.accepted',
            resourceType: 'Quote',
            resourceId: quoteId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }

  async rejectQuote(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    quoteId: string,
  ): Promise<QuoteDTO> {
    return withSpan(tracer, 'quote.reject', async (span) => {
      span.setAttributes({ organizationId, projectId, quoteId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findByIdForUpdate(tx, quoteId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new QuoteNotFoundError(quoteId);
        }
        if (!['SUBMITTED', 'DRAFT'].includes(row.status)) {
          throw new QuoteInvalidStateError(row.status, 'reject');
        }
        const updated = await this.repo.update(tx as any, quoteId, {
          status: 'REJECTED',
          rejectedAt: new Date(),
        });
        const items = await this.repo.findItemsByQuoteId(tx as any, quoteId);
        await writeOutboxEvent(
          tx,
          'procurement.quote.rejected',
          { organizationId, projectId, quoteId },
          organizationId,
        );
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'quote.rejected',
            resourceType: 'Quote',
            resourceId: quoteId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }
}
