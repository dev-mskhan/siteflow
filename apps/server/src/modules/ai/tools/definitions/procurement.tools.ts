// apps/server/src/modules/ai/tools/definitions/procurement.tools.ts
//
// READ-tier tools that wrap purchase order, quote, delivery, and procurement report services.
// All tools in this file are READ — they call existing services, return data,
// and never write to any domain table.
//
// Rules enforced at this layer:
//   - organizationId + projectId always come from RunContext (injected by tool-factory)
//   - Never import from DB schema directly — always go through a domain service
//   - Numbers and comparisons come from service/tool logic; the LLM must not compute them
//   - NO BINDING tools (create/approve/send/cancel PO) — those are deferred to future waves

import { z } from 'zod';
import { registerTool } from '../tool-registry.js';
import { PurchaseOrderService } from '../../../project/purchase-order/purchase-order.service.js';
import { QuoteService } from '../../../project/quote/quote.service.js';
import { DeliveryService } from '../../../project/delivery/delivery.service.js';
import { reportService } from '../../../reporting/report.service.js';

// Instantiate service instances
const purchaseOrderService = new PurchaseOrderService();
const quoteService = new QuoteService();
const deliveryService = new DeliveryService();

// ── 1. list_purchase_orders ───────────────────────────────────────────────────
// Lists purchase orders with optional status filter and pagination.
// Status values: DRAFT, PENDING_APPROVAL, APPROVED, SENT, ACKNOWLEDGED,
// PARTIALLY_RECEIVED, RECEIVED, CANCELLED

