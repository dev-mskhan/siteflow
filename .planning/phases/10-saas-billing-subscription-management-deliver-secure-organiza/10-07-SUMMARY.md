---
phase: "10-saas-billing-subscription-management-deliver-secure-organiza"
plan: "07"
subsystem: billing/webhooks
tags: [stripe, webhooks, fastify, raw-body, postgres, inbox, idempotency]

requires:
  - "10-06: validated Stripe adapter and mode-separated webhook signing secrets"
provides:
  - "Raw-byte signed Stripe webhook ingress at /api/v1/webhooks/stripe"
  - "Unique durable inbound webhook inbox with pending/retry state and due-scan indexes"
affects: [billing, stripe, apps/server, plan-10-14, plan-10-10]

actuals:
  tokens: 7372
  tasks: 1
  commits: 2
plan_head_before: d882afd64abe458a0a79d01627e9890c08adbc9d
plan_head_after: defbe0278008c083fa9c9c794101992f4cd8e29c
commits: 2

tech-stack:
  added: []
  patterns:
    - "Route-encapsulated Fastify JSON parser retains raw Buffer only for Stripe webhook ingress"
    - "Inbound provider identity is deduplicated in PostgreSQL independently of the outbound outbox"

key-files:
  created:
    - apps/server/src/modules/billing/webhook.routes.ts
    - apps/server/src/modules/billing/webhook-inbox.repository.ts
    - packages/database/src/schema/saas-webhook-inbox.schema.ts
    - packages/database/drizzle/0045_saas_webhook_inbox.sql
    - apps/server/tests/integration/billing/webhook-inbox.test.ts
    - .planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-07-red-evidence.json
  modified:
    - apps/server/src/app/index.ts
    - apps/server/src/modules/billing/stripe.adapter.ts
    - apps/server/tests/unit/billing/stripe-adapter.test.ts
    - apps/server/vitest.config.ts
    - packages/database/src/schema/index.ts

key-decisions:
  - "Verify the untouched Buffer through Stripe's approved SDK helper before inspecting event fields or writing the inbox."
  - "Persist only event identity/type/time, mode, and bounded Stripe object reference; never retain payload or metadata."
  - "A duplicate uses a unique-conflict no-op, preserving pending/retry state and retry eligibility."

requirements-completed: [BILL-06]

coverage:
  - id: D1
    description: "A valid Stripe signature over original raw request bytes is verified and durably recorded before a 200 acknowledgement."
    requirement: BILL-06
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#accepts an event signed over the exact original raw bytes and persists it before acknowledgement"
        status: pass
    human_judgment: false
  - id: D2
    description: "Missing, invalid, or body-mismatched signatures are rejected without an inbox row."
    requirement: BILL-06
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#rejects a delivery with no Stripe-Signature before persisting an inbox event"
        status: pass
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#rejects an invalid Stripe signature before persisting an inbox event"
        status: pass
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#rejects a request whose raw bytes differ from the signed payload"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unique provider event identity safely acknowledges duplicates without changing retry state."
    requirement: BILL-06
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#acknowledges duplicate event IDs without duplicating or terminating retryable state"
        status: pass
    human_judgment: false
  - id: D4
    description: "The unauthenticated provider endpoint documents its required signature header and accepts only supported billing events."
    requirement: BILL-06
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#publishes the unauthenticated Stripe endpoint and signature header in OpenAPI"
        status: pass
      - kind: integration
        ref: "apps/server/tests/integration/billing/webhook-inbox.test.ts#acknowledges signed but unsupported event types without storing them"
        status: pass
    human_judgment: false

duration: 23 min
completed: 2026-10-11
status: complete
---

# Phase 10 Plan 07: Signed Stripe Webhook Inbox Summary

**Raw-byte Stripe signature verification now gates a durable, deduplicated PostgreSQL inbox; supported event evidence is minimized and remains retryable for Plan 10-14.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-10-11T09:53:25Z
- **Completed:** 2026-10-11T10:16:48Z
- **Tasks:** 1
- **Files modified or added:** 11

## Accomplishments

- Registered the unauthenticated `POST /api/v1/webhooks/stripe` endpoint with a route-encapsulated Fastify `application/json` parser that preserves the original Buffer. Stripe SDK verification occurs before event inspection or database access.
- Added a bounded, metadata-free event contract for subscription created/updated/deleted and invoice paid/payment-failed events. Unsupported verified event types are acknowledged but not persisted; event metadata never supplies tenant identity.
- Added a PostgreSQL inbox with unique `(provider, provider_event_id)`, pending/retry statuses, attempt and eligibility timestamps, bounded error/reference columns, and indexes for pending/due scans. Conflict no-op keeps existing retry state unchanged.
- Added OpenAPI documentation and real PostgreSQL/Fastify integration coverage for valid signatures, missing/invalid/mismatched bytes, duplicates, unsupported events, and the unauthenticated route contract.
- Added migration `0045_saas_webhook_inbox.sql` without modifying `_journal.json`. Applied and re-applied only that SQL file against `siteflow_test`; the DDL was idempotent. Read-only probes confirmed the production-named `siteflow` database was not migrated.

