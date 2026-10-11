---
phase: "10-saas-billing-subscription-management-deliver-secure-organiza"
plan: "08"
subsystem: billing/database
tags: [stripe, postgres, drizzle, invoices, payment-attempts, tenant-isolation]

requires:
  - phase: "10-14"
    provides: "Durable webhook recovery, provider-current-object retrieval, and tenant-mapped reconciliation"
provides:
  - "Tenant-scoped SaaS invoice and payment-attempt persistence separate from construction finance"
  - "Replay-safe invoice/payment synchronization from verified Stripe invoice facts"
  - "Out-of-order event protection for invoice and payment history"
affects: [10-09, 10-15, 10-16, 10-17, billing, stripe]

actuals:
  tokens: 12718
  tasks: 2
  commits: 4
plan_head_before: 85abbe1cb9ee05de9532c838079aaf8ee56f2367
plan_head_after: 49f965d8231937ed9151e666f3d7b9538e2d97d2

tech-stack:
  added: []
  patterns:
    - "Persist SaaS billing history in dedicated tenant-qualified tables, never construction-finance invoice/payment tables"
    - "Use verified provider facts and Stripe mode-qualified provider identities for idempotent invoice and attempt upserts"
    - "Apply persisted event-time high-water guards before related invoice writes and protect each invoice/attempt upsert against stale timestamps"

key-files:
  created:
    - packages/database/src/schema/saas-invoice.schema.ts
    - packages/database/drizzle/0046_saas_invoice_history.sql
    - packages/shared/src/modules/billing/invoice.schema.ts
    - apps/server/src/modules/billing/invoice.repository.ts
    - apps/server/src/modules/billing/invoice.service.ts
    - apps/server/tests/integration/billing/invoices-tax-refunds.test.ts
    - .planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-08-red-evidence.json
    - .planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-08-task2-red-evidence.json
  modified:
    - packages/database/src/schema/index.ts
    - packages/shared/src/index.ts
    - apps/server/src/modules/billing/provider-reconciler.ts
    - apps/server/src/modules/billing/stripe.adapter.ts

key-decisions:
  - "Invoice ownership is resolved only through persisted mode-qualified customer/subscription associations; webhook metadata is never trusted for tenant identity."
  - "Invoice amount, currency, status, and attempt outcomes are sourced from retrieved verified Stripe invoice facts."
  - "Migration 0046 follows the approved unjournaled additive SQL practice and was manually applied only to siteflow_test; the Drizzle journal and siteflow database remain untouched."
  - "BILL-07 remains incomplete until the conditional Stripe Tax scope owned by Plan 10-16 is delivered."

patterns-established:
  - "SaaS invoice and payment-attempt records use dedicated tables with tenant-qualified foreign keys and provider identity constraints."
  - "Stale webhook events return without mutating invoice or attempt history; conditional upserts independently reject stale persisted timestamps."

requirements-completed: []

coverage:
  - id: D1
    description: "Verified Stripe invoice events persist tenant-scoped SaaS invoice and payment-attempt history."
    requirement: BILL-07
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/invoices-tax-refunds.test.ts#reconciles signed invoice events into tenant-scoped SaaS invoice and payment history"
        status: pass
    human_judgment: false
  - id: D2
    description: "Duplicate invoice delivery is idempotent and older invoice facts cannot overwrite newer invoice or payment history."
    requirement: BILL-07
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/invoices-tax-refunds.test.ts#does not let stale invoice facts overwrite newer state across two organizations"
        status: pass
    human_judgment: false
  - id: D3
    description: "Invoice facts remain organization-qualified and separate from construction-finance invoice/payment records."
    requirement: BILL-07
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/invoices-tax-refunds.test.ts#does not let stale invoice facts overwrite newer state across two organizations"
        status: pass
    human_judgment: false

duration: 39 min
completed: 2026-10-11
status: complete
---

# Phase 10 Plan 08: SaaS Invoice and Payment History Summary

