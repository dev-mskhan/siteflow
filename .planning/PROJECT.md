# SiteFlow

## What This Is

SiteFlow is a multi-tenant construction project operations platform. It brings project teams' operational workflows and commercial controls into one auditable system, spanning organization access, project setup, schedules, procurement, documents and compliance, and project financial management.

The current product is a TypeScript monorepo with a Fastify API, React web client, and PostgreSQL-backed persistence. This project record describes the existing brownfield product and the work to be tracked from the upcoming reporting phase; it does not imply that prior capabilities should be rebuilt.

## Core Value

Construction teams can coordinate project delivery and understand operational and financial status from tenant-isolated, auditable records they can trust.

## Target Users

- Construction organizations and their organization administrators.
- Project managers and project members coordinating project delivery.
- Procurement, finance, and commercial users managing commitments and payment workflows.
- Subcontractors and suppliers participating in project workflows, subject to their assigned access.
- Future platform operators, if/when a platform-level usage and subscription model is approved.

## Current Product Context

- The application is a multi-tenant modular monolith. PostgreSQL is authoritative for business and financial state; organization/project context and RBAC guard access.
- Existing capabilities cover authentication and organizations, project core, schedule execution, partners/procurement, production hardening, documents/compliance/operations, and commercial control.
- Phase D and Phase E records report completion. Phase F is the next planned delivery area.
- Reporting must reuse authoritative backend services/read models so API, dashboard, and exports agree. Frontend code must not independently calculate business metrics.
- The Phase F scope selected so far is project and organization-portfolio reporting, with backend reporting APIs and web report views/download controls.
- Download formats selected are PDF, XLSX, and CSV. Keep small exports synchronous and use existing PgBoss infrastructure for exports expected or measured to exceed the existing ~100 ms-under-load threshold.
- Platform payment, usage-metering, and subscription models are not part of Phase F. Keep future platform billing possible through clean domain boundaries without implementing speculative models.
- Detailed metric definitions, filters, role visibility, portfolio rollups, and report layouts remain to be clarified before Phase F execution planning.

## Requirements

### Validated

- Organization authentication, membership, invitations, authorization, and tenant context exist in the application.
- Project core and project-scoped permissions are implemented.
- Schedule execution, schedule calculations, baselines, and schedule metrics exist.
- Partners and procurement workflows exist.
- Production hardening and Phase D document/compliance/operations capabilities are recorded as completed.
- Phase E commercial control exists for budgets, changes, costs, commitments, billing, payments, audit, and retainage, with approved-purchase-order-only commitment coverage and subcontract commitments explicitly deferred pending an approved contract source.
- PostgreSQL/Drizzle, Redis, PgBoss/outbox, MinIO, and OpenTelemetry are established infrastructure. Do not introduce competing infrastructure without evidence and approval.

### Active

- [ ] Provide consistent project and organization-portfolio reporting based on authoritative server-side calculations.
- [ ] Make project health, schedule, cost, procurement, subcontractor, and executive/project summary reports available through agreed APIs and web surfaces.
- [ ] Allow authorized users to download reports as PDF, XLSX, and CSV, with consistent filters and metric definitions across the UI, API, and files.
- [ ] Preserve tenant isolation and project/organization permissions across report queries, exports, background jobs, stored files, and downloads.
- [ ] Preserve extension points for possible future platform usage, payment, and subscription capabilities without adding those models to Phase F.

### Out of Scope

- Implementing platform subscription, usage-metering, or platform payment models in Phase F — explicitly deferred for a future decision.
- Rebuilding completed Phase 1/2/3/C/D/E product capabilities as part of GSD setup.
- Implementing notification, email, WhatsApp, or realtime communications as part of the currently selected reporting-only Phase F scope.
- Inventing unapproved metric formulas, health scores, forecast rules, or role visibility rules before domain definitions are agreed.
- Adding a new queue, cache, object store, or reporting framework without a demonstrated requirement and repository evidence.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Begin GSD tracking from the next phase while recording existing capabilities as history | The repository contains completed phase task records; planning should continue rather than recreate delivered work | Accepted |
| Phase F currently targets reporting, metrics, APIs, and exports only | User selected reporting-only scope rather than the broader notification/realtime proposal | Accepted; details to clarify before phase plan |
| Include backend APIs and web report/download surfaces | User selected an end-to-end product surface | Accepted |
| Include project and organization-portfolio perspectives | User selected both perspectives; other audiences await explicit authorization/requirements | Accepted |
| Provide PDF, XLSX, and CSV exports | User explicitly requested downloadable reports in these formats | Accepted |
| Use PgBoss for expensive exports; retain synchronous small-export path | Existing queue is the established job infrastructure; checklist uses an approximately 100 ms under-load threshold | Accepted as a planning constraint; benchmark during design |
| Defer platform usage/payments/subscriptions as models | Future extensibility is desired, but user selected no billing models in Phase F | Accepted |
| Treat existing `.planning` task documents and codebase map as brownfield evidence | No project-wide GSD artifacts existed; avoid discarding existing plans | Accepted |

## Constraints

- Preserve strict organization/project isolation; tenant identity comes from authenticated context rather than user-controlled report/export input.
- Reports, APIs, background jobs, cache keys, stored export objects, and download authorization must carry the appropriate organization/project scope.
- PostgreSQL and existing domain services remain authoritative; cache is optional optimization only.
- Use existing Fastify, Drizzle/PostgreSQL, shared Zod, Redis, PgBoss/outbox, MinIO, and observability patterns.
- Read and apply `.planning/checklist_when_to_apply.md` and `.planning/siteflow_testing_context.md` for each relevant phase chunk and phase exit.
- Avoid speculative read models and caches; benchmark query paths and move costly work to PgBoss based on the project's established performance guidance.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. Confirm the core value and project context remain accurate.

**After each milestone** (via `/gsd-complete-milestone`):
1. Review all sections and the project core value.
2. Reconcile Out of Scope with current decisions.
3. Record new decisions and any future platform billing scope approved.

---
*Last updated: 2026-10-07 after brownfield GSD initialization*
