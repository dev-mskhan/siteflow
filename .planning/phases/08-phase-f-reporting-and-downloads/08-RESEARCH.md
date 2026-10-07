# Phase 8: Phase F Reporting and Downloads — Research

**Researched:** 2026-10-08
**Domain:** SiteFlow event publishing/dispatch, notification delivery, scheduled work, tenant-scoped operational reporting, and exports
**Confidence:** HIGH for inspected codebase patterns and identified gaps; MEDIUM for design recommendations pending F.0 probes and workload profiling

<user_constraints>
## User Constraints (from CONTEXT.md)

The following locked decisions, discretion defaults, and deferred ideas are copied from the current phase context. `[VERIFIED: .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:9-170]`

### Locked Decisions

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
- **F.6 Realtime events:** use a compatible existing runtime if F.0 verifies one; otherwise implement the smallest viable one-way Fastify transport (SSE preferred), reuse the existing outbox/notification path if sound, and recheck current tenant/project permissions on subscribe and every delivery. This autonomous fallback must not block unattended execution.
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
- **F.17 Report export/download service:** make each approved report family downloadable in CSV only from the same server-produced values and filter contract. PDF/XLSX are explicitly deferred; do not select or install renderer packages.
- **F.18 Phase hardening:** run the phase-level regression, security, performance, export, communication, and operational quality gates.

### Domain-event contract and reliability
- Create a shared, versioned event envelope with stable identity, event type/version, occurred time, organization ID, optional project ID, actor where applicable, entity type/ID, correlation/causation identifiers where supported, and validated payload. Final field names and integration points must follow actual repository conventions.
- Cover the supplied vocabulary where corresponding source workflows exist: `TaskCompleted`, `TaskDelayed`, `TaskDateChanged`, `MaterialOrdered`, `MaterialDelayed`, `MaterialDelivered`, `IssueCreated`, `IssueResolved`, `RfiCreated`, `RfiOverdue`, `SubmittalSubmitted`, `SubmittalRejected`, `InspectionScheduled`, `InspectionFailed`, `ChangeOrderCreated`, `ChangeOrderApproved`, `PaymentApplicationSubmitted`, `PaymentOverdue`, `DocumentExpiring`, and `SafetyIncidentCreated`. Do not invent source workflows or emit events with fabricated domain state.
- Domain mutation and outbox event must commit atomically. Processing must tolerate retry and duplicate delivery, isolate handler failures, retain failure/dead-letter state consistent with the existing outbox, and preserve tenant/actor/correlation context.
- Verify event validity, missing tenant, invalid payload/version, serialization/deserialization, identity, transaction rollback, retry, duplicate delivery, and idempotent consumer behavior as applicable.

### Notification, channels, jobs, and preferences
- Keep a notification domain separate from email/realtime/WhatsApp providers, with enough recipient, event, channel, rendered content, priority, status/timestamp, attempt, failure, retry, and correlation data to audit lifecycle without overbuilding a parallel event store.
- Email uses a replaceable provider abstraction with templates, subject, HTML/text, retry/failure tracking, idempotency, and delivery status. Never accidentally include access tokens, passwords, or sensitive financial details.
- Realtime delivery reuses a compatible runtime only when F.0 verifies it. Otherwise implement the smallest viable one-way Fastify transport (SSE preferred), reusing the existing outbox/notification path if sound and using persisted notification state with bounded polling if it is not. Authentication, tenant context, membership, and current permission must be checked on subscription and every delivery. The transport fallback is autonomous and must not block unattended execution.
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
- Provide project health, schedule, cost/commercial, procurement, subcontractor, and executive/project-summary reports, plus the organization-portfolio perspective. Make every approved report family available as CSV only. PDF/XLSX are explicitly deferred; no renderer selection, package install, or rendering tests are in Phase 8.
- CSV is a flat, machine-readable representation of the selected report dataset with stable column names and explicit date, unit, and currency conventions; it does not attempt to reproduce PDF layout.
- CSV carries the same metric definitions, selected filters, date semantics, authorization scope, and report values as the corresponding API/view. Do not implement separate calculations for export.

### Export lifecycle, jobs, storage, and audit
- Keep small, bounded exports synchronous. An export expected or measured to exceed approximately 100 ms under load is handled by existing PgBoss. Measure representative report/export cost during planning rather than treating every export as asynchronous.
- Keep export job definitions and handling with the reporting module, following existing module `.jobs.ts` / `.worker.ts` patterns, and register its handler in `apps/server/src/worker.ts`. Reuse the existing PgBoss instance; do not introduce another queue or a separate worker process unless profiling later demonstrates isolation is necessary.
- Persist a bounded export record with owner, organization/project scope, report type, normalized filter snapshot, format, status, and expiry. Use a small state lifecycle sufficient for pending/processing/ready/failed/expired. Jobs are idempotent and carry `organizationId`; payloads contain identifiers and validated filters, not report result rows.
- Use existing MinIO storage for generated artifacts and existing signed-download patterns. Store objects under server-generated tenant/project-scoped keys; never accept or reveal raw object keys. Re-check authorization when issuing a download URL. Audit export requests and download authorization/URL issuance with actor, scope, format, filters, and outcome, but do not log report contents or sensitive financial values.
- User-confirmed lifecycle defaults: generated artifact retention of 24 hours and signed URL lifetime of 5 minutes, configurable and overridden only when verified deployment policy requires different values. Expiration removes access and schedules object cleanup; users can request a fresh export.
- UI/API must represent pending, ready, failed, and expired exports with clear retry/regenerate behavior. A failed job must not expose a partial or success-shaped artifact.

### Future platform capability boundary
- Do not add platform payment, usage-metering, subscription, invoice, or plan models in Phase 8. Keep organization/project reporting boundaries separate so a future platform-operator reporting perspective can be added with its own explicit scope and authorization; do not query across tenants in this phase.
- Do not introduce a second database, queue, worker process, storage system, event store, speculative reporting projection, or speculative Redis cache. Add a projection/cache only if codebase investigation and profiling prove it necessary and its data lifecycle, tenant scoping, invalidation, TTL, fallback, and tests are defined.

### Agent discretion
- The user's “finished, compact, industry-standard” direction means prefer established codebase patterns, stable event/report contracts, and only the minimum additional persistence/job lifecycle needed.
- The CSV shape follows the locked flat, stable-column contract. The configurable 24-hour retention and 5-minute signed URL defaults are user-confirmed; verify deployment policy and override only when evidence requires it.
- The user selected the report families, project and organization-portfolio perspectives, backend APIs plus web views, and CSV-only exports. PDF/XLSX are explicitly deferred.
- User-confirmed discussion choices: transparent indicators; explicit unavailable/coverage semantics; links to existing records; on-demand freshness; metric-appropriate date semantics; historical reporting only when supported by authoritative history; project/organization timezone with UTC fallback; report-specific date presets; authorized non-archived portfolio projects; currency grouping without invented conversion; visible partial coverage; portfolio totals and project rows; source-capability visibility; and reuse of existing project/organization authorization.
- Latest planning instruction asks that every Phase F capability from the supplied F.0–F.18 proposal be represented as a chunk; retain each named capability while splitting it into small, independently verifiable implementation plans.

### Deferred Ideas (OUT OF SCOPE)
- Platform-operator usage, payments, subscriptions, billing, and cross-tenant platform reporting — future phase after separate product/security requirements.
- Any report metric without an authoritative source or approved definition — defer that metric rather than fabricate it.
- PDF and XLSX rendering, renderer package selection/installation, and their implementation tests — explicitly deferred; Phase 8 is CSV-only.
</user_constraints>

<phase_requirements>
## Phase Requirements

Descriptions are copied from the active requirement set; the research support column points to findings and tests in this file. `[VERIFIED: .planning/REQUIREMENTS.md:20-100]`

