# Phase 8 Discussion Log — Phase F Reporting and Downloads

**Date:** 2026-10-07
**Phase:** 8

## Scope decisions and later planning instruction

The discussion initially recorded reporting-only scope: project and organization-portfolio perspectives, backend APIs and web views, PDF/XLSX/CSV downloads, and no platform billing models. In the subsequent `/gsd-plan-phase 8` request, the user explicitly asked that every capability in the supplied F.0–F.18 proposal be represented in the chunks, including event backbone, notifications, email, realtime, WhatsApp abstraction, scheduled jobs, and preferences. The Phase 8 plan therefore reflects the expanded scope; the roadmap, requirements, and context were reconciled before planning. Platform billing remains out of scope.

The user also requires the original quality gate to be applied chunk by chunk, the phase split into small independently verifiable units, and no missing capabilities from the supplied dependency graph, event vocabulary, or report/export scope.

Latest planning clarification: Phase 8 delivers CSV only; PDF/XLSX are deferred. Realtime must be planned autonomously for unattended execution, preferring the smallest one-way transport compatible with verified infrastructure and existing authorization. Export artifacts default to 24-hour retention and signed URLs to five minutes, configurable and overridden only when verified deployment policy requires it.

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

## Planning defaults and confirmed lifecycle

- The later explicit scope choice supersedes the initial PDF/XLSX/CSV discussion: Phase 8 implements CSV only; PDF/XLSX are deferred and must not appear as conditional deliverables.
- Realtime must be deliverable unattended. F.0 checks for a compatible existing runtime; otherwise F.6 plans native Fastify SSE as the minimal one-way fallback, with current authorization on subscribe and send and no unnecessary transport dependency.
- Keep fast bounded exports synchronous; route work expected/measured above approximately 100 ms under load through the existing PgBoss worker and module-owned handlers.
- Persist only the bounded tenant-scoped export lifecycle needed, reuse MinIO, reauthorize each download, and audit safe metadata without report contents.
- The user confirmed configurable defaults of 24-hour artifact retention and five-minute signed URL expiry. Honor a different value only when verified deployment policy requires it.

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
- Unsupported metrics without authoritative source data or approved definitions.
