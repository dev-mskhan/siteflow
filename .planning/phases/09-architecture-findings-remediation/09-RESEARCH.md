# Phase 9: Architecture Findings Remediation — Research

**Researched:** 2026-10-09
**Domain:** Fastify authorization, multi-tenant reporting/export, outbox/workers, date boundaries, Redis cache reliability
**Confidence:** HIGH for current-state findings (read from checked-out source); MEDIUM for implementation recommendations

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Close the code-backed findings H1–H9 from `docs/architecture/findings.md` in the current SiteFlow checkout. The user explicitly authorized implementation fixes after the read-only architecture review and directed that each issue be fixed, tested, and verified. This phase does not mark Phase 8 complete: its 22 plans remain unexecuted and its broader capabilities remain pending.
- Preserve tenant isolation as a hard boundary. Every changed repository operation must include organization scope and applicable project scope; never grant access based on an identifier, URL parameter, or role name alone.
- Reuse existing Fastify, Zod, Drizzle, PostgreSQL, PgBoss, outbox, Redis, MinIO, permission maps, test factories, and transaction patterns. Do not add infrastructure without source evidence and a tested need.
- Backend route tests must exercise the production Fastify app through `app.inject()` and PostgreSQL-backed fixtures; test cross-tenant boundaries with at least two organizations where applicable.
- Do not claim end-to-end capability from definitions alone. If a partial notification/dispatcher feature cannot safely be completed within the existing contract, keep its status explicitly unavailable and avoid speculative delivery wiring.
- Keep architecture outputs in `docs/architecture/` out of remediation commits and pushes. Do not modify source during the architecture deliverable stage; source changes belong only to Phase 9 implementation.
- Do not add PDF/XLSX, platform billing, or unrelated Phase 8 capabilities. The user requested no questions; resolve ordinary choices using existing Phase 8 decisions and repository conventions, and record genuine blockers rather than weakening authorization or fabricating verification.
  [VERIFIED: `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md:7-29`]

### Relevant Phase 8 Decisions to Preserve
- Project reports use the project timezone and portfolio reports the organization timezone, with an explicit UTC fallback if configuration is absent.
- The organization portfolio includes projects the caller is authorized to read, excluding archived/deleted projects by default, with project-status filters. Resolve organization identity from authenticated context, never from user-supplied tenant input.
- Show portfolio totals and a bounded, cursor-paginated project comparison list. A project row drills into the project report only if the caller independently has access to that project.
- Project report sections inherit existing read capabilities for their source modules. Hide unauthorized sections without disclosing their existence or substituting zero. Independently authorize every drill-down.
- Portfolio scope reuses existing project membership and organization-level cross-project authority. Organization-wide authority may see its permitted portfolio; users without it remain limited to projects they can already read. Do not infer access from a role name or create a broad bypass.
- Keep small, bounded exports synchronous. An export expected or measured to exceed approximately 100 ms under load is handled by existing PgBoss.
- User-confirmed lifecycle defaults: generated artifact retention of 24 hours and signed URL lifetime of 5 minutes, configurable; use a verified deployment policy instead if it requires different values.
- D-02 — Autonomous authorized realtime: F.0 inventories existing realtime and notification/outbox paths. If a compatible existing runtime is verified, reuse it; otherwise implement the smallest viable one-way Fastify-compatible transport (SSE preferred), reuse the existing outbox/notification path if sound, and enforce current tenant, membership, and permission checks. No human transport decision blocks execution.
- Do not introduce a second database, queue, worker process, storage system, event store, speculative reporting projection, or speculative Redis cache.
  [VERIFIED: `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:64-84`]

### the agent's Discretion
The user requested no questions. Resolve ordinary choices using the existing Phase 8 user decisions and repository conventions; record any genuine blocker rather than weakening authorization or fabricating a successful verification.
[VERIFIED: `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md:29`]