| ID | Description | Research Support |
|---|---|---|
| EVT-01 | Domain events use a versioned, immutable, uniquely identifiable envelope with organization scope, optional project scope, actor where applicable, entity identity, timestamps, and trace/correlation fields consistent with repository conventions. | Outbox schema and existing producer payload audit; F.1 contract recommendations. |
| EVT-02 | A business mutation and its outbox event are persisted in the same database transaction; event payloads are validated and safe to serialize, retry, and deduplicate. | Existing transactional producer patterns and F.2 rollback/retry risks. |
| EVT-03 | Event consumers are registered independently of source modules and provide handler isolation, idempotency, retry/failure state, correlation-aware logging, and observable processing without duplicate event systems. | PgBoss worker/outbox review; F.3 durable idempotency and failure state. |
| NTF-01 | Notification intent, recipient, template/content, channel delivery, attempt, status, timestamps, failure reason, retry information, and source event/correlation are represented independently of provider-specific delivery. | Notification schema/module not found; F.4 minimum lifecycle gap. |
| NTF-02 | Email delivery uses a replaceable provider abstraction, templates, text/HTML content, retry/failure tracking, idempotency, and delivery status; sensitive credentials and financial data are not inadvertently included. | Existing SMTP transport limitations and F.5 safety recommendations. |
| NTF-03 | Realtime delivery is authorized against current organization context, project membership, and required permission before a connection subscribes or receives scoped events; identifiers alone never grant access. | Auth context/policy evidence; no realtime implementation found; F.6 authorization risks. |
| COM-01 | WhatsApp is represented by a provider-neutral channel contract and does not require a concrete vendor unless one is configured. | F.7 provider-neutral contract; no vendor dependency recommendation. |
| SCH-01 | Scheduled operational checks use the existing background-job infrastructure and domain services to detect due-date/overdue/expiring conditions; schedulers do not send provider messages directly. | PgBoss and compliance expiry scan patterns; F.8 uncovered reminder families. |
| PREF-01 | User channel/event preferences control delivery without suppressing or deleting the underlying domain event; preference hierarchy reuses existing settings conventions. | Existing org/project settings precedence; no user-channel preference model found. |
| RPT-01 | Reporting services use authoritative server-side domain services/read models; the web client does not recalculate business metrics. | Source service and frontend findings; F.10 foundation recommendation. |
| RPT-02 | Each exposed metric has a stable definition, source, filter contract, and date-range behavior so API, web UI, and downloads agree. | Metric/source coverage and common result contract findings. |
| RPT-03 | Reporting reads are organization- and project-scoped and respect the existing authorization model; wrong-tenant resources do not leak through results or errors. | Existing auth boundary patterns and schedule-metric tenant defect. |
| RPT-04 | Authorized project users can view a project health report using only agreed health categories and formulas. | F.11 source-backed indicators; no weighted score. |
| RPT-05 | Authorized project users can view schedule metrics derived from the existing schedule source of truth. | F.12 schedule-metric implementation and tenant repair requirement. |
| RPT-06 | Authorized project users can view cost/commercial metrics derived from Phase E financial truth, with coverage and unavailable values disclosed rather than fabricated. | F.13 commercial/financial summary reuse and coverage. |
| RPT-07 | Authorized project users can view procurement metrics derived from procurement source records. | F.14 source modules and supported fields; no invented schedule impact formula. |
| RPT-08 | Authorized project users can view subcontractor metrics derived from subcontractor and linked operational/commercial sources, without inventing contract commitments or performance scores. | F.15 subcontract commitment source gap. |
| RPT-09 | Authorized organization users can view an organization portfolio report with explicit project inclusion rules and tenant-safe aggregation. | F.16 org/project authority and currency grouping. |
| RPT-10 | Users can view an executive/project summary whose component values trace to the same authoritative report services. | F.16 common report-result contract. |
| RPT-11 | Authorized users can download reports as CSV; PDF/XLSX are explicitly deferred. | F.17 CSV rendering and format parity requirement. |
| RPT-12 | Exports use the same metric definitions, filters, date ranges, and authorization scope as the matching report API/view. | F.10/F.16/F.17 common server-produced result. |
| RPT-13 | Small exports may complete synchronously; exports expected or measured to exceed the repository's approximate 100 ms-under-load threshold use the existing PgBoss job infrastructure and a bounded, observable lifecycle. | F.17 PgBoss pattern; profile representative outputs before routing. |
| RPT-14 | Any generated export is stored and downloadable only through organization/project-scoped authorization and expiring download access; report data is not exposed by guessing identifiers or object keys. | MinIO/document download precedent and scoped export-record recommendation. |
| RPT-15 | Web report views expose agreed filters and formats and handle pending, ready, expired, and failed export states when asynchronous processing is used. | Current placeholder web app and export UI state gap. |
| EXT-01 | Reporting/module boundaries do not prevent a future platform operator perspective for usage, payments, and subscriptions; no platform billing domain is implemented by this requirement set. | Keep organization/project report boundaries clean; preserve out-of-scope boundary. |
</phase_requirements>

## Summary

Phase 8 must be planned as the full F.0–F.18 event/notification/scheduled-work/reporting/export sequence, not as a reporting-only phase. The actual implementation platform is the SiteFlow modular monolith: Fastify, Drizzle/PostgreSQL, PgBoss, Redis, MinIO, React/Vite, and the existing observability/audit/auth layers. This differs from proposal variants mentioning Prisma or BullMQ; do not add a second ORM, queue, worker process, database, or storage system. `[VERIFIED: .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:16-35; apps/server/package.json:1-60; packages/database/src/schema/outbox.schema.ts:1-34]`

The repository has a real transactional outbox writer and several domain-service producers, as well as a shared PgBoss singleton, worker registration, SMTP email service, a compliance expiry scan, financial summaries, schedule metrics, and MinIO signed URLs. Those are reusable foundations—not a complete event bus or notification/report/export product. The outbox envelope is currently unversioned and weakly typed, consumer idempotency includes a process-local example, notifications/preferences/realtime have no established module pattern in the inspected module/schema inventories, and the generic export queue declaration is not a working report-export lifecycle. `[VERIFIED: apps/server/src/lib/outbox/outbox.service.ts:1-150; apps/server/src/lib/queue/queue.ts:1-170; apps/server/src/modules/project/core/project.worker.ts:1-170; apps/server/src/modules/project/compliance/expiry-scanner.service.ts:1-170; apps/server/src/lib/email/email.service.ts:1-180]`

For reporting, extend the authoritative module services and keep one server-produced report result contract across API, web, and files. Cost and financial summaries already define coverage and unavailable forecast/subcontract commitment semantics; schedule metrics are reusable only after fixing the metric-row repository's missing organization scope. Procurement source records expose status/date/task links, but they do not themselves establish a business-approved material-to-schedule impact formula. The web app currently has a placeholder `App` rather than a report navigation/page system. `[VERIFIED: apps/server/src/modules/project/commercial-summary/commercial-summary.service.ts:1-110; apps/server/src/modules/project/financial-summary/financial-summary.service.ts:1-180; apps/server/src/modules/project/schedule-metrics/schedule-metrics.repository.ts:1-45; apps/server/src/modules/project/material-request/material-request.service.ts:1-260; apps/server/src/modules/project/purchase-order/purchase-order.service.ts:1-330; apps/web/src/App.tsx:1-8]`

**Primary recommendation:** keep the project-defined dependency order and all 19 chunk IDs distinct; use F.0 to confirm contracts, then build on the existing outbox/PgBoss and module services, create only the minimum notification/export persistence required, and defer cache/projection work unless representative profiling demonstrates a bottleneck. Treat event coverage, financial coverage, authorization, retention, and the sync/async export split as evidence-driven—not invented. `[VERIFIED: .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:9-35,55-115; .planning/checklist_when_to_apply.md:1-22,330-460]`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Event envelope, mutation/outbox atomicity, dispatch | API / Backend | Database / Storage | Domain services own mutations and call the transaction-bound outbox writer; the worker process dispatches persisted events. `[VERIFIED: apps/server/src/modules/project/core/project.service.ts:1-230; apps/server/src/lib/outbox/outbox.service.ts:1-150; apps/server/src/worker.ts:1-80]` |
| Notification lifecycle and preference decisions | API / Backend | Database / Storage | Keep intent and attempts separate from provider operations; no existing notification table/module was identified in inspected inventories. `[VERIFIED: packages/database/src/schema/: directory inventory; apps/server/src/modules/: directory inventory; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:43-65]` |
| Email, realtime, WhatsApp delivery | API / Backend | External provider boundary | Provider calls belong in asynchronous channel workers, not source-domain transactions; SMTP exists, but Socket.IO/realtime and WhatsApp provider contracts were not found. `[VERIFIED: apps/server/src/lib/email/email.service.ts:1-180; apps/server/package.json:1-60; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:43-65]` |
| Scheduled operational scans | API / Backend | Database / queue | PgBoss schedules jobs; the compliance expiry scanner is a concrete domain-source precedent. `[VERIFIED: apps/server/src/modules/project/compliance/expiry-scanner.worker.ts:1-40; apps/server/src/modules/project/compliance/expiry-scanner.service.ts:1-170; apps/server/src/worker.ts:1-80]` |
| Report aggregation and metric definitions | API / Backend | Database / Storage | Compose report services from authoritative project services; PostgreSQL remains truth. Do not calculate business metrics in React. `[VERIFIED: .planning/codebase/ARCHITECTURE.md:1-70; apps/server/src/modules/project/financial-summary/financial-summary.service.ts:1-180; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:67-88]` |
| Report navigation, filters, and presentation | Browser / Client | API / Backend | React/Vite is the browser tier; reports must consume API values and link to authorized existing details. Current `App.tsx` is only a placeholder. `[VERIFIED: apps/web/src/App.tsx:1-8; apps/web/package.json:1-45; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:67-115]` |
| Large report generation and export state | API / Backend | Database / Storage | API creates/reads scoped export state; PgBoss worker generates files; MinIO stores artifacts; download issuance must re-check access. `[VERIFIED: apps/server/src/lib/queue/queue.ts:1-170; apps/server/src/lib/storage/storage.service.ts:1-105; apps/server/src/modules/project/documents/document.service.ts:250-345; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:117-139]` |

## Standard Stack

Versions below are repository-declared package versions, not registry-current verification. No new third-party package is recommended: use built-in CSV serialization and native Fastify SSE if no compatible runtime is verified. PDF/XLSX are deferred and have no package selection/install task. `[VERIFIED: apps/server/package.json:1-60; apps/web/package.json:1-45; package.json:1-35]`

### Core

