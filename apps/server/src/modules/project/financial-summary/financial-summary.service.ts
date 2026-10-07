import { Decimal } from 'decimal.js';
import type { FinancialAuditQuery } from '@siteflow/shared';
import { formatMoney } from '../../../lib/commercial/money.js';
import { getDb } from '../../../lib/db/index.js';
import { commercialSummaryService } from '../commercial-summary/commercial-summary.service.js';
import { financialSummaryRepository } from './financial-summary.repository.js';

function amount(value: string | null | undefined) {
  return new Decimal(value ?? '0');
}

function totalsByKey(
  rows: Array<{ currencyCode: string; direction?: string; total: string | null }>,
) {
  return new Map(
    rows.map((row) => [`${row.currencyCode}:${row.direction ?? ''}`, amount(row.total)]),
  );
}

function totalAt(values: Map<string, Decimal>, currencyCode: string, direction = '') {
  return values.get(`${currencyCode}:${direction}`) ?? new Decimal(0);
}

function sortedCurrencies(fallback: string, ...groups: Array<Array<{ currencyCode: string }>>) {
  return [
    ...new Set([fallback, ...groups.flatMap((group) => group.map((row) => row.currencyCode))]),
  ].sort();
}

export class FinancialAuditNotFoundError extends Error {
  statusCode = 404;
  code = 'FINANCIAL_AUDIT_SOURCE_NOT_FOUND';

  constructor() {
    super('The requested project or change order was not found.');
  }
}

export class InvalidFinancialAuditCursorError extends Error {
  statusCode = 400;
  code = 'INVALID_FINANCIAL_AUDIT_CURSOR';

  constructor() {
    super('The financial audit cursor is invalid.');
  }
}

export class FinancialSummaryService {
  private get db() {
    return getDb();
  }

  async getSummary(organizationId: string, projectId: string) {
    const [
      costSummary,
      contractRows,
      applicationRows,
      billedRows,
      approvedInvoiceRows,
      paymentRows,
      retainageRows,
    ] = await Promise.all([
      commercialSummaryService.getProjectSummary(organizationId, projectId),
      financialSummaryRepository.findApprovedContractValues(this.db, organizationId, projectId),
      financialSummaryRepository.findApprovedApplications(this.db, organizationId, projectId),
      financialSummaryRepository.findBilledInvoiceTotals(this.db, organizationId, projectId),
      financialSummaryRepository.findApprovedInvoiceTotals(this.db, organizationId, projectId),
      financialSummaryRepository.findExecutedPayments(this.db, organizationId, projectId),
      financialSummaryRepository.findRetainageTotals(this.db, organizationId, projectId),
    ]);

    const currencies = sortedCurrencies(
      costSummary.currencyBreakdown[0]?.currencyCode ?? 'USD',
      contractRows,
      applicationRows,
      billedRows,
      approvedInvoiceRows,
      paymentRows,
      retainageRows,
    );
    const contractTotals = totalsByKey(contractRows);
    const applicationTotals = totalsByKey(applicationRows);
    const billedTotals = totalsByKey(billedRows);
    const approvedInvoiceTotals = totalsByKey(approvedInvoiceRows);
    const paymentTotals = totalsByKey(paymentRows);
    const heldTotals = new Map(retainageRows.map((row) => [row.currencyCode, amount(row.held)]));
    const releasedTotals = new Map(
      retainageRows.map((row) => [row.currencyCode, amount(row.released)]),
    );

    const currencyBreakdown = currencies.map((currencyCode) => {
      const approvedReceivables = totalAt(approvedInvoiceTotals, currencyCode, 'RECEIVABLE');
      const approvedPayables = totalAt(approvedInvoiceTotals, currencyCode, 'PAYABLE');
      const received = totalAt(paymentTotals, currencyCode, 'RECEIVABLE');
      const paid = totalAt(paymentTotals, currencyCode, 'PAYABLE');
      return {
        currencyCode,
        approvedContractValue: formatMoney(totalAt(contractTotals, currencyCode)),
        approvedPaymentApplications: formatMoney(totalAt(applicationTotals, currencyCode)),
        billedReceivables: formatMoney(totalAt(billedTotals, currencyCode, 'RECEIVABLE')),
        billedPayables: formatMoney(totalAt(billedTotals, currencyCode, 'PAYABLE')),
        approvedReceivables: formatMoney(approvedReceivables),
        approvedPayables: formatMoney(approvedPayables),
        paidReceivables: formatMoney(received),
        paidPayables: formatMoney(paid),
        receivablesOutstanding: formatMoney(Decimal.max(approvedReceivables.minus(received), 0)),
        payablesOutstanding: formatMoney(Decimal.max(approvedPayables.minus(paid), 0)),
        cashReceived: formatMoney(received),
        cashPaid: formatMoney(paid),
        netCash: formatMoney(received.minus(paid)),
        retainageHeld: formatMoney(heldTotals.get(currencyCode) ?? new Decimal(0)),
        retainageReleased: formatMoney(releasedTotals.get(currencyCode) ?? new Decimal(0)),
      };
    });

    return {
      cost: costSummary,
      commitments: {
        coverage: 'APPROVED_PURCHASE_ORDERS_ONLY',
        subcontractCommitments: 'DEFERRED_UNTIL_APPROVED_CONTRACT_SOURCE_EXISTS',
        currencyBreakdown: costSummary.currencyBreakdown.map((row) => ({
          currencyCode: row.currencyCode,
          approvedPOCommitments: row.committed,
        })),
      },
      billingAndCash: {
        currencyBreakdown,
        formulas: {
          approvedContractValue: 'Current approved schedule-of-values revision contract value.',
          approvedPaymentApplications:
            'Sum of approved and partially approved payment application net approved amounts.',
          billedInvoices:
            'Submitted, approved, and rejected invoice totals; drafts and voided invoices excluded.',
          outstanding:
            'Approved invoice totals less executed payments, floored at zero, by direction and currency.',
          cash: 'Executed payments only; net cash is received less paid, by currency.',
          retainage: 'Held and released totals from the retainage ledger.',
        },
      },
      commitmentCoverage: 'APPROVED_PURCHASE_ORDERS_ONLY',
      subcontractCommitments: 'DEFERRED_UNTIL_APPROVED_CONTRACT_SOURCE_EXISTS',
    };
  }

