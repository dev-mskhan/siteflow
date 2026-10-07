# Phase 8: Phase F Reporting and Downloads

**Created:** 2026-10-07
**Status:** Decisions captured; ready for research and planning.

<domain>
Deliver project and organization-portfolio reporting, backend APIs, web views, and downloadable reports. Reporting is an extension of existing SiteFlow source modules, not a new operational system. Keep Phase F reporting-only; do not add communications or platform billing.
</domain>

<decisions>
### Metric definitions and freshness
- Use existing authoritative schedule, procurement, subcontractor, and Phase E commercial data/services. API, web views, and exports must consume the same server-produced report result; the browser must not calculate business metrics.
- Show transparent domain indicators and underlying facts. Do not invent a weighted project-health score, forecast, subcontractor rating, or unsupported commitment metric. If an approved formula already exists, planning must cite its source before reusing it.
- Keep financial concepts distinct (budget, approved changes, committed, actual, forecast, variance, billed, approved, paid, and retainage as source coverage allows). Do not combine values with different meanings.
- If source coverage is absent or incomplete, show “Not available” with the reason and coverage; never substitute zero or silently omit the gap. Do not claim subcontract commitments or other values whose authoritative source is not implemented.
- On-screen metrics are current when requested and carry an “as of” timestamp. Reuse existing source queries/read models first. Add a report cache or derived projection only after profiling shows a need and the design includes tenant/project-scoped keys, invalidation, TTL, PostgreSQL fallback, and tests.
- Metric summaries link to existing authorized operational records rather than duplicating their workflows or detail tables in reporting.

### Filters and dates
- Use date semantics appropriate to the metric: “as of” for current-state values, a date range for period activity/financial flows, and an upcoming window for schedule outlook. Keep the normalized filter contract identical across API, UI, and exports.
- Use report-specific defaults and a small set of relevant presets plus custom dates where meaningful; do not force one arbitrary date range on every report.
- Project reports use the project timezone and portfolio reports the organization timezone, with an explicit UTC fallback if configuration is absent. Display the effective timezone.
- Report historical values only when authoritative source history supports the selected date. Otherwise clearly label a value as current-only or unavailable; do not reconstruct history from current state.

### Portfolio and authorization
- The organization portfolio includes projects the caller is authorized to read, excluding archived/deleted projects by default, with project-status filters. Resolve organization identity from authenticated context, never from user-supplied tenant input.
- Do not sum unlike currencies. Group portfolio totals by source currency; convert only if planning finds an approved exchange-rate source and an explicit rate-date rule.
- Show portfolio totals and a bounded, cursor-paginated project comparison list. A project row drills into the project report only if the caller independently has access to that project.
- Project report sections inherit existing read capabilities for their source modules. Hide unauthorized sections without disclosing their existence or substituting zero. Independently authorize every drill-down.
- Portfolio scope reuses existing project membership and organization-level cross-project authority. Organization-wide authority may see its permitted portfolio; users without it remain limited to projects they can already read. Do not infer access from a role name or create a broad bypass.
- All report queries, export records/jobs, stored objects, and download authorization preserve `organizationId` and applicable `projectId`. Wrong-tenant resources return the repository-standard non-leaking response. Exports contain no more data than the requesting user can view.

### Report families and downloadable formats
- Provide project health, schedule, cost/commercial, procurement, subcontractor, and executive/project-summary reports, plus the organization-portfolio perspective. Make every approved report family available as PDF, XLSX, and CSV.
- PDF is a management-ready summary with report scope, filters, effective timezone, “as of”/period labels, key tables, units/currency, and coverage/limitations.
- XLSX is an analysis workbook with clearly named report sections/sheets and detailed tabular data. Values originate in the server report service; spreadsheet formulas must not become a competing source of truth.
- CSV is a flat, machine-readable representation of the selected report dataset with stable column names and explicit date, unit, and currency conventions; it does not attempt to reproduce PDF layout.
- All formats carry the same metric definitions, selected filters, date semantics, authorization scope, and report values as the corresponding API/view. Do not implement separate calculations per format.

### Export lifecycle, jobs, storage, and audit
- Keep small, bounded exports synchronous. An export expected or measured to exceed approximately 100 ms under load is handled by existing PgBoss. Measure representative report/export cost during planning rather than treating every export as asynchronous.
- Keep export job definitions and handling with the reporting module, following existing module `.jobs.ts` / `.worker.ts` patterns, and register its handler in `apps/server/src/worker.ts`. Reuse the existing PgBoss instance; do not introduce another queue or a separate worker process unless profiling later demonstrates isolation is necessary.
- Persist a bounded export record with owner, organization/project scope, report type, normalized filter snapshot, format, status, and expiry. Use a small state lifecycle sufficient for pending/processing/ready/failed/expired. Jobs are idempotent and carry `organizationId`; payloads contain identifiers and validated filters, not report result rows.
- Use existing MinIO storage for generated artifacts and existing signed-download patterns. Store objects under server-generated tenant/project-scoped keys; never accept or reveal raw object keys. Re-check authorization when issuing a download URL. Audit export requests and download authorization/URL issuance with actor, scope, format, filters, and outcome, but do not log report contents or sensitive financial values.
- Working lifecycle defaults for planning: generated artifact retention of 24 hours and signed URL lifetime of 5 minutes, configurable and checked against deployment policy. Expiration removes access and schedules object cleanup; users can request a fresh export.
- UI/API must represent pending, ready, failed, and expired exports with clear retry/regenerate behavior. A failed job must not expose a partial or success-shaped artifact.