| Existing component | Repository-declared version | Purpose | Why standard here |
|---|---:|---|---|
| Fastify | `^5.2.1` | API and route lifecycle | Existing production app factory, validation, auth hooks, response handling, and OpenAPI composition. `[VERIFIED: apps/server/package.json:25-57; apps/server/src/app/index.ts:1-120]` |
| Drizzle ORM + PostgreSQL | `drizzle-orm ^0.36.4`, `pg ^8.13.1` | Persistence, transactions, authoritative reads | Existing schema/migration and transaction patterns; PostgreSQL is the source of truth. `[VERIFIED: apps/server/package.json:25-57; packages/database/src/schema/outbox.schema.ts:1-34; .planning/codebase/ARCHITECTURE.md:1-70]` |
| PgBoss | `^10.1.2` | Durable jobs, workers, schedules | Existing shared Postgres-backed queue and worker entrypoint. `[VERIFIED: apps/server/package.json:25-57; apps/server/src/lib/queue/queue.ts:1-170; apps/server/src/worker.ts:1-80]` |
| React / Vite | `react ^18.3.1`, `vite ^6.0.3` | Web report surfaces | Existing frontend runtime/build; no report UI component or navigation pattern was identified in `apps/web/src`. `[VERIFIED: apps/web/package.json:1-45; apps/web/src/App.tsx:1-8]` |
| Zod | `^3.23.8` | Request and shared-contract validation | Used by the established server/shared stack; all new inputs and report filters should follow repository validation conventions. `[VERIFIED: apps/server/package.json:25-60; .planning/checklist_when_to_apply.md:104-145]` |

### Supporting

