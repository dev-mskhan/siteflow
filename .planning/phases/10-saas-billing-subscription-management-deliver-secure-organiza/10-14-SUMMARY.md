---
phase: "10-saas-billing-subscription-management-deliver-secure-organiza"
plan: "14"
subsystem: billing/webhooks
tags: [stripe, postgres, pgboss, durable-inbox, reconciliation, retries]

requires:
  - "10-07: signed raw-byte Stripe webhook ingress and durable pending inbox"
provides:
  - "Startup and recurring recovery of acknowledged Stripe webhook inbox events"
  - "Leased, bounded, retryable PostgreSQL event claims safe for concurrent workers"
  - "Tenant-qualified Stripe current-object reconciliation with replay and event-order protection"
affects: [billing, stripe, plan-10-08, plan-10-10]

actuals:
  tokens: 13936
  tasks: 1
  commits: 2
plan_head_before: 3911c50518523bbeaa4d0c8467ac50804b3f9445
plan_head_after: a9b9eaac4fc964649630949c468202b4a0c83a0a

tech-stack:
  added: []
  patterns:
    - "PostgreSQL FOR UPDATE SKIP LOCKED claims with persisted processing leases and capped exponential retry"
    - "Provider reads outside transactions followed by customer-locked tenant-qualified idempotent writes"
    - "A local event-time high-water mark prevents a late older reconciliation from overwriting newer accepted state"

key-files:
  created:
    - apps/server/src/modules/billing/provider-reconciler.ts
    - apps/server/src/modules/billing/webhook.worker.ts
    - .planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-14-validation-evidence.json
  modified:
    - apps/server/src/modules/billing/webhook-inbox.repository.ts
    - apps/server/src/modules/billing/customer.repository.ts
    - apps/server/src/modules/billing/stripe.adapter.ts
    - apps/server/src/worker-registration.ts
    - apps/server/tests/integration/billing/webhook-inbox.test.ts
    - apps/server/tests/unit/billing/stripe-adapter.test.ts

key-decisions:
  - "Recover directly from the inbox at startup and on a one-minute PgBoss schedule; the inbox scan, not an enqueue, is the source of truth."
  - "Persist the latest reconciled Stripe event creation time in existing subscription metadata to guard against late older work without a schema migration."
  - "Resolve tenants only through persisted, mode-qualified SiteFlow customer/subscription associations; never trust provider event metadata for ownership."

requirements-completed: [BILL-06]

coverage:
  - id: D1
    description: "Acknowledged pending inbox rows are recovered at worker startup and through the registered recurring one-minute scan."
    requirement: BILL-06
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#recovers an acknowledged pending event during worker restart and registers a durable one-minute scan"
        status: pass
    human_judgment: false
  - id: D2
    description: "Provider outages and expired processing leases remain durably retryable with bounded backoff and terminal attempt limits."
    requirement: BILL-06
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#persists provider outages as retry-due work and later converges from the current object"
        status: pass
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#recovers an expired processing lease after a worker crash"
        status: pass
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#stops retrying after the bounded attempt limit while retaining a durable terminal failure"
        status: pass
    human_judgment: false
  - id: D3
    description: "Current-object reconciliation is tenant-mapped, replay-safe, and protects local state from duplicate or late older event work."
    requirement: BILL-06
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#uses the provider current object for stale events and does not duplicate local history or audit on replay"
        status: pass
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#does not let a late older reconciliation overwrite a state already accepted from a newer event"
        status: pass
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#quarantines unknown provider mappings without trusting event metadata"
        status: pass
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#serializes concurrent events for one provider subscription into one history and audit transition"
        status: pass
    human_judgment: false

duration: 31 min
completed: 2026-10-11
status: complete
---

# Phase 10 Plan 14: Durable Webhook Recovery and Reconciliation Summary

**Acknowledged Stripe inbox events now recover through startup and one-minute PgBoss scans, with leased bounded retries and tenant-safe current-object reconciliation that resists replay and late-event regression.**

## Performance

- **Duration:** 31 min from the RED task commit through GREEN verification.
- **Started:** 2026-10-11T10:44:23Z
- **Completed:** 2026-10-11T11:15:48Z
- **Tasks:** 1
- **Files modified or added:** 10 implementation, test, and validation-evidence files (plus this summary).

## Accomplishments

- Added bounded, indexed PostgreSQL inbox claims using `FOR UPDATE SKIP LOCKED`; persisted ten-minute processing leases make crashed claims eligible for recovery.
- Registered a Stripe webhook recovery worker that scans immediately at worker startup and runs through PgBoss on the recurring `* * * * *` schedule.
- Added durable retry state with exponential backoff capped at one hour and a terminal limit of eight attempts.
- Reconciled Stripe's current subscription and invoice-linked subscription facts outside database transactions, then applied tenant-qualified state, history, and audit changes in a customer-locked transaction.
- Resolved organizations only through persisted Stripe customer associations qualified by mode; unknown or conflicting associations are quarantined. Event metadata is not used for tenant assignment.
- Persisted an event-time high-water marker in the existing subscription metadata so a late older reconciliation cannot overwrite state already accepted from a newer event.
- Added real PostgreSQL/Fastify coverage for acknowledged-event recovery, outages, leases, replay idempotency, current-state ordering, metadata-resistant quarantine, concurrent claims, bounded attempts, and schedule registration.
- Made no database schema or migration changes. `_journal.json`, migration 0044/0045, and the production-named `siteflow` database were untouched.

