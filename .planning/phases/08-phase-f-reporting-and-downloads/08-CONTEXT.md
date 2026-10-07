# Phase 8: Phase F Reporting and Downloads

**Created:** 2026-10-07
**Status:** Decisions captured; ready for research and planning.

<domain>
Deliver the Phase F event backbone, notification/communication and scheduled automation capabilities, project and organization-portfolio reporting, backend APIs, web views, and downloadable reports. Use existing SiteFlow source modules and infrastructure; avoid isolated CRUD systems and do not add platform billing.
</domain>

<decisions>
### Phase structure and dependency order
- Start with F.0, a repository/contract audit that identifies what existing transaction, outbox, worker, queue, Redis, audit, auth, tenant-scope, membership/permission, commercial, event-like record, notification, realtime, and email capabilities actually exist. Record transaction, payload, tenant/actor propagation, retry, and failure contracts before implementation.
- Preserve the dependency order: existing foundation → versioned domain event contract → transactional publishing → dispatcher/consumer infrastructure → notification core → channel delivery, scheduled jobs, and preferences → reporting read models and metric families → APIs → exports → hardening.
- Keep domain modules independent of concrete event consumers and communication providers. Reuse public module services and existing infrastructure instead of creating parallel systems.
- Split capability areas into small, independently verifiable plans/chunks. Apply the production-readiness checklist during each chunk for build-in controls and at phase end for end-of-phase gates; do not misclassify pre-production-only load tests as per-chunk work.

### Required F.0–F.18 chunk coverage
- **F.0 Repository/contract audit:** produce the dependency and contract baseline; no new business functionality.
- **F.1 Domain event contract:** implement the versioned common event envelope and event vocabulary.
- **F.2 Transactional event publishing:** atomically persist domain changes and outbox events; verify rollback, retries, deduplication, and idempotency.
- **F.3 Event dispatcher/consumers:** register independent handlers with retries, failure isolation, idempotency, logging, correlation, failure/dead-letter state, and metrics.
- **F.4 Notification core:** create channel-independent notification, recipient, template, delivery, attempt, lifecycle, and failure state.
- **F.5 Email delivery:** add templates and a replaceable provider abstraction with safe content, retry, idempotency, and delivery state.
- **F.6 Realtime events:** deliver authorized project/organization/user events using the actual repository realtime stack, if one exists.
- **F.7 WhatsApp abstraction:** define a replaceable outbound messaging channel without requiring a concrete vendor.
- **F.8 Scheduled jobs:** generate operational due/overdue/expiring checks through the existing job and domain-service patterns.
- **F.9 Notification preferences:** let user/channel preferences control delivery without suppressing domain events.
- **F.10 Reporting foundation:** connect authoritative operational sources to backend report services/read models; only add projections if demonstrated necessary.
- **F.11 Project health:** expose transparent, source-backed health indicators without an invented weighted score.
- **F.12 Schedule metrics:** report existing authoritative schedule data without duplicating schedule calculations.
- **F.13 Cost metrics:** report Phase E financial concepts distinctly and disclose unavailable source coverage.
- **F.14 Procurement metrics:** report source-backed procurement status and material-to-task schedule impact where supported.
- **F.15 Subcontractor metrics:** use subcontractor and linked operational/commercial sources without invented commitments or performance scores.
- **F.16 Executive/reporting APIs:** expose project and organization-portfolio reports with the agreed access, filters, and bounded project pagination.
- **F.17 Report export/download service:** make each approved report family downloadable in CSV from the same server-produced values and filter contract; PDF/XLSX are deferred.
- **F.18 Phase hardening:** run the phase-level regression, security, performance, export, communication, and operational quality gates.

