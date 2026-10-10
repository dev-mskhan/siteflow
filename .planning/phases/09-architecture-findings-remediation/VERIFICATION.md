---
phase: 09-architecture-findings-remediation
verified: 2026-10-10T07:52:09+05:00
status: gaps_found
score: 9/9 must-haves verified
covered_files:
  - .planning/phases/09-architecture-findings-remediation/09-01-PLAN.md
  - .planning/phases/09-architecture-findings-remediation/09-01-SUMMARY.md
  - .planning/phases/09-architecture-findings-remediation/09-02-PLAN.md
  - .planning/phases/09-architecture-findings-remediation/09-02-SUMMARY.md
  - .planning/phases/09-architecture-findings-remediation/09-03-PLAN.md
  - .planning/phases/09-architecture-findings-remediation/09-03-SUMMARY.md
  - apps/server/src/lib/outbox/outbox.dispatcher.ts
  - apps/server/src/lib/outbox/outbox.service.ts
  - apps/server/src/modules/notification/realtime/realtime.plugin.ts
  - apps/server/src/modules/project/core/project.cache.service.ts
  - apps/server/src/modules/project/core/project.policy.ts
  - apps/server/src/modules/project/core/project.service.ts
  - apps/server/src/modules/project/core/project.worker.ts
  - apps/server/src/modules/reporting/cost/cost-report.service.ts
  - apps/server/src/modules/reporting/docs/report.api.schemas.ts
  - apps/server/src/modules/reporting/exports/export.jobs.ts
  - apps/server/src/modules/reporting/exports/export.repository.ts
  - apps/server/src/modules/reporting/exports/export.routes.ts
  - apps/server/src/modules/reporting/exports/export.service.ts
  - apps/server/src/modules/reporting/exports/export.worker.ts
  - apps/server/src/modules/reporting/portfolio/portfolio-report.repository.ts
  - apps/server/src/modules/reporting/portfolio/portfolio-report.service.ts
  - apps/server/src/modules/reporting/procurement/procurement-report.service.ts
  - apps/server/src/modules/reporting/report.filters.ts
  - apps/server/src/modules/reporting/report.handlers.ts
  - apps/server/src/modules/reporting/report.routes.ts
  - apps/server/src/modules/reporting/report.service.ts
  - apps/server/src/modules/reporting/schedule/schedule-report.service.ts
  - apps/server/src/modules/reporting/subcontractor/subcontractor-report.service.ts
  - apps/server/src/worker-registration.ts
  - apps/server/src/worker.ts
  - apps/server/tests/integration/notification/realtime-authorization.test.ts
  - apps/server/tests/integration/outbox/dispatcher.test.ts
  - apps/server/tests/integration/outbox/transactional-publishing.test.ts
  - apps/server/tests/integration/project/project-worker.test.ts
  - apps/server/tests/integration/reporting/export-lifecycle.test.ts
  - apps/server/tests/integration/reporting/report-foundation.test.ts
  - apps/server/tests/integration/reporting/report-routes.test.ts
  - apps/server/tests/integration/worker/worker-registration.test.ts
  - apps/web/src/reporting/report-api.ts
  - packages/env/src/server.ts
  - packages/shared/src/reporting/report.schema.ts
covered_digest: "v3:sha256:434fe1e90924645c6d34c8cbf923a647d9e77be716ae638e80d580aa9c573186"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Phase 9 changes are committed and pushed without architecture evidence in the remediation commit."
    status: partial
    reason: "Source and regression verification is complete, but no remediation commit or push has been created yet. Phase 8 also remains pending."
    artifacts:
      - path: ".planning/ROADMAP.md"
        issue: "Phase 9 criterion 9 includes committed/pushed fixes; no such completion is claimed here."
    missing:
      - "Commit and push the verified remediation changes while excluding docs/architecture/."
---

# Phase 9: Architecture Findings Remediation Verification Report

**Phase Goal:** Close the source-verified authorization, tenant-isolation, reliability, export-contract, and date-semantics gaps recorded as H1–H9 in `docs/architecture/findings.md`, without claiming the unexecuted Phase 8 plans are complete.
**Verified:** 2026-10-10T07:52:09+05:00
**Status:** gaps_found
**Re-verification:** Yes — export retention and signed-URL settings were moved into validated configuration and the complete Phase 9 regression set rerun.

