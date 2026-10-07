# Project State

## Current Position

**Current phase:** Phase 8 — Phase F Reporting and Downloads (GSD tracking begins here)
**Phase status:** Context gathering; not ready for executable plan until the user supplies the promised Phase F context and outstanding metric/product decisions are resolved.
**Last activity:** 2026-10-07 — brownfield codebase mapping and GSD project initialization.
**Next action:** User provides Phase F context; then run `/gsd-discuss-phase 8` or `/gsd-plan-phase 8` after confirming metric requirements.

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

## Open Questions for Phase F

- Exact formulas, definitions, source fields, and “unavailable” semantics for each metric.
- Report filters, date/time-zone behavior, pagination, and historical/as-of semantics.
- Organization portfolio eligibility, project selection, aggregation, currencies, and partial-failure behavior.
- Role/capability visibility across project and organization reports.
- Dashboard page layouts and downloadable report presentation/content.
- Export size/runtime thresholds, asynchronous status model, retention, expiration, and audit events.
- Which report families must be available in each export format.

## Session Continuity

- The user said they will provide Phase F context again after project-wide GSD setup.
- Existing task documents remain historical references; no Phase 1–7 plans were generated or rewritten.
- Existing unrelated worktree changes must remain untouched.
