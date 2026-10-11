---
phase: 10-saas-billing-subscription-management
plan: 16
status: partial
requirements: [T-10-28]
---

# Plan 10-16 Summary: Conditional Stripe Tax Through the Adapter

## What Was Built

- `apps/server/src/modules/billing/tax.policy.ts` (new): pure branch policy and fact verifier.
  - `decideTaxBranch`: returns `CALCULATE`, `NOT_CALCULATED`, or `FAIL`. Disabled or unconfigured Tax fails explicitly when required and is skipped when optional. An unsupported jurisdiction follows the same rule. Tax is never inferred as zero or exempt.
  - `verifyTaxCalculationFacts`: rejects calculations with an empty id, currency mismatch, unsafe or negative amounts, expired `expires_at`, or positive tax without jurisdiction countries. Countries are read from `tax_breakdown[].tax_rate_details.country`.
- `apps/server/src/modules/billing/stripe.adapter.ts`: `StripeTaxCalculationSnapshot` now includes `tax_amount_exclusive`, `tax_amount_inclusive`, and `tax_date`.
- Tests: 6 Stripe Tax policy tests in `invoices-tax-refunds.test.ts`, 8 adapter unit tests in `stripe-adapter.test.ts`, and 8 new persistence tests in `tests/unit/billing/invoice-tax-persistence.test.ts`.
- Persistence (added): nullable `tax_calculation_id`, `tax_amount_cents`, `tax_currency`, `tax_jurisdiction_countries` columns on `saas_invoices`, guarded by check `saas_invoices_tax_facts_check`. Migration `packages/database/drizzle/0048_saas_invoice_tax_facts.sql` (hand-written, not in journal). `InvoiceService.synchronizeVerifiedInvoice` takes `taxFacts` (verified only) and persists them; absent or not-calculated Tax writes NULLs, never zero. Invalid facts are rejected before any write.
- Note: a NOT_CALCULATED event overwrites earlier tax columns with NULL on each applied event (monotonic upsert).

## Verification

- `pnpm --filter @siteflow/server exec vitest run tests/unit/billing/invoice-tax-persistence.test.ts tests/unit/billing/stripe-adapter.test.ts tests/integration/billing/invoices-tax-refunds.test.ts`: 28 passed across 3 files.
- Migration 0048 applied to `siteflow_test` (4/4 columns and constraint present).
- Migration 0048 NOT applied to dev `siteflow`: that DB has no `saas_invoices` table, so earlier saas invoice migrations were never applied there. Creating it is out of scope.
- Typecheck of changed files: 0 errors. 11 pre-existing errors remain in catalog.service.ts, invoice.routes.ts, and trial.routes.ts, untouched.
- Evidence: `10-16-verification-evidence.json`.

## Deviations

- Separate RED run not captured; the policy file was written before the test block.

## Unverified

- Live Stripe Tax calculation and jurisdiction acceptance: UNVERIFIED, gated by Plan 10-10 and the SDK approval gate.
- Dev DB migration 0048: blocked until the saas invoice schema exists in dev.
- Source of the account-level Stripe Tax enabled/configured state: no adapter retrieve exists, so it is an explicit input.


## Self-Check

- Files changed: 4 (`tax.policy.ts` new; `stripe.adapter.ts`; two test files).
- No commits, no pushes. `.planning/config.json`, `state.json`, and `milestone.lock` were not modified by this work. `milestone.lock` appears untracked in git status and predates these changes.
