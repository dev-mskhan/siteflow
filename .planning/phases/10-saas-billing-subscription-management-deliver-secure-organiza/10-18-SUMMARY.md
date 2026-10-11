---
phase: 10-saas-billing-subscription-management
plan: 18
status: complete
requirements: [T-10-31, T-10-32]
---

# Plan 10-18 Summary: Policy-Governed Subscription Lifecycle Actions

## What Was Built

- `packages/shared/src/modules/billing/lifecycle.schema.ts` (new): response contract for the cancel route, exported from `packages/shared/src/index.ts`.
- `apps/server/src/modules/billing/subscription-lifecycle.service.ts` (new): `SubscriptionLifecycleService`.
  - Cancel (unchanged): cancels at period end (D-07). Provider call runs outside the DB transaction; local `cancelAtPeriodEnd` update, `cancel_scheduled` history, and `billing.subscription.cancel_scheduled` audit are written in one transaction. Repeat calls are idempotent with no provider call.
  - Downgrade: schedules the target plan for period end. Invalid direction returns 409 `INVALID_PLAN_CHANGE`. Repeat to the same scheduled plan is idempotent.
  - Upgrade: applies immediately with proration. Target must be higher than current; otherwise 409 `INVALID_PLAN_CHANGE`. Same plan and interval is idempotent. Price resolved from the approved catalog (`price_pro_month_v1`, `price_starter_month_v1`).
  - Pause: always 409 `LIFECYCLE_ACTION_NOT_SUPPORTED` because D-07 marks `customer.subscription.paused` unsupported. No provider call.
  - Reactivate: clears a scheduled cancel. With no scheduled cancel it is an idempotent no-op (200, `idempotent: true`, no provider call), consistent with D-02 and other idempotent actions.
- `apps/server/src/modules/billing/lifecycle.routes.ts` (new): `POST /api/v1/organizations/:organizationId/billing/subscription/{cancel,downgrade,upgrade,pause,reactivate}`, guarded by `authenticate`, `organizationContext`, and `requirePermission('billing:manage')` (Organization Admin only).
- `apps/server/src/app/index.ts`: registers the lifecycle routes.
- `apps/server/tests/integration/billing/lifecycle.test.ts` (new): 23 integration tests covering all five actions, RBAC, idempotency, and provider-failure leaves local state unchanged.

## Verification

- `pnpm --filter @siteflow/server test -- lifecycle`: `tests/integration/billing/lifecycle.test.ts` passes (23 declared tests).
- `pnpm --filter @siteflow/server test -- catalog-entitlements`: 18 passed, 0 failed (regression).
- Full `pnpm --filter @siteflow/server test -- lifecycle catalog-entitlements` reports 1 failed file out of 6: `tests/integration/reporting/export-lifecycle.test.ts` (F.17B export lifecycle). Matched the `lifecycle` filter but is outside billing; that file and its reporting module are unmodified by this plan, so the failure is pre-existing and was not fixed here.
- Typecheck: no errors in the new or changed lifecycle files. The 11 pre-existing errors in catalog.service.ts, invoice.routes.ts, and trial.routes.ts are untouched.
- Migrations: none. No schema change was needed, so `siteflow_test` and the dev `siteflow` DB were not modified and the database package was not rebuilt.
- Evidence: `10-18-verification-evidence.json`.

## Deviations

- The plan listed `lifecycle.service.ts`. The implementation uses a new `subscription-lifecycle.service.ts` to keep the cancel logic separate from the existing lifecycle policy module.
- Pause is intentionally a 409 refusal (D-07: `customer.subscription.paused` unsupported).
- Reactivation without a scheduled cancel is an idempotent no-op rather than a 409 (D-02 idempotency pattern).

## Unverified

- Live Stripe `cancel_at_period_end` call: UNVERIFIED. Requires live Stripe credentials and the SDK approval gate (Plan 10-10). The provider call is covered by a mocked adapter spy only.
- Webhook reconciliation of the cancellation back into local state: UNVERIFIED. Needs a real Stripe webhook delivery.
- Real SMTP notification and ngrok acceptance: UNVERIFIED. Not in scope for this route and not exercised.

## Self-Check

- Files changed: `subscription-lifecycle.service.ts`, `lifecycle.routes.ts`, `lifecycle.test.ts` (modified in this run and committed in the 10-18 lifecycle commit); `lifecycle.schema.ts` (new); `apps/server/src/app/index.ts`, `packages/shared/src/index.ts` (modified); evidence JSON and this summary.
- Migrations: none. No DB schema change was required, so `siteflow_test` and dev `siteflow` were not modified.
- `.planning/config.json`, `state.json`, and `milestone.lock` were not modified or staged.
