---
phase: "10"
plan: "05"
subsystem: billing/catalog-subscriptions
tags: [billing, saas, catalog, subscription, postgres, integration, unit]
requires: ["10-04"]
provides:
  - "saas_plans, saas_price_versions, saas_subscriptions, saas_subscription_history tables in app schema"
  - "Migration 0043_saas_catalog_subscriptions.sql applied to siteflow and siteflow_test with seeded v1 plans"
  - "Shared Zod schemas: PlanTierSchema, SubscriptionStatusSchema, PriceVersionSchema, SubscriptionDTOSchema, etc."
  - "APPROVED_PLANS, APPROVED_LIMITS, APPROVED_PRICING_V1 in @siteflow/shared - local catalog authority"
  - "CatalogRepository with plan/price/subscription CRUD and history ledger operations"
  - "CatalogService enforcing local catalog authority, price version resolution, subscription transitions"
  - "Unit tests (9 passed) verifying approved prices, limits, provider mapping, and tamper protection"
  - "Integration tests (9 passed) verifying PostgreSQL catalog seed, one-current-sub invariant, and grandfathering"
affects:
  - "packages/database, packages/shared, apps/server"
tech_stack:
  added: []
  patterns: [drizzle-orm, fastify, zod, postgres, audit-logging]
key_files:
  created:
    - "packages/database/drizzle/0043_saas_catalog_subscriptions.sql"
    - "packages/shared/src/modules/billing/catalog.schema.ts"
    - "apps/server/src/modules/billing/catalog.repository.ts"
    - "apps/server/src/modules/billing/catalog.service.ts"
    - "apps/server/tests/unit/billing/catalog-policy.test.ts"
    - "apps/server/tests/integration/billing/catalog-entitlements.test.ts"
  modified:
    - "packages/database/src/schema/saas-billing.schema.ts"
    - "packages/shared/src/index.ts"
key_decisions:
  - "saasPlans and saasPriceVersions tables seeded with approved v1 pricing at migration time; Stripe IDs are stored as references only, amounts and limits are authoritative locally."
  - "saas_subscriptions enforces one-current invariant via PostgreSQL partial unique index on (organization_id) WHERE is_current = true."
  - "priceVersionId in saas_subscriptions column stores full PK (e.g. 'starter_month_v1') pointing to saas_price_versions.id, enabling FK integrity across historical entries."
  - "saas_subscription_history ledger retains ALL subscription changes with action/from/to fields for auditability and grandfathering."
  - "CatalogService.resolvePriceFromProvider() rejects unmapped Stripe price IDs, preventing provider identity tampering."
requirements_completed: [BILL-01, BILL-03, BILL-09]
duration: "~30 min"
completed: "2026-10-11"
coverage:
  - deliverable: "Unit tests for catalog policy, pricing, limits, and provider mapping"
    verification:
      - kind: script
        ref: "pnpm --filter @siteflow/server test tests/unit/billing/catalog-policy.test.ts"
        status: pass
  - deliverable: "Integration tests for PostgreSQL catalog seed, subscription creation, plan changes, and grandfathering"
    verification:
      - kind: script
        ref: "pnpm --filter @siteflow/server test tests/integration/billing/catalog-entitlements.test.ts"
        status: pass
---

# Phase 10 Plan 05: Versioned Catalog & Subscription History Summary

Expanded the Phase 10 billing tracer into the complete approved local plan catalog and historical subscription model, establishing that SiteFlow—not Stripe or client inputs—owns all authoritative plan and price version policy.

**Duration:** ~30 min | **Tasks:** 1 | **Files:** 6 created, 2 modified

## Accomplishments

- **Database Schema Expansion:**
  - Added `saas_plans`, `saas_price_versions`, `saas_subscriptions`, `saas_subscription_history` tables to `saas-billing.schema.ts`.
  - One-current-subscription invariant enforced by PostgreSQL partial unique index: `WHERE is_current = true` on `organization_id`.
  - FK references from subscriptions to plans and price versions preserve relational integrity for historical lookups.

- **Migration 0043:**
  - Applied `0043_saas_catalog_subscriptions.sql` to both `siteflow` and `siteflow_test`.
  - Seeded 3 approved plans (Starter, Professional, Enterprise) and 6 price versions (2 intervals × 3 tiers) with exact amounts and limits from `10-POLICY-DECISIONS.md`.

- **Shared Catalog Authority:**
  - Created `catalog.schema.ts` in `@siteflow/shared` with all Zod schemas, `APPROVED_PLANS`, `APPROVED_LIMITS`, `APPROVED_PRICING_V1`, and utility functions (`getApprovedPlan`, `getApprovedPrice`, `findPriceByProviderPriceId`).
  - Provider Stripe price IDs are stored in the catalog but never used as authoritative policy sources.

- **Server Catalog Module:**
  - `CatalogRepository` with typed CRUD for plans, price versions, subscriptions, and history.
  - `CatalogService` enforcing: local catalog authority, immutable price version resolution, provider price ID validation with tamper rejection, atomic subscription creation/plan change with history recording and audit logging.

- **Tests:**
  - **9 unit tests** verifying exact approved USD amounts, limits by tier, provider mapping, and tamper protection.
  - **9 integration tests** verifying PostgreSQL seed counts, full catalog service lifecycle (create/change plan), one-current-sub enforcement via PostgreSQL state, subscription history ledger, and v1 grandfathering.

## Verification Results

- ✅ PASS `tests/unit/billing/catalog-policy.test.ts` — 9/9 tests.
- ✅ PASS `tests/integration/billing/catalog-entitlements.test.ts` — 9/9 tests.
- **Total: 18/18 tests passed.**

## Deviations from Plan

None. Plan catalog implementation exactly matches approved policy values from `10-POLICY-DECISIONS.md`. No Stripe dependencies introduced. Construction-finance schemas untouched.

## Self-Check: PASSED
