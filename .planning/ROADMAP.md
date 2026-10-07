# SiteFlow Roadmap

**Project:** SiteFlow
**Created:** 2026-10-07
**Granularity:** Standard

## Context

This is a brownfield roadmap for continued development. Phases 1–7 below record completed SiteFlow history from existing task documents and implementation context; they are not requests to reimplement that work. GSD tracking begins with Phase 8, corresponding to product Phase F.

The current Phase F boundary is reporting-only: project/portfolio metrics, APIs, web views, and downloads. Communication channels and platform billing models are deferred. The user will provide additional Phase F context before its detailed implementation plan is finalized.

## Phases

### Current GSD Tracking

- [ ] **Phase 8: Phase F Reporting and Downloads** - Build approved project and organization-portfolio reporting, web views, and downloadable reports.

### Completed History

| GSD Phase | SiteFlow Phase / Work | Status | Evidence |
|-----------|------------------------|--------|----------|
| 1 | Authentication, organizations, memberships, invitations, RBAC, audit | Complete | Existing modules and phase history in `.planning/checklist_when_to_apply.md` |
| 2 | Project core, members, phases, cost codes, settings | Complete | Existing project modules and phase history |
| 3 | Schedule execution core, tasks, calendars, dependencies, engine, baselines, logs, issues, metrics | Complete | `.planning/tasks_schedule_execution.md` |
| 4 | Partners and procurement | Complete | `.planning/tasks_partners_procurement.md` |
| 5 | Production hardening | Complete | `.planning/tasks_production_hardening.md` |
| 6 | Phase D documents, compliance, and operations | Complete | `.planning/tasks_phase_d.md` |
| 7 | Phase E commercial control | Complete | `.planning/tasks_phase_e.md` |

### Phase 8: Phase F Reporting and Downloads

**Goal:** Authorized users can access trustworthy project and organization-portfolio reporting through consistent backend APIs, web views, and PDF/XLSX/CSV downloads without compromising tenant isolation.
**Depends on:** Completed SiteFlow Phases 1–7 (recorded as historical evidence; not replanned here)
**Requirements:** RPT-01–RPT-15, EXT-01
**Success Criteria** (what must be TRUE):
  1. Authorized project users can view agreed project health, schedule, cost, procurement, subcontractor, and executive summary reports whose values come from authoritative backend sources.
  2. Authorized organization users can view a portfolio report containing only projects permitted by the agreed portfolio and role rules.
  3. A metric shown in the API and web UI matches its PDF, XLSX, or CSV export for the same filters and date range.
  4. Cross-tenant report access and export/download attempts cannot expose another organization's or project's data.
  5. Costly exports complete through the existing background-job infrastructure with observable status and authorized, expiring downloads.
**Plans:** TBD (pending user decisions and phase discussion)
**Entry gate:** Resolve metric definitions and sources, report filters/date semantics, portfolio rules, role visibility, report layouts, and export lifecycle/retention before creating executable plans.

**Status:** Planned; detailed scope/metric decisions still need user context before executable plans.

Deliver reporting for project and organization-portfolio perspectives using the existing multi-tenant API, domain services, database, queue, storage, cache, and web architecture.

Expected capability areas:

1. **Reporting definitions and access contract** — settle metric formulas, sources, filters, date ranges, portfolio inclusion, and role permissions before implementation.
2. **Project health and schedule reporting** — derive from existing operational and schedule truth; do not make up scores or duplicate schedule calculation.
3. **Cost and commercial reporting** — derive from Phase E financial services and state explicit coverage/deferred-source behavior.
4. **Procurement and subcontractor reporting** — use authoritative source modules; avoid duplicate commitments and unsupported performance scores.
5. **Executive and portfolio reports** — compose established report services with organization-scoped project selection and totals.
6. **Report APIs and web views** — present consistent server-produced metrics and filters.
7. **PDF, XLSX, and CSV exports** — use one report data contract; handle large generation via PgBoss and scoped, expiring MinIO-backed downloads where justified.
8. **Phase exit hardening** — validate multi-tenant isolation, permissions, concurrency, API contracts, cache behavior only if introduced, worker retry/idempotency, export integrity, and performance per the required planning checklist/testing context.

**Entry gate:** Before `/gsd-plan-phase`, gather the user's promised Phase F context and confirm formulas, role-specific visibility, portfolio semantics, report layouts, filters, export lifecycle/retention, and whether any Phase F notification scope is intentionally added. Keep the previously selected reporting-only default unless explicitly changed.

**Non-goals:** Build no platform payment, usage-metering, or subscription model in this phase. Do not build email/WhatsApp/realtime systems under the current Phase F decision.

### Future Phases — Uncommitted

- Platform usage, payments, and subscriptions: possible future product capability; no phase number, behavior, or schema committed.
- Communication/notification/realtime capabilities: not part of Phase 8 under the current scope; future placement and requirements TBD.

## Coverage

| Requirement | Phase |
|-------------|-------|
| RPT-01–RPT-15 | Phase 8 |
| EXT-01 | Phase 8 boundary; future phase TBD |

## Decisions and Constraints

- `.planning/checklist_when_to_apply.md` and `.planning/siteflow_testing_context.md` are mandatory references for each implementation chunk and phase exit.
- Tenant isolation and permission checks apply equally to API reads, portfolio aggregates, exports, worker jobs, stored objects, cache keys, and download access.
- Reuse existing PgBoss/outbox and MinIO storage; do not assume the currently declared generic export queue is implemented.
- PostgreSQL and authoritative domain services remain the source of truth. Cache only after measured need.
- Resolve export sync/async thresholds from expected/measured runtime and safe bounded payloads; the approximate 100 ms threshold is a design guide, not a claim about current report performance.
- Do not add GSD plans for completed phases solely to make their historical implementation appear to have been GSD-managed.
