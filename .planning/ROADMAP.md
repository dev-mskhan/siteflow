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
- [x] **Phase 9: Architecture Findings Remediation** - User-prioritized fixes for H1–H9; execute this remediation before resuming Phase 8 plans without treating Phase 8 as complete.

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

**Goal:** SiteFlow reliably publishes tenant-scoped domain events, delivers configurable notifications through authorized channels and scheduled jobs, and provides trustworthy project and organization-portfolio reporting through consistent APIs, web views, and CSV downloads without compromising tenant isolation.
**Depends on:** Completed SiteFlow Phases 1–7 (recorded as historical evidence; not replanned here)
**Requirements:** EVT-01–EVT-03, NTF-01–NTF-03, COM-01, SCH-01, PREF-01, RPT-01–RPT-15, EXT-01
**Success Criteria** (what must be TRUE):
  1. Domain changes and their versioned, tenant-scoped events commit atomically; event handlers are safely retryable, idempotent, observable, and isolated from one another.
  2. Notification delivery is represented independently of domain mutations and supports the agreed email, realtime, and replaceable WhatsApp channel contracts, scheduled triggers, and user delivery preferences.
  3. Realtime subscriptions and every notification/job delivery enforce current organization, project-membership, and permission boundaries; identifiers alone never grant access.
  4. Authorized project users can view agreed project health, schedule, cost, procurement, subcontractor, and executive summary reports whose values come from authoritative backend sources.
  5. Authorized organization users can view a portfolio report containing only projects permitted by the agreed portfolio and role rules.
  6. A metric shown in the API and web UI matches its CSV export for the same filters and date range; PDF/XLSX are deferred.
  7. Cross-tenant event, notification, report, export, job, storage, and download paths cannot expose another organization's or project's data.
  8. Costly exports and scheduled work use the existing background-job infrastructure with observable status, safe retries, and authorized, expiring downloads where applicable.

**Plans:** 0/22 plans executed
Plans:
**Wave 1**
- [ ] 08-01-PLAN.md — F.0 repository and contract audit

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 08-02-PLAN.md — F.1 versioned event contract

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 08-03-PLAN.md — F.2 transactional event publishing

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 08-04-PLAN.md — F.3 reliable event dispatcher and consumers

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 08-05-PLAN.md — F.4 notification intent and lifecycle

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 08-06-PLAN.md — F.5 safe replaceable email delivery
- [ ] 08-07-PLAN.md — F.6 authorized realtime delivery via verified runtime or Fastify SSE
- [ ] 08-08-PLAN.md — F.7 provider-neutral WhatsApp channel contract

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 08-09-PLAN.md — F.8 scheduled operational reminders
- [ ] 08-10-PLAN.md — F.9 preferences wired into delivery

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 08-11-PLAN.md — F.10 reporting foundation and tenant-safe sources

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 08-12-PLAN.md — F.11 source-backed health report
- [ ] 08-13-PLAN.md — F.12 schedule report
- [ ] 08-14-PLAN.md — F.13 cost and commercial report
- [ ] 08-15-PLAN.md — F.14 procurement report
- [ ] 08-16-PLAN.md — F.15 subcontractor report

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 08-17-PLAN.md — F.16 authorized report APIs and portfolio

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 08-18-PLAN.md — F.16 project and portfolio web views

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 08-19-PLAN.md — F.17 canonical CSV rendering and parity

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 08-20-PLAN.md — F.17 scoped CSV export lifecycle, PgBoss, and MinIO

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 08-21-PLAN.md — F.17 CSV-only web export lifecycle

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 08-22-PLAN.md — F.18 Tier 2 evidence and phase-wide hardening

**Entry gate:** Audit existing outbox, worker, tenant/RBAC, audit, communication, metric-source, export, and storage contracts; verify metric definitions and sources, event and notification boundaries, report filters/date semantics, portfolio rules, role visibility, CSV output, and export lifecycle/retention before implementation. Select realtime autonomously: verify an existing runtime, otherwise plan the minimal Fastify-compatible one-way route (SSE preferred) with current-authorization checks; no human transport decision blocks execution.