### Deferred Ideas (OUT OF SCOPE)
Do not add PDF/XLSX, platform billing, or unrelated Phase 8 capabilities.
[VERIFIED: `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md:28`]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REM-01 | Every project-report route enforces the existing report/source project-read capability; missing project membership fails closed. | H1: `requireProjectPermission`, report source capability checks, route integration cases. |
| REM-02 | Portfolio aggregates and rows include only projects the caller can read under existing project membership and organization-level cross-project authority; results use bounded cursor pagination. | H2: shared authorized-project scope for aggregates and cursor-paged rows. |
| REM-03 | SSE requires authenticated identity, derives tenant access from current server-side membership/authority, rejects URL-only tenant claims, and uses configured CORS policy. Do not claim realtime delivery is wired unless a registered caller is implemented and tested. | H3: authenticate/context pre-handlers, current-access recheck, configured CORS, endpoint integration coverage. |
| REM-04 | Validate the actual outbox envelope and tenant requirements; connect a single validated dispatch path with durable retry/idempotency, or remove/fence unused dispatcher code if the current runtime contract does not support safe wiring. | H4: preserve the existing outbox-to-PgBoss runtime and fence the incompatible unused dispatcher unless a real compatible event consumer is established. |
| REM-05 | Trace reminder, email, and preference implementation against the existing product contract. Register and test only complete supported paths; remove or explicitly isolate dormant definitions rather than advertising unimplemented delivery. | H5: fence incomplete paths; do not implement pending Phase 8 notification wiring in this remediation. |
| REM-06 | Align browser/server filter naming; preserve useful errors; ensure a slow report is not silently swallowed or recalculated unnecessarily. Select async work before expensive report generation using a researched, measurable policy, while keeping bounded fast exports synchronous. | H6: align `filter`/`filters`; classify before fetching; do not catch-and-requeue the completed slow fetch. |
| REM-07 | Authorize project scope at export creation and re-check current access at status/download; tenant-qualify every export mutation and audit request/download actions without recording report contents. | H7: scoped export access, qualified state transitions, and audit assertions. |
| REM-08 | Implement the full declared preset contract and custom date bounds using the applicable project/organization timezone, with a consistent documented UTC fallback. | H8: shared filter schema, timezone-aware normalizer, existing effective-settings service, date-boundary tests. |
| REM-09 | Make retry/idempotency durable across project-worker restarts/replicas and replace unbounded Redis `KEYS` invalidation with a bounded/scalable approach. | H9: persisted deduplication for effects that need it; generation-based org list-cache invalidation. |
</phase_requirements>

## Summary

The findings are concentrated in existing backend paths, not a new framework or dependency choice. The repository already has the needed seams: project policy/context guards, organization/project settings, PostgreSQL/Drizzle, PgBoss/outbox, MinIO, audit logging, and real-app integration fixtures. [VERIFIED: `apps/server/src/modules/project/core/project.middleware.ts:35-48,150-162`; `apps/server/src/modules/project/core/project.policy.ts:555-591`; `apps/server/src/modules/organization/settings/settings.service.ts:25-53`; `apps/server/src/worker.ts:8-60`; `apps/server/tests/helpers/test-app.ts:1-32`]

**Phase 8 is still pending and is NOT complete because Phase 9 is prioritized.** `.planning/STATE.md` records Phase 8 as ready for execution with implementation not started, while Phase 9 context explicitly says its 22 Phase 8 plans remain unexecuted. Keep remediation limited to H1–H9 in currently implemented paths; do not fill in the broader Phase 8 event, notification, realtime delivery, reporting, or export features. [VERIFIED: `.planning/STATE.md:1-27`; `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md:3-7`; `.planning/ROADMAP.md:9-15,45-52`]

**Primary recommendation:** fix access boundaries first (H1–H3, H7), make the current worker/export/date contracts truthful and retry-safe (H4–H6, H8–H9), and fence partial Phase 8 notification/dispatcher definitions rather than wire speculative end-to-end systems. No new external package is indicated. [ASSUMED]

## Standard Stack

| Concern | Use | Reason |
|---------|-----|--------|
| HTTP and auth | Existing Fastify app, `authenticate`, `organizationContext`, `projectContext`, `requireProjectPermission` | Exercises the same route lifecycle as production. [VERIFIED: `apps/server/src/app/index.ts:1-20,185-193`; `apps/server/src/modules/project/core/project.middleware.ts:35-48,150-162`] |
| Persistence and idempotency | Existing Drizzle/PostgreSQL and transactional patterns | Tenant qualification and durable uniqueness belong in the authoritative store, not a process-local `Set`. [VERIFIED: `apps/server/src/lib/outbox/outbox.service.ts:20-48,83-112`; `apps/server/src/modules/project/core/project.worker.ts:19-20,32-78`] |
| Jobs and artifact storage | Existing PgBoss, outbox, and MinIO | Phase 8 decisions explicitly prohibit second queue/storage systems and set lifecycle defaults. [VERIFIED: `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:74-84`] |
| Validation | Existing shared Zod schemas | Shared report filters and event envelope schemas already exist. [VERIFIED: `packages/shared/src/reporting/report.schema.ts:1-30`; `packages/shared/src/events/domain-event.schema.ts:1-58`] |
| Tests | Vitest + real Fastify `app.inject()` integration tests | Server manifest exposes Vitest; the required helper calls `buildApp()` then `app.ready()`. [VERIFIED: `apps/server/package.json:5-20`; `apps/server/tests/helpers/test-app.ts:1-32`] |

**Installation:** none; this phase should not add external packages. [ASSUMED]

## H1 — Project reports bypass project-read authorization (REM-01)