## Goal Achievement

`docs/architecture/` was treated as user-owned evidence and was not modified. Source and current regression tests, not SUMMARY.md statements, were used as evidence.

| # | Truth / requirement | Status | Direct evidence |
|---|---|---|---|
| 1 | REM-01: Project-report endpoints enforce current project-read authority and fail closed for missing membership. | ✓ VERIFIED | `report.routes.ts` applies `authenticate`, `organizationContext`, `projectContext`, `requireProjectPermission('project:read')`, then report-specific capabilities to all six project routes. `report-routes.test.ts` checks an organization member lacking project-read authority against each route. |
| 2 | REM-02: Portfolio rows and aggregates use caller-readable project scope and bounded cursor paging. | ✓ VERIFIED | `portfolio-report.repository.ts` derives readable project IDs via `projectPolicy`, applies the same organization/project predicate to rows, totals, status counts, and currency aggregates, and clamps page size to 1–100. `report-routes.test.ts` asserts empty and single-project views, aggregate agreement, and cursor pages. |
| 3 | REM-03: SSE rejects unauthenticated/foreign-tenant claims and uses configured CORS rather than URL-derived tenant identity. | ✓ VERIFIED (organization-scoped route) | `realtime.plugin.ts` uses `authenticate` and `organizationContext`, compares verified context with the path organization, and does not set a wildcard header or fall back to the URL. `realtime-authorization.test.ts` exercises unauthenticated, cross-organization, and wildcard-origin cases. The route is organization-scoped; no project-specific subscription contract or runtime project-filtered delivery is demonstrated, so this is not evidence of project-level realtime delivery. |
| 4 | REM-04: Active outbox contracts and tenant scope are validated; dormant dispatcher is fenced. | ✓ VERIFIED | `outbox.service.ts` validates known queue payloads, domain envelopes, required tenant scope and tenant consistency both before persistence and before dispatch. `outbox.dispatcher.ts` rejects registration/dispatch as unavailable. `transactional-publishing.test.ts` covers invalid/mismatched payloads, transaction requirement, duplicate row ID, and send options; `dispatcher.test.ts` checks the fence. |
| 5 | REM-05: Reminder/email/preference delivery is either integrated or explicitly kept unavailable. | ✓ VERIFIED (availability boundary only) | `worker-registration.ts` registers supported workers but not reminder/email delivery. `worker-registration.test.ts` asserts supported registrations and absence of reminder/email/preference registrations and schedules. This does not complete Phase 8 delivery functionality. |
| 6 | REM-06: Export filter contract agrees, errors surface, and work is not silently duplicated; export policy is configured. | ✓ VERIFIED | `report-api.ts` sends `filters`; `export.routes.ts` accepts `filters`; `export.service.ts` selects configured synchronous report types before fetching and marks/rethrows failures rather than falling through to another generation. `packages/env/src/server.ts` validates retention (1–720 hours, default 24) and signed URL expiry (60–604800 seconds, default 300); `export.repository.ts` and `export.service.ts` consume those settings. Lifecycle tests verify expiry uses configured retention and URL lifetime uses the validated value. |
| 7 | REM-07: Export creation, access/state transitions, download and audit paths are organization/project/actor-scoped. | ✓ VERIFIED | `export.service.ts` authorizes project exports, checks owner/org on status, rechecks project-read authority, checks requester/project again in `export.worker.ts`, and writes organization/project/actor audit entries. Repository lifecycle updates include export ID, organization ID, and nullable project ID. `export-lifecycle.test.ts` checks request/download audits and cross-tenant access. |
| 8 | REM-08: Public date presets and custom bounds are validated with effective timezone and UTC fallback. | ✓ VERIFIED | `report.filters.ts` implements all declared presets, validates complete/valid/ordered custom bounds, and derives calendar dates in the supplied timezone. `getReportDateOptions` resolves project settings or organization settings with UTC fallback. `report-foundation.test.ts` exercises every preset in `America/Los_Angeles`, custom-bound rejection, and UTC envelope default. |
| 9 | REM-09: Project-worker retry/idempotency is durable across processes/replicas and cache invalidation is bounded. | ✓ VERIFIED (current handlers) | `project.worker.ts` handlers only log and trace; they perform no business mutation or cache invalidation, so repeated delivery cannot duplicate a project business effect today. Project events are persisted through the transactional outbox and sent through PgBoss with a stable singleton key. Generation-based project-list invalidation avoids Redis `KEYS`; cache tests cover generation advance and stale-fill rejection. Any future effectful project handler must add durable consumer idempotency before shipping. |