**Status:** Planning verification passed; implementation validation remains pending execution.

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
10. **F.17 Report export/download service** — produce CSV only from the same authorized server report results; use synchronous execution or existing PgBoss/MinIO lifecycle according to measured cost. PDF/XLSX are explicitly deferred.
11. **F.18 Phase hardening** — verify multi-tenant isolation, permissions, concurrency, API contracts, cache behavior only if introduced, worker retry/idempotency, channel delivery security, CSV integrity, configurable 24-hour artifact retention and 5-minute signed URL expiry (unless verified deployment policy overrides), and required quality gates.

**Entry gate:** Use the decisions in `08-CONTEXT.md`; planning research must verify existing contracts and trace each metric and job to authoritative code before implementation.

**Non-goals:** Build no platform payment, usage-metering, or subscription model in this phase. Do not build a concrete WhatsApp vendor integration unless configured and approved; use the replaceable channel contract.

### Phase 9: Architecture Findings Remediation

**Priority:** User-authorized remediation scheduled ahead of the remaining Phase 8 plan execution because the current checkout already contains the affected runtime paths.
**Goal:** Close the source-verified authorization, tenant-isolation, reliability, export-contract, and date-semantics gaps recorded as H1–H9 in `docs/architecture/findings.md`, without claiming the unexecuted Phase 8 plans are complete.
**Depends on:** The current checked-out SiteFlow implementation and the source-backed evidence in `docs/architecture/`; Phase 8 remains pending and is not marked complete by this remediation.
**Requirements:** REM-01–REM-09 (one for each H1–H9; the plan must resolve confirmed gaps and either wire or explicitly remove/demote partial dormant paths based on source).
**Success Criteria** (what must be TRUE):
  1. Project report and portfolio results are limited by current project-read authority; report routes reject users without the relevant capability, and portfolio pagination is bounded.
  2. SSE subscriptions require verified identity and current tenant/project authority; organization identity is never taken from an unauthenticated URL fallback, and CORS follows configured policy.
  3. Outbox event contracts are validated, tenant requirements are explicit, and dispatch/idempotency behavior is durable across retries/restarts—or unused paths are removed and documented rather than presented as wired.
  4. Intended reminder/email/preference paths have explicit, tested runtime wiring, or remain intentionally unavailable with inactive definitions removed or clearly fenced.
  5. Export request filters match the web/API contract; report work is not silently swallowed or unnecessarily duplicated; sync/async selection and retention/URL expiry are validated configuration.
  6. Export project scope, every state transition, download authorization, and audit event are organization/project/actor-qualified and covered by cross-tenant integration tests.
  7. Every public date preset has defined behavior, custom ranges are validated, and report boundaries use project/organization timezone with documented UTC fallback.
  8. Retry safety for project jobs is durable across processes, and cache invalidation avoids Redis `KEYS` over an unbounded keyspace.
  9. Relevant API, worker, and multi-tenant regression suites pass; the fixes are committed/pushed without adding `docs/architecture/` to the fixes commit.

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

### Phase 10: SaaS Billing & Subscription Management

**Goal:** Build a secure, auditable organization-level SaaS subscription and entitlement backend within SiteFlow’s existing modular monolith. Reconcile the proposed billing specification against the repository’s actual models and patterns; use Stripe as the external commerce processor and PostgreSQL as the authoritative local state. Keep SaaS subscriptions separate from construction finance. Integrate existing authentication, organization permissions, transactions, audit, outbox, workers, and shared validation; document new routes in OpenAPI and maintain source-evidenced Archify diagrams. Require unit, integration, and end-to-end tests where each layer applies, plus security, performance, and project regression checks using `.planning/checklist_when_to_apply.md`. Resolve Stripe dashboard setup with the user before implementation.
**Requirements:** BILL-01–BILL-11
**Depends on:** Phase 9
**Success Criteria** (what must be TRUE):
  1. Versioned plans, prices, entitlements, trials, and usage limits have explicit server-side rules.
  2. Subscription lifecycle operations and their policy (trial conversion, change, cancellation, renewal, and recovery) are implemented and auditable.
  3. Stripe is isolated behind an adapter; checkout redirects never grant access, and signed webhooks use a durable, tenant-safe, deduplicated, retryable inbox.
  4. Local subscription, invoice, payment-attempt, refund, history, and entitlement state is PostgreSQL-backed and tenant-scoped; construction finance remains a separate domain.
  5. Entitlements and plan limits are enforced at backend operations, including concurrent limit changes.
  6. Existing auth, organization/RBAC, audit, transaction/outbox, worker, and shared-validation conventions are reused without spreading Stripe calls through unrelated modules.
  7. Appropriate unit, integration, and E2E coverage—including Stripe test-mode scenarios—plus lint, typecheck, build, and focused/full regression gates pass.
  8. New routes have shared runtime validation and OpenAPI/Swagger documentation; Archify diagrams reflect verified runtime behavior.
  9. Webhook replay, out-of-order delivery, provider outages, retries, and reconciliation have tested recovery behavior.