| Existing component | Repository-declared version | Purpose | Use |
|---|---:|---|---|
| Redis / ioredis | `^5.4.2` | Existing cache, rate limiting, tenant-job limiting | Reuse only where already justified; it is not report truth or an authorization boundary. `[VERIFIED: apps/server/package.json:25-57; apps/server/src/lib/redis/redis.ts:1-50; .planning/checklist_when_to_apply.md:180-220]` |
| MinIO SDK | `^8.0.7` | Existing object store and presigned URL support | Reuse the storage service, validated keys, deletion, and the authorized document-download precedent. `[VERIFIED: apps/server/package.json:25-57; apps/server/src/lib/storage/storage.service.ts:1-105; apps/server/src/modules/project/documents/document.service.ts:290-345]` |
| Nodemailer | `^10.0.10` | Existing SMTP transport | Reuse as a transport behind a notification-owned provider boundary; it is not by itself delivery lifecycle or notification persistence. `[VERIFIED: apps/server/package.json:25-57; apps/server/src/lib/email/email.service.ts:1-100]` |
| Decimal.js | `^10.6.0` | Exact commercial arithmetic | Continue using the existing financial/commercial service calculations; do not reproduce them in exports or frontend code. `[VERIFIED: apps/server/package.json:25-57; apps/server/src/modules/project/commercial-summary/commercial-summary.service.ts:1-105]` |
| OpenTelemetry/Pino | `@opentelemetry/api ^1.9.0`, `pino ^9.5.0` | Tracing and structured logs | Reuse logger/tracer patterns and preserve IDs rather than adding a second observability system. `[VERIFIED: apps/server/package.json:25-57; apps/server/src/modules/project/engine/schedule.worker.ts:1-205]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Actual Drizzle/PostgreSQL/PgBoss | Proposal references to Prisma/BullMQ | Proposal names conflict with checked-in manifests and implementations. Use the actual stack; adding a parallel ORM/queue is out of scope. `[VERIFIED: apps/server/package.json:25-57; apps/server/src/lib/queue/queue.ts:1-170]` |
| Existing outbox and PgBoss | Direct provider calls or a new event broker | Direct sends bypass the transactional outbox and make rollback/retry behavior inconsistent; a second broker/worker is expressly out of scope. `[VERIFIED: apps/server/src/lib/outbox/outbox.service.ts:1-150; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:9-14,135-139]` |
| Existing domain services | New report-specific copies of financial/schedule formulas | Duplicated formulas can disagree with source workflows; service summaries already encode financial coverage and schedule calculation outputs. `[VERIFIED: apps/server/src/modules/project/commercial-summary/commercial-summary.service.ts:1-110; apps/server/src/modules/project/financial-summary/financial-summary.service.ts:1-180]` |

**Installation:** none recommended for the research baseline. If a formatter/generator dependency becomes necessary, select and audit it in its correct ecosystem before installation; no package has been registry or legitimacy checked in this session. `[VERIFIED: apps/server/package.json:25-60; apps/web/package.json:1-45]`

## Current Repository Contracts and Evidence

### Transactions, outbox, and events

- Domain services use Drizzle transactions and can atomically write audit and outbox records. `ProjectService.createProject` creates the project, settings, membership, audit row, and outbox row inside one transaction; material request submission/cancellation and purchase order approval/send/cancel also write their existing events in a transaction. `[VERIFIED: apps/server/src/modules/project/core/project.service.ts:30-110; apps/server/src/modules/project/material-request/material-request.service.ts:180-275; apps/server/src/modules/project/purchase-order/purchase-order.service.ts:270-390]`
- The outbox is generic and unversioned: the schema has separate event ID, tenant, type, JSON payload, state/retry/error/timestamps, but no first-class event version, actor, entity, correlation, or consumer-delivery columns. The current persisted state values are quoted verbatim: `['PENDING', 'PROCESSED', 'FAILED']`. `[VERIFIED: packages/database/src/schema/outbox.schema.ts:1-34]`
- The writer accepts `eventType: string`, `payload: Record<string, any>`, and optional `organizationId`; when omitted it falls back to the payload field and can persist `null`. The writer inserts a pending row and attempts a `NOTIFY siteflow_outbox`. F.1/F.2 should make tenant scope and payload validation explicit while retaining the same transactional table/notification mechanism if F.0 confirms no competing contract. `[VERIFIED: apps/server/src/lib/outbox/outbox.service.ts:10-45; packages/database/src/schema/outbox.schema.ts:10-28]`
- The dispatcher forwards `event.eventType` as the PgBoss queue name, then marks the row processed; its retry ceiling is `MAX_OUTBOX_RETRIES = 5`. Existing outbox states are not a consumer-specific delivery ledger or an explicit dead-letter queue. Its selection uses `FOR UPDATE SKIP LOCKED`, but selection, queue send, and state update are separate calls in the shown implementation. Confirm locking/claim behavior with a two-worker failure/retry test before treating it as duplicate-proof. `[VERIFIED: apps/server/src/lib/outbox/outbox.service.ts:10-115; ASSUMED: lock/claim race needs reproduction against the configured Drizzle/Postgres connection lifecycle]`
- Producer vocabulary is heterogeneous: project jobs use a module queue constant and job envelope; procurement uses string event names; document upload uses a queue constant. Examples include `procurement.material_request.submitted`, `procurement.purchase_order.approved`, and `DOCUMENT_QUEUES.UPLOADED`. These names are source evidence, not proof that the supplied F.1 event vocabulary is fully emitted. `[VERIFIED: apps/server/src/modules/project/core/project.jobs.ts:1-70; apps/server/src/modules/project/material-request/material-request.service.ts:215-270; apps/server/src/modules/project/purchase-order/purchase-order.service.ts:320-390; apps/server/src/modules/project/documents/document.service.ts:250-345]`
- The inspected current producer set includes project create/update, procurement transitions, document upload, and compliance-expiry scan events. Existing project worker handlers mostly log/trace; their `processedEvents` set is process-local, so it cannot serve as durable idempotency across restarts. Schedule recalculation also enqueues a metrics-refresh job directly after calculation rather than using the transactional outbox. `[VERIFIED: apps/server/src/modules/project/core/project.service.ts:30-110,155-220; apps/server/src/modules/project/core/project.worker.ts:1-170; apps/server/src/modules/project/engine/schedule.worker.ts:35-155]`
- The event names requested by the phase are a user-specified contract, conditional on real source workflows. Keep this quote as the authoritative vocabulary: `TaskCompleted`, `TaskDelayed`, `TaskDateChanged`, `MaterialOrdered`, `MaterialDelayed`, `MaterialDelivered`, `IssueCreated`, `IssueResolved`, `RfiCreated`, `RfiOverdue`, `SubmittalSubmitted`, `SubmittalRejected`, `InspectionScheduled`, `InspectionFailed`, `ChangeOrderCreated`, `ChangeOrderApproved`, `PaymentApplicationSubmitted`, `PaymentOverdue`, `DocumentExpiring`, and `SafetyIncidentCreated`. `[VERIFIED: .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:37-43]`

### PgBoss, worker, retries, and scheduled work

- `getQueueInstance()` creates one PgBoss instance against the database, enables `useListenNotify`, pre-creates declared queues, and exposes `sendJob`. The generic export declaration is incomplete: `ExportPayload` currently has only `resourceType`, `resourceId`, `format: 'csv' | 'pdf'`, and `requestedBy`; it carries no organization scope, has no XLSX, and the inspected worker registration contains no export worker. `[VERIFIED: apps/server/src/lib/queue/queue.ts:1-170; apps/server/src/worker.ts:1-80]`
- `registerWorker` is the best existing generic worker pattern: configurable team concurrency/timeout, optional tenant ID extraction/lease, structured lifecycle logging, and thrown-error propagation to PgBoss. Its source comment states “retry with exponential backoff + jitter (configured in pg-boss queue options)”; F.0 must verify the actual effective queue retry defaults/options rather than assume that comment sets them. `[VERIFIED: apps/server/src/lib/queue/worker-factory.ts:1-95]`
- `apps/server/src/worker.ts` registers auth, organization, project, schedule, and compliance handlers and starts the outbox poller. Existing PgBoss schedules cover cleanup and invitation expiry; compliance schedules an expiry scan. Reuse this worker registry and use module-owned `.jobs.ts`/`.worker.ts` additions; do not create another worker process. `[VERIFIED: apps/server/src/worker.ts:1-80; apps/server/src/modules/project/compliance/expiry-scanner.worker.ts:1-40]`
- The compliance scanner is a useful scheduled/idempotency starting point: it reads active expiring records, locks/rechecks the candidate inside a transaction, writes an outbox event, and marks `expiresNotified`. It covers document/permit/compliance records only; it does not prove that RFI, payment, submittal, task, or delivery reminder jobs exist. `[VERIFIED: apps/server/src/modules/project/compliance/expiry-scanner.service.ts:1-165]`
- Job IDs/payloads generally preserve `organizationId`, optional `projectId`, actor/correlation, and sometimes idempotency keys, but not every job type has every field. Validate tenant and domain identity at each handler; do not accept arbitrary provider payloads. `[VERIFIED: apps/server/src/modules/project/core/project.jobs.ts:1-70; apps/server/src/modules/project/engine/schedule.jobs.ts:1-45; apps/server/src/modules/project/engine/schedule.worker.ts:35-100]`

### Auth, tenant scope, audit, cache

- `organizationContext`/`projectContext` are the source for organization and project identity; `ProjectContext` carries organization ID, project ID, user ID, org permissions, and project membership. Project middleware checks the project under the authenticated organization, returns the non-leaking project-not-found path for wrong-org identifiers, and calls the policy guard for project permissions. Portfolio access must extend these existing authority rules, not infer from a role label or accept tenant IDs from a report query. `[VERIFIED: apps/server/src/modules/rbac/rbac.types.ts:1-25; apps/server/src/modules/project/core/project.types.ts:80-110; apps/server/src/modules/project/core/project.middleware.ts:1-160; apps/server/src/modules/project/core/project.policy.ts:1-500]`
- Policy already maps source-domain read capabilities and organization-level cross-project authority. Add a reporting capability only if F.0 shows source capability inheritance cannot express a required section. When adding one, update both capability maps and test project and org-level boundaries. `[VERIFIED: apps/server/src/modules/project/core/project.policy.ts:1-500; .planning/checklist_when_to_apply.md:145-180]`
- Audit records can be written through `auditService.log(entry, tx)` in the same transaction as a mutation. Reuse it for security-sensitive export lifecycle actions; log IDs/scope/outcome rather than report content or sensitive financial values. `[VERIFIED: apps/server/src/modules/audit/audit.service.ts:1-65; apps/server/src/modules/project/core/project.service.ts:65-105]`
- Redis is a shared ioredis client and an optional acceleration layer; schedule metrics and project-context middleware catch cache errors and fall back to PostgreSQL. Existing schedule metric keys include organization, project, and revision, while project context keys include organization/project/user. Do not add a report cache absent profiling. `[VERIFIED: apps/server/src/lib/redis/redis.ts:1-50; apps/server/src/modules/project/schedule-metrics/schedule-metrics.service.ts:25-120; apps/server/src/modules/project/core/project.middleware.ts:1-145; .planning/checklist_when_to_apply.md:180-220]`
- Project-context cache TTL is 120 seconds, so F.6 must explicitly decide how membership revocation and room/event delivery freshness work; a one-time room join based on a stale cached membership cannot be assumed to reflect current authorization. `[VERIFIED: apps/server/src/modules/project/core/project.middleware.ts:10-25; ASSUMED: realtime authorization freshness needs a design/probe because the repository currently has no realtime implementation]`

### Email, realtime, notifications, preferences

- `EmailService` uses Nodemailer with configured SMTP when credentials exist and otherwise creates an Ethereal test account, with JSON-transport fallback if that setup fails. This is a working account/invitation email transport, not a replaceable notification-provider contract, templating/catalog system, or persisted attempt/delivery lifecycle. Treat the test-account fallback and its preview-URL logging as development behavior to review before sending project/financial notifications. `[VERIFIED: apps/server/src/lib/email/email.service.ts:1-100; apps/server/src/modules/invitation/invitation.worker.ts:1-70]`
- The server package manifest does not declare Socket.IO and the inspected server module inventory does not show a realtime/notification module. This means there is no verified checked-in realtime runtime; F.0 must still inventory deployment/runtime wiring and outbox/notification delivery. If no compatible existing runtime is verified, F.6 implements native Fastify SSE and current authorization checks without adding a transport dependency. `[VERIFIED: apps/server/package.json:1-60; apps/server/src/modules/: directory inventory; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:47-53]`
- No notification lifecycle or per-user channel preference schema/module was identified in the inspected database schema and server module inventories. Existing settings do support org and project effective values: project settings override org settings, with UTC fallback for timezone; the implementation is `timezone: projectSettings?.timezone ?? orgSettings?.timezone ?? 'UTC'`. That does not establish an existing user notification-preference contract. Add only minimum preference/delivery persistence after F.0. `[VERIFIED: packages/database/src/schema/: directory inventory; apps/server/src/modules/: directory inventory; apps/server/src/modules/project/settings/project-settings.service.ts:1-100; apps/server/src/modules/organization/settings/settings.service.ts:1-100]`
- Email content is interpolated into inline HTML in current account flows. New notification templates need context-appropriate escaping and secret/financial-data minimization; do not copy account-template construction as the final notification design. `[VERIFIED: apps/server/src/lib/email/email.service.ts:65-180; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:47-58]`

### Reporting sources, metrics, history

- Schedule metrics currently expose total tasks, completed tasks, critical task count, schedule revision, and updated timestamp. Task queries include organization and project; however, the persisted metric lookup and upsert are project-ID-only. Exact problematic expressions: `.where(eq(projectScheduleMetrics.projectId, projectId))` and `target: projectScheduleMetrics.projectId`. Fix and add two-organization isolation tests before F.12/report reuse. `[VERIFIED: apps/server/src/modules/project/schedule-metrics/schedule-metrics.repository.ts:1-45; apps/server/src/modules/project/schedule-metrics/schedule-metrics.service.ts:35-115]`
- `ScheduleMetricsService` uses Redis, then a persisted summary row, then live DB counts; Redis keys include organization/project/revision and Redis failures fall back. That is an existing schedule optimization only; it is not evidence that a report-wide projection or Redis cache is needed. `[VERIFIED: apps/server/src/modules/project/schedule-metrics/schedule-metrics.service.ts:25-120]`
- Commercial summary reports original/revised budget, approved budget changes, committed PO amounts, posted actuals, and explicitly returns `forecast: null` with a reason. Its coverage is approved purchase orders only; subcontract commitments and invoice lifecycle coverage are deferred. Reuse that output and its disclosure, not a new aggregate formula. `[VERIFIED: apps/server/src/modules/project/commercial-summary/commercial-summary.service.ts:1-110]`
- Financial summary composes the commercial summary with approved contract values, payment applications, billed/approved invoices, executed payments, and retainage; it reports values by currency and documents formulas. Distinguish billed, approved, paid/cash, outstanding, and held/released retainage. Existing source code indicates subcontract commitment coverage remains deferred. `[VERIFIED: apps/server/src/modules/project/financial-summary/financial-summary.service.ts:1-180]`
- Procurement source modules exist for material requests, purchase orders, delivery, receipts, procurement approval, and inventory. Material-request items can link a task and required-by date; PO items can link a task and expected delivery date. Those links support traceable rows, but a “material-to-task schedule impact” formula, risk weight, or forecast is not established by those fields alone. `[VERIFIED: apps/server/src/modules/project/material-request/material-request.service.ts:1-275; apps/server/src/modules/project/purchase-order/purchase-order.service.ts:1-390; apps/server/src/modules/project/delivery/: directory inventory; apps/server/src/modules/project/inventory/: directory inventory]`
- The subcontractor domain exists as a project module, but the financial summary explicitly states its commitment coverage is deferred until an approved contract source exists. Thus subcontractor reports can link to actual supported subcontractor/operational data but must not fabricate contract commitments, workload promises, or performance scoring. `[VERIFIED: apps/server/src/modules/project/subcontractor/: directory inventory; apps/server/src/modules/project/financial-summary/financial-summary.service.ts:75-145; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:72-80]`
- The checked-in services provide current operational summaries and audit/history surfaces, but no evidence was found that every requested metric has an as-of historical snapshot. For each metric, F.0/F.10 must mark it current-only or unavailable unless its source history is demonstrated; do not backfill historical values from present state. `[VERIFIED: apps/server/src/modules/project/financial-summary/financial-summary.service.ts:35-175; apps/server/src/modules/project/schedule-metrics/schedule-metrics.service.ts:35-115; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:83-95]`

### Export storage and web surface

- The current `ExportPayload` is not a report job contract: it lacks `organizationId`, normalized filters, report family, export record ID, expiry, and XLSX. No producer/worker for that generic queue is registered in the inspected worker entrypoint. Keep this explicitly as an incomplete declaration, not reusable export infrastructure. `[VERIFIED: apps/server/src/lib/queue/queue.ts:35-90; apps/server/src/worker.ts:1-80; .planning/codebase/CONCERNS.md:1-45]`
- The MinIO adapter validates object keys and presign expiry, can delete/head objects, and constructs tenant/project/category paths; `objectKey` requires both `orgId` and `projectId`. A portfolio export has no single natural project ID, so specify a safe org-scoped key shape using the existing storage adapter boundary before coding. Do not expose raw keys. `[VERIFIED: apps/server/src/lib/storage/storage.service.ts:1-105; apps/server/src/lib/storage/storage.interface.ts:1-25]`
- The existing document download flow looks up the row scoped by organization/project/document, checks lifecycle and access policy, issues a presigned URL, re-locks and re-checks access, and writes an access log. Use this pattern for an export record, substituting export ownership and report scope. `[VERIFIED: apps/server/src/modules/project/documents/document.service.ts:290-345]`
- The storage adapter supports object deletion, but no export-artifact retention/cleanup job was found in the inspected worker registrations. A persisted expiry timestamp alone does not delete an object; F.17 must explicitly schedule/perform idempotent cleanup and revoke record-based access. `[VERIFIED: apps/server/src/lib/storage/storage.service.ts:40-90; apps/server/src/worker.ts:1-80; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:125-139]`
- User-confirmed configurable defaults are 24-hour artifact retention and 5-minute signed URL expiry. Inspect deployment policy; override only when verified policy requires another value. Local `docker-compose.yml` declares `STORAGE_PRESIGN_EXPIRY_SECONDS: 3600` for the existing document worker, which is not by itself a verified export deployment-policy override. `[VERIFIED: .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:129-139; docker-compose.yml:160-205]`
- `apps/web/src/App.tsx` currently renders only a basic SiteFlow title/tagline; the inspected web source directory shows no report navigation, route tree, or report page pattern. F.16 therefore includes new UI surface work; don’t claim an existing report dashboard architecture. `[VERIFIED: apps/web/src/App.tsx:1-8; apps/web/src/: directory inventory; apps/web/package.json:1-45]`
- Server manifest contains no PDF/XLSX generator dependency; PDF/XLSX are deferred. CSV is built from one authorized server result object using built-in serialization; do not select or install a renderer package. `[VERIFIED: apps/server/package.json:1-60; apps/web/package.json:1-45; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:75-85]`

## Architecture Patterns

### System Architecture Diagram

```text
Domain route/service
  └─ authenticated org/project context + source-module authorization
      └─ PostgreSQL transaction
          ├─ authoritative domain mutation
          ├─ audit record where required
          └─ validated versioned outbox event
                └─ existing worker/outbox poller
                    └─ idempotent independent handler
                        └─ notification intent / scheduled scan
                            └─ preference + authorization decision
                                └─ provider worker
                                    ├─ SMTP (existing transport)
                                    ├─ realtime only if supported/wired after F.0
                                    └─ provider-neutral WhatsApp contract

