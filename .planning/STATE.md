---
gsd_state_version: "1.0"
current_phase: Phase 8 — Phase F Reporting and Downloads (GSD tracking begins here)
status: unknown
stopped_at: Phase 8 context gathered; ready for planning
last_updated: "2026-10-07T19:17:42.305Z"
last_activity: 2026-10-08
last_activity_desc: Phase 8 discussion decisions captured.
state_head: d6f9724665e44b5ad071df73bc264d7ce321a056
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

**Current phase:** Phase 8 — Phase F Reporting and Downloads (GSD tracking begins here)
**Phase status:** Context captured; ready for research and planning.
**Last activity:** 2026-10-08 — Phase 8 discussion decisions captured.
**Next action:** Run /gsd-plan-phase 8 to create the Phase F execution plans.

## Project Snapshot

- SiteFlow is an existing multi-tenant construction operations platform with project, schedule, procurement, document/compliance, and commercial capabilities.
- Phases 1–7 are recorded as completed history in `.planning/ROADMAP.md`.
- The codebase map is in `.planning/codebase/` and was committed in `18f87fa`.
- Phase F is scoped provisionally to project and organization-portfolio reporting, backend APIs, web report/download surfaces, and PDF/XLSX/CSV exports.
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
- Trace each report family into PDF, XLSX, and CSV from the same server-produced result, and identify the minimum web surfaces required.
- Read `.planning/checklist_when_to_apply.md` and `.planning/siteflow_testing_context.md` before planning; account for the schedule-metrics organization-scope gap before reuse.

## Session Continuity

**Last session:** Phase 8 context and discussion reconciled; ready for planning.
**Stopped at:** Phase 8 context complete; run `/gsd-plan-phase 8` when ready.
**Resume file:** .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md

- Phase 8 scope and decisions are recorded in `08-CONTEXT.md`; the discussion log distinguishes user-confirmed choices from planning assumptions.
- No Phase 8 research or plans exist yet; planning should verify the assumptions and codebase findings before producing executable tasks.
- Existing task documents remain historical references; no Phase 1–7 plans were generated or rewritten.
- Preserve unrelated worktree changes.