**Stripe SaaS invoice and payment-attempt facts now reconcile into tenant-scoped PostgreSQL history with separate construction-finance tables and replay-safe stale-event protection.**

## Performance

- **Duration:** 39 min (measured from the preceding plan-completion HEAD through the final task commit).
- **Started:** 2026-10-11T16:21:13+05:00
- **Completed:** 2026-10-11T16:59:47+05:00
- **Tasks:** 2
- **Files modified or added:** 12 plan files (10 implementation/test/migration files and 2 RED evidence records), excluding this summary.

## Accomplishments

- Added separate PostgreSQL SaaS invoice and payment-attempt tables, provider identity constraints, tenant-qualified relationships/indexes, shared billing contracts, repository, and service.
- Wired the existing durable provider reconciler to synchronize retrieved Stripe invoice facts after persisted customer/subscription tenant mapping. Provider webhook metadata is not an ownership source.
- Persisted provider amounts, currency, invoice state, timestamps, URLs, and payment-attempt outcome from verified invoice facts; duplicate deliveries update the same provider identity rather than duplicating history.
- Added event high-water and per-row timestamp guards so an older event cannot regress invoice/payment facts or create an older payment attempt after newer invoice state is accepted.
- Added real PostgreSQL integration coverage using randomized organizations, signed invoice webhooks, duplicate/replay behavior, tenant-qualified persisted rows, and construction-finance separation assertions.
- Added additive migration `0046_saas_invoice_history.sql`; applied it only to `siteflow_test` under the approved manual/un-journaled migration policy. `_journal.json`, migrations 0044/0045, and the `siteflow` database were not modified.

## Verification

- ✅ `pnpm --filter @siteflow/server exec vitest run tests/integration/billing/invoices-tax-refunds.test.ts` — 2/2 passed against PostgreSQL.
- ✅ `pnpm --filter @siteflow/server exec vitest run tests/integration/billing/checkout-portal.test.ts` — 13/13 passed.
- ✅ `pnpm --filter @siteflow/server exec vitest run tests/integration/billing/webhook-inbox.test.ts` — 15/15 passed on an isolated rerun. An earlier concurrently executed run had two transient inbox assertions fail while other integration processes were contending for the shared database; the isolated run passed.
- ✅ Database and shared package typechecks passed.
- ✅ `pnpm --filter @siteflow/server build` passed.
- ✅ ESLint passed on the changed Plan 10-08 source, schema, and test files.
- ⚠️ `pnpm --filter @siteflow/server typecheck` remains blocked by pre-existing diagnostics in `catalog.service.ts` and `trial.routes.ts`, as already tracked in the phase deferred-items record. The final typecheck reported no diagnostics in Plan 10-08 files.
- ✅ Stub scan found no placeholder/TODO/FIXME or empty-data stubs in Plan 10-08 implementation/test files.

## TDD Gate Compliance

- **Task 1 RED:** The focused PostgreSQL test failed before implementation because separate SaaS invoice/payment persistence and reconciler wiring were absent. `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-08-red-evidence.json` passed `gsd-tools check tdd-red-evidence` with `RED_EVIDENCE_OK`; the named target failure was semantically inspected. Commit: `e74a945`.
- **Task 1 GREEN:** Added the dedicated schema, contracts, repository/service, provider retrieval facts, reconciliation wiring, migration, and passing integration behavior. Commit: `f00d74f`.
- **Task 2 RED:** The two-organization PostgreSQL replay test delivered a newer paid invoice followed by an older failure event and failed on the intended assertion: persisted `PAID` status regressed to `OPEN`. `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-08-task2-red-evidence.json` passed the RED evidence classifier and semantic review. Commit: `f5ef11c`.
- **Task 2 GREEN:** Moved the reconciler event-time guard ahead of invoice writes and added stale timestamp conditions to invoice/payment-attempt upserts. The focused invoice suite then passed. Commit: `49f965d`.
- **REFACTOR:** No separate refactor commit was needed; the focused source lint and build passed.

## Task Commits

