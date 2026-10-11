---
phase: 10-saas-billing-subscription-management
plan: 17
status: partial
requirements: [T-10-29, T-10-30]
---

# Plan 10-17 Summary: Persist Verified Provider Refund History

## What Was Built

- `packages/database/src/schema/saas-refund-history.schema.ts` (new): `saasRefunds` (unique on `stripe_mode, stripe_refund_id`, FKs to organizations and saas_invoices, check constraints) and `saasRefundEvents` (append-only replay log, unique on `stripe_mode, source_event_id`).
- `packages/database/src/schema/index.ts`: exports the new schema.
- `packages/database/drizzle/0049_saas_refund_history.sql` (new): additive and idempotent, hand-written, not in the Drizzle journal (same convention as 0048).
- `apps/server/src/modules/billing/refund-history.repository.ts` (new): `verifyRefundFact` (rejects invalid facts before any write), `RefundHistoryRepository.assertInvoiceBelongsToOrganization`, and `recordVerifiedRefund` (monotonic upsert plus idempotent event log).
- `apps/server/src/modules/billing/provider-reconciler.ts`: exports `reconcileVerifiedRefundFact`. It resolves the tenant from the stored customer association (never provider metadata), verifies the invoice belongs to that org and mode, and writes only refund history inside a transaction. It never touches subscriptions or entitlements.
- Tests: 6 new 10-17 cases in `invoices-tax-refunds.test.ts` (persist, replay, monotonic, cross-tenant rejection, unknown customer quarantine, no subscription change).

## Verification

- `pnpm --filter @siteflow/server exec vitest run tests/integration/billing/invoices-tax-refunds.test.ts`: 18 passed, 0 failed.
- Migration 0049 applied to `siteflow_test` and dev `siteflow`; both show `saas_refunds` and `saas_refund_events`.
- `pnpm --filter @siteflow/database build`: success.
- Typecheck: 0 errors in changed files. 11 pre-existing errors remain in catalog.service.ts, invoice.routes.ts, and trial.routes.ts, untouched.
- Evidence: `10-17-verification-evidence.json`.

## Deviations

- Refund mutation route not registered. Recorded as OPT-OUT: no existing privileged supra-org staff authority is source-verified. Platform Admin is Phase 2+ and unimplemented.

## Unverified

- Live Stripe refund webhook events: UNVERIFIED. Refund event types are not in the webhook allowlist, and live provider work is gated by Plan 10-10 and the SDK approval gate. The dispatch function is proven by integration tests only.
- Refund initiation: OPT-OUT, see above.

## Self-Check

- Files changed: `provider-reconciler.ts`, `invoices-tax-refunds.test.ts`, `schema/index.ts` (modified); `saas-refund-history.schema.ts`, `0049_saas_refund_history.sql`, `refund-history.repository.ts`, evidence JSON, and this summary (new).
- `.planning/config.json`, `state.json`, and `milestone.lock` were not modified or staged.