registerTool({
  name: 'list_purchase_orders',
  description:
    'Returns a list of purchase orders for a project. Use this to get an overview ' +
    'of all POs or filter by status (e.g., SENT, APPROVED, RECEIVED). ' +
    'Each PO includes items, totals, supplier, and status.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('The UUID of the project.'),
    status: z
      .enum([
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'SENT',
        'ACKNOWLEDGED',
        'PARTIALLY_RECEIVED',
        'RECEIVED',
        'CANCELLED',
      ])
      .optional()
      .describe(
        'Optional: filter by PO status. Valid values: DRAFT, PENDING_APPROVAL, APPROVED, SENT, ACKNOWLEDGED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED.',
      ),
    cursor: z.string().optional().describe('Pagination cursor from a previous response.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(50)
      .describe('Maximum number of POs to return (1–50, default 50).'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.purchase_order.read',
  async execute({ projectId, status, cursor, limit }, ctx) {
    return purchaseOrderService.listPurchaseOrders(ctx.organizationId, projectId, {
      status,
      cursor,
      limit: limit ?? 50,
    });
  },
});

// ── 2. get_purchase_order ─────────────────────────────────────────────────────
// Retrieves a single PO with all line items and details.

registerTool({
  name: 'get_purchase_order',
  description:
    'Returns the complete details of a specific purchase order, including all line items, ' +
    'supplier information, totals (subtotal, discounts, tax, grand total), delivery info, ' +
    'and status. Use this to inspect a specific PO mentioned by the user.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('The UUID of the project.'),
    purchaseOrderId: z.string().uuid().describe('The UUID of the purchase order to retrieve.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.purchase_order.read',
  async execute({ projectId, purchaseOrderId }, ctx) {
    return purchaseOrderService.getPurchaseOrder(ctx.organizationId, projectId, purchaseOrderId);
  },
});

// ── 3. list_quotes ────────────────────────────────────────────────────────────
// Lists quotes with optional status filter and pagination.
// Status values: DRAFT, SUBMITTED, ACCEPTED, REJECTED

registerTool({
  name: 'list_quotes',
  description:
    'Returns a list of quotes for a project. Use this to see all quotes from suppliers ' +
    'or filter by status (e.g., SUBMITTED, ACCEPTED). Each quote includes items, totals, ' +
    'supplier, validity period, and status.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('The UUID of the project.'),
    status: z
      .enum(['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED'])
      .optional()
      .describe(
        'Optional: filter by quote status. Valid values: DRAFT, SUBMITTED, ACCEPTED, REJECTED.',
      ),
    cursor: z.string().optional().describe('Pagination cursor from a previous response.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(50)
      .describe('Maximum number of quotes to return (1–50, default 50).'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.quote.read',
  async execute({ projectId, status, cursor, limit }, ctx) {
    return quoteService.listQuotes(ctx.organizationId, projectId, {
      status,
      cursor,
      limit: limit ?? 50,
    });
  },
});

// ── 4. get_quote ──────────────────────────────────────────────────────────────
// Retrieves a single quote with all line items and details.

registerTool({
  name: 'get_quote',
  description:
    'Returns the complete details of a specific quote, including all line items, ' +
    'supplier information, totals (subtotal, discounts, tax, grand total), validity period, ' +
    'and status. Use this to inspect a specific quote mentioned by the user.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('The UUID of the project.'),
    quoteId: z.string().uuid().describe('The UUID of the quote to retrieve.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.quote.read',
  async execute({ projectId, quoteId }, ctx) {
    return quoteService.getQuote(ctx.organizationId, projectId, quoteId);
  },
});

// ── 5. compare_quotes ─────────────────────────────────────────────────────────
// Compares multiple quotes side-by-side. NO service method exists for this —
// the tool fetches quotes individually and computes the comparison with full provenance.

registerTool({
  name: 'compare_quotes',
  description:
    'Compares 2-5 quotes side-by-side for bid leveling. Returns a comparison table showing: ' +
    '(1) total prices (lowest, highest, difference), ' +
    '(2) validity periods (longest, shortest), ' +
    '(3) item-by-item unit price comparison for each material. ' +
    'Every figure is sourced from a specific quote with full provenance. ' +
    'Use this when the user asks to compare quotes or perform bid leveling.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('The UUID of the project.'),
    quoteIds: z
      .array(z.string().uuid())
      .min(2)
      .max(5)
      .describe('Array of 2–5 quote UUIDs to compare. All must belong to the same project.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.quote.read',
  async execute({ projectId, quoteIds }, ctx) {
    // Fetch all quotes
    const quotes = await Promise.all(
      quoteIds.map((quoteId) =>
        quoteService.getQuote(ctx.organizationId, projectId, quoteId),
      ),
    );

    // Validate all quotes exist
    if (quotes.some((q) => !q)) {
      throw new Error('One or more quotes not found or do not belong to this project');
    }

    // Find lowest/highest by total amount
    const sortedByTotal = [...quotes].sort((a, b) =>
      parseFloat(a.totalAmount) - parseFloat(b.totalAmount)
    );
    const lowestQuote = sortedByTotal[0]!;
    const highestQuote = sortedByTotal[sortedByTotal.length - 1]!;
    const priceDifference = (
      parseFloat(highestQuote.totalAmount) - parseFloat(lowestQuote.totalAmount)
    ).toFixed(2);

    // Find longest/shortest validity
    const quotesWithValidity = quotes.filter((q: any) => q.validUntil);
    let longestValidQuote: any = null;
    let shortestValidQuote: any = null;
    if (quotesWithValidity.length > 0) {
      const sortedByValidity = [...quotesWithValidity].sort(
        (a: any, b: any) => new Date(b.validUntil!).getTime() - new Date(a.validUntil!).getTime(),
      );
      longestValidQuote = sortedByValidity[0]!;
      shortestValidQuote = sortedByValidity[sortedByValidity.length - 1]!;
    }

    // Item-by-item comparison (group by materialId)
    const itemsByMaterial = new Map<string, Array<{
      quoteId: string;
      quoteNumber: string;
      supplierId: string;
      description: string;
      quantity: string;
      unitCode: string;
      unitPrice: string;
      lineSubtotal: string;
      lineTotal: string;
    }>>();

    for (const quote of quotes) {
      for (const item of (quote as any).items) {
        const key = item.materialId;
        const arr = itemsByMaterial.get(key) ?? [];
        arr.push({
          quoteId: (quote as any).id,
          quoteNumber: (quote as any).quoteNumber,
          supplierId: (quote as any).supplierId,
          description: item.description,
          quantity: item.quantity,
          unitCode: item.unitCode,
          unitPrice: item.unitPrice,
          lineSubtotal: item.lineSubtotal,
          lineTotal: item.lineTotal,
        });
        itemsByMaterial.set(key, arr);
      }
    }

    const itemComparison = Array.from(itemsByMaterial.entries()).map(([materialId, items]) => {
      const sortedByUnitPrice = [...items].sort(
        (a, b) => parseFloat(a.unitPrice) - parseFloat(b.unitPrice),
      );
      const lowestUnitPrice = sortedByUnitPrice[0]!;
      const highestUnitPrice = sortedByUnitPrice[sortedByUnitPrice.length - 1]!;

      return {
        materialId,
        description: items[0]!.description,
        quotes: items.map((i) => ({
          quoteId: i.quoteId,
          quoteNumber: i.quoteNumber,
          supplierId: i.supplierId,
          quantity: i.quantity,
          unitCode: i.unitCode,
          unitPrice: i.unitPrice,
          lineSubtotal: i.lineSubtotal,
          lineTotal: i.lineTotal,
        })),
        lowestUnitPrice: {
          quoteId: lowestUnitPrice.quoteId,
          quoteNumber: lowestUnitPrice.quoteNumber,
          unitPrice: lowestUnitPrice.unitPrice,
        },
        highestUnitPrice: {
          quoteId: highestUnitPrice.quoteId,
          quoteNumber: highestUnitPrice.quoteNumber,
          unitPrice: highestUnitPrice.unitPrice,
        },
        priceDifference: (
          parseFloat(highestUnitPrice.unitPrice) - parseFloat(lowestUnitPrice.unitPrice)
        ).toFixed(4),
      };
    });

    return {
      quotes: quotes.map((q: any) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        supplierId: q.supplierId,
        grandTotal: q.totalAmount,
        currencyCode: q.currencyCode,
        validUntil: q.validUntil,
        status: q.status,
      })),
      comparison: {
        byTotal: {
          lowestQuoteId: lowestQuote.id,
          lowestQuoteNumber: lowestQuote.quoteNumber,
          lowestTotal: lowestQuote.totalAmount,
          highestQuoteId: highestQuote.id,
          highestQuoteNumber: highestQuote.quoteNumber,
          highestTotal: highestQuote.totalAmount,
          difference: priceDifference,
          currencyCode: lowestQuote.currencyCode,
        },
        byValidity: longestValidQuote
          ? {
              longestValidQuoteId: longestValidQuote.id,
              longestValidQuoteNumber: longestValidQuote.quoteNumber,
              longestValidUntil: longestValidQuote.validUntil,
              shortestValidQuoteId: shortestValidQuote!.id,
              shortestValidQuoteNumber: shortestValidQuote!.quoteNumber,
              shortestValidUntil: shortestValidQuote!.validUntil,
            }
          : null,
        itemComparison,
      },
      provenance: {
        toolName: 'compare_quotes',
        quoteIds,
        comparisonPerformedAt: new Date().toISOString(),
      },
    };
  },
});

// ── 6. get_procurement_report ─────────────────────────────────────────────────
// Aggregated procurement report: counts by status for material requests, POs,
// deliveries, receipts, and inventory items.

registerTool({
  name: 'get_procurement_report',
  description:
    'Returns an aggregated procurement report for a project, showing counts by status for: ' +
    '(1) material requests, (2) purchase orders, (3) deliveries, (4) receipts, and (5) total inventory items. ' +
    'Use this for high-level procurement overview and status summaries.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('The UUID of the project.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.material_request.read',
  async execute({ projectId }, ctx) {
    return reportService.getProcurementReport(ctx.organizationId, projectId);
  },
});

// ── 7. check_delivery_status ──────────────────────────────────────────────────
// Lists deliveries for a project with optional PO filter.
// Delivery status values: SCHEDULED, DELIVERED, CANCELLED

registerTool({
  name: 'check_delivery_status',
  description:
    'Returns a list of deliveries for a project. Use this to check which POs have deliveries, ' +
    'which deliveries are scheduled vs delivered, and track actual delivery dates. ' +
    'Each delivery includes items, quantities, scheduled and actual dates, and carrier info.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('The UUID of the project.'),
    cursor: z.string().optional().describe('Pagination cursor from a previous response.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(50)
      .describe('Maximum number of deliveries to return (1–50, default 50).'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.delivery.read',
  async execute({ projectId, cursor, limit }, ctx) {
    return deliveryService.listDeliveries(ctx.organizationId, projectId, {
      cursor,
      limit: limit ?? 50,
    });
  },
});

// ── End of READ-tier procurement tools ────────────────────────────────────────
// NO WRITE/BINDING tools in this file. All create/approve/send/cancel actions
// are deferred to future waves per AI_AGENT_PLAN.md WAVE 2 requirements.