- **Current pattern:** every project report runs `authenticate`, `organizationContext`, and `projectContext`, but none adds `requireProjectPermission`; project context explicitly permits a nullable membership, while the permission helper delegates to `projectPolicy`. [VERIFIED: `apps/server/src/modules/reporting/report.routes.ts:39-95`; `apps/server/src/modules/project/core/project.middleware.ts:35-48,77-128,147-162`; `apps/server/src/modules/project/core/project.policy.ts:555-591`]
- **Source values:** `projectContext` sets `projectMembership: membership`, and `requireProjectPermission(action: string)` calls `projectPolicy.authorize({ actor: request.projectCtx, action })`. [VERIFIED: `apps/server/src/modules/project/core/project.middleware.ts:114-128,150-162`]
- **Implementation seam / affected files:** add the existing project permission guard to every report route; use `projectPolicy.can` or equivalent source-module capability checks when building multi-source reports so unauthorized sections are omitted, not exposed as zero. Touch `report.routes.ts`, `report.handlers.ts`/family services, and only extend `project.policy.ts` if a needed capability genuinely does not exist. [VERIFIED: `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:69-73`; `apps/server/src/modules/project/core/project.policy.ts:555-591`]
- **Safe recommendation:** require a baseline project-read capability on each report route, fail closed for a user with no active project membership and no applicable organization-level authority, then gate each source section with its existing read capability. Do not infer access from role names or add a broad report bypass. [ASSUMED]
- **Test target/pattern:** extend `apps/server/tests/integration/reporting/report-routes.test.ts` using `createTestApp()` and `app.inject()`. Test allowed capability, an organization member without project membership, a project member without the report/source capability, and non-leaking cross-tenant behavior. Existing fixture helpers include `createVerifiedUser`, `createOrgWithAdmin`, and `addMemberDirectly`. [VERIFIED: `apps/server/tests/integration/reporting/report-routes.test.ts:1-20,98-158`; `apps/server/tests/helpers/fixtures.ts:1-160`; `.planning/siteflow_testing_context.md:78-128,602-677`]
- **Risk / choice:** health and executive summary combine sources with different permissions. Preserve the Phase 8 section-level visibility rule rather than granting access to the whole response because one source is readable. [VERIFIED: `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:69-73`]

## H2 — Portfolio rows and aggregates are not caller-scoped (REM-02)

- **Current pattern:** project rows filter only by `organizationId`, `ARCHIVED`, and `CANCELLED`, cap at `Math.min(limit, 100)`, and have no cursor/order; status counts filter only by organization and include all statuses. The service calls both queries without a caller identity and computes currency totals from the bounded row list. [VERIFIED: `apps/server/src/modules/reporting/portfolio/portfolio-report.repository.ts:25-72`; `apps/server/src/modules/reporting/portfolio/portfolio-report.service.ts:12-52`; `apps/server/src/modules/reporting/report.handlers.ts:75-83`]
- **Source values:** archived/cancelled filters are currently `ne(projects.status, 'ARCHIVED')` and `ne(projects.status, 'CANCELLED')`; portfolio rows use `.limit(Math.min(limit, 100))`. [VERIFIED: `apps/server/src/modules/reporting/portfolio/portfolio-report.repository.ts:49-58`]
- **Implementation seam / affected files:** pass authenticated `userId` plus organization context from handler to service/repository; form one authorized-project relation/predicate from active project membership or explicit organization-level cross-project authority, and apply it to rows, status counts, currency aggregates, and pagination. Add stable cursor ordering and preserve default archived/deleted exclusion. [VERIFIED: `apps/server/src/modules/reporting/report.handlers.ts:75-83`; `apps/server/src/modules/project/core/project.policy.ts:410,555-591`; `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:66-73`]
- **Safe recommendation:** calculate totals over the complete authorized project set, independently of the current page; page only the comparison rows. Use the existing permission map, not org role names. Do not reuse `ProjectRepository.findAll` as an authorization filter: its current query is organization-scoped but not membership-scoped. [VERIFIED: `apps/server/src/modules/project/core/project.repository.ts:85-136`; `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:69-73`]
- **Test target/pattern:** extend `report-routes.test.ts` with two orgs and multiple projects in one org: member sees only readable projects and scoped totals/counts; org-level cross-project authority sees its permitted set; pagination is bounded and stable; archived projects are excluded by default. Assert project IDs, not only a count. [VERIFIED: `apps/server/tests/integration/reporting/report-routes.test.ts:1-20,136-158`; `.planning/siteflow_testing_context.md:602-677,716-859`]
- **Risk / choice:** omitting the caller predicate from even one aggregate leaks information despite correct row filtering. Keep all portfolio queries on the same authorization scope. [ASSUMED]

## H3 — SSE accepts URL-only tenant identity and wildcard origin (REM-03)