## Verification

- ✅ Exact plan integration command: `pnpm --filter @siteflow/server exec vitest run tests/integration/billing/webhook-inbox.test.ts` — 7/7 passed against real Fastify and `siteflow_test`.
- ✅ Combined webhook plus Checkout/Portal regression suites — 20/20 passed.
- ✅ Stripe adapter unit tests — 8/8 passed, including SDK signature verification with a signing secret and no Stripe API key.
- ✅ Database package build and typecheck; server build.
- ✅ ESLint on changed implementation/tests — 0 errors. It reported the pre-existing `no-explicit-any` warning in the rate-limit callback in `apps/server/src/app/index.ts`.
- ⚠️ Server typecheck remains blocked by existing diagnostics in `catalog.service.ts` and `trial.routes.ts`; no diagnostics were reported in Plan 10-07 files. This is already recorded in the phase `deferred-items.md`.
- ✅ Schema verification confirmed the table and all three indexes in `siteflow_test`; `siteflow` still has no webhook inbox table.
- ✅ Stub scan found no TODO/FIXME/placeholder/empty-data stubs in changed implementation or test files.

## TDD Gate Compliance

- **RED:** The complete TAP report in `10-07-red-evidence.json` records all seven planned integration cases failing on the absent route (target assertion: expected 200, received 404). `gsd_run check tdd-red-evidence ... --raw` returned `RED_EVIDENCE_OK`; semantic inspection confirmed the target executed and failed on the intended behavior.
- **GREEN:** `defbe02` added raw-byte verification, route registration, durable inbox schema/repository, and migration. The focused PostgreSQL suite passed 7/7.
- **REFACTOR:** No separate refactor was required.

## Task Commits

1. **Task 1 RED: webhook inbox integration coverage** — `fdbce97` (`test(10-07): add failing webhook inbox integration coverage`)
2. **Task 1 GREEN: signed webhook ingress and inbox** — `defbe02` (`feat(10-07): add signed Stripe webhook inbox`)

The measured plan task-commit range is `d882afd64abe458a0a79d01627e9890c08adbc9d..defbe0278008c083fa9c9c794101992f4cd8e29c` (2 commits).

## Decisions Made

- The webhook verifier uses `Stripe.webhooks.constructEvent` directly, so receiving a webhook requires the validated mode-specific signing secret but does not require an unrelated Stripe API key.
- Inbox evidence is limited to provider event identity/type/creation time, live-mode bit, and bounded object type/ID. Raw JSON and metadata are not persisted.
- Retry work remains a pending/retry ledger concern. Plan 10-14 owns scanning, leases, worker processing, and reconciliation; none was implemented here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking test configuration] Added non-production Stripe test fixtures**
- **Found during:** Task 1 verification
- **Issue:** The established test environment had no `STRIPE_TEST_WEBHOOK_SECRET`; the existing Plan 10-13 Portal regression also lacked its required `STRIPE_PORTAL_CONFIGURATION_ID` fixture.
- **Fix:** Added a public synthetic signing-secret fixture and the expected test Portal configuration ID to Vitest-only environment settings. No real credentials were added.
- **Files modified:** `apps/server/vitest.config.ts`
- **Verification:** The webhook suite passed with generated signatures; Checkout and Portal regression suite passed with all 13 tests.
- **Committed in:** `fdbce97`

**Total deviations:** 1 auto-fixed (Rule 3).
**Impact on plan:** Test-only fixtures enabled deterministic signature verification and preserved the prior Portal contract without changing production configuration or widening implementation scope.

## Issues Encountered

- Fastify validates required headers before route handlers by default. The webhook route uses `attachValidation` to keep the OpenAPI-required signature header while returning the intended safe 400 for a missing signature.
- Raw SQL timestamp columns arrive as strings through the test query path; assertions parse the timestamp rather than assuming a JavaScript `Date`.
- The server-wide typecheck still fails only on pre-existing billing catalog/trial diagnostics documented by Plan 10-13. These unrelated errors were not changed.

## User Setup Required

None for this local implementation. Test Mode Dashboard/ngrok acceptance remains owned by Plan 10-10.

## Next Phase Readiness

Plan 10-07 is complete. Continue with Plan 10-14, which owns durable scans, recovery, provider reconciliation, and worker registration. Plan 10-14 remains pending; this plan added no worker or entitlement mutation.

`BILL-06` is shared with Plan 10-14, so its global requirements checkbox remains pending until that dependent plan is complete.

---
*Phase: 10-saas-billing-subscription-management-deliver-secure-organiza*
*Completed: 2026-10-11*

## Self-Check: PASSED

- All listed source, schema, migration, test, RED evidence, and summary files exist.
- Both task commits (`fdbce97`, `defbe02`) are ancestors of the current branch HEAD.
- The persisted plan ledger measures 2 task commits from `d882afd64abe458a0a79d01627e9890c08adbc9d` through `defbe0278008c083fa9c9c794101992f4cd8e29c`.
- RED evidence and all four coverage entries pass their GSD validators.
