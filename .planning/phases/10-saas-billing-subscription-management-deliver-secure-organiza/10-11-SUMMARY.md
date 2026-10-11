---
phase: "10"
plan: "11"
subsystem: billing/entitlements
tags: [billing, entitlements, invitations, postgres, concurrency]
requires: ["10-05"]
provides:
  - "Pure entitlement policy decisions for approved limit boundaries and subscription states"
  - "Transactional project and organization-user admission with per-organization advisory locking"
  - "Pending organization invitations reserve user seats until acceptance, cancellation, or expiry"
  - "Invitation acceptance atomically converts its reserved seat to an active membership"
affects:
  - "apps/server"
tech_stack:
  added: []
  patterns: [drizzle-orm, postgres-advisory-locks, fastify-integration-tests]
key_files:
  created:
    - "apps/server/src/modules/billing/entitlement.policy.ts"
    - "apps/server/src/modules/billing/entitlement.service.ts"
    - "apps/server/tests/unit/billing/entitlement-policy.test.ts"
  modified:
    - "apps/server/src/modules/project/core/project.service.ts"
    - "apps/server/src/modules/invitation/invitation.service.ts"
    - "apps/server/tests/integration/billing/catalog-entitlements.test.ts"
    - "apps/server/tests/integration/invitations_routes.test.ts"
key_decisions:
  - "The organization-user quota is consumed by active organization memberships and unexpired pending invitations, not project assignments."
  - "A shared transaction-scoped advisory lock serializes project and invitation seat consumption for each organization."
  - "Canceled subscriptions retain approved limits through current_period_end, per D-07."
requirements_completed: [BILL-03, BILL-04, BILL-09]
completed: "2026-10-11"
coverage:
  - deliverable: "Pure entitlement policy decisions"
    verification:
      - kind: script
        ref: "pnpm --filter @siteflow/server exec vitest run tests/unit/billing/entitlement-policy.test.ts"
        status: pass
  - deliverable: "PostgreSQL entitlement admission, invitation reservations, concurrency, and tenant isolation"
    verification:
      - kind: script
        ref: "pnpm --filter @siteflow/server exec vitest run tests/integration/billing/catalog-entitlements.test.ts tests/integration/invitations_routes.test.ts"
        status: pass
  - deliverable: "Server bundle"
    verification:
      - kind: script
        ref: "pnpm --filter @siteflow/server build"
        status: pass
---

# Phase 10 Plan 11: Transactional Entitlement Enforcement

Enforced approved project and organization-user limits at the server-side consuming operations. Organization seat usage now includes active memberships and unexpired pending invitations, preventing concurrent overbooking and allowing acceptance to atomically convert a reservation into a membership.

## Accomplishments

- Added deterministic policy functions and tests for hard-limit boundaries, restricted access, grace periods, trial expiry, and canceled subscriptions that remain paid through their current period end.
- Added tenant-scoped entitlement resolution from local approved plan limits and PostgreSQL usage counts.
- Added shared per-organization transaction advisory locking for project creation and invitation seat admission.
- Wired organization-user checks into invitation creation and acceptance; invitation cancellation also serializes with seat changes, and acceptance revalidates the pending invitation inside its transaction.
- Removed the organization-user quota from project-member assignment, which does not consume an organization seat.
- Added integration coverage for project limit enforcement, invitation reservations and acceptance, concurrent invitations, tenant isolation, rollback, and exact `LIMIT_EXCEEDED` API responses.
- Provisioned trials in the pre-existing invitation route test fixture so its invitation-flow tests exercise the now-required entitled organization state.

## Verification

- ✅ Entitlement policy unit tests: 32 passed.
- ✅ Billing and invitation integration suites: 64 passed.
- ✅ Server build: passed.
- ✅ ESLint on entitlement source, unit tests, and catalog integration tests: no errors; entitlement service retains `any` warnings.
- ⚠️ Server typecheck remains blocked by existing errors in `catalog.service.ts` and `trial.routes.ts`; no errors remain in `entitlement.service.ts`.
- ⚠️ The expanded invitation route test file has pre-existing lint errors for unused declarations; its integration tests pass.

## Deviations

The approved D-04 organization-user quota is enforced at organization invitation boundaries rather than project-member assignment. Canceled-subscription paid-through access was implemented from approved D-07 lifecycle policy.