### Domain-event contract and reliability
- Create a shared, versioned event envelope with stable identity, event type/version, occurred time, organization ID, optional project ID, actor where applicable, entity type/ID, correlation/causation identifiers where supported, and validated payload. Final field names and integration points must follow actual repository conventions.
- Cover the supplied vocabulary where corresponding source workflows exist: `TaskCompleted`, `TaskDelayed`, `TaskDateChanged`, `MaterialOrdered`, `MaterialDelayed`, `MaterialDelivered`, `IssueCreated`, `IssueResolved`, `RfiCreated`, `RfiOverdue`, `SubmittalSubmitted`, `SubmittalRejected`, `InspectionScheduled`, `InspectionFailed`, `ChangeOrderCreated`, `ChangeOrderApproved`, `PaymentApplicationSubmitted`, `PaymentOverdue`, `DocumentExpiring`, and `SafetyIncidentCreated`. Do not invent source workflows or emit events with fabricated domain state.
- Domain mutation and outbox event must commit atomically. Processing must tolerate retry and duplicate delivery, isolate handler failures, retain failure/dead-letter state consistent with the existing outbox, and preserve tenant/actor/correlation context.
- Verify event validity, missing tenant, invalid payload/version, serialization/deserialization, identity, transaction rollback, retry, duplicate delivery, and idempotent consumer behavior as applicable.

### Notification, channels, realtime, jobs, and preferences
- Keep a notification domain separate from email/realtime/WhatsApp providers, with enough recipient, event, channel, rendered content, priority, status/timestamp, attempt, failure, retry, and correlation data to audit lifecycle without overbuilding a parallel event store.
- Email uses a replaceable provider abstraction with templates, subject, HTML/text, retry/failure tracking, idempotency, and delivery status. Never accidentally include access tokens, passwords, or sensitive financial details.
- Realtime delivery follows an existing runtime if present. If none exists, use a minimal one-way transport compatible with the checked-in Fastify/PostgreSQL stack (prefer SSE with the existing event-notification path over adding a bidirectional protocol). Authentication, tenant context, membership, and permission must be checked server-side on subscribe and delivery; a known project ID never authorizes subscription or receipt.
- WhatsApp remains a provider-neutral channel abstraction; do not add a concrete vendor dependency unless configured and supported by existing deployment policy.
- Scheduled reminders/monitoring cover the supplied examples where their source workflows exist: RFI approaching due date, payment overdue, document expiring, submittal overdue, task approaching deadline, and material delivery approaching. The scheduler enqueues idempotent work to existing infrastructure; jobs call domain services and emit events/notification intents, not direct provider sends.
- Preferences may follow organization defaults → project defaults → user settings only where existing settings contracts support that hierarchy. Preferences decide delivery channels, never whether the underlying domain event exists.
- Event and notification records must be tenant scoped, auditable where security-sensitive, retry safe, and observable; keep provider calls outside database transactions.

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
- Provide project health, schedule, cost/commercial, procurement, subcontractor, and executive/project-summary reports, plus the organization-portfolio perspective. Make every approved report family available as CSV. PDF and XLSX are deferred; do not add renderer dependencies or plan their implementation in Phase 8.
- CSV is a flat, machine-readable representation of the selected report dataset with stable column names and explicit date, unit, and currency conventions; it does not attempt to reproduce PDF layout.
- CSV carries the same metric definitions, selected filters, date semantics, authorization scope, and report values as the corresponding API/view. Do not implement separate calculations for exports.

### Export lifecycle, jobs, storage, and audit
- Keep small, bounded exports synchronous. An export expected or measured to exceed approximately 100 ms under load is handled by existing PgBoss. Measure representative report/export cost during planning rather than treating every export as asynchronous.
- Keep export job definitions and handling with the reporting module, following existing module `.jobs.ts` / `.worker.ts` patterns, and register its handler in `apps/server/src/worker.ts`. Reuse the existing PgBoss instance; do not introduce another queue or a separate worker process unless profiling later demonstrates isolation is necessary.
- Persist a bounded export record with owner, organization/project scope, report type, normalized filter snapshot, format, status, and expiry. Use a small state lifecycle sufficient for pending/processing/ready/failed/expired. Jobs are idempotent and carry `organizationId`; payloads contain identifiers and validated filters, not report result rows.
- Use existing MinIO storage for generated artifacts and existing signed-download patterns. Store objects under server-generated tenant/project-scoped keys; never accept or reveal raw object keys. Re-check authorization when issuing a download URL. Audit export requests and download authorization/URL issuance with actor, scope, format, filters, and outcome, but do not log report contents or sensitive financial values.
- User-confirmed lifecycle defaults: generated artifact retention of 24 hours and signed URL lifetime of 5 minutes, configurable; use a verified deployment policy instead if it requires different values. Expiration removes access and schedules object cleanup; users can request a fresh export.
- UI/API must represent pending, ready, failed, and expired exports with clear retry/regenerate behavior. A failed job must not expose a partial or success-shaped artifact.