- **Current pattern:** the SSE plugin reads `request.user` without registering `authenticate` or `organizationContext`; when absent, `userOrgId` falls back to the URL organization. It sets `Access-Control-Allow-Origin` to `*`. [VERIFIED: `apps/server/src/modules/notification/realtime/realtime.plugin.ts:7-35`]
- **Source values:** `const userOrgId = user?.organizationId ?? organizationId;` and `reply.raw.setHeader('Access-Control-Allow-Origin', '*');`. [VERIFIED: `apps/server/src/modules/notification/realtime/realtime.plugin.ts:13,24`]
- **Implementation seam / affected files:** attach the normal auth/context chain and derive identity from verified request context; enforce current organization/project/user permissions on subscription and again before delivery, including revocation behavior. Remove the route-level wildcard header and rely on the already configured CORS plugin. The app mounts the realtime plugin separately from organization-prefixed routes. [VERIFIED: `apps/server/src/app/index.ts:56-60,188-189`; `apps/server/src/modules/notification/realtime/realtime.plugin.ts:7-35`; `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:74-80`]
- **Safe recommendation:** fail closed if authenticated identity/context is absent; never fall back to a client-supplied organization ID. Do not claim delivery is wired merely because the connection manager has `broadcastToTenant`; Phase 9 context requires a registered caller and test before that claim. [VERIFIED: `apps/server/src/modules/notification/realtime/realtime.delivery.ts:34-45`; `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md:13`]
- **Test target/pattern:** add route-level SSE tests (unauthenticated request, same-org authorized request, cross-org URL, revoked/current membership or permission, configured CORS response) through `createTestApp()`/`app.inject()`. Existing `realtime-authorization.test.ts` tests helper/manager behavior only; it does not exercise the actual route. [VERIFIED: `apps/server/tests/integration/notification/realtime-authorization.test.ts:1-75`; `.planning/siteflow_testing_context.md:78-128`]
- **Risk / choice:** an SSE connection outlives the initial authorization decision. Ensure access is rechecked during delivery or the connection is invalidated on membership/permission changes; tenant equality alone is insufficient. [ASSUMED]

## H4 — Outbox dispatcher is disconnected from the active runtime contract (REM-04)

- **Current pattern:** `OutboxService.publishPendingEvents` dispatches `event.eventType` and raw payload to PgBoss; retry state is stored on `outboxEvents`. `EventDispatcher` instead validates only that `organizationId` exists and tracks completed handlers in a process-local `Set`. `writeOutboxEvent` accepts generic payload data and optional organization ID. [VERIFIED: `apps/server/src/lib/outbox/outbox.service.ts:20-48,83-128`; `apps/server/src/lib/outbox/outbox.dispatcher.ts:14-80`]
- **Source values:** `organizationId?: string` in `writeOutboxEvent`; `private processedExecutions: Set<string> = new Set();`; `await sendJob(event.eventType, event.payload as Record<string, unknown>);`. [VERIFIED: `apps/server/src/lib/outbox/outbox.service.ts:20-35,104`; `apps/server/src/lib/outbox/outbox.dispatcher.ts:14-16`]
- **Implementation seam / affected files:** preserve one current outbox→PgBoss path; validate the actual event-type/payload contract before enqueueing and encode which job classes require tenant scope. Retain any explicitly global auth events only under their own known schema. Fence/remove the unused generic `EventDispatcher` unless a compatible producer/consumer contract is implemented within this scope. [VERIFIED: `apps/server/src/lib/outbox/outbox.service.ts:20-48,83-112`; `apps/server/src/lib/queue/queue.ts:19-75`; `packages/shared/src/events/domain-event.schema.ts:20-58`]
- **Safe recommendation:** do **not** wire `eventDispatcher` into the poller as-is: the active queue accepts event-specific jobs, while the domain envelope is a different contract; a universal “organization required” check could also reject legitimate global jobs. Add explicit per-type validation and durable retry/dedup tests to the active path, or keep domain dispatch explicitly dormant pending Phase 8. [ASSUMED]
- **Test target/pattern:** extend `tests/integration/outbox/transactional-publishing.test.ts` and `dispatcher.test.ts`. Test valid active payload, invalid event/version/tenant payload, explicitly global event, transaction rollback, persisted retry, duplicate dispatch/worker effect, and restart/second dispatcher behavior. The existing publishing test expects missing-tenant rejection, but the current writer shown above has no such validation branch. [VERIFIED: `apps/server/tests/integration/outbox/transactional-publishing.test.ts:1-85`; `apps/server/tests/integration/outbox/dispatcher.test.ts:1-90`; `apps/server/src/lib/outbox/outbox.service.ts:20-48`]
- **Risk / choice:** do not conflate domain-event envelopes with current auth/invitation queue payloads; preserve producer atomicity and ensure duplicate dispatch cannot duplicate worker effects. [VERIFIED: `.planning/siteflow_testing_context.md:1235-1368`]

## H5 — Reminder, email, and preference helpers are not a complete runtime pipeline (REM-05)

- **Current pattern:** `worker.ts` registers auth, org, project, schedule, compliance, and export workers; it does not register the reminder scan or notification email worker. Reminder and email modules expose processing functions, and preferences can be read/written, but no complete dispatch path is established by these definitions. [VERIFIED: `apps/server/src/worker.ts:8-60`; `apps/server/src/modules/project/operations-reminders/operations-reminders.worker.ts:6-25`; `apps/server/src/modules/notification/email/email.worker.ts:8-46`; `apps/server/src/modules/notification/preferences/preference.service.ts:15-51`]
- **Implementation seam / affected files:** phase9 scope should make dormancy explicit and prevent these helpers from being presented or invoked as active delivery. Keep reusable functions isolated for later Phase 8 work; remove or disable unused enqueue/schedule entry points if they can create jobs without a registered consumer. Do not add notification scheduler/provider/preference wiring in this remediation. [VERIFIED: `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md:15,26-28`; `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:11-18,42-63`]
- **Safe recommendation:** fence rather than wire: the end-to-end registration, current authorization, preference evaluation, retries, and provider behavior belong to still-pending Phase 8 capabilities, not H1–H9 remediation. Keep status explicitly unavailable until a consumer and producer are both tested. [ASSUMED]
- **Test target/pattern:** retain/update `tests/integration/operations-reminders/reminders.test.ts` as a worker-function contract test, but do not treat it as evidence of scheduling/registration; add a focused worker-registration/fencing assertion. For any future supported path, test producer→PgBoss payload→worker state and preference-disabled behavior with deterministic worker execution. [VERIFIED: `apps/server/tests/integration/operations-reminders/reminders.test.ts:1-65`; `.planning/siteflow_testing_context.md:1311-1368`]
- **Risk / choice:** registering these stubs now could advertise reminders/email/preferences while bypassing user preferences or runtime authorization. Keep this boundary explicit rather than broadening the phase. [ASSUMED]

