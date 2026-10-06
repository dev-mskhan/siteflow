import { Decimal } from 'decimal.js';
import { formatMoney } from '../../../lib/commercial/money.js';
import { getDb } from '../../../lib/db/index.js';
import { commercialSummaryRepository } from './commercial-summary.repository.js';

type SummaryRows = {
  budget: Array<{ currencyCode: string; revisionNumber: number; costCodeId: string; total: string | null }>;
  commitments: Array<{ currencyCode: string; total: string | null }>;
  actuals: Array<{ currencyCode: string; total: string | null }>;
};

function money(value: string | null | undefined): Decimal {
  return new Decimal(value ?? '0');
}

function summarize(rows: SummaryRows, fallbackCurrency: string) {
  const currencies = new Set([
    fallbackCurrency,
    ...rows.budget.map((row) => row.currencyCode),
    ...rows.commitments.map((row) => row.currencyCode),
    ...rows.actuals.map((row) => row.currencyCode),
  ]);
  return [...currencies].sort().map((currencyCode) => {
    const budgetRows = rows.budget.filter((row) => row.currencyCode === currencyCode);
    const latestRevision = budgetRows.reduce(
      (latest, row) => Math.max(latest, row.revisionNumber),
      0,
    );
    const original = budgetRows
      .filter((row) => row.revisionNumber === 1)
      .reduce((total, row) => total.plus(money(row.total)), new Decimal(0));
    const revised = budgetRows
      .filter((row) => row.revisionNumber === latestRevision)
      .reduce((total, row) => total.plus(money(row.total)), new Decimal(0));
    const committed = rows.commitments
      .filter((row) => row.currencyCode === currencyCode)
      .reduce((total, row) => total.plus(money(row.total)), new Decimal(0));
    const postedActual = rows.actuals
      .filter((row) => row.currencyCode === currencyCode)
      .reduce((total, row) => total.plus(money(row.total)), new Decimal(0));
    return {
      currencyCode,
      originalBudget: formatMoney(original),
      approvedBudgetChanges: formatMoney(revised.minus(original)),
      revisedBudget: formatMoney(revised),
      committed: formatMoney(committed),
      postedActual: formatMoney(postedActual),
      forecast: null,
      variance: null,
      approvedRevisionNumber: latestRevision || null,
    };
  });
}

export class CommercialSummaryNotFoundError extends Error {
  statusCode = 404;
  code = 'COMMERCIAL_SUMMARY_NOT_FOUND';

  constructor() {
    super('Project cost code not found.');
  }
}

export class CommercialSummaryService {
  private get db() {
    return getDb();
  }

  private async getRows(organizationId: string, projectId: string, costCodeId?: string) {
    const [currencyCode, costCode] = await Promise.all([
      commercialSummaryRepository.findProjectCurrency(this.db, organizationId, projectId),
      costCodeId
        ? commercialSummaryRepository.findCostCode(this.db, organizationId, projectId, costCodeId)
        : Promise.resolve(null),
    ]);
    if (costCodeId && !costCode) throw new CommercialSummaryNotFoundError();
    if (!currencyCode) throw new CommercialSummaryNotFoundError();

    const [budget, commitments, actuals] = await Promise.all([
      commercialSummaryRepository.findApprovedBudgetLines(
        this.db,
        organizationId,
        projectId,
        costCodeId,
      ),
      costCodeId
        ? commercialSummaryRepository.findCostCodeCommitments(
            this.db,
            organizationId,
            projectId,
            costCodeId,
          )
        : commercialSummaryRepository.findProjectCommitments(this.db, organizationId, projectId),
      commercialSummaryRepository.findPostedActuals(
        this.db,
        organizationId,
        projectId,
        costCodeId,
      ),
    ]);
    return {
      costCode,
      currencyBreakdown: summarize({ budget, commitments, actuals }, currencyCode),
    };
  }

  async getProjectSummary(organizationId: string, projectId: string) {
    const summary = await this.getRows(organizationId, projectId);
    return {
      ...summary,
      forecastBasis: null,
      forecastUnavailableReason:
        'No authoritative forecast source exists. Posted actuals and open commitments cannot yet be reconciled without invoice/commitment-consumption records.',
      commitmentCoverage: 'APPROVED_PURCHASE_ORDERS_ONLY',
      subcontractCommitments: 'DEFERRED_UNTIL_APPROVED_CONTRACT_SOURCE_EXISTS',
      invoiceLifecycleCoverage: 'DEFERRED_UNTIL_INVOICE_SOURCE_EXISTS',
    };
  }

  async getCostCodeSummary(organizationId: string, projectId: string, costCodeId: string) {
    const summary = await this.getRows(organizationId, projectId, costCodeId);
    return {
      ...summary,
      forecastBasis: null,
      forecastUnavailableReason:
        'No authoritative forecast source exists. Posted actuals and open commitments cannot yet be reconciled without invoice/commitment-consumption records.',
      commitmentCoverage: 'APPROVED_PURCHASE_ORDERS_ONLY',
      subcontractCommitments: 'DEFERRED_UNTIL_APPROVED_CONTRACT_SOURCE_EXISTS',
      invoiceLifecycleCoverage: 'DEFERRED_UNTIL_INVOICE_SOURCE_EXISTS',
    };
  }
}

export const commercialSummaryService = new CommercialSummaryService();
