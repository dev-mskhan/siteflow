---
phase: "10"
plan: "04"
subsystem: billing/trial-tracer
tags: [billing, saas, trial, postgres, fastify, tracer, integration]
requires: ["10-01", "10-02"]
provides:
  - "PostgreSQL saasTrials table in app schema with unique organization constraint"
  - "Migration 0042_saas_billing.sql applied to siteflow and siteflow_test"
  - "Shared Zod schemas for trial responses (TrialResponseSchema, TrialStatusSchema)"
  - "Server billing module with trial repository, service, and routes"
  - "RBAC permissions billing:manage and billing:read seeded to Organization Admin and Finance roles"
  - "Integration tests verifying trial provisioning, idempotency, RBAC, tenant isolation, and concurrency safety"
affects:
  - "packages/database, packages/shared, apps/server"
tech_stack:
  added: []
  patterns: [drizzle-orm, fastify, zod, rbac, audit-logging]
key_files:
  created:
    - "packages/database/src/schema/saas-billing.schema.ts"
    - "packages/database/drizzle/0042_saas_billing.sql"
    - "packages/shared/src/modules/billing/trial.schema.ts"
    - "apps/server/src/modules/billing/trial.repository.ts"
    - "apps/server/src/modules/billing/trial.service.ts"
    - "apps/server/src/modules/billing/trial.routes.ts"
    - "apps/server/tests/integration/billing/trial-provisioning.test.ts"
  modified:
    - "packages/database/src/schema/index.ts"
    - "packages/shared/src/index.ts"
    - "apps/server/src/modules/rbac/permissions.seed.ts"
    - "apps/server/src/app/index.ts"
key_decisions:
  - "Created saasTrials table in app schema with unique constraint on organization_id, preventing multiple trials per organization at the database level."
  - "Configured 14-day trial duration with Professional plan tier limits per approved 10-POLICY-DECISIONS.md."
  - "Handled PostgreSQL unique constraint collision (code 23505) in trial.service.ts to ensure concurrent duplicate requests resolve idempotently without unhandled errors."
  - "Enforced RBAC via requireOrgPermission('billing:manage') for trial mutation and requireOrgPermission('billing:read') for read routes."
requirements_completed: [BILL-02, BILL-03, BILL-09]
duration: "~40 min"
completed: "2026-10-11"
coverage:
  - deliverable: "Real PostgreSQL integration test suite covering trial provisioning, idempotency, RBAC, cross-tenant isolation, and concurrent races"
    verification:
      - kind: script
        ref: "pnpm --filter @siteflow/server test tests/integration/billing/trial-provisioning.test.ts"
        status: pass
---

# Phase 10 Plan 04: SaaS Billing Trial Tracer Slice Summary

Implemented and verified the vertical tracer slice for Phase 10 SaaS Billing: establishing organization trial provisioning and status read path backed by PostgreSQL, Fastify route registration, RBAC permission enforcement, and transaction audit logging.

**Duration:** ~40 min | **Tasks:** 2 | **Files:** 7 created, 4 modified

## Accomplishments

- **Database Persistence & Migrations:**
  - Added `saasTrials` table to `packages/database/src/schema/saas-billing.schema.ts` within the `app` schema with `organization_id` foreign key and unique index.
  - Generated and applied migration `packages/database/drizzle/0042_saas_billing.sql` to both `siteflow` and `siteflow_test` databases.
  - Exported billing schema through `packages/database/src/schema/index.ts`.

- **Shared Runtime Contracts:**
  - Created `packages/shared/src/modules/billing/trial.schema.ts` defining `TrialStatusSchema` and `TrialResponseSchema`.
  - Re-exported billing schemas via `packages/shared/src/index.ts`.

- **Server Billing Module:**
  - Implemented `TrialRepository` (`apps/server/src/modules/billing/trial.repository.ts`) with PostgreSQL queries for trial creation and retrieval.
  - Implemented `TrialService` (`apps/server/src/modules/billing/trial.service.ts`) with 14-day trial calculation, concurrency race conflict handling (`23505`), and atomic audit logging (`billing.trial.started`).
  - Implemented `TrialRoutes` (`apps/server/src/modules/billing/trial.routes.ts`) mounting `POST /:organizationId/billing/trial` and `GET /:organizationId/billing/trial`.
  - Added RBAC permissions `billing:manage` and `billing:read` to `permissions.seed.ts` granted to `Organization Admin` and `Finance`.
  - Registered billing routes in `apps/server/src/app/index.ts` under `/api/v1/organizations` prefix with Swagger documentation tags.

- **Integration Verification:**
  - Created `apps/server/tests/integration/billing/trial-provisioning.test.ts` testing against real PostgreSQL container (`siteflow_test` on port 5434).
  - Verified 7 test scenarios:
    1. 14-day no-card trial provisioning with PostgreSQL persistence and audit logging.
    2. Idempotent re-provisioning returning the existing trial.
    3. Reading trial status through GET route by authorized admin.
    4. Denying unauthenticated requests before database writes.
    5. Denying users with insufficient permissions.
    6. Denying cross-tenant access between organizations.
    7. Concurrent duplicate trial request handling producing exactly one persisted trial.

## Verification Results

- ✅ PASS `pnpm --filter @siteflow/server test tests/integration/billing/trial-provisioning.test.ts` (7 tests passed, 0 failed).

## Deviations from Plan

None — implementation followed the architectural plan and policy decisions strictly without introducing Stripe dependencies or touching construction commercial finance models.

## Self-Check: PASSED