  async getCostSummary(organizationId: string, projectId: string) {
    return commercialSummaryService.getProjectSummary(organizationId, projectId);
  }

  async getCommitmentSummary(organizationId: string, projectId: string) {
    const summary = await commercialSummaryService.getProjectSummary(organizationId, projectId);
    return {
      coverage: 'APPROVED_PURCHASE_ORDERS_ONLY',
      subcontractCommitments: 'DEFERRED_UNTIL_APPROVED_CONTRACT_SOURCE_EXISTS',
      currencyBreakdown: summary.currencyBreakdown.map((row) => ({
        currencyCode: row.currencyCode,
        approvedPOCommitments: row.committed,
      })),
    };
  }

  async getBillingSummary(organizationId: string, projectId: string) {
    const summary = await this.getSummary(organizationId, projectId);
    return {
      currencyBreakdown: summary.billingAndCash.currencyBreakdown.map((row) => ({
        currencyCode: row.currencyCode,
        approvedContractValue: row.approvedContractValue,
        approvedPaymentApplications: row.approvedPaymentApplications,
        billedReceivables: row.billedReceivables,
        billedPayables: row.billedPayables,
        approvedReceivables: row.approvedReceivables,
        approvedPayables: row.approvedPayables,
        paidReceivables: row.paidReceivables,
        paidPayables: row.paidPayables,
        receivablesOutstanding: row.receivablesOutstanding,
        payablesOutstanding: row.payablesOutstanding,
        retainageHeld: row.retainageHeld,
        retainageReleased: row.retainageReleased,
      })),
      formulas: summary.billingAndCash.formulas,
    };
  }

  async getCashSummary(organizationId: string, projectId: string) {
    const summary = await this.getSummary(organizationId, projectId);
    return {
      currencyBreakdown: summary.billingAndCash.currencyBreakdown.map((row) => ({
        currencyCode: row.currencyCode,
        cashReceived: row.cashReceived,
        cashPaid: row.cashPaid,
        netCash: row.netCash,
      })),
      formula: summary.billingAndCash.formulas.cash,
    };
  }

  private decodeCursor(value?: string) {
    if (!value) return null;
    try {
      const decoded = Buffer.from(value, 'base64url').toString('utf8');
      const splitAt = decoded.indexOf('|');
      const createdAt = decoded.slice(0, splitAt);
      const id = decoded.slice(splitAt + 1);
      if (splitAt < 1 || !id || Number.isNaN(Date.parse(createdAt))) {
        throw new InvalidFinancialAuditCursorError();
      }
      return { createdAt, id };
    } catch (error) {
      if (error instanceof InvalidFinancialAuditCursorError) throw error;
      throw new InvalidFinancialAuditCursorError();
    }
  }

  async listAuditEvents(
    organizationId: string,
    projectId: string,
    query: FinancialAuditQuery,
    changeOrderId?: string,
  ) {
    if (changeOrderId) {
      const changeOrder = await financialSummaryRepository.findChangeOrder(
        this.db,
        organizationId,
        projectId,
        changeOrderId,
      );
      if (!changeOrder) throw new FinancialAuditNotFoundError();
    } else {
      await commercialSummaryService.getProjectSummary(organizationId, projectId);
    }
    const rows = await financialSummaryRepository.listAuditEvents(
      this.db,
      organizationId,
      projectId,
      query,
      this.decodeCursor(query.cursor),
      changeOrderId,
    );
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.cursorCreatedAt}|${last.id}`, 'utf8').toString('base64url')
        : null;
    return {
      events: page.map(({ cursorCreatedAt: _cursorCreatedAt, ...event }) => event),
      nextCursor,
    };
  }
}

export const financialSummaryService = new FinancialSummaryService();
