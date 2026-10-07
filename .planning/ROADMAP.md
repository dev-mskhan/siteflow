# SiteFlow Roadmap

**Project:** SiteFlow
**Created:** 2026-10-07
**Granularity:** Standard

## Context

This is a brownfield roadmap for continued development. Phases 1–7 below record completed SiteFlow history from existing task documents and implementation context; they are not requests to reimplement that work. GSD tracking begins with Phase 8, corresponding to product Phase F.

Phase F includes a versioned domain-event backbone, notification and communication capabilities, scheduled operational automation, and project/organization-portfolio reporting with APIs, web views, and downloads. Platform billing models remain deferred. Phase 8 detailed scope and decisions are recorded in `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md`.

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

**Goal:** SiteFlow reliably publishes tenant-scoped domain events, delivers configurable notifications through authorized channels and scheduled jobs, and provides trustworthy project and organization-portfolio reporting through consistent APIs, web views, and PDF/XLSX/CSV downloads without compromising tenant isolation.
**Depends on:** Completed SiteFlow Phases 1–7 (recorded as historical evidence; not replanned here)
**Requirements:** EVT-01–EVT-03, NTF-01–NTF-03, COM-01, SCH-01, PREF-01, RPT-01–RPT-15, EXT-01
**Success Criteria** (what must be TRUE):
  1. Domain changes and their versioned, tenant-scoped events commit atomically; event handlers are safely retryable, idempotent, observable, and isolated from one another.
  2. Notification delivery is represented independently of domain mutations and supports the agreed email, realtime, and replaceable WhatsApp channel contracts, scheduled triggers, and user delivery preferences.
  3. Realtime subscriptions and every notification/job delivery enforce current organization, project-membership, and permission boundaries; identifiers alone never grant access.
  4. Authorized project users can view agreed project health, schedule, cost, procurement, subcontractor, and executive summary reports whose values come from authoritative backend sources.
  5. Authorized organization users can view a portfolio report containing only projects permitted by the agreed portfolio and role rules.
  6. A metric shown in the API and web UI matches its PDF, XLSX, or CSV export for the same filters and date range.
  7. Cross-tenant event, notification, report, export, job, storage, and download paths cannot expose another organization's or project's data.
  8. Costly exports and scheduled work use the existing background-job infrastructure with observable status, safe retries, and authorized, expiring downloads where applicable.
**Plans:** TBD (pending Phase 8 research and planning)
**Entry gate:** Audit existing outbox, worker, tenant/RBAC, audit, communication, metric-source, export, and storage contracts; verify metric definitions and sources, event and notification boundaries, report filters/date semantics, portfolio rules, role visibility, report layouts, and export lifecycle/retention before implementation.

**Status:** Context captured; ready for research and executable planning.

Deliver the event/communication foundation and reporting capabilities for project and organization-portfolio perspectives using existing multi-tenant API, domain services, database, queue, storage, cache, and web architecture.

Expected capability areas:

1. **F.0 Repository and contract audit** — verify actual transaction, outbox, worker, queue, tenant/RBAC, audit, event, notification, and reporting sources before implementation.
2. **F.1 Domain-event contract** — define versioned, immutable, identifiable, tenant-scoped event envelopes and the agreed event vocabulary.
3. **F.2 Transactional event publishing** — persist business changes and outbox events atomically; ensure safe retry and deduplication.
4. **F.3 Event dispatcher/consumers** — provide registered handlers, retries, failure isolation, idempotency, correlation, dead-letter/failure state, logging, and metrics.
5. **F.4 Notification core** — model notification intent, recipient, template/delivery/attempt, lifecycle, status, and failure state independently of channels.
6. **F.5–F.9 Communication and automation** — implement replaceable email delivery, authorized realtime delivery, a provider-neutral WhatsApp contract, scheduled operational reminders, and channel preferences; do not couple domain mutations directly to providers.
7. **F.10 Reporting foundation** — expose authoritative source data through minimum-necessary backend report services/read models; avoid unsupported or speculative projections.
8. **F.11–F.15 Project report families** — health, schedule, cost/commercial, procurement, subcontractor, executive and portfolio metrics with explicit source coverage and permission rules.
9. **F.16 Reporting APIs** — expose consistent project and organization-portfolio report contracts and bounded pagination.
10. **F.17 Report export/download service** — produce PDF, XLSX, and CSV from the same authorized server report results; use synchronous execution or existing PgBoss/MinIO lifecycle according to measured cost.
11. **F.18 Phase hardening** — verify multi-tenant isolation, permissions, concurrency, API contracts, cache behavior only if introduced, worker retry/idempotency, channel delivery security, export integrity, and required quality gates.

**Entry gate:** Use the decisions in `08-CONTEXT.md`; planning research must verify existing contracts and trace each metric and job to authoritative code before implementation.

**Non-goals:** Build no platform payment, usage-metering, or subscription model in this phase. Do not build a concrete WhatsApp vendor integration unless configured and approved; use the replaceable channel contract.

### Future Phases — Uncommitted

- Platform usage, payments, and subscriptions: possible future product capability; no phase number, behavior, or schema committed.

## Coverage

| Requirement | Phase |
|-------------|-------|
| EVT-01–EVT-03, NTF-01–NTF-03, COM-01, SCH-01, PREF-01 | Phase 8 |
| RPT-01–RPT-15 | Phase 8 |
| EXT-01 | Phase 8 boundary; future phase TBD |

## Decisions and Constraints

- `.planning/checklist_when_to_apply.md` and `.planning/siteflow_testing_context.md` are mandatory references for each implementation chunk and phase exit.
- Tenant isolation and permission checks apply equally to API reads, portfolio aggregates, exports, worker jobs, stored objects, cache keys, and download access.
- Reuse existing PgBoss/outbox and MinIO storage; do not assume the currently declared generic export queue is implemented.
- PostgreSQL and authoritative domain services remain the source of truth. Cache only after measured need.
- Resolve export sync/async thresholds from expected/measured runtime and safe bounded payloads; the approximate 100 ms threshold is a design guide, not a claim about current report performance.
- Do not add GSD plans for completed phases solely to make their historical implementation appear to have been GSD-managed.
