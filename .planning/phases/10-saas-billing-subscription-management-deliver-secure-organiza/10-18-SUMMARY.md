---
phase: 10-saas-billing-subscription-management
plan: 18
status: partial
requirements: [T-10-31, T-10-32]
---

# Plan 10-18 Summary: Policy-Governed Subscription Cancel Route

## What Was Built

- `packages/shared/src/modules/billing/lifecycle.schema.ts` (new): response contract for the cancel route, exported from `packages/shared/src/index.ts`.
- `apps/server/src/modules/billing/subscription-lifecycle.service.ts` (new): `SubscriptionLifecycleService.scheduleCancellation`. Cancels at period end (D-07). The provider call runs outside the DB transaction, then the local `cancelAtPeriodEnd` update, history row (`cancel_scheduled`), and audit row (`billing.subscription.cancel_scheduled`) are written in one transaction. Repeat calls are idempotent and make no provider call.
- `apps/server/src/modules/billing/lifecycle.routes.ts` (new): `POST /api/v1/organizations/:organizationId/billing/subscription/cancel`, guarded by `authenticate`, `organizationContext`, and `requirePermission('billing:manage')` (Organization Admin only).
- `apps/server/src/app/index.ts`: registers the lifecycle routes.
- `apps/server/tests/integration/billing/lifecycle.test.ts` (new): 7 integration tests.

## Verification

- `pnpm --filter @siteflow/server exec vitest run tests/integration/billing/lifecycle.test.ts`: 7 passed, 0 failed.
- `pnpm --filter @siteflow/server exec vitest run tests/integration/billing/catalog-entitlements.test.ts` (regression): 18 passed, 0 failed.
- Combined: 25 passed, 0 failed.
- Typecheck: no errors in the new or changed lifecycle files. The 11 pre-existing errors in catalog.service.ts, invoice.routes.ts, and trial.routes.ts are untouched.
- Migrations: none. No schema change was needed, so `siteflow_test` and the dev `siteflow` DB were not modified and the database package was not rebuilt.
- Evidence: `10-18-verification-evidence.json`.

## Deviations

- The plan listed `lifecycle.service.ts`. The implementation uses a new `subscription-lifecycle.service.ts` to keep the cancel logic separate from the existing lifecycle policy module.
- Downgrade at period end, upgrade with proration, pause handling, and reactivation are NOT implemented in this plan. Downgrade needs Stripe subscription schedules, which the adapter does not expose. Upgrade needs proration and catalog price resolution. Reactivation goes through Checkout only (D-02). These are deferred and this plan is `partial`.

## Unverified

- Live Stripe `cancel_at_period_end` call: UNVERIFIED. Requires live Stripe credentials and the SDK approval gate (Plan 10-10). The provider call is covered by a mocked adapter spy only.
- Webhook reconciliation of the cancellation back into local state: UNVERIFIED. Needs a real Stripe webhook delivery.
- Real SMTP notification and ngrok acceptance: UNVERIFIED. Not in scope for this route and not exercised.

## Self-Check

- Files changed: `subscription-lifecycle.service.ts`, `lifecycle.routes.ts`, `lifecycle.test.ts`, `lifecycle.schema.ts` (new); `apps/server/src/app/index.ts`, `packages/shared/src/index.ts` (modified); evidence JSON and this summary (new).
- `.planning/config.json`, `state.json`, and `milestone.lock` were not modified or staged.