## H6 — Export filter mismatch and slow-fetch retry recalculates reports (REM-06)

- **Current pattern:** the browser posts a singular `filter`; the server schema reads plural `filters`. The service times `fetchReport` and only checks the elapsed time after that awaited fetch. A slow fetch then falls through to PgBoss, whose worker fetches the same report again. The broad `catch` also routes report/render/upload failures into that async path. Threshold, retention, and URL expiry are constants. [VERIFIED: `apps/web/src/reporting/report-api.ts:97-113`; `apps/server/src/modules/reporting/exports/export.routes.ts:14-22,37-55`; `apps/server/src/modules/reporting/exports/export.service.ts:12-18,70-117`; `apps/server/src/modules/reporting/exports/export.worker.ts:10-38`]
- **Source values:** web request object contains `filter`; server body schema contains `filters`; configured-in-code values are `SYNC_THRESHOLD_MS = 100`, `EXPORT_RETENTION_HOURS = 24`, and `SIGNED_URL_EXPIRY_SECONDS = 5 * 60`. [VERIFIED: `apps/web/src/reporting/report-api.ts:98-113`; `apps/server/src/modules/reporting/exports/export.routes.ts:17-22`; `apps/server/src/modules/reporting/exports/export.service.ts:14-15`; `apps/server/src/modules/reporting/exports/export.repository.ts:11`]
- **Implementation seam / affected files:** align the web body key to the server's canonical plural filter property; introduce validated environment-backed threshold/retention/expiry policy; separate expected report errors from async selection. Decide sync/async before invoking report generation for asynchronous jobs. [VERIFIED: same source ranges above; `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:74-80`]
- **Safe recommendation:** never swallow a synchronous error and enqueue a second copy. Use representative latency measurements and a configured threshold to classify export families/size before `fetchReport`; unknown/known-expensive requests should select PgBoss up front. If a request already fetched a slow report, finish with that same result or fail explicitly—do not recalculate it in a job. On failure, persist/report the failure rather than returning a success-shaped pending job. [ASSUMED]
- **Test target/pattern:** extend `tests/integration/reporting/export-lifecycle.test.ts` for canonical filter persistence, configured lifecycle values, fast sync, preselected async, slow-fetch single invocation, surfaced failure, and job payload. Use deterministic service/clock seams; avoid wall-clock sleeps. [VERIFIED: `apps/server/tests/integration/reporting/export-lifecycle.test.ts:1-20,95-165`; `.planning/siteflow_testing_context.md:2320-2367`]
- **Risk / choice:** adding config must honor verified deployment policy; the current slow path already spends the fetch latency before returning and may do that work twice. Do not claim a test has demonstrated performance or test outcomes here. [VERIFIED: `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:77-80`; `apps/server/src/modules/reporting/exports/export.service.ts:78-117`]

## H7 — Export project scope, transitions, and auditing are incomplete (REM-07)

- **Current pattern:** export routes apply authentication and organization context but no project context/permission; `projectId` is accepted from request body. Repository reads are org-qualified, but `markProcessing`, `markReady`, `markFailed`, and `markExpired` update by export ID alone. Service status/download checks owner and organization but do not re-check current project read authority. No route audit write is present. [VERIFIED: `apps/server/src/modules/reporting/exports/export.routes.ts:14-55`; `apps/server/src/modules/reporting/exports/export.repository.ts:48-99`; `apps/server/src/modules/reporting/exports/export.service.ts:122-160`]
- **Implementation seam / affected files:** validate project existence/organization and source-read permission on create; repeat current access checks for status and URL issuance; pass organization/project scope through every repository state transition and constrain expected source state; write audit events for request and authorized download-URL issuance. [VERIFIED: `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:69-80`; `apps/server/src/modules/audit/audit.service.ts` (existing pattern used by project/organization services)]
- **Safe recommendation:** use the repository-standard non-leaking response for wrong-tenant/unauthorized exports; treat ownership as insufficient after project membership revocation. For portfolio exports reuse H2's authorized project scope. Audit actor, scope, format, filters, and outcome only—never report contents or sensitive financial values. [VERIFIED: `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:70-80`]
- **Test target/pattern:** extend `tests/integration/reporting/export-lifecycle.test.ts`: organization member without project permission cannot create; permission/membership revocation blocks status/download; cross-org and cross-project ID attempts return non-leaking errors; persisted mutations remain scoped; audit rows contain actor/scope but no report data. [VERIFIED: `apps/server/tests/integration/reporting/export-lifecycle.test.ts:1-20,130-165`; `.planning/siteflow_testing_context.md:602-677,716-788,1819-1846`]
- **Risk / choice:** a presigned URL remains usable until its expiry after issuance; keep URL lifetime configurable at the confirmed 5-minute default and only issue it after a fresh authorization lookup. [VERIFIED: `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:77-80`]