### Future platform capability boundary
- Do not add platform payment, usage-metering, subscription, invoice, or plan models in Phase 8. Keep organization/project reporting boundaries separate so a future platform-operator reporting perspective can be added with its own explicit scope and authorization; do not query across tenants in this phase.
- Do not build notifications, email/WhatsApp delivery, realtime infrastructure, a new event backbone, speculative reporting projections, or speculative Redis caches to support these reports.
</decisions>

<specifics>
- The user selected the report families, project and organization-portfolio perspectives, backend APIs plus web views, and PDF/XLSX/CSV exports in prior Phase 8 scope decisions.
- User-confirmed discussion choices: transparent indicators; explicit unavailable/coverage semantics; links to existing records; on-demand freshness; metric-appropriate date semantics; historical reporting only when supported by authoritative history; project/organization timezone with UTC fallback; report-specific date presets; authorized non-archived portfolio projects; currency grouping without invented conversion; visible partial coverage; portfolio totals and project rows; source-capability visibility; and reuse of existing project/organization authorization.
- Export layout/lifecycle specifics above are agent-discretion defaults adopted under autopilot to finish the requested discussion. They are planning defaults, not user-confirmed business policy; research/planning should verify existing config and storage lifecycle conventions and call out any retention or format constraints before implementation.
- The user’s “finished, compact, industry-standard” direction means prefer established codebase patterns, stable report contracts, and only the minimum additional persistence/job lifecycle needed for secure downloads.
</specifics>

<code_context>
- Architecture: TypeScript modular monolith; Fastify API, React/Vite web, Drizzle/PostgreSQL, Redis, PgBoss with transactional outbox, MinIO, and OpenTelemetry/Pino. PostgreSQL remains authoritative.
- Existing report sources include schedule metrics and the project `commercial-summary` / `financial-summary` modules. Planning should trace each report metric to its source module/service before defining a query or projection.
- `apps/server/src/modules/project/schedule-metrics/schedule-metrics.repository.ts` currently scopes its metric-row lookup/upsert by `projectId` alone. Fix and test organization scoping before reuse or extension.
- `apps/server/src/lib/queue/queue.ts` only declares a generic export payload/queue: it has no `organizationId`, omits XLSX, and the mapped codebase had no producer/worker. Do not treat it as a ready report-export service.
- Background work belongs to reporting module job/worker files registered from `apps/server/src/worker.ts`; the existing app worker and queue are the default. Use database-backed lifecycle/idempotency and preserve organization/project/requester scope on every job.
- Existing MinIO service and `apps/server/src/modules/project/documents/document.service.ts` are signed-URL precedents. Reuse the storage adapter and its validation; do not issue object URLs without an authorized export-record lookup.
- Existing RBAC policy is in `apps/server/src/modules/project/core/project.policy.ts`; project/organization context types are in `apps/server/src/modules/project/core/project.types.ts`. Extend established capability maps only if research proves a new capability is required, and update both policy maps and boundary tests together.
- Do not add Redis report caching unless profiling justifies it. If it is introduced, keys must include organization and project scope plus normalized filters; define invalidation/TTL and PostgreSQL fallback in the same change. Cache is never an authorization boundary.
- Tests must follow `.planning/siteflow_testing_context.md`: real Fastify app factory and `app.inject()`, PostgreSQL-backed fixtures, at least two organizations for isolation, exact RBAC and ownership boundaries, persisted-state assertions, and deterministic worker retry/idempotency tests. Add cache-path tests only if a cache is introduced.
</code_context>

<canonical_refs>
- `.planning/ROADMAP.md`
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/checklist_when_to_apply.md` — mandatory implementation and phase-exit checklist.
- `.planning/siteflow_testing_context.md` — mandatory integration/security/background-job/cache testing contract.
- `.planning/codebase/STACK.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONCERNS.md`
- `apps/server/src/modules/project/core/project.policy.ts`
- `apps/server/src/modules/project/core/project.types.ts`
- `apps/server/src/modules/project/schedule-metrics/schedule-metrics.repository.ts`
- `apps/server/src/modules/project/documents/document.service.ts`
- `apps/server/src/lib/queue/queue.ts`
- `apps/server/src/worker.ts`
- `apps/server/src/lib/storage/storage.service.ts`
</canonical_refs>

<deferred>
- Platform-operator usage, payments, subscriptions, billing, and cross-tenant platform reporting — future phase after separate product/security requirements.
- Notifications, email, WhatsApp, realtime delivery, and a general domain-event backbone — outside the selected reporting-only scope.
- Any report metric without an authoritative source or approved definition — defer that metric rather than fabricate it.
</deferred>