1. **Task 1 RED: invoice persistence integration test/evidence** — `e74a945` (`test(10-08): add failing SaaS invoice persistence test`)
2. **Task 1 GREEN: verified invoice and payment synchronization** — `f00d74f` (`feat(10-08): synchronize verified SaaS invoice and payment facts`)
3. **Task 2 RED: stale replay/tenant isolation test/evidence** — `f5ef11c` (`test(10-08): prevent stale invoice replay regression`)
4. **Task 2 GREEN: stale invoice and payment guards** — `49f965d` (`feat(10-08): reject stale invoice and payment facts`)

The measured task-commit range is `85abbe1cb9ee05de9532c838079aaf8ee56f2367..49f965d8231937ed9151e666f3d7b9538e2d97d2` (**4 commits**). Plan metadata is committed separately.

## Files Created/Modified

- `packages/database/src/schema/saas-invoice.schema.ts` — dedicated SaaS invoice/payment-attempt schema.
- `packages/database/drizzle/0046_saas_invoice_history.sql` — idempotent additive PostgreSQL migration.
- `packages/shared/src/modules/billing/invoice.schema.ts` — shared invoice/payment history contracts.
- `apps/server/src/modules/billing/invoice.repository.ts` — tenant-qualified provider upserts with stale-fact protection.
- `apps/server/src/modules/billing/invoice.service.ts` — verified fact validation and transactional synchronization.
- `apps/server/src/modules/billing/provider-reconciler.ts` — tenant-mapped invoice event synchronization and event-time guard.
- `apps/server/src/modules/billing/stripe.adapter.ts` — provider invoice snapshot retrieval.
- `apps/server/tests/integration/billing/invoices-tax-refunds.test.ts` — real PostgreSQL replay, tenant isolation, and finance-boundary assertions.

## Decisions Made

- Provider object facts are retrieved through the existing Stripe adapter; invoice event metadata does not determine tenant ownership or persisted invoice amounts/status.
- Persisted customer/subscription associations qualified by Stripe mode determine organization scope; conflicting provider identities are rejected/quarantined.
- Dedicated SaaS invoice/payment tables are kept independent of project construction-finance lifecycles and records.
- The migration procedure follows the approved additive manual SQL policy; no Drizzle journal entry or production-named database operation was made.
- Plan 10-08 completes invoice/payment synchronization only. Conditional Tax remains pending for Plan 10-16, so the compound requirement BILL-07 is not marked complete yet.

## Deviations from Plan

None — the implementation and verification stayed within Plan 10-08 ownership. The stale-event protections are required by the plan's replay-safety acceptance criteria. The approved migration procedure and test-database-only application were followed.

## Issues Encountered

- The Task 2 RED test exposed a real correctness defect: invoice synchronization occurred before the reconciler's subscription event-time high-water check. Moving the check ahead of invoice writes and adding conditional upsert timestamp guards resolved the regression.
- Server-wide typecheck remains blocked by unrelated pre-existing `catalog.service.ts` and `trial.routes.ts` diagnostics. No unrelated files were changed.
- A concurrently executed regression run briefly reported two webhook inbox failures; the webhook inbox suite passed all 15 tests when rerun in isolation against the shared test database.

## User Setup Required

None — no new credentials or external service configuration were required.

## Next Phase Readiness

The local SaaS invoice/payment-history foundation is ready for dependent work. Continue in the requested dependency order with Plans 10-09/10-15 as scheduled; Plan 10-16 owns conditional Tax. This execution stops after Plan 10-08 and does not start Plans 10-09, 10-15, 10-16, or 10-17.

---
*Phase: 10-saas-billing-subscription-management-deliver-secure-organiza*
*Completed: 2026-10-11*

## Self-Check: PASSED

- Summary, RED evidence, integration test, and migration files exist.
- Task commits `e74a945`, `f00d74f`, `f5ef11c`, and `49f965d` are ancestors of the current HEAD.
- The persisted ledger measures 4 task commits from `85abbe1cb9ee05de9532c838079aaf8ee56f2367` through `49f965d8231937ed9151e666f3d7b9538e2d97d2`.