Authenticated report request
  └─ resolve permitted organization/project scope and effective timezone
      └─ report service composes existing domain services/repositories
          ├─ source-backed metrics + explicit coverage/as-of/filter contract
          ├─ project view / portfolio view
          └─ export request
              ├─ bounded fast export -> synchronous response
              └─ measured expensive export -> existing PgBoss job
                  └─ report result -> CSV -> MinIO object
                      └─ scoped export-record reauthorization -> short-lived URL
```

This diagram separates the intended Phase F boundaries and reuses current API/database/worker/storage process boundaries; notification and report/export persistence is not currently a complete subsystem. `[VERIFIED: .planning/codebase/ARCHITECTURE.md:1-70; apps/server/src/worker.ts:1-80; apps/server/src/lib/outbox/outbox.service.ts:1-150; apps/server/src/modules/project/documents/document.service.ts:290-345]`

### Recommended Project Structure

Follow established module locality; add only required reporting module files and shared contracts:

```text
apps/server/src/
├── lib/outbox/                 # current transactional writer/dispatcher; evolve compatibly
├── lib/queue/                  # current PgBoss singleton/worker factory
├── modules/
│   ├── project/<domain>/       # existing source services; do not couple to consumers
│   ├── notification/           # new only if F.0 confirms no reusable module
│   └── reporting/              # new report services/routes and export job/worker
├── worker.ts                   # register new worker handlers/schedules here
└── ...
packages/
├── database/src/schema/         # minimum event/notification/export persistence
└── shared/src/                  # validated API/filter/DTO contracts as established
apps/web/src/
├── App.tsx                      # current minimal shell; expand with report nav/views
└── ...
```

This is a recommended logical split, not a claim that these folders already exist. `[VERIFIED: .planning/codebase/ARCHITECTURE.md:1-70; apps/server/src/worker.ts:1-80; apps/web/src/App.tsx:1-8; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:117-127]`

### Pattern 1: Mutation plus outbox in one transaction

**What:** Keep domain mutation, audit where required, and event insert inside the same `db.transaction` callback. No email, Redis, HTTP, or provider call inside that transaction. `[VERIFIED: apps/server/src/modules/project/core/project.service.ts:30-110; apps/server/src/modules/project/material-request/material-request.service.ts:215-270; .planning/checklist_when_to_apply.md:180-220]`

**When to use:** Any event representing committed domain state. Event publisher receives the transaction handle; event validation must fail the mutation rather than commit an invalid event.

**Example shape:**

```ts
await db.transaction(async (tx) => {
  const updated = await domainRepository.mutate(tx, scope, input);
  await auditService.log(auditEntry, tx);
  await writeOutboxEvent(tx, eventType, validatedEventPayload, organizationId);
  return updated;
});
```

The function names are established (`writeOutboxEvent`, `auditService.log`); the event envelope/schema and final function signatures remain for F.0/F.1 to define. `[VERIFIED: apps/server/src/lib/outbox/outbox.service.ts:10-45; apps/server/src/modules/audit/audit.service.ts:20-55; apps/server/src/modules/project/core/project.service.ts:30-110]`

### Pattern 2: Existing queue worker wrapper

**What:** Register worker in module-owned worker code through `registerWorker`, pass organization scope in the job data, set a bounded concurrency/timeout, and rethrow transient failures so PgBoss can retry. `[VERIFIED: apps/server/src/lib/queue/worker-factory.ts:1-95; apps/server/src/modules/project/engine/schedule.worker.ts:35-100]`

**When to use:** Scheduled checks, channel delivery, and async exports whose expected or measured runtime exceeds the project’s approximately 100ms-under-load guide. The threshold is a design/profiling trigger, not a measured fact about these reports. `[VERIFIED: .planning/checklist_when_to_apply.md:25-45; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:117-127]`

### Pattern 3: Authorization-scoped download

**What:** Resolve an export record using authenticated organization/user scope, authorize the requested report contents, then issue a presigned URL through `StorageService`; never use caller-provided object keys. `[VERIFIED: apps/server/src/modules/project/documents/document.service.ts:290-345; apps/server/src/lib/storage/storage.service.ts:1-65]`

**When to use:** Every ready export download, including portfolio files, and every fresh URL request. Expiration/failed states must not generate access to leftover objects.

## Minimal Dependency-Ordered Chunk Recommendation

Retain all chunks individually; these are sequencing dependencies, not permission to merge IDs. The ordering follows the canonical F.0–F.18 list in current context. `[VERIFIED: .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:9-35]`

| Order | Chunk | Minimal dependency / planning gate |
|---:|---|---|
| 1 | **F.0 Repository/contract audit** | Inventory verified transactions, producers/consumers, worker retry semantics, preferences, channels, source definitions, scopes, storage lifecycle, UI, and test patterns. No business feature. |
| 2 | **F.1 Domain event contract** | Depends on F.0; specify envelope, validation, version strategy, and only source-supported vocabulary. |
| 3 | **F.2 Transactional event publishing** | Depends on F.1 and verified existing outbox behavior; make mutation/event atomic, scoped, tested for rollback and duplicate publication. |
| 4 | **F.3 Event dispatcher/consumers** | Depends on F.2; durable idempotency/failure state and handler isolation before delivering intents to channels. |
| 5 | **F.4 Notification core** | Depends on F.3; persist notification intent/recipient/delivery/attempt lifecycle independently from providers. |
| 6 | **F.5 Email delivery** | Depends on F.4; reuse SMTP transport behind replaceable provider and add safe templates/delivery tracking. |
| 7 | **F.6 Realtime events** | Depends on F.4 and F.0 realtime finding; only select/use an actual compatible stack after verifying it, with server-side auth at subscribe and delivery boundaries. |
| 8 | **F.7 WhatsApp abstraction** | Depends on F.4; provider-neutral outbound interface only unless deployment policy authorizes a vendor. |
| 9 | **F.8 Scheduled jobs** | Depends on F.3/F.4 and F.0 source-flow audit; enqueue tenant-scoped reminder checks through existing worker/job patterns. |
| 10 | **F.9 Notification preferences** | Depends on F.4; use only settings scopes confirmed to exist and apply preference decisions after event creation. |
| 11 | **F.10 Reporting foundation** | Depends on communication/foundation sequence; define a single server report-result/filter/date/coverage contract and authoritative source map. Fix schedule metric tenancy before reuse. |
| 12 | **F.11 Project health** | Depends on F.10; ship separate source-backed indicators only, no weighted score. |
| 13 | **F.12 Schedule metrics** | Depends on F.10 and tenant-safe repair/retest of schedule-metrics repository. |
| 14 | **F.13 Cost metrics** | Depends on F.10; compose Phase E summaries and preserve currency and unavailable coverage. |
| 15 | **F.14 Procurement metrics** | Depends on F.10; use source-backed status/date/task links; no unsupported impact formula. |
| 16 | **F.15 Subcontractor metrics** | Depends on F.10 and approved subcontractor/contract source mapping; disclose unavailable commitments. |
| 17 | **F.16 Executive/reporting APIs** | Depends on F.11–F.15; serve project/portfolio results and corresponding web views with same filters, source visibility, auth, pagination. |
| 18 | **F.17 Report export/download service** | Depends on F.16 stable result contract; use shared report values, existing PgBoss/MinIO, scoped export lifecycle, and measured sync/async split. |
| 19 | **F.18 Phase hardening** | Depends on all prior chunks; phase-level regression/security/concurrency/API/worker/export review and Tier 2 gates. Keep Tier 3 pre-production load tests out of implementation chunk gates. |

Within steps 6–10 and 12–16, independently verifiable plans can be parallelized only after the stated shared contract exists; do not collapse or omit a named chunk. `[VERIFIED: .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:9-35; .planning/checklist_when_to_apply.md:1-22]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Business-event durability | A second event store or direct provider sends from mutation handlers | Existing PostgreSQL outbox, improved/validated through F.0–F.3 | Existing domain services already call `writeOutboxEvent(tx, ...)`; the shared table and listener/poller are in place. `[VERIFIED: apps/server/src/lib/outbox/outbox.service.ts:10-150]` |
| Queue and retries | A new Redis queue or separate worker process | Existing PgBoss singleton, `registerWorker`, and `apps/server/src/worker.ts` | Existing PostgreSQL-backed queue and worker lifecycle are already configured. `[VERIFIED: apps/server/src/lib/queue/queue.ts:1-170; apps/server/src/lib/queue/worker-factory.ts:1-95; apps/server/src/worker.ts:1-80]` |
| Commercial formulas | A report-only duplicate or UI calculation | `commercialSummaryService` and `financialSummaryService` | Existing exact-decimal calculations and explicit coverage/formula semantics. `[VERIFIED: apps/server/src/modules/project/commercial-summary/commercial-summary.service.ts:1-110; apps/server/src/modules/project/financial-summary/financial-summary.service.ts:1-180]` |
| Schedule task metrics | A second task-count calculator/read model without measurement | Existing `ScheduleMetricsService`, after correcting repository tenant scope | Current service already computes counts and has optional Redis + PostgreSQL materialization; repository lookup/upsert scope must be repaired first. `[VERIFIED: apps/server/src/modules/project/schedule-metrics/schedule-metrics.service.ts:25-120; apps/server/src/modules/project/schedule-metrics/schedule-metrics.repository.ts:1-45]` |
| Authorization | A reporting-specific role-name bypass or caller-supplied tenant ID | `orgContext`, `projectCtx`, project policy and source module permissions | Existing context/policy supplies organization and project authority; tenant IDs in untrusted request filters must not establish scope. `[VERIFIED: apps/server/src/modules/rbac/rbac.types.ts:1-25; apps/server/src/modules/project/core/project.middleware.ts:1-160; apps/server/src/modules/project/core/project.policy.ts:1-500]` |
| Storage/signing | Raw object-key endpoints or a parallel object store | MinIO `StorageService`, validated object-key construction and authorization precedent | Existing adapter validates paths/expiry and has delete/head/presign support. `[VERIFIED: apps/server/src/lib/storage/storage.service.ts:1-105; apps/server/src/modules/project/documents/document.service.ts:290-345]` |
| Email delivery transport | A second SMTP implementation | Existing Nodemailer service behind a channel/provider interface | Reuse transport, but add notification lifecycle/template/provider boundary; current service alone is not that abstraction. `[VERIFIED: apps/server/src/lib/email/email.service.ts:1-100]` |
| File formats | Separate report calculations per format | One authorized backend report result and a thin built-in CSV serializer | Avoid calculation drift; PDF/XLSX are deferred and no renderer dependency is selected. `[VERIFIED: .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:75-85; apps/server/package.json:25-60]` |

