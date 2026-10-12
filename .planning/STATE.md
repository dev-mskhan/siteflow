---
gsd_state_version: "1.0"
current_phase: 11
current_plan: 0
status: Planned
stopped_at: Planned Phase 11 (7 plans)
last_updated: "2026-10-12T00:00:00.000Z"
last_activity: 2026-10-12
last_activity_desc: Phase 10 closed (api:access allowed per policy); Phase 11 plans 11-01..11-07 created
state_head: b74b747
progress:
  total_phases: 11
  completed_phases: 1
  total_plans: 51
  completed_plans: 44
  percent: 86
current_phase_name: Platform Administration & Operational Controls
---

# Project State

## Current Position

**Current phase:** Phase 11 — Platform Administration & Operational Controls
Current Plan: 0
Total Plans in Phase: 7
**Phase status:** In progress. Plan 11-01 (platform RBAC foundation) complete: migrations 0050 and 0051 applied to siteflow_test only, guard, Redis-cached permission lookup with invalidation, env bootstrap (PLATFORM_BOOTSTRAP_EMAIL). Phase 10 (SaaS Billing) is closed.
**Last activity:** 2026-10-12 — Completed 11-01. platform-rbac integration tests 8/8 pass. Pre-existing failure in task3_rbac_tenant_isolation (invitation seat check NO_ENTITLEMENT, Phase 10 billing enforcement); not caused by 11-01.
**Next action:** Ask user about applying 0050/0051 to main siteflow DB and approval workflow scope before starting 11-02.

## Project Snapshot

- SiteFlow is an existing multi-tenant construction operations platform with project, schedule, procurement, document/compliance, and commercial capabilities.
- Phases 1–7 are recorded as completed history in `.planning/ROADMAP.md`.
- The codebase map is in `.planning/codebase/` and was committed in `18f87fa`.
- Phase F includes the approved F.0–F.18 event, notification, realtime, scheduled automation, project/portfolio reporting, API, web, CSV-export, and hardening capabilities. PDF/XLSX are explicitly deferred.
- Realtime delivery is autonomous: F.0 verifies any compatible existing runtime, otherwise plans native Fastify SSE with current tenant/permission checks. Export defaults are configurable 24-hour artifact retention and 5-minute signed URL expiry, overridden only by verified deployment policy.
- Exports should use existing PgBoss for operations expected/measured to exceed ~100 ms under load; small exports may remain synchronous.
- Platform payments, subscriptions, and usage-metering are explicitly deferred.

## Decisions and Constraints

- Do not reimplement completed phases.
- Preserve tenant isolation as a hard boundary across every reporting, export, background-job, cache, and storage path.
- Extend authoritative read services; keep dashboard/API/download calculations consistent.
- Reuse current Fastify/Drizzle/PostgreSQL/PgBoss/outbox/Redis/MinIO architecture.
- Avoid speculative reporting projection tables and Redis caches; establish evidence first.
- Read `.planning/checklist_when_to_apply.md` and `.planning/siteflow_testing_context.md` before planning or executing Phase F.

## Planning Investigations for Phase F

These are research and implementation-planning tasks, not unresolved user decisions:

- Trace each report metric to an authoritative source and reuse existing definitions; leave unsupported metrics unavailable rather than inventing formulas.
- Verify API/UI/export filter contracts, pagination, date semantics, timezones, and source history against existing modules.
- Map report visibility to existing project and organization permissions, including tenant-isolation tests.
- Profile representative exports to determine which need PgBoss; verify existing MinIO, signed-URL, retention, cleanup, and audit conventions before adopting the recorded lifecycle defaults.
- Trace each report family into CSV from the same server-produced result, and identify the minimum web surfaces required. PDF/XLSX have no Phase 8 implementation tasks.
- Read `.planning/checklist_when_to_apply.md` and `.planning/siteflow_testing_context.md` before planning; account for the schedule-metrics organization-scope gap before reuse.

## Session Continuity

**Last session:** 2026-10-11T12:03:19.491Z
**Stopped at:** Completed 10-08-PLAN.md
**Resume file:** None

- Phase 8 scope and decisions are recorded in `08-CONTEXT.md`; the discussion log distinguishes user-confirmed choices from planning assumptions.
- Phase 8 plans `08-01` through `08-22`, research, context, and `08-VALIDATION.md` exist; review remaining technical probes and command-checker findings before execution.
- Existing task documents remain historical references; no Phase 1–7 plans were generated or rewritten.
- Preserve unrelated worktree changes.

## Accumulated Context

### Roadmap Evolution

- Phase 10 added: Registered Phase 10 SaaS Billing & Subscription Management with secure Stripe-backed subscriptions, tenant-scoped entitlements, explicit construction-finance boundary, shared validation, OpenAPI/Archify documentation, and mandatory appropriate test gates; Phase 8 remains pending.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 10 P13 | 38min | 1 tasks | 8 files |
| Phase 10 P07 | 23 min | 1 tasks | 11 files |
| Phase 10 P14 | 31 min | 1 tasks | 10 files |
| Phase 10 P08 | 39 min | 2 tasks | 12 files |

## Decisions

- [Phase 10]: Reuse billing:manage for the combined payment-method mutation and invoice-history Portal; source grants it to Organization Admin, while Finance has billing:read only.
- [Phase 10]: Require an explicit Stripe Portal configuration ID and retrieve/validate its active feature set before session creation.
- [Phase 10]: Resolve Stripe customers only by authenticated organization ID and current Stripe mode; never create a customer as a Portal side effect.
- [Phase 10]: Verify Stripe webhook signatures over route-scoped original raw bytes before persistence.
- [Phase 10]: Store only bounded provider event/object references; never infer tenant scope from event metadata.
- [Phase 10]: Use unique-conflict no-op for duplicates so pending/retry state remains available to Plan 10-14 recovery.
- [Phase 10]: Recover acknowledged Stripe inbox events directly at startup and on a durable one-minute PgBoss schedule.
- [Phase 10]: Persist a local Stripe event-time high-water mark in existing subscription metadata to prevent late older work from regressing accepted state without a schema migration.
- [Phase 10]: Resolve webhook organization ownership only through persisted mode-qualified SiteFlow customer/subscription associations; never use provider event metadata.
- [Phase 10]: Invoice ownership is resolved only through persisted mode-qualified customer/subscription associations, never webhook metadata.
- [Phase 10]: Invoice amounts, currency, status, and attempt outcomes come from retrieved verified Stripe invoice facts.
- [Phase 10]: Use dedicated SaaS invoice/payment tables and approved unjournaled additive SQL, applied only to siteflow_test.
- [Phase 10]: BILL-07 remains pending until conditional Stripe Tax owned by Plan 10-16 is delivered.
