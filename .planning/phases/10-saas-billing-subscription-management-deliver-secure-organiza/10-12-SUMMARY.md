---
phase: "10"
plan: "12"
subsystem: billing/checkout
tags: [billing, checkout, stripe, permissions, customer-association]
requires: ["10-06", "10-11"]
provides:
  - "Permission-checked hosted Checkout using the approved local catalog"
  - "Mode-scoped organization-to-Stripe-customer associations"
  - "Redirects and client fields isolated from subscription entitlement state"
affects:
  - "apps/server"
  - "packages/database"
tech_stack:
  added: []
  patterns: [drizzle-orm, fastify-integration-tests, stripe-idempotency]
key_files:
  created:
    - "apps/server/src/modules/billing/checkout.routes.ts"
    - "apps/server/src/modules/billing/customer.repository.ts"
    - "apps/server/tests/integration/billing/checkout-portal.test.ts"
    - "packages/database/drizzle/0044_saas_customer_associations.sql"
  modified:
    - "apps/server/src/app/index.ts"
    - "packages/database/src/schema/saas-billing.schema.ts"
key_decisions:
  - "Reuse billing:manage for Checkout: source grants it to Organization Admin; Finance has billing:read only."
  - "Persist Stripe customer mappings separately from subscriptions so Checkout does not create entitlement-bearing placeholder state."
  - "Keep the migration journal unchanged; apply the additive SQL through the established manual path after schema checks."
requirements_completed: [BILL-02, BILL-05, BILL-09]
completed: "2026-10-11"
coverage:
  - deliverable: "Checkout authorization, approved price, idempotency, tenant isolation, and client-override behavior"
    verification:
      - kind: script
        ref: "pnpm --filter @siteflow/server test -- tests/integration/billing/checkout-portal.test.ts"
        status: pass
  - deliverable: "Database schema package"
    verification:
      - kind: script
        ref: "pnpm --filter @siteflow/database build"
        status: pass
  - deliverable: "Server bundle"
    verification:
      - kind: script
        ref: "pnpm --filter @siteflow/server build"
        status: pass
  - deliverable: "Changed-file lint"
    verification:
      - kind: script
        ref: "pnpm --filter @siteflow/server exec eslint src/modules/billing/checkout.routes.ts src/modules/billing/customer.repository.ts tests/integration/billing/checkout-portal.test.ts"
        status: pass
---

# Phase 10 Plan 12: Permission-Checked Hosted Checkout

Added a tenant-authorized hosted Checkout route that derives plan, price, customer, and return URLs from server-owned organization and catalog state. Stripe return redirects remain informational; only later verified provider reconciliation can grant subscription entitlements.

## Accomplishments

- Registered `POST /api/v1/organizations/:organizationId/billing/checkout` behind authentication, organization membership, and `billing:manage`.
- Confirmed `billing:manage` is granted to Organization Admin; Finance has `billing:read` but not `billing:manage`.
- Added a mode-scoped customer association table, repository, and additive SQL migration; customer IDs are persisted independently of subscription state.
- Used Stripe customer and Checkout idempotency keys to make retry behavior stable.
- Derived Checkout prices and return URLs from local approved state; client-supplied price, currency, customer, tenant, and redirect fields do not override them.
- Added integration coverage for authorized success, stable retries and customer reuse, unauthenticated/unauthorized/cross-tenant denial, and non-authoritative redirects.

## Verification

- ✅ Checkout integration suite: 5 passed.
- ✅ Database package build passed.
- ✅ Server build passed.
- ✅ ESLint on changed Checkout route, repository, and test: passed.
- ⚠️ Server typecheck remains blocked by existing diagnostics in `catalog.service.ts` and `trial.routes.ts`; no Checkout route or customer repository type errors remain.
- ✅ The controlled additive migration was applied and verified in `siteflow_test`; the production/development `siteflow` database was not changed.

## Migration Note

`0044_saas_customer_associations.sql` is intentionally not registered in `_journal.json`, consistent with the approved migration reconciliation. Apply it through the established controlled SQL path to each deployment database before enabling Checkout; do not run Drizzle migration replay against the untracked legacy ledger.
