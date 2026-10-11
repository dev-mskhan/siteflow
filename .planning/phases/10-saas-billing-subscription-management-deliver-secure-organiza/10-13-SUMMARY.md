---
phase: "10-saas-billing-subscription-management-deliver-secure-organiza"
plan: "13"
subsystem: billing/portal
tags: [stripe, customer-portal, rbac, tenant-isolation, fastify, zod, postgres]

requires:
  - "10-12: mode-scoped persisted Stripe customer associations and hosted Checkout"
provides:
  - "Tenant-authorized restricted Customer Portal session endpoint"
  - "Fail-closed Stripe Portal configuration feature validation"
affects: [billing, stripe, apps/server, plan-10-07]

actuals:
  tokens: 7309.25
  tasks: 1
  commits: 2
plan_head_before: 5b1d3606877eb844fa39437950e64c420d2f74d7
plan_head_after: 4fc380477ac59e16eed6a2db680662e121c0e036
commits: 2

tech-stack:
  added: []
  patterns: [mode-scoped-customer-lookup, provider-configuration-allowlist, fastify-integration-tests]

key-files:
  created:
    - apps/server/src/modules/billing/portal.routes.ts
    - .planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-13-red-evidence.json
    - .planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/deferred-items.md
  modified:
    - apps/server/src/modules/billing/stripe.adapter.ts
    - apps/server/src/app/index.ts
    - apps/server/tests/integration/billing/checkout-portal.test.ts
    - apps/server/tests/unit/billing/stripe-adapter.test.ts
    - packages/env/src/server.ts

key-decisions:
  - "Reuse billing:manage for the combined payment-method mutation and invoice-history Portal; source grants it to Organization Admin, while Finance has billing:read only."
  - "Require an explicit Stripe Portal configuration ID and retrieve/validate its active feature set before session creation."
  - "Resolve Stripe customers only by authenticated organization ID and current Stripe mode; never create a customer as a Portal side effect."

patterns-established:
  - "Stripe Billing Portal session creation fails closed unless its explicit configuration enables payment-method updates and invoice history only."
  - "Reject unrecognized provider Portal feature keys to prevent newly introduced mutation capabilities from silently becoming available."

requirements-completed: [BILL-05, BILL-09]

coverage:
  - id: D1
    description: "Organization Admin receives a Portal URL for its persisted customer; unauthenticated, Finance, cross-tenant, missing-customer, and wrong-mode requests are denied before provider session creation."
    requirement: BILL-05
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/checkout-portal.test.ts#SaaS Billing — Restricted Customer Portal (10-13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stripe Portal configuration must be active, allow payment methods and invoices, and disable customer updates and subscription changes/cancellation; unknown features fail closed."
    requirement: BILL-05
    verification:
      - kind: unit
        ref: "apps/server/tests/unit/billing/stripe-adapter.test.ts#StripeAdapter"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Portal route is registered and publishes its response contract through OpenAPI."
    requirement: BILL-09
    verification:
      - kind: integration
        ref: "apps/server/tests/integration/billing/checkout-portal.test.ts#publishes the restricted Portal endpoint and response contract in OpenAPI"
        status: pass
    human_judgment: false

duration: 38min
completed: 2026-10-11
status: complete
---

# Phase 10 Plan 13: Restricted Customer Portal Summary

**Tenant-authorized Stripe Customer Portal sessions with payment-method and invoice access only, guarded by live configuration verification.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-10-11T09:06:30Z
- **Completed:** 2026-10-11T09:44:53Z
- **Tasks:** 1
- **Files modified or added:** 7 implementation/test/evidence files

## Accomplishments

- Registered `POST /api/v1/organizations/:organizationId/billing/portal` behind authentication, organization membership, and `billing:manage`.
- Confirmed the permission source: Organization Admin has `billing:manage`; Finance has `billing:read` only. No new RBAC permission was needed.
- Looked up the Stripe customer using only the authenticated organization and active Stripe mode; an absent mapping returns not found without creating a customer.
- Required an explicit `STRIPE_PORTAL_CONFIGURATION_ID`. The Stripe adapter retrieves that provider configuration before creating a session and fails closed unless it is active, payment-method updates and invoice history are enabled, and customer updates, subscription updates, and cancellation are disabled.
- Rejected unknown configuration feature keys, so a future provider feature such as pause cannot silently expand the Portal allowlist.
- Added Fastify/OpenAPI schemas and integration checks for the success response, error cases, malformed tenant IDs, and documented contract.

## Verification