**Key insight:** The expensive risk is not drawing a report or wrapping an email call; it is keeping the same tenant-authorized domain truth, metric semantics, date scope, retry behavior, and security boundaries across API, async work, realtime, and downloadable copies. The established services/outbox are the correct foundation, but each identified gap must be closed before it is treated as complete infrastructure. `[VERIFIED: .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:37-139; .planning/siteflow_testing_context.md:1-120]`

## Common Pitfalls

### 1. Treating an outbox row as exactly-once consumer processing
**What goes wrong:** A publish/send succeeded but acknowledgement failed, or two pollers dispatch an event twice; consumer side effects duplicate.
**Why:** Outbox dispatch is retryable and the queue is at-least-once in practical failure conditions; an in-memory `Set` is not durable.
**How to avoid:** F.0 prove claim/lock behavior; F.3 persist idempotency per consumer/event (or an equivalent durable unique invariant) and test worker restart/replay.
**Warning signs:** repeated notifications after restart, outbox marked processed while handler has not completed, or failures with no queryable terminal state. `[VERIFIED: apps/server/src/lib/outbox/outbox.service.ts:48-115; apps/server/src/modules/project/core/project.worker.ts:1-45; ASSUMED: duplicate dispatch race requires reproduction]`

### 2. Assuming all proposal event names have current producers
**What goes wrong:** Events contain invented or stale state, or events are silently omitted from real domain transitions.
**Why:** Current producers are a mix of existing queue/event strings, not one validated versioned catalog.
**How to avoid:** Map each event name to its actual domain transition/service in F.0; emit only when that transition exists, and add tests at the transaction boundary. `[VERIFIED: apps/server/src/modules/project/core/project.jobs.ts:1-70; apps/server/src/modules/project/material-request/material-request.service.ts:215-270; apps/server/src/modules/project/purchase-order/purchase-order.service.ts:320-390; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:37-43]`

### 3. Calling notifications from inside transactions or before preferences/auth checks
**What goes wrong:** External send cannot roll back with the mutation, transient provider errors block domain work, or unauthorized recipients receive content.
**How to avoid:** Persist notification intent transactionally downstream of a valid event; use workers for external calls, evaluate user/channel preference without suppressing the domain event, and revalidate authorization for realtime. `[VERIFIED: .planning/checklist_when_to_apply.md:180-220; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:43-65]`

### 4. Reusing schedule metrics without fixing tenant scope
**What goes wrong:** Materialized row access/upsert is scoped only by project ID although report reads are tenant scoped.
**How to avoid:** Fix `findByProject` and conflict targeting to preserve `organizationId`; integration-test two orgs before building F.12 or portfolio aggregation on it. `[VERIFIED: apps/server/src/modules/project/schedule-metrics/schedule-metrics.repository.ts:1-45; .planning/siteflow_testing_context.md:1-120]`

### 5. Inventing portfolio totals, historic numbers, or health/impact scores
**What goes wrong:** Users interpret an unsupported zero/forecast/score as financial truth or complete portfolio coverage.
**How to avoid:** Group by currency; preserve “not available” and source coverage; show only current facts unless history is authoritative; never infer a material-impact or subcontractor score from a relationship alone. `[VERIFIED: apps/server/src/modules/project/commercial-summary/commercial-summary.service.ts:1-110; apps/server/src/modules/project/financial-summary/financial-summary.service.ts:1-180; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:67-115]`

### 6. Treating the generic export queue as an export product
**What goes wrong:** Jobs lack tenant and normalized report scope, omit XLSX, and are not processed; raw artifacts may outlive access.
**How to avoid:** Add scoped export-record lifecycle and a reporting worker through the current PgBoss worker; payloads carry validated IDs/filters, not report rows; cleanup/retry must be durable and idempotent. `[VERIFIED: apps/server/src/lib/queue/queue.ts:35-90; apps/server/src/worker.ts:1-80; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:117-139]`

### 7. Exposing signed URLs without rechecking scoped export ownership
**What goes wrong:** A guessed ID/key or an expired/failed record exposes another tenant's report.
**How to avoid:** Lookup export record scoped to authenticated organization and requester/report permission, issue URL only for `ready`, log issuance, and use a bounded expiry. Expiry must also delete objects or make them inaccessible. `[VERIFIED: apps/server/src/modules/project/documents/document.service.ts:290-345; apps/server/src/lib/storage/storage.service.ts:1-105]`

### 8. Inventing a settings hierarchy or trusting stale realtime membership
**What goes wrong:** User/project preference behavior differs from existing settings; revoked users continue receiving events.
**How to avoid:** F.0 map real settings scopes and member-change invalidation, then implement only supported preference precedence and current authorization checks. `[VERIFIED: apps/server/src/modules/project/settings/project-settings.service.ts:1-100; apps/server/src/modules/organization/settings/settings.service.ts:1-100; apps/server/src/modules/project/core/project.middleware.ts:1-145]`

