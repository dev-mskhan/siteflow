---
gsd_state_version: "1.0"
current_phase: Phase 8 — Phase F Reporting and Downloads (GSD tracking begins here)
status: Ready to execute
stopped_at: Phase 8 planning verified; implementation not started.
last_updated: "2026-10-07T21:44:42.095Z"
last_activity: 2026-10-08
last_activity_desc: Phase 8 plan verification passed; 22 plans in 15 waves.
state_head: 7a283c543fe191075aaba55e1dd4dbb89e32df2e
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 22
  completed_plans: 0
  percent: 0
current_phase_name: Phase F Reporting and Downloads
---

# Project State

## Current Position

**Current phase:** Phase 8 — Phase F Reporting and Downloads (GSD tracking begins here)
**Phase status:** Phase 8 planning complete and verified; ready for execution.
**Last activity:** 2026-10-08 — Phase 8 plan verification passed; 22 plans in 15 waves.
**Next action:** /gsd-execute-phase 8 — begin the first dependency-ordered plan.

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

**Last session:** Phase 8 plans and scope artifacts repaired; deterministic checker results remain to be reviewed.
**Stopped at:** Phase 8 planning verified; implementation not started.
**Resume file:** .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md

- Phase 8 scope and decisions are recorded in `08-CONTEXT.md`; the discussion log distinguishes user-confirmed choices from planning assumptions.
- Phase 8 plans `08-01` through `08-22`, research, context, and `08-VALIDATION.md` exist; review remaining technical probes and command-checker findings before execution.
- Existing task documents remain historical references; no Phase 1–7 plans were generated or rewritten.
- Preserve unrelated worktree changes.
