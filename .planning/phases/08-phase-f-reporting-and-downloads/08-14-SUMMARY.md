# 08-14 SUMMARY — F.13 Commercial Financial Summary Report Engine

**Phase:** 08-phase-f-reporting-and-downloads  
**Plan:** 14  
**Wave:** 9  
**Status:** ✅ Completed  

---

## What Was Built

### Task 1: Commercial & Financial Summary Composition
- **`apps/server/src/modules/reporting/cost/cost-report.repository.ts`**:
  - `findApprovedContractValues`, `findApprovedInvoiceTotals`, `findExecutedPayments`: Wraps financial summary queries while enforcing organizationId and projectId scoping.
- **`apps/server/src/modules/reporting/cost/cost-report.service.ts`**:
  - `getCostReport(organizationId, projectId, rawFilters)`: Composes Phase E `financialSummaryService.getSummary()` into standard `ReportResultEnvelope` for `COMMERCIAL_FINANCIAL_SUMMARY`.
  - Preserves exact decimal arithmetic and multi-currency breakdowns without summing across currencies.
  - Exposes explicit `subcontractCommitmentsCoverage` as `isAvailable: false` with reason `DEFERRED_UNTIL_APPROVED_CONTRACT_SOURCE_EXISTS`.

### Task 2: Multi-Tenant & Coverage Verification
- **`apps/server/tests/integration/reporting/cost-report.test.ts`**:
  - Tests envelope generation and parity with Phase E financial summary.
  - Tests explicit coverage disclosure for unavailable subcontract commitments.
  - Tests multi-tenant isolation (Org 2 cannot access Org 1 financial summary).
  - Tests input validation (missing `organizationId` or `projectId`).
- **Result:** 5/5 tests pass ✅

---

## Files Created / Modified

| File | Action |
|------|--------|
| `apps/server/src/modules/reporting/cost/cost-report.repository.ts` | Created |
| `apps/server/src/modules/reporting/cost/cost-report.service.ts` | Created |
| `apps/server/tests/integration/reporting/cost-report.test.ts` | Created |

---

## Verification

| Test Suite | Tests Passed | Status |
|------------|--------------|--------|
| `tests/integration/reporting/cost-report.test.ts` | 5 / 5 | ✅ Passed |

---

## Key Decisions
- **Source Parity**: Composes Phase E `financialSummaryService` directly rather than re-implementing financial ledger queries or formulas.
- **Multi-Currency Safety**: Retains currency breakdown structure; never aggregates values across different currency codes.
- **Explicit Coverage Disclosure**: Explicitly marks subcontract commitments as unavailable with deferral reason.