## Verification

- ✅ Exact plan integration command: `pnpm --filter @siteflow/server exec vitest run tests/integration/billing/webhook-inbox.test.ts` — **15/15 passed** against the configured PostgreSQL test environment.
- ✅ Stripe adapter unit tests: `pnpm --filter @siteflow/server exec vitest run tests/unit/billing/stripe-adapter.test.ts` — **8/8 passed**.
- ✅ ESLint on changed Plan 10-14 implementation and tests — passed with no reported lint errors.
- ✅ `pnpm --filter @siteflow/server build` — succeeded.
- ⚠️ `pnpm --filter @siteflow/server typecheck` — remains blocked by pre-existing errors exclusively in `catalog.service.ts` and `trial.routes.ts`; it reported no diagnostics in Plan 10-14 files. These unrelated blockers are recorded in the phase `deferred-items.md` and were not modified.
- ✅ Validation evidence records PgBoss queue `billing:stripe-webhook-recovery`, schedule identifier `siteflow-stripe-webhook-inbox-recovery-v1`, cron `* * * * *`, and recovery interval `1 minute`.
- ✅ Stub scan found no TODO/FIXME/placeholder/empty-data stubs in the implementation and tests.

## TDD Gate Compliance

- **RED:** The focused PostgreSQL restart-recovery target failed on the absent worker entry point, as recorded in `10-14-red-evidence.json`; the prior execution returned `RED_EVIDENCE_OK` after semantic inspection.
- **GREEN:** The worker, repository, reconciler, registration, and added ordering guard were implemented; the full webhook integration suite passed 15/15 and adapter unit suite passed 8/8.
- **REFACTOR:** No separate refactor commit was needed after verification.

## Task Commits

1. **Task 1 RED: webhook recovery integration coverage** — `d644664` (`test(10-14): add failing webhook recovery integration coverage`)
2. **Task 1 GREEN: durable webhook recovery and reconciliation** — `a9b9eaa` (`feat(10-14): add durable Stripe webhook recovery and reconciliation`)

The measured task-commit range is `3911c50518523bbeaa4d0c8467ac50804b3f9445..a9b9eaac4fc964649630949c468202b4a0c83a0a` (**2 commits**). Plan metadata is committed separately.

## Decisions Made

- The durable inbox scan is the recovery source of truth; recovery does not rely on an in-memory or PgBoss handoff succeeding after webhook acknowledgement.
- Provider network reads happen before opening local transactions. A customer association row lock serializes local subscription changes for the mapped tenant.
- Existing subscription JSON metadata stores a local event-time high-water value, avoiding a new column or migration while preventing older accepted work from regressing local state.
- Existing Stripe event/inbox fields and customer mappings are sufficient; no raw event metadata is persisted or used for ownership.

## Deviations from Plan

None — the extra customer lookup and subscription-item fields in the repository/Stripe adapter support the plan's required persisted tenant mapping and current-price reconciliation. No schema, endpoint, or later-plan behavior was added.

## Issues Encountered

- Server-wide typecheck remains blocked by the pre-existing billing catalog and trial route diagnostics described above. Focused integration tests, adapter unit tests, lint, and the server build all passed.
- PgBoss schedule identity is passed through its supported `singletonKey` option; the integration test asserts the schedule identifier and one-minute cron.
- The GSD requirement marker did not recognize this repository's plain-text requirement ID formatting. Its readiness check confirmed `BILL-06` is complete and `BILL-07` is blocked by the still-pending Plan 10-08; only `BILL-06` is marked complete because invoice/payment record synchronization remains out of scope for this plan.

## User Setup Required

None. No new external configuration or credentials are required.

## Next Phase Readiness

Plan 10-14 is complete. `BILL-07` remains pending for Plan 10-08, which owns invoice/payment record synchronization. Per the requested Phase 10 dependency order, continue with Plan 10-08. This execution stopped after Plan 10-14.

---
*Phase: 10-saas-billing-subscription-management-deliver-secure-organiza*
*Completed: 2026-10-11*

## Self-Check: PASSED

- Summary, validation evidence, RED evidence, implementation, and test files all exist.
- Task commits `d644664` and `a9b9eaa` are ancestors of the current branch HEAD.
- The persisted plan ledger measures 2 task commits from `3911c50518523bbeaa4d0c8467ac50804b3f9445` through `a9b9eaac4fc964649630949c468202b4a0c83a0a`.
