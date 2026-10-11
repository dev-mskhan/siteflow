---
gsd_state_version: "1.0"
current_phase: 10
status: In Progress
stopped_at: Plan 10-12 — permission-checked hosted Checkout
last_updated: "2026-10-11T13:00:00.000Z"
last_activity: 2026-10-11
last_activity_desc: Completed Phase 10 Plan 10-11 entitlement enforcement
state_head: 177eeb77f1f8ed7ec8bca1939171960f27c0cbb7
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 44
  completed_plans: 30
  percent: 0
current_phase_name: SaaS Billing & Subscription Management
---

# Project State

## Current Position

**Current phase:** Phase 10 — SaaS Billing & Subscription Management
**Phase status:** Execution in progress; Plans 10-01 through 10-06 and 10-11 are complete. Phase 8 remains pending.
**Last activity:** 2026-10-11 — Completed Plan 10-11 (transactional entitlement enforcement).
**Next action:** Execute Plan 10-12, then continue Phase 10 in dependency order.

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

**Last session:** 2026-10-10T09:50:56.701Z
**Stopped at:** Phase 10 context gathered
**Resume file:** .planning\phases\10-saas-billing-subscription-management-deliver-secure-organiza\10-CONTEXT.md

- Phase 8 scope and decisions are recorded in `08-CONTEXT.md`; the discussion log distinguishes user-confirmed choices from planning assumptions.
- Phase 8 plans `08-01` through `08-22`, research, context, and `08-VALIDATION.md` exist; review remaining technical probes and command-checker findings before execution.
- Existing task documents remain historical references; no Phase 1–7 plans were generated or rewritten.
- Preserve unrelated worktree changes.

## Accumulated Context

### Roadmap Evolution

- Phase 10 added: Registered Phase 10 SaaS Billing & Subscription Management with secure Stripe-backed subscriptions, tenant-scoped entitlements, explicit construction-finance boundary, shared validation, OpenAPI/Archify documentation, and mandatory appropriate test gates; Phase 8 remains pending.