### Future platform capability boundary
- Do not add platform payment, usage-metering, subscription, invoice, or plan models in Phase 8. Keep organization/project reporting boundaries separate so a future platform-operator reporting perspective can be added with its own explicit scope and authorization; do not query across tenants in this phase.
- **User-confirmed scope update:** realtime transport may be selected autonomously for the unattended phase execution; prefer the smallest one-way transport that fits the verified runtime and current authorization model, and do not add a dependency if the existing stack suffices. CSV is the only Phase 8 download format; PDF/XLSX are deferred to a later product decision. Use 24-hour artifact retention and 5-minute signed URL expiry unless verified deployment policy requires different values.
- **D-01 — CSV-only exports:** Phase 8 implements and tests CSV only. PDF/XLSX rendering and related package selection/installation are deferred.
- **D-02 — Autonomous authorized realtime:** F.0 inventories existing realtime and notification/outbox paths. If a compatible existing runtime is verified, reuse it; otherwise implement the smallest viable one-way Fastify-compatible transport (SSE preferred), reuse the existing outbox/notification path if sound, and enforce current tenant, membership, and permission checks. No human transport decision blocks execution.
- **D-03 — Export lifecycle defaults:** Use configurable 24-hour artifact retention and 5-minute signed URL expiry; override only when verified deployment policy requires it.
- Do not introduce a second database, queue, worker process, storage system, event store, speculative reporting projection, or speculative Redis cache. Add a projection/cache only if codebase investigation and profiling prove it necessary and its data lifecycle, tenant scoping, invalidation, TTL, fallback, and tests are defined.
</decisions>

<specifics>
- The user selected the report families, project and organization-portfolio perspectives, backend APIs plus web views, and CSV exports in prior Phase 8 scope decisions. PDF/XLSX were later explicitly deferred.
- User-confirmed discussion choices: transparent indicators; explicit unavailable/coverage semantics; links to existing records; on-demand freshness; metric-appropriate date semantics; historical reporting only when supported by authoritative history; project/organization timezone with UTC fallback; report-specific date presets; authorized non-archived portfolio projects; currency grouping without invented conversion; visible partial coverage; portfolio totals and project rows; source-capability visibility; and reuse of existing project/organization authorization.
- Export lifecycle defaults above are user-confirmed. Verify deployment configuration before implementation and honor any deployment policy that requires different values; PDF/XLSX are deferred rather than an unresolved renderer choice.
- The user's “finished, compact, industry-standard” direction means prefer established codebase patterns, stable event/report contracts, and only the minimum additional persistence/job lifecycle needed.
- The user directed that the realtime transport be selected autonomously for unattended execution; prefer the smallest one-way transport compatible with verified existing infrastructure and avoid a new dependency where possible.
- Latest planning instruction asks that every Phase F capability from the supplied F.0–F.18 proposal be represented as a chunk; retain each named capability while splitting it into small, independently verifiable implementation plans.
</specifics>

<code_context>
- Architecture: TypeScript modular monolith; Fastify API, React/Vite web, Drizzle/PostgreSQL, Redis, PgBoss with transactional outbox, MinIO, and OpenTelemetry/Pino. PostgreSQL remains authoritative. Older proposal references to Prisma/BullMQ must not override actual repository tooling.
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
- Any report metric without an authoritative source or approved definition — defer that metric rather than fabricate it.
- PDF and XLSX report rendering and related dependencies/tests — explicitly deferred; Phase 8 delivers CSV only.
</deferred>