### 9. Overloading request paths or adding cache before evidence
**What goes wrong:** A portfolio/CSV request causes long synchronous work or introduces stale tenant-sensitive caches.
**How to avoid:** Bound and profile representative report/export samples; keep fast bounded exports synchronous and use PgBoss only for measured/expected expensive work. Do not add report Redis cache/projection speculatively. `[VERIFIED: .planning/checklist_when_to_apply.md:25-45,200-220; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:83-88,117-127]`

## Validation Architecture

Nyquist validation is enabled; the configuration declares `"workflow": { "nyquist_validation": true }`. Include the following in phase plans. `[VERIFIED: .planning/config.json:1-20]`

### Test Framework

| Property | Value |
|---|---|
| Backend framework | Vitest 3; `apps/server` declares `test: vitest run`. `[VERIFIED: apps/server/package.json:1-24]` |
| Integration app | `createTestApp()` → `buildApp()` → `app.ready()` and route tests with `app.inject()`. `[VERIFIED: .planning/siteflow_testing_context.md:1-90]` |
| Database | Dedicated PostgreSQL test service on port `5434`; randomized run IDs scope fixtures; real PostgreSQL, transactions, constraints, and PgBoss behavior are required for applicable integration tests. `[VERIFIED: .planning/siteflow_testing_context.md:90-180]` |
| Quick backend command | `pnpm --filter @siteflow/server test` (Vitest script). `[VERIFIED: apps/server/package.json:1-24; .planning/codebase/TESTING.md:1-45]` |
| Web E2E command | `pnpm --filter @siteflow/web test:e2e`. `[VERIFIED: apps/web/package.json:1-20; .planning/codebase/TESTING.md:1-45]` |
| Phase suite commands | `pnpm test`, `pnpm build`; web checks/E2E when UI changes. `[VERIFIED: package.json:1-25; .planning/codebase/TESTING.md:1-45]` |

### Phase Requirements → Test Map

| Requirement IDs | Behaviors to prove | Test type / command | File exists? |
|---|---|---|---|
| EVT-01–EVT-03 | Version/schema validation; required tenant; atomic rollback; duplicate/replay idempotency; consumer failure isolation and observable failure state | Unit for pure envelope validation; PostgreSQL integration + deterministic worker tests via server Vitest | New phase tests required |
| NTF-01–NTF-03, COM-01 | Persist intent/attempt/failure; provider retry; safe email content; authorized realtime connect/subscribe/delivery; WhatsApp provider-neutral dispatch | Integration for persistence/provider boundary and authorization; unit for pure rendering/selection | New phase tests required |
| SCH-01, PREF-01 | Scheduled scan dedupe and tenant scoping; preference controls channels but not event persistence | PostgreSQL/PgBoss integration with duplicate/retry + settings precedence | New phase tests required |
| RPT-01–RPT-03 | Same server result across callers; strict filters/date semantics; wrong-org non-leakage; bounded indexed query | Fastify `app.inject()` integration with real DB and at least two orgs | New phase tests required |
| RPT-04–RPT-08 | Project health/schedule/commercial/procurement/subcontractor only from authoritative facts; unavailable/coverage handling; tenant-safe schedule source | Pure formula unit tests plus persisted-state integration | New phase tests required |
| RPT-09–RPT-10 | Authorized project inclusion, currency grouping, bounded cursor, drill-through permission and executive summary parity | Route integration + two-org/project membership fixtures | New phase tests required |
| RPT-11–RPT-15 | CSV parity, scoped job states, no guessed URL/key, expiry/cleanup, failed-job safety, sync/async path | CSV renderer tests + DB/MinIO/PgBoss integration; browser state E2E | New phase tests required |
| EXT-01 | No cross-tenant platform reporting/billing model introduced | Schema/API scope review; no new platform scope | N/A (boundary review) |

Test design must follow the repository testing contract: inspect existing fixtures before adding database assertions; do not use global counts/latest-row queries without a test scope; never substitute mocked persistence/transactions for applicable integration tests. `[VERIFIED: .planning/siteflow_testing_context.md:130-260]`

### Sampling Rate

- **Per chunk:** relevant unit/integration test; server typecheck and lint for backend work; web typecheck/build/E2E for UI work. The checklist names this `"Tier 1 — Build-in"`. `[VERIFIED: .planning/checklist_when_to_apply.md:1-22,405-430; .planning/codebase/TESTING.md:1-45]`
- **Per wave/phase:** full integration suite, API/OpenAPI audit, tenant-negative tests, migrations on fresh DB, complex query `EXPLAIN ANALYZE`, concurrency/retry review, and full workspace build. The checklist labels these `"Tier 2 — End-of-Phase Gate"`; they are not a checklist that must be repeated in every chunk. `[VERIFIED: .planning/checklist_when_to_apply.md:1-22,330-430]`
- **Pre-production only:** realistic data/load tests, p50/p95/p99 targets, multi-worker volume/failure injection, long-duration resource tests, and capacity baselines. The checklist labels these `"Tier 3 — Pre-Production Gate"`; do not turn them into per-chunk gates. `[VERIFIED: .planning/checklist_when_to_apply.md:20-22,345-405,430-460]`

### Wave 0 Gaps

- [ ] Add phase-specific event envelope/outbox tests, including tenant requiredness, rollback, duplicate/retry and consumer idempotency.
- [ ] Add two-organization schedule-metric isolation coverage while repairing lookup/upsert tenant predicates.
- [ ] Add deterministic PgBoss tests for failure/retry/idempotency and notification delivery state.
- [ ] Add report/portfolio API tests using real Fastify app factory and PostgreSQL fixtures; validate route contracts and cursor bounds.
- [ ] Add CSV format parity, access recheck, failure/expiry/object-cleanup tests; browser tests for async status states.
- [x] PDF/XLSX are deferred; no renderer dependency selection, installation, implementation, or implementation tests belong to Phase 8.

These are gaps to plan, not implementation performed in this research. `[VERIFIED: apps/server/package.json:1-60; apps/web/src/App.tsx:1-8; apps/server/src/lib/queue/queue.ts:35-90; .planning/siteflow_testing_context.md:1-260]`

## Security Domain

Security enforcement is enabled by default per the verification protocol; do not omit this section. `[VERIFIED: .planning/config.json:1-20]`

### Applicable ASVS Categories

| ASVS Category | Applies | Phase control |
|---|---|---|
| V2 Authentication | Yes | Authenticate all report/export routes; do not expose access tokens or session data in events/templates. `[VERIFIED: apps/server/src/app/index.ts:1-120; .planning/checklist_when_to_apply.md:145-180]` |
| V3 Session Management | Yes for realtime connection/session lifetime | Revalidate identity/context for connections and protected room joins; ensure revocation behavior matches current auth model. `[VERIFIED: apps/server/src/modules/project/core/project.middleware.ts:1-160; ASSUMED: realtime runtime absent and requires design]` |
| V4 Access Control | Yes | Derive tenant from auth context; enforce project membership/source capability for report section, event delivery, export creation, and download. `[VERIFIED: apps/server/src/modules/project/core/project.middleware.ts:1-160; apps/server/src/modules/project/core/project.policy.ts:1-500]` |
| V5 Input Validation | Yes | Zod validate event envelope, filters, cursor, format, dates, and job payload; bound and whitelist filters. `[VERIFIED: .planning/checklist_when_to_apply.md:104-145,150-180]` |
| V6 Cryptography | Applies narrowly | Do not invent token/signature/URL cryptography; use existing MinIO presigning and server secrets. Do not log signed URLs or credentials. `[VERIFIED: apps/server/src/lib/storage/storage.service.ts:1-65; apps/server/src/app/index.ts:25-60]` |

