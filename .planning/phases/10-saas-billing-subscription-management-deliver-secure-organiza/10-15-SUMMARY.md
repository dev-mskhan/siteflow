---
phase: "10-saas-billing-subscription-management-deliver-secure-organiza"
plan: "15"
subsystem: billing/invoices
tags: [stripe, postgres, fastify, rbac, invoice-history, tenant-isolation]

requires:
  - "10-08: tenant-scoped SaaS invoice and payment-attempt persistence"
provides:
  - "GET /api/v1/organizations/:organizationId/billing/invoices bounded SaaS invoice/payment-attempt history"
  - "Shared Zod query and response contracts for invoice history"
affects: [billing, plan-10-08]

tech-stack:
  added: []
  patterns:
    - "requirePermission('billing:read') guard on an organization-scoped billing route"
    - "Tenant-qualified, limit-bounded repository query returning invoices with nested payment attempts"

key-files:
  created:
    - apps/server/src/modules/billing/invoice.routes.ts
  modified:
    - apps/server/src/app/index.ts
    - apps/server/src/modules/billing/invoice.service.ts
    - apps/server/src/modules/billing/invoice.repository.ts
    - packages/shared/src/modules/billing/invoice.schema.ts
    - apps/server/tests/integration/billing/invoices-tax-refunds.test.ts

key-decisions:
  - "Reuse the existing billing:read permission (already seeded in permissions.seed.ts) instead of adding a new capability."
  - "Query limit is validated by the shared Zod schema (default 20, max 100); out-of-range values return 422 through Fastify schema validation."

requirements-completed: [BILL-07, BILL-09]

commits:
  - "448348d feat(10-15): add tenant billing invoice history route"
  - "6dc314b fix(10-15): normalize raw SQL attempt timestamps and align limit validation to 422"

duration: n/a
completed: 2026-10-11
status: complete
---

# Phase 10 Plan 15: Tenant Billing Invoice History Summary

**Organization billing users can read a bounded, tenant-scoped history of their own SaaS invoices and payment attempts through a permission-guarded, validated route.**

## What Was Built

- `GET /api/v1/organizations/:organizationId/billing/invoices` registered in `apps/server/src/app/index.ts` under `/api/v1/organizations`.
- Route guarded by `organizationContext` plus `requirePermission('billing:read')`; tagged `billing` for OpenAPI.
- `limit` query parameter: integer, 1–100, default 20, validated by the shared `saasInvoiceHistoryQuerySchema`.
- `InvoiceService.getHistory` maps repository rows to the shared `saasInvoiceHistoryDataSchema` shape (invoice fields plus up to 100 payment attempts per invoice, ISO timestamps).
- Repository adds a tenant-qualified, bounded query over SaaS invoice and payment-attempt tables only; no construction-finance tables are read.
- Shared schema gained history query, record, and data schemas plus limit constants.

## Verification

- `pnpm --filter @siteflow/server test -- invoices-tax-refunds`: **6/6 passed** (2 Plan 10-08 persistence tests, 4 Plan 10-15 API tests).
  - Authorized billing member receives only its own bounded history (200).
  - Unauthenticated and members without `billing:read` are denied (401/403).
  - Billing member cannot read another organization's history (403).
  - `limit=101` is rejected (422).
- Typecheck was not run for this summary; no pre-existing typecheck status was re-verified here.

## Deviations from Plan

- **Permission:** The plan listed `permissions.seed.ts` as modified, but the commits did not change it. The route uses the already-seeded `billing:read` permission, which matched history-read semantics, so no new capability was added.
- **Over-limit status:** Limits above 100 return **422** (Fastify schema validation), not 400, to align with the shared validation contract. The test was updated accordingly in `6dc314b`.
- **Timestamp normalization:** `6dc314b` wraps `attempt.createdAt` in `new Date(...)` because raw SQL returns timestamps as non-Date values.

## Issues Encountered

- Plan 10-14 recorded pre-existing server typecheck blockers in `catalog.service.ts` and `trial.routes.ts`; they are unrelated and were not modified here.

## Self-Check

- Route, service, repository, and shared schema files exist; commits `448348d` and `6dc314b` are on `development`.
- Test suite run above passed 6/6.

---
*Phase: 10-saas-billing-subscription-management-deliver-secure-organiza*
*Completed: 2026-10-11*
