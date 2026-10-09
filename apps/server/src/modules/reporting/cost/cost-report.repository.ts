// apps/server/src/modules/reporting/cost/cost-report.repository.ts
// F.13 — Repository wrapper for cost and commercial report facts.
// Delegates data access to authoritative financialSummaryRepository while enforcing tenant isolation.

import { getDb } from '../../../lib/db/index.js';
import { financialSummaryRepository } from '../../project/financial-summary/financial-summary.repository.js';

export class CostReportRepository {
  private get db() {
    return getDb();
  }

  async findApprovedContractValues(organizationId: string, projectId: string) {
    return financialSummaryRepository.findApprovedContractValues(
      this.db,
      organizationId,
      projectId,
    );
  }

  async findApprovedInvoiceTotals(organizationId: string, projectId: string) {
    return financialSummaryRepository.findApprovedInvoiceTotals(
      this.db,
      organizationId,
      projectId,
    );
  }

  async findExecutedPayments(organizationId: string, projectId: string) {
    return financialSummaryRepository.findExecutedPayments(
      this.db,
      organizationId,
      projectId,
    );
  }
}