### Known Threat Patterns for SiteFlow

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Cross-org report, export/job, event, or object access | Information disclosure / Elevation | Scope every query/job/object to authenticated `organizationId`; check project capability; wrong-org identifiers use non-leaking response. `[VERIFIED: apps/server/src/modules/project/core/project.middleware.ts:1-160; .planning/checklist_when_to_apply.md:125-180]` |
| Duplicate/out-of-order event delivery | Tampering / repudiation | Stable immutable event ID/version, durable consumer idempotency, transaction and replay tests; never rely on a process-local set. `[VERIFIED: apps/server/src/lib/outbox/outbox.service.ts:48-115; apps/server/src/modules/project/core/project.worker.ts:1-45]` |
| Realtime room guessing or stale membership | Information disclosure / elevation | Authenticate connection; authorize subscribe and each scoped delivery using current org/project membership; identifier possession is not authorization. `[VERIFIED: apps/server/src/modules/project/core/project.middleware.ts:1-160; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:47-53]` |
| Export identifier/key guessing or URL reuse | Information disclosure | Require scoped export-record lookup, fresh permission check, short-lived URL, no raw key input/output, explicit expiry/object cleanup. `[VERIFIED: apps/server/src/modules/project/documents/document.service.ts:290-345; apps/server/src/lib/storage/storage.service.ts:1-105]` |
| Unsafe CSV content / HTML notification values | Injection | Validate/escape CSV cell contents and HTML notification values before release. `[ASSUMED: security review needed for CSV serializer and templates; .planning/checklist_when_to_apply.md:230-270]` |
| PII, secrets, financial values in logs or templates | Information disclosure | Log scoped IDs/state/outcomes only; Pino redaction covers auth/cookie headers; explicitly review notification templates and audit metadata. `[VERIFIED: apps/server/src/app/index.ts:25-60; apps/server/src/lib/email/email.service.ts:1-100; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:47-58,125-139]` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `[ASSUMED]` Outbox row locking may not reserve events through queue send/update because selection and acknowledgement are separate database calls; confirm with two pollers and fault injection before changing design. | Current Repository Contracts | Duplicate consumer effects or unnecessary redesign if current connection wrapper provides an unobserved transaction boundary. |
| A2 | User-confirmed defaults are configurable 24-hour artifact retention and 5-minute signed URL expiry; local compose declares `STORAGE_PRESIGN_EXPIRY_SECONDS: 3600`. Inspect deployment policy and override only if verified policy requires it. | Export storage | Incorrectly diverging from an actually enforced deployment policy. |
| A3 | `[VERIFIED: inspected module/schema/manifest inventories]` No existing user notification preference, notification state, or realtime implementation was found in the inspected surfaces; `[ASSUMED]` uninspected runtime plugins/deployment wiring could exist. | Notifications | Plan could create duplicate functionality or miss an existing provider if F.0 inventory is incomplete. |
| A5 | `[ASSUMED]` Material request/PO task and date fields may support useful traceable schedule facts, but no approved impact calculation was found. | Reporting sources | Misleading schedule-risk metric if converted into an invented score. |
| A6 | `[ASSUMED]` Some requested metrics may lack authoritative event/history data for past dates; report them as current-only/unavailable until source history proves otherwise. | Reporting sources | False historical trend claims. |

## Resolved User Decisions and F.0 Evidence Probes

These choices are settled and are not open questions or human gates:

- **D-01:** Phase 8 implements CSV only. PDF/XLSX renderer work, package selection/installation, and implementation tests are deferred.
- **D-02:** Realtime is delivered autonomously. F.0 inventories compatible runtime and outbox/notification paths; if no compatible runtime exists, F.6 implements minimal Fastify SSE without a transport dependency. Every subscription and event send checks current organization/project membership and permission.
- **D-03:** Export artifact retention defaults to 24 hours and signed URL expiry to 5 minutes, both configurable. Override only if F.0 verifies deployment policy requiring another value.
- Channel preference evaluation is wired into delivery: a suppressed channel creates no send/attempt, while source event and notification intent remain persisted.

F.0/F.18 resolve repository/runtime evidence and operational configuration:

1. Verify actual outbox transaction/NOTIFY/polling, PgBoss retry/claim behavior, duplicate delivery, and failure-state evidence; record observed contracts before choosing integration details.
2. Inventory any existing realtime runtime and authorization hooks, then record the deterministic transport branch: verified compatible runtime, otherwise Fastify SSE. This probe cannot block implementation or require a transport package.
3. Verify deployment retention/signing policy; otherwise retain the user-confirmed configurable 24-hour/5-minute defaults. The local compose 3600-second setting is not itself a verified deployment-policy override.
4. Trace source events, report metrics, filters, history, permissions, and preference settings to checked-in source. Unsupported formulas/history remain unavailable; no unresolved product choice is implied.
5. Profile representative report/CSV work only to choose synchronous versus existing PgBoss execution; there is no renderer/package decision to research.

Remaining technical uncertainty is executable through the existing plans and must be resolved by F.0 or implementation evidence, not a human decision: actual outbox claim/retry behavior; complete source transition inventory; supported preference storage/precedence; source history and metric coverage; deployment policy presence; and measured report runtimes.

## Environment Availability

Live runtime connectivity/version was not probed in this research session. The local compose file declares the existing infrastructure services; declaration is not proof they are running. `[VERIFIED: docker-compose.yml:1-210; .planning/codebase/STACK.md:1-80]`

| Dependency | Required by | Repository evidence | Live availability | Fallback |
|---|---|---|---|---|
| PostgreSQL | API, transaction/outbox, reports, PgBoss persistence | Compose Postgres service; test context port 5434 | Not probed | None for required integration/transaction tests |
| PgBoss worker | Event dispatch, notifications, scheduled work, expensive exports | Existing `apps/server/src/worker.ts` | Not probed | No second queue; synchronous only for bounded fast exports |
| Redis | Existing caches/rate limits/tenant job leases | Compose Redis service and shared ioredis | Not probed | Existing cache callers fall back to PostgreSQL where coded; do not require Redis for report truth |
| MinIO | Export/document artifacts and signed URLs | Compose MinIO service and existing adapter | Not probed | No alternate storage planned |
| SMTP | Email channel | Env-configured Nodemailer transport | Not probed/configuration not inspected | Provider boundary may defer delivery; avoid sensitive Ethereal fallback in production |
| Realtime transport | F.6 | No server package dependency found | Not found in inspected code; live deployment unknown | F.0 verifies a compatible runtime; otherwise implement native Fastify SSE and reuse the verified outbox/notification path |

There is no missing package dependency blocking this phase: realtime has the autonomous Fastify SSE fallback, and PDF/XLSX are deferred. `[VERIFIED: apps/server/package.json:1-60; apps/server/src/modules/: directory inventory]`

## State of the Art

| Old/proposal framing | Actual repository approach | Planning implication |
|---|---|---|
| Prisma ORM / BullMQ queue | Drizzle + PostgreSQL and PgBoss | Use the checked-in code and migrations; do not port proposal snippets literally. `[VERIFIED: apps/server/package.json:25-57; apps/server/src/lib/queue/queue.ts:1-170]` |
| Direct email on domain event | Existing email worker/transport plus PostgreSQL outbox/PgBoss | Keep external send out of source transactions; add lifecycle and idempotency rather than bypassing queue. `[VERIFIED: apps/server/src/modules/invitation/invitation.worker.ts:1-70; apps/server/src/lib/outbox/outbox.service.ts:1-150]` |
| Report-specific duplicate calculations/projections | Existing summaries and schedule metric materialization | Reuse existing source services; profile before any further projection/cache. `[VERIFIED: apps/server/src/modules/project/commercial-summary/commercial-summary.service.ts:1-110; apps/server/src/modules/project/financial-summary/financial-summary.service.ts:1-180; .planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:83-88]` |

**Deprecated/outdated:** No external technology deprecation claim is made. Proposal references to Prisma/BullMQ are simply not the current checked-in stack. `[VERIFIED: apps/server/package.json:25-57]`

## Sources

### Primary (HIGH confidence — repository source of truth read this session)

- `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md` — locked scope, all F.0–F.18 definitions, event vocabulary, reporting/filter/export decisions.
- `.planning/phases/08-phase-f-reporting-and-downloads/08-DISCUSSION-LOG.md` — user-confirmed and discretion distinctions.
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — Phase 8 expanded goal, requirements, active scope.
- `.planning/checklist_when_to_apply.md` — Tier 1 per-chunk, Tier 2 end-of-phase, Tier 3 pre-production gates.
- `.planning/siteflow_testing_context.md` — real Fastify/PostgreSQL/PgBoss integration test contract and test fixture restrictions.
- `apps/server/src/lib/outbox/outbox.service.ts`, `packages/database/src/schema/outbox.schema.ts`, `apps/server/src/lib/queue/queue.ts`, `apps/server/src/lib/queue/worker-factory.ts`, `apps/server/src/worker.ts` — event/job contract and worker behavior.
- `apps/server/src/modules/project/core/project.service.ts`, `project.worker.ts`, `project.jobs.ts`, `project.policy.ts`, `project.middleware.ts`, `project.types.ts` — transactions, jobs, role/context rules.
- `apps/server/src/modules/project/schedule-metrics/`, `commercial-summary/`, `financial-summary/`, `material-request/`, `purchase-order/`, `subcontractor/`, `compliance/` — source metrics, financial coverage, procurement and expiry flows.
- `apps/server/src/lib/email/email.service.ts`, `apps/server/src/modules/invitation/invitation.worker.ts`, `apps/server/src/lib/storage/storage.service.ts`, `apps/server/src/modules/project/documents/document.service.ts` — SMTP, job delivery, MinIO signing, access checks.
- `apps/server/package.json`, `apps/web/package.json`, `apps/web/src/App.tsx`, `docker-compose.yml`, `.planning/codebase/{STACK,ARCHITECTURE,INTEGRATIONS,CONCERNS,TESTING}.md` — actual stack, frontend state, local infrastructure, known risks.

### External authoritative documentation

- None fetched in this session. No new package/API recommendation relies on external documentation; no package was selected for installation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for repository-declared versions and actual implementations; not registry-current verified.
- Architecture: HIGH for inspected service/worker/storage paths; MEDIUM where runtime deployment may provide components not represented in repository.
- Metrics/source map: HIGH for the services opened; MEDIUM for total metric coverage until F.0 maps all report fields and history.
- Pitfalls: HIGH for directly evidenced tenancy/outbox/export declarations; MEDIUM for inferred concurrency risks pending execution against Postgres.

**Research date:** 2026-10-08
**Valid until:** 2026-11-07 (repository architecture is relatively stable; reassess faster if dependencies, worker contracts, or Phase F scope changes)
