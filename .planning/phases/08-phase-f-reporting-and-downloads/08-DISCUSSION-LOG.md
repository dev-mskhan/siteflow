# Phase 8 Discussion Log — Phase F Reporting and Downloads

**Date:** 2026-10-07
**Phase:** 8

## Scope carried into discussion

The user had already selected reporting-only scope: project and organization-portfolio perspectives, backend APIs and web views, PDF/XLSX/CSV downloads, and no platform billing models. Communications/realtime remain out of scope. The user selected all open decision areas and requested a compact, industry-standard result that keeps the production-readiness checklist in view.

## User-confirmed decisions

### Metric definitions
- Project health uses separate explainable indicators, not an invented weighted score.
- Missing or unsupported source values are “Not available,” with reason and coverage; never substitute zero or silently omit.
- Metric summaries link to existing authorized operational records.
- Metrics are current on demand, carry an “as of” time, and are cached only if profiling demonstrates a need.

### Filters and dates
- Use metric-appropriate as-of, period-range, and upcoming-window semantics, consistently across API, UI, and export.
- Historical values are shown only when authoritative source history supports them; otherwise disclose current-only/unavailable.
- Project reports use project timezone, portfolio reports organization timezone, and UTC as explicit fallback.
- Use report-specific date defaults and relevant common presets plus custom ranges where meaningful.

### Portfolio
- Include authorized non-archived projects by default and provide status filters.
- Group portfolio totals by source currency; no conversion without an approved rate source and date rule.
- Show partial metric coverage and project query failures explicitly; do not imply partial totals are complete.
- Show portfolio totals and project comparison rows with bounded pagination and authorized project drill-through.

### Permissions
- Project report sections inherit the existing source-module read permissions; hide restricted sections and independently authorize drill-downs.
- Reuse existing project membership and organization-level cross-project authority; do not widen access through the reporting layer.

## Agent-discretion defaults (not user-confirmed)

The session changed to autopilot before downloads were discussed. To finish the selected area without adding another decision round, the following planning defaults were applied and recorded as assumptions in `08-CONTEXT.md`:

- Make every approved report family available in PDF, XLSX, and CSV, each with format-appropriate presentation from the same server-generated data contract.
- Keep fast bounded exports synchronous; use existing PgBoss for work expected/measured above approximately 100 ms under load; use module-owned job/worker code registered in the existing worker.
- Persist export lifecycle/scope metadata; use existing MinIO storage and issue authorized short-lived signed URLs.
- Working defaults: 24-hour artifact retention and five-minute URL expiry. These are operational assumptions for planning, not confirmed business policy; verify existing deployment configuration before implementation.
- Audit export requests and download authorization/URL issuance without logging report content.

## Required planning references

- `.planning/checklist_when_to_apply.md`
- `.planning/siteflow_testing_context.md`
- `.planning/ROADMAP.md`
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/CONCERNS.md`

## Codebase findings used

- Existing `RESOURCE_EXPORT` is only a queue/payload declaration, omits tenant context and XLSX, and has no mapped producer/worker.
- The current schedule-metrics repository uses `projectId` without `organizationId` for a metric-row lookup/upsert; fix tenant scope before reuse.
- Existing PgBoss worker registration and MinIO authorized signed-download patterns should be reused; do not add new infrastructure.
- No report cache or projection is approved without measured need.

## Deferred

- Platform billing/usage/subscription and cross-tenant platform reports.
- Notifications, email/WhatsApp, realtime, and a general event backbone.
- Unsupported metrics without authoritative source data or approved definitions.