**Score:** 9/9 verified. Commit/push remains the only Phase 9 completion gate.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/server/src/modules/reporting/report.routes.ts` | Project-read route guards and SSE-adjacent report wiring | ✓ VERIFIED | Substantive route guards are connected to integration coverage. |
| `apps/server/src/modules/reporting/portfolio/portfolio-report.repository.ts` | Authorized project filtering and bounded cursor paging | ✓ VERIFIED | Real DB predicates scope each query; limit is clamped. |
| `apps/server/src/modules/notification/realtime/realtime.plugin.ts` | Authenticated tenant-scoped SSE boundary | ✓ VERIFIED | Auth and current organization context are wired; project-specific SSE is not claimed. |
| `apps/server/src/lib/outbox/outbox.service.ts` | Validated outbox enqueue/dispatch contract | ✓ VERIFIED | Validation runs before write and dispatch; PgBoss send options are stable-keyed. |
| `apps/server/src/modules/reporting/exports/export.service.ts` | Export scope, decision and error behavior | ✓ VERIFIED | Sync eligibility and signed URL expiry are read from validated environment settings. |
| `apps/server/src/modules/reporting/report.filters.ts` | Effective timezone date normalization | ✓ VERIFIED | Presets/custom validation and timezone input are implemented and tested. |
| `apps/server/src/modules/project/core/project.worker.ts` | Safe project worker retry behavior | ✓ VERIFIED for current handlers | Project handlers are side-effect-free log/trace consumers; repeated or retried delivery cannot duplicate business mutations. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Project/organization membership policies | Project-report routes and portfolio queries | Current project membership and policy checks | WIRED | Route middleware and `PortfolioReportRepository.getReadableProjectIds` derive current authorization. |
| Verified request identity/context | SSE connection | `authenticate` → `organizationContext` → tenant comparison | WIRED | URL organization is only a target to compare, not an identity fallback. |
| Outbox writer/poller | PgBoss consumers | Validated payload → persisted row → singleton-key send | WIRED | `writeOutboxEvent` requires transaction and validates; poller revalidates before `sendJob`. |
| Web export request | Export server/service | Canonical `filters`; pre-fetch sync eligibility | WIRED | Client and server use `filters`; integration tests cover filter persistence and no duplicate sync fetch. |
| Project/organization settings | Date filters | Project settings or organization settings, UTC fallback | WIRED | `getReportDateOptions` feeds `normalizeReportFilters`. |
| Project worker event | Durable idempotent business effect | Side-effect-free handlers plus persisted outbox/PgBoss delivery | ✓ VERIFIED for current handlers | The current handler implementations only emit logs/spans; there is no business effect to duplicate on retry. Any future effectful consumer requires durable idempotency. |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| Portfolio service/repository | project rows, counts, contract values | Drizzle queries against `projects` and `projectMembers` with authorization predicates | Yes | ✓ FLOWING |
| Project report handlers/services | report values | Existing report/domain services and database reads | Yes | ✓ FLOWING |
| Export worker/service | report envelope and CSV | Scoped report service → CSV renderer → MinIO | Yes | ✓ FLOWING |
| Date filter service | effective timezone and week start | Project/organization settings repositories | Yes, UTC fallback | ✓ FLOWING |
| Project worker | event data | Persisted outbox payload/PgBoss job | Real event payload; handler emits logs/spans only | ✓ FLOWING (no business mutation) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Focused Phase 9 integration regressions | `pnpm --filter @siteflow/server exec vitest run` with the nine specified Phase 9 integration files | 9 files passed; **66 tests passed** | ✓ PASS |
| Server types | `pnpm --filter @siteflow/server typecheck` | Exit 0 | ✓ PASS |
| Web types | `pnpm --filter @siteflow/web typecheck` | Exit 0 | ✓ PASS |
| Focused server lint | ESLint on the changed Phase 9 server implementation paths | 0 errors; 10 `no-explicit-any` warnings | ✓ PASS (warnings) |
| Full server lint | `pnpm --filter @siteflow/server lint` | Exit 1; 4 errors in unchanged `notification.service.ts`, `preferences/preference.service.ts`, and `reporting/exports/report-renderer.ts` (two type-only import errors, forbidden `require()`, and dynamic-import type annotation); 598 warnings | ✗ FAIL (unrelated existing errors) |

The nine-file run after the export configuration fix reported 66 passing tests.

### Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| None declared or implied by the Phase 9 plans/summaries | N/A | Not a migration/tooling probe phase | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| REM-01 | 09-01 | Project reports enforce current project-read authority | SATISFIED | Route guards and route integration cases. |
| REM-02 | 09-01 | Portfolio rows/aggregates are authorized with bounded cursors | SATISFIED | Shared query scope, capped limit, route tests. |
| REM-03 | 09-01 | Authenticated tenant-scoped realtime with configured CORS | SATISFIED for current organization stream | Route auth/context and SSE integration tests; project-level subscriptions/delivery are not claimed. |
| REM-04 | 09-02 | Validated active outbox and fenced unused dispatcher | SATISFIED | Validation in writer/poller; dispatcher tests. |
| REM-05 | 09-02 | Notification/reminder helpers wired or deliberately unavailable | SATISFIED as unavailable boundary | Registration test protects absence; Phase 8 capability remains pending. |
| REM-06 | 09-02 | Export filter contract, observable failures, no duplicate generation | SATISFIED | Client/server fields and sync failure behavior pass; retention and URL expiry are validated and consumed from environment configuration with documented defaults. |
| REM-07 | 09-03 | Export lifecycle and audit scope | SATISFIED | Service/repository checks and lifecycle integration tests. |
| REM-08 | 09-03 | Date preset/custom validation and timezone fallback | SATISFIED | Normalizer, settings resolution and focused tests. |
| REM-09 | 09-03 | Durable project worker retry/idempotency and bounded invalidation | SATISFIED for current handlers | Project handlers have no business effects; outbox/PgBoss delivery is persisted and keyed, and cache-generation invalidation is covered by tests. |

No additional Phase 9-mapped requirement was found outside REM-01–REM-09.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| None | — | No remaining H6 export-policy hard-coded constants found in the reviewed paths | ✓ Cleared | Retention and URL expiry are validated environment settings. |

Other `return null` hits are ordinary not-found/unsupported-report/cursor control flow, not placeholder implementations. No unreferenced `TBD`, `FIXME`, or `XXX` debt marker was found in the scanned implementation files.

### Human Verification Required

No separate interactive UAT prompt was used; the user requested autonomous execution without questions. Automated route, outbox, worker-registration, export, date, and cache regression tests are recorded below.

### Gaps Summary

The retention and signed URL expiry configuration gap is closed and verified. Current project worker behavior is safe under retries because handlers only log and trace and perform no business side effect; future effectful handlers will need durable consumer idempotency. The nine-file integration run passed 66 tests, and server, web, and env typechecks passed. Full server lint still exits non-zero due to four errors in unchanged notification and report-renderer files.

The project-worker reliability claim is narrower than the summary's broad wording: the project handlers presently log and trace only, while event production is transactional/persisted and sent through the PgBoss singleton with a stable key. That provides durable enqueue/retry and leaves no business mutation to duplicate today; it is not evidence of durable consumer idempotency after restart/redelivery. There is no restart/retry behavior test. Do not generalize this current no-op safety to future effectful handlers.

Phase 8 remains pending and unexecuted, as shown by `.planning/STATE.md` and the unchecked roadmap phase. No source code, requirements/roadmap planning state, or `docs/architecture/` evidence was edited for this verification. No staging, commit, or push was performed; the roadmap's commit/push clause therefore remains outstanding by instruction.

---

_Verified: 2026-10-10T07:52:09+05:00_
_Verifier: the agent (gsd-verifier)_