## H8 — Declared date presets and timezone behavior do not match implementation (REM-08)

- **Current pattern:** the public/shared contract declares:
  ```text
  DatePresetSchema = z.enum([
    'TODAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_30_DAYS',
    'THIS_QUARTER', 'THIS_YEAR', 'CUSTOM',
  ]);
  ```
  The normalizer explicitly handles only the first three and defaults all other values to the current UTC month. `CUSTOM` dates pass through without paired/date-order validation. Report envelopes hard-code UTC; project effective settings already merge project timezone → organization timezone → UTC. [VERIFIED: `packages/shared/src/reporting/report.schema.ts:3-21`; `apps/server/src/modules/reporting/report.filters.ts:3-40`; `apps/server/src/modules/project/settings/project-settings.service.ts:35-53,87-110`; `apps/server/src/modules/reporting/schedule/schedule-report.service.ts:24-59`; `apps/server/src/modules/reporting/cost/cost-report.service.ts:20-58`; `apps/server/src/modules/reporting/procurement/procurement-report.service.ts:20-60`; `apps/server/src/modules/reporting/subcontractor/subcontractor-report.service.ts:20-60`; `apps/server/src/modules/reporting/portfolio/portfolio-report.service.ts:12-52`; `apps/server/src/modules/reporting/report.service.ts:45-75`]
- **Implementation seam / affected files:** update shared runtime schema and OpenAPI values together; pass effective timezone and organization week-start from existing settings to normalization; return that same timezone in every report envelope; propagate custom start/end fields consistently through web/API/export filters. [VERIFIED: `apps/server/src/modules/organization/settings/settings.types.ts:1-20`; `apps/server/src/modules/project/settings/project-settings.service.ts:35-53,87-110`; `apps/server/src/modules/reporting/docs/report.api.schemas.ts:48-60`; `apps/web/src/reporting/report-api.ts:4-18,98-113`]
- **Safe recommendation:** require both custom dates, validate real calendar dates and `startDate <= endDate`; do not invent a maximum range without a product/performance rule. Calculate calendar boundaries in the effective timezone, use the configured week start, retain UTC fallback, and define quarter/year as calendar boundaries unless a product rule explicitly selects fiscal settings. [ASSUMED]
- **Test target/pattern:** extend `tests/integration/reporting/report-foundation.test.ts` with all declared preset branches, custom missing/invalid/reversed bounds, timezone midnight and DST boundary cases; extend route tests to verify envelope timezone and identical normalized filters across report/API/export paths. [VERIFIED: `apps/server/tests/integration/reporting/report-foundation.test.ts:1-82`; `apps/server/tests/integration/reporting/schedule-report.test.ts:1-30,90-150`; `.planning/siteflow_testing_context.md:2320-2367`]
- **Risk / choice:** UTC-only defaults or parsing a date-only value as an instant can shift a calendar day. Keep report data date semantics and rendered effective timezone consistent; do not reconstruct historical values from current state. [VERIFIED: `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:64-65`]

## H9 — Project worker dedupe is process-local; list invalidation uses Redis `KEYS` (REM-09)

- **Current pattern:** `project.worker.ts` deduplicates project-created/status jobs with a module-level `Set`; job payloads already carry optional/required `idempotencyKey` values. `project.cache.service.ts` invalidates organization list entries by calling `client.keys(pattern)` then deleting the full result. [VERIFIED: `apps/server/src/modules/project/core/project.worker.ts:19,32-78`; `apps/server/src/modules/project/core/project.jobs.ts:9-38`; `apps/server/src/modules/project/core/project.cache.service.ts:74-108`]
- **Source values:** project job context includes `idempotencyKey?: string`; list cache keys are currently `org:projects:list:${orgId}:${filterHash}` and invalidation uses `const keys = await client.keys(pattern);`. [VERIFIED: `apps/server/src/modules/project/core/project.jobs.ts:9-38`; `apps/server/src/modules/project/core/project.cache.service.ts:74-105`]
- **Implementation seam / affected files:** persist deduplication for any job with effects using a PostgreSQL unique execution key derived from existing job idempotency data, with effect/state commit made atomic; replace delete-by-pattern with an organization-scoped generation/version in list-cache keys so invalidation increments a token and does not enumerate Redis keys. [ASSUMED]
- **Safe recommendation:** do not mistake a process-local `Set` for restart/replica safety. Current worker bodies mainly log, so identify actual side effects before adding persistence; for any effect in scope, use durable unique-key/transaction semantics and prove retries across worker instances. For list caches, generation keys avoid global scans; old-generation entries can expire under existing list TTL. [VERIFIED: `apps/server/src/modules/project/core/project.worker.ts:32-80`; `apps/server/src/modules/project/core/project.cache.service.ts:74-108`; `.planning/checklist_when_to_apply.md:215-225`]
- **Test target/pattern:** add `tests/integration/project-worker.test.ts` (or extend `project_core.test.ts`) with duplicate delivery across newly registered worker instances and concurrent execution, asserting one durable effect; test list cache hit/miss, invalidation generation change, expiry, and Redis-unavailable fallback using the existing Redis test infrastructure. [VERIFIED: `apps/server/tests/integration/project_core.test.ts:1-20,55-110`; `.planning/siteflow_testing_context.md:1311-1368,1453-1502`]
- **Risk / choice:** a new durable execution table is a schema/migration cost and must not be added for log-only work. Confirm each job's effect and key semantics before adding it; never mark work complete before its effect commits. [VERIFIED: `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md:23-26`; `.planning/siteflow_testing_context.md:1098-1130,1216-1234`]