- ✅ Real Fastify/PostgreSQL integration suite: `checkout-portal.test.ts` — 13 passed, including prior Checkout regression cases.
- ✅ Stripe adapter unit suite — 8 passed; tests reject cancellation, customer updates, disabled payment/invoice access, and unknown mutation features.
- ✅ Server bundle build passed.
- ✅ Shared environment package typecheck passed.
- ✅ ESLint on changed environment schema passed. Server ESLint had no errors; it reported one pre-existing warning at `apps/server/src/app/index.ts:79`.
- ⚠️ Server typecheck remains blocked by existing diagnostics in `catalog.service.ts` and `trial.routes.ts`; no diagnostics pointed to Plan 10-13 files.
- ✅ No database migration or Drizzle journal changes were made; `siteflow` was not targeted.
- ✅ Stub scan found no TODO, FIXME, placeholder, or empty-data UI stubs in changed implementation/test files.

## TDD Gate Compliance

- **RED:** Added integration behavior tests first. `10-13-red-evidence.json` records the actual TAP-flat run and semantic assessment; the canonical `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` for the target test failing on the unregistered endpoint.
- **GREEN:** Added the route, explicit Stripe configuration verification, environment validation, and adapter tests. The full integration and adapter unit suites passed.
- **REFACTOR:** No separate refactor was needed.

## Task Commits

1. **Task 1 RED: restricted Portal integration coverage** — `75d34a6` (`test(10-13): add restricted Portal integration coverage`)
2. **Task 1 GREEN: restricted Portal route and provider allowlist** — `4fc3804` (`feat(10-13): add strictly restricted Customer Portal`)

Both task commits include the required Copilot co-author trailer. The measured task commit range is recorded in `plan_head_before` and `plan_head_after` above.

## Files Created/Modified

- `apps/server/src/modules/billing/portal.routes.ts` — authenticated, permission-gated route resolving only the current org/mode customer association.
- `apps/server/src/modules/billing/stripe.adapter.ts` — reads and validates the exact active Portal feature allowlist before provider session creation.
- `apps/server/src/app/index.ts` — registers the Portal route.
- `packages/env/src/server.ts` — validates the explicit Portal configuration ID.
- `apps/server/tests/integration/billing/checkout-portal.test.ts` — real app/database access, deny cases, mapping, mode isolation, validation, and OpenAPI coverage.
- `apps/server/tests/unit/billing/stripe-adapter.test.ts` — provider-configuration allowlist and fail-closed behavior.
- `.planning/phases/10-saas-billing-subscription-management-deliver-secure-organiza/10-13-red-evidence.json` — canonical RED test evidence.

## Decisions Made

- Reused `billing:manage`, whose verified source grants it only to Organization Admin; `billing:read` alone is insufficient because the Portal also permits changing a payment method.
- Chose explicit server-side provider-configuration verification rather than trusting a Dashboard default. Stripe's Portal session API selects a configuration; it does not accept per-session feature switches.
- Kept lifecycle policy inside SiteFlow. The Portal receives no subscription-change, cancellation, pause, or reactivation flow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical security control] Validate and pin the provider Portal configuration**
- **Found during:** Task 1
- **Issue:** Stripe Portal features are controlled by a reusable provider configuration, not by the session-creation request. A session using an unchecked Dashboard default could expose subscription mutations despite a secure route.
- **Fix:** Added `STRIPE_PORTAL_CONFIGURATION_ID`; retrieve the selected configuration through the adapter and fail closed unless only the approved feature set is enabled. Unknown feature keys are rejected.
- **Files modified:** `packages/env/src/server.ts`, `apps/server/src/modules/billing/stripe.adapter.ts`, `apps/server/src/modules/billing/portal.routes.ts`, `apps/server/tests/unit/billing/stripe-adapter.test.ts`
- **Verification:** Adapter tests cover all enabled/disabled flags and unknown features; integration verifies the explicit configuration ID reaches the adapter.
- **Committed in:** `4fc3804`

### Deferred Issues

- Existing server typecheck diagnostics and the unrelated ESLint warning are recorded in `deferred-items.md`; they predate and are outside this plan's source changes.

**Total deviations:** 1 auto-fixed (Rule 2).
**Impact on plan:** Fail-closed configuration validation is necessary to guarantee the Portal cannot bypass SiteFlow subscription policy.

## User Setup Required

Configure Stripe Dashboard Customer Portal for the applicable Stripe mode so the selected configuration is active, enables payment-method management and invoice history, and disables customer updates, subscription changes, and cancellation. Set the corresponding non-secret `STRIPE_PORTAL_CONFIGURATION_ID` (`bpc_…`) in the server environment. The adapter verifies these settings before issuing each session. Do not place Stripe API credentials or webhook secrets in source control or chat.

## Next Phase Readiness

Plan 10-13 is complete. Continue Phase 10 in dependency order with Plan 10-07, followed by 10-14, 10-08, and later plans. Plan 10-07 was intentionally not executed here.

---
*Phase: 10-saas-billing-subscription-management-deliver-secure-organiza*
*Completed: 2026-10-11*

## Self-Check: PASSED

- Summary, RED evidence, deferred diagnostics, and Portal route files exist.
- Both task commits (`75d34a6`, `4fc3804`) are ancestors of the current branch HEAD.