**Plans:** 9/19 plans executed
**Tasks:** 27 tasks

Plans:
- [x] 10-01-PLAN.md — Capture Phase 9 lint baseline and reconcile migration history before billing schema work
- [x] 10-02-PLAN.md — Approve catalog, trial, entitlement, and lifecycle policy inputs
- [x] 10-03-PLAN.md — Verify Stripe SDK legitimacy before installation
- [x] 10-04-PLAN.md — Tracer: provision and read an organization trial end-to-end
- [x] 10-05-PLAN.md — Expand the versioned catalog, subscription lifecycle, and entitlements
- [x] 10-11-PLAN.md — Enforce approved entitlements atomically in PostgreSQL
- [x] 10-06-PLAN.md — Integrate hosted Checkout and restricted Customer Portal
- [x] 10-12-PLAN.md — Create permission-checked hosted Checkout
- [x] 10-13-PLAN.md — Restrict hosted Customer Portal features
- [ ] 10-07-PLAN.md — Build durable signed webhook inbox and provider reconciliation
- [ ] 10-14-PLAN.md — Recover acknowledged webhook events and reconcile provider state
- [ ] 10-08-PLAN.md — Persist replay-safe tenant-scoped SaaS invoice and payment history
- [ ] 10-15-PLAN.md — Expose authorized SaaS invoice history
- [ ] 10-16-PLAN.md — Integrate conditional Stripe Tax facts
- [ ] 10-17-PLAN.md — Persist separate refund history and guard mutation authority
- [ ] 10-09-PLAN.md — Implement lifecycle policy and Phase 10-owned verified grace-reminder delivery
- [ ] 10-18-PLAN.md — Add permission-checked lifecycle routes
- [ ] 10-19-PLAN.md — Enforce approved restricted-access operation matrix
- [ ] 10-10-PLAN.md — Verify provider acceptance, source-evidenced diagrams, and phase gates

**Plan dependencies:** 10-01, 10-02, and 10-03 are prerequisite gates. 10-04 depends on 10-01 and 10-02; 10-05 follows 10-04; 10-11 follows 10-05; 10-06 follows 10-03/10-05; 10-12 follows 10-06/10-11; 10-13 follows 10-12; 10-07 follows 10-13 to serialize registration in `apps/server/src/app/index.ts`; 10-14 follows 10-07; 10-08 follows 10-14; 10-09 follows 10-02/10-08/10-11/10-14 to serialize schema/migration ownership; 10-15 follows 10-08; 10-16 follows 10-06/10-15; 10-17 follows 10-08/10-14/10-16; 10-18 follows 10-09/10-15/10-16 to serialize `stripe.adapter.ts`; 10-19 follows 10-11/10-18; and final gate 10-10 depends on 10-13, 10-17, and 10-19.

**Execution waves:** Wave 1: 10-01, 10-02, 10-03; Wave 2: 10-04; Wave 3: 10-05; Wave 4: 10-06, 10-11; Wave 5: 10-12; Wave 6: 10-13; Wave 7: 10-07; Wave 8: 10-14; Wave 9: 10-08; Wave 10: 10-09, 10-15; Wave 11: 10-16; Wave 12: 10-17, 10-18; Wave 13: 10-19; Wave 14: 10-10.