## Don't Hand-Roll

| Problem | Avoid | Use |
|---------|-------|-----|
| Project authorization | Route-local role-name comparisons | `projectContext`, `requireProjectPermission`, existing `projectPolicy` and source capabilities. [VERIFIED: `apps/server/src/modules/project/core/project.middleware.ts:35-48,150-162`; `project.policy.ts:555-591`] |
| Tenant-aware portfolio | Filtering rows after organization-wide aggregates | One authorization-scoped repository predicate reused for rows and all aggregate queries. [ASSUMED] |
| CSV/export job infrastructure | New queue/storage or exposing object keys | Existing PgBoss, export record, MinIO, and presigned URL patterns. [VERIFIED: `apps/server/src/modules/reporting/exports/export.service.ts:8-10,20-32,127-160`; `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:74-80`] |
| Event dispatch | Second generic dispatcher alongside active outbox/PgBoss contract | Validate the active dispatch contract; fence the unused dispatcher unless safely compatible. [ASSUMED] |
| Redis wildcard invalidation | `KEYS` over list-cache keys | Organization generation/version keys or, if generation design is rejected, cursor-based `SCAN` as required by the checklist. [VERIFIED: `apps/server/src/modules/project/core/project.cache.service.ts:101-108`; `.planning/checklist_when_to_apply.md:215-225`] |
| Date/timezone rules | Custom UTC offset math or a new date library | Existing project/organization effective settings and one shared report normalizer. [VERIFIED: `apps/server/src/modules/project/settings/project-settings.service.ts:35-53,87-110`; `apps/server/src/modules/reporting/report.filters.ts:3-40`] |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (server manifest declares `vitest` `^3.0.0`) |
| Config file | `apps/server/vitest.config.ts`; root workspace `vitest.workspace.ts` |
| Quick run command | `pnpm --filter @siteflow/server test -- tests/integration/reporting/report-routes.test.ts` |
| Full server suite | `pnpm --filter @siteflow/server test` |
| Root suite / build | `pnpm test`; `pnpm build` |
| Typecheck / lint | `pnpm --filter @siteflow/server typecheck`; `pnpm --filter @siteflow/server lint` |

These commands derive from root and server `package.json` scripts; no tests were run for this research. Integration tests must use real PostgreSQL-backed fixtures and the production app factory (`createTestApp()` → `buildApp()` → `app.ready()`), not mocked Fastify request/reply objects. [VERIFIED: `package.json:8-15`; `apps/server/package.json:5-19`; `apps/server/vitest.config.ts:1-31`; `vitest.workspace.ts:1-10`; `.planning/siteflow_testing_context.md:78-128,184-232`; `apps/server/tests/helpers/test-app.ts:1-32`]

### Requirement → Test Map

| Requirement | Primary regression target |
|-------------|---------------------------|
| REM-01/02 | `tests/integration/reporting/report-routes.test.ts` — project/source permission and authorized portfolio rows/aggregates/cursors |
| REM-03 | New SSE route integration coverage alongside `tests/integration/notification/realtime-authorization.test.ts` |
| REM-04/05 | `tests/integration/outbox/transactional-publishing.test.ts`, `dispatcher.test.ts`, and reminder/notification registration or fencing tests |
| REM-06/07 | `tests/integration/reporting/export-lifecycle.test.ts` plus export request filter-contract assertions |
| REM-08 | `tests/integration/reporting/report-foundation.test.ts` and timezone-aware report route tests |
| REM-09 | New project-worker durable retry test plus project cache invalidation tests |

### Phase Verification Commands

```bash
pnpm --filter @siteflow/server test -- tests/integration/reporting/report-routes.test.ts
pnpm --filter @siteflow/server test -- tests/integration/reporting/export-lifecycle.test.ts
pnpm --filter @siteflow/server test -- tests/integration/reporting/report-foundation.test.ts
pnpm --filter @siteflow/server test -- tests/integration/outbox
pnpm --filter @siteflow/server test -- tests/integration/notification tests/integration/operations-reminders
pnpm --filter @siteflow/server test -- tests/integration/project_core.test.ts
pnpm --filter @siteflow/server typecheck
pnpm --filter @siteflow/server lint
pnpm --filter @siteflow/server test
pnpm build
```

The focused files listed as new above are Wave 0 gaps until implemented. Tests that exercise DB/Redis/PgBoss/MinIO must use the configured test infrastructure in `apps/server/vitest.config.ts`; do not treat a pure worker-function test as proof of runtime registration, durable retry, or authorization. [VERIFIED: `apps/server/vitest.config.ts:1-31`; `.planning/siteflow_testing_context.md:1311-1368,1453-1502,2638-2790`]

## Security Domain

| Area | Applies | Standard control |
|------|---------|------------------|
| V2 Authentication | Yes — SSE and export routes | `authenticate`; reject absent identity. |
| V3 Session Management | Yes — long-lived SSE | Use current server-side identity/context; invalidate or recheck after revocation. |
| V4 Access Control | Yes — project reports, portfolio, exports, SSE | Existing project/organization permission maps; deny by default and re-check at download/delivery. |
| V5 Input Validation | Yes — export body, report filters, cursor, outbox payload | Shared Zod schemas; validate tenant/scope and date bounds. |
| V6 Cryptography | Limited — signed download URLs | Reuse MinIO presigning; do not implement signing or token cryptography. |

Threats to cover: horizontal privilege escalation/IDOR for project/export IDs; cross-tenant aggregate and job-payload leakage; SSE URL tenant spoofing; stale access on long-lived connections and downloads; duplicate worker effects; CSV/report filter tampering. [VERIFIED: `.planning/siteflow_testing_context.md:602-788,825-859,1311-1368`; `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md:69-80`]

## Assumptions Log

| # | Claim / recommendation | Section | Risk if wrong |
|---|------------------------|---------|---------------|
| A1 | Prefer fencing the disconnected generic dispatcher over wiring it into the active outbox poller; current active event-specific contracts should be validated in place. | H4 | Could defer a product-required generic event consumer; resolve against the intended Phase 8 contract before implementation. |
| A2 | Fence reminder/email/preference modules rather than complete their producer/registration pipeline in Phase 9. | H5 | A path may already be relied on by an untracked runtime; confirm call sites before deleting exports. |
| A3 | Select sync/async export execution before report fetch using measured family/size policy; route an already-fetched slow result through no second fetch. | H6 | A measurement policy may not predict variable workloads; unknown workloads should default to the safe async path until measured. |
| A4 | Calendar quarter/year is the date-preset default absent an explicit fiscal-period contract. | H8 | Financial reports may require configured fiscal periods instead. |
| A5 | Use org-generation cache keys and a durable DB idempotency key for jobs with actual effects. | H9 | Requires coordinated cache-key rollout and possibly a migration; avoid persistence for log-only jobs. |

## Open Questions / Safe Defaults

1. **H4 event contract:** Are current outbox types exclusively event-specific PgBoss jobs, or is any producer already writing `DomainEventEnvelope` for generic dispatch? **Default:** preserve the active poller contract, validate active event types, and fence generic dispatcher until a registered compatible consumer is proven.
2. **H5 dormant modules:** Are any out-of-repository runtime consumers calling reminder/email/preference helpers? **Default:** inspect call sites during execution; make entry points explicitly dormant and do not register incomplete work.
3. **H6 cost classification:** Which report families exceed the ~100 ms threshold under representative load? **Default:** profile and persist a simple report-family/size policy; decide before fetching; treat unknown expensive work as async.
4. **H8 fiscal boundaries:** Should quarter/year presets follow fiscal settings? **Default:** use calendar boundaries unless a product rule confirms fiscal periods; always use the applicable timezone and `weekStartsOn`.
5. **H9 job effects:** Which project jobs have side effects beyond logging? **Default:** durable idempotency only for effects, using stable `idempotencyKey` and transactional persistence; do not claim the existing in-memory `Set` is durable.

## Sources

### Primary — checked-out source and decisions
- `.planning/phases/09-architecture-findings-remediation/09-CONTEXT.md` — requirements, constraints, acceptance.
- `.planning/phases/08-phase-f-reporting-and-downloads/08-CONTEXT.md` — project/portfolio authorization, current realtime checks, timezone semantics, configurable export policy.
- `docs/architecture/findings.md` — H1–H9 finding summary; source files cited inline under each item.
- `.planning/STATE.md`, `.planning/ROADMAP.md` — confirms Phase 8 remains pending.
- `.planning/checklist_when_to_apply.md` and `.planning/siteflow_testing_context.md` — mandatory tenant, RBAC, async, cache, and real integration-test contracts.
- `apps/server/package.json`, `package.json`, `apps/server/vitest.config.ts`, `vitest.workspace.ts` — available test, lint, typecheck, and build commands.

**Research date:** 2026-10-09
**Valid until:** 2026-11-08; recheck source paths and deployment configuration before implementation.
**Execution note:** No application source, `docs/architecture/`, tests, or runtime behavior were modified or executed during research.
