---
phase: 08-phase-f-reporting-and-downloads
slug: phase-f-reporting-and-downloads
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-10-08"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The phase is not yet validated; all planned checks remain pending.

---

## Test Infrastructure

| Property | Value |
|---|---|
| **Framework** | Vitest 3 (server); Playwright (web E2E) |
| **Config file** | `vitest.workspace.ts`; server package script in `apps/server/package.json`; web Playwright script in `apps/web/package.json` |
| **Quick run command** | `pnpm --filter @siteflow/server test -- tests/integration/outbox/dispatcher.test.ts` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | Quick: under 60 seconds when the named targeted test is present; full suite: several minutes, confirm on first run |

Integration tests use `createTestApp()` → `buildApp()` → `app.ready()` and `app.inject()`, real PostgreSQL, two-organization isolation fixtures, randomized `runId` values, scoped persisted-state assertions, and real PgBoss/MinIO behavior when applicable, per `.planning/siteflow_testing_context.md`.

---

## Sampling Rate

- **After every task commit:** Run that task's `<automated>` command(s) verbatim.
- **After every plan wave:** Run `pnpm test`.
- **Before `/gsd-verify-work`:** Run `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, and the database migration commands listed in F.18.
- **Max feedback latency:** 60 seconds for targeted tests; full-suite duration is measured and recorded on first run.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---:|---:|---|---|---|---|---|---|---|
| 08-01-01 | 01 | 1 | EVT-01–03 | T-08-01 | F.0 audit covers tenant, event, worker, source and storage evidence without implementation changes | server baseline | `pnpm --filter @siteflow/server test` | Existing command; audit artifact task-created | ⬜ pending |
| 08-01-02 | 01 | 1 | EVT-01–03 | T-08-01 | Audit keeps real integration-test and tier boundaries | server typecheck | `pnpm --filter @siteflow/server typecheck` | Existing command; audit artifact task-created | ⬜ pending |
| 08-02-01 | 02 | 2 | EVT-01 | T-08-02 | Versioned event contract rejects invalid scope/payload and serializes safely | server integration | `pnpm --filter @siteflow/server test -- tests/integration/outbox/domain-event-contract.test.ts` | No — task-created | ⬜ pending |
| 08-02-02 | 02 | 2 | EVT-01 | T-08-02 | Event vocabulary/migration compatibility is preserved | server integration | `pnpm --filter @siteflow/server test -- tests/integration/outbox/domain-event-contract.test.ts` | No — task-created | ⬜ pending |
| 08-03-01 | 03 | 3 | EVT-02 | T-08-03 | Mutation and tenant-scoped outbox event commit/rollback atomically | server integration | `pnpm --filter @siteflow/server test -- tests/integration/outbox/transactional-publishing.test.ts` | No — task-created | ⬜ pending |
| 08-03-02 | 03 | 3 | EVT-02 | T-08-03 | Only source-backed producers are migrated and retry/dedup behavior persists | server integration | `pnpm --filter @siteflow/server test -- tests/integration/outbox/transactional-publishing.test.ts` | No — task-created | ⬜ pending |
| 08-04-01 | 04 | 4 | EVT-03 | T-08-04 | Handler failure isolation and durable idempotency prevent duplicate effects | server integration | `pnpm --filter @siteflow/server test -- tests/integration/outbox/dispatcher.test.ts` | No — task-created | ⬜ pending |
| 08-04-02 | 04 | 4 | EVT-03 | T-08-04 | Retry/failure telemetry and worker registration are observable | server integration | `pnpm --filter @siteflow/server test -- tests/integration/outbox/dispatcher.test.ts` | No — task-created | ⬜ pending |
| 08-05-01 | 05 | 5 | NTF-01 | T-08-05 | Notification intent and channel attempt lifecycle persist independently | server integration | `pnpm --filter @siteflow/server test -- tests/integration/notification/notification-lifecycle.test.ts` | No — task-created | ⬜ pending |
| 08-05-02 | 05 | 5 | NTF-01 | T-08-05 | Invalid transitions/failures preserve scoped intent state | server integration | `pnpm --filter @siteflow/server test -- tests/integration/notification/notification-lifecycle.test.ts` | No — task-created | ⬜ pending |
| 08-06-01 | 06 | 6 | NTF-02 | T-08-06 | Email provider boundary renders safe text/HTML and avoids secret disclosure | server integration | `pnpm --filter @siteflow/server test -- tests/integration/notification/email-delivery.test.ts` | No — task-created | ⬜ pending |
| 08-06-02 | 06 | 6 | NTF-02 | T-08-06 | Email attempts, retry, idempotency and terminal outcome are persisted | server integration | `pnpm --filter @siteflow/server test -- tests/integration/notification/email-delivery.test.ts` | No — task-created | ⬜ pending |
| 08-07-01 | 07 | 6 | NTF-03 | T-08-07 | Current tenant/project permission is checked at realtime connection and subscribe | server integration | `pnpm --filter @siteflow/server test -- tests/integration/notification/realtime-authorization.test.ts` | No — task-created | ⬜ pending |
| 08-07-02 | 07 | 6 | NTF-03 | T-08-07 | Current permission is rechecked at delivery; revocation and disconnect fail closed | server integration | `pnpm --filter @siteflow/server test -- tests/integration/notification/realtime-authorization.test.ts` | No — task-created | ⬜ pending |
| 08-08-01 | 08 | 6 | COM-01 | T-08-08 | WhatsApp contract is provider-neutral and does not require vendor credentials | server unit | `pnpm --filter @siteflow/server test -- tests/unit/notification/whatsapp-channel.test.ts` | No — task-created | ⬜ pending |
| 08-08-02 | 08 | 6 | COM-01 | T-08-08 | Channel dispatch preserves tenant scope and intent lifecycle | server integration | `pnpm --filter @siteflow/server test -- tests/integration/notification/whatsapp-channel.test.ts` | No — task-created | ⬜ pending |
| 08-09-01 | 09 | 7 | SCH-01 | T-08-09 | Source-backed due checks enqueue scoped idempotent work | server integration | `pnpm --filter @siteflow/server test -- tests/integration/operations-reminders/reminders.test.ts` | No — task-created | ⬜ pending |
| 08-09-02 | 09 | 7 | SCH-01 | T-08-09 | Worker registration/retries do not duplicate reminders | server integration | `pnpm --filter @siteflow/server test -- tests/integration/operations-reminders/reminders.test.ts` | No — task-created | ⬜ pending |
| 08-10-01 | 10 | 7 | PREF-01 | T-08-10 | Disabled channel creates no send/attempt while event and intent remain persisted | server integration | `pnpm --filter @siteflow/server test -- tests/integration/notification/preferences.test.ts` | No — task-created | ⬜ pending |
| 08-10-02 | 10 | 7 | PREF-01 | T-08-10 | Protected settings routes enforce owner/tenant scope and affect delivery | server integration | `pnpm --filter @siteflow/server test -- tests/integration/notification/preferences.test.ts` | No — task-created | ⬜ pending |
| 08-11-01 | 11 | 8 | RPT-01–03, RPT-05 | T-08-11 | Schedule metrics repair includes organization scope before reuse | server integration | `pnpm --filter @siteflow/server test -- tests/integration/schedule-metrics/tenant-scope.test.ts` | No — task-created | ⬜ pending |
| 08-11-02 | 11 | 8 | RPT-01–03 | T-08-11 | Shared report contract/source map constrains filters and tenant visibility | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/report-foundation.test.ts` | No — task-created | ⬜ pending |
| 08-12-01 | 12 | 9 | RPT-04 | T-08-12 | Health indicators expose only audited source facts | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/project-health.test.ts` | No — task-created | ⬜ pending |
| 08-12-02 | 12 | 9 | RPT-04 | T-08-12 | Report respects source permission and project ownership | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/project-health.test.ts` | No — task-created | ⬜ pending |
| 08-13-01 | 13 | 9 | RPT-05 | T-08-13 | Schedule report reuses authoritative service facts | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/schedule-report.test.ts` | No — task-created | ⬜ pending |
| 08-13-02 | 13 | 9 | RPT-05 | T-08-13 | Tenant, project, filter and ownership boundaries are enforced | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/schedule-report.test.ts` | No — task-created | ⬜ pending |
| 08-14-01 | 14 | 9 | RPT-06 | T-08-14 | Commercial values preserve authoritative coverage and currency semantics | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/cost-report.test.ts` | No — task-created | ⬜ pending |
| 08-14-02 | 14 | 9 | RPT-06 | T-08-14 | Financial authorization and persisted sources are checked | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/cost-report.test.ts` | No — task-created | ⬜ pending |
| 08-15-01 | 15 | 9 | RPT-07 | T-08-15 | Procurement report exposes only verified source status | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/procurement-report.test.ts` | No — task-created | ⬜ pending |
| 08-15-02 | 15 | 9 | RPT-07 | T-08-15 | Source permission, ownership and tenant scope are enforced | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/procurement-report.test.ts` | No — task-created | ⬜ pending |
| 08-16-01 | 16 | 9 | RPT-08 | T-08-16 | Subcontractor facts have authoritative coverage; unsupported commitments remain unavailable | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/subcontractor-report.test.ts` | No — task-created | ⬜ pending |
| 08-16-02 | 16 | 9 | RPT-08 | T-08-16 | Tenant, project and source ownership boundaries are tested | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/subcontractor-report.test.ts` | No — task-created | ⬜ pending |
| 08-17-01 | 17 | 10 | RPT-03, RPT-10 | T-08-17 | Project API and executive summary use authorized canonical report services | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/report-routes.test.ts` | No — task-created | ⬜ pending |
| 08-17-02 | 17 | 10 | RPT-09–10 | T-08-17 | Portfolio includes only authorized projects and groups currencies safely | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/report-routes.test.ts` | No — task-created | ⬜ pending |
| 08-18-01 | 18 | 11 | RPT-09–10 | T-08-18 | Project report web view renders server result without client recalculation | web E2E | `pnpm --filter @siteflow/web test:e2e` | No — task-created | ⬜ pending |
| 08-18-02 | 18 | 11 | RPT-09–10 | T-08-18 | Portfolio view respects available project access and pagination | web E2E | `pnpm --filter @siteflow/web test:e2e` | No — task-created | ⬜ pending |
| 08-19-01 | 19 | 12 | RPT-11–12 | T-08-19 | CSV output matches one authorized report API result | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/export-format-parity.test.ts` | No — task-created | ⬜ pending |
| 08-19-02 | 19 | 12 | RPT-11–12 | T-08-19 | CSV serialization escapes formula-leading content and preserves stable fields | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/export-format-parity.test.ts` | No — task-created | ⬜ pending |
| 08-20-01 | 20 | 13 | RPT-13–14 | T-08-20 | CSV export records enforce schema, owner, and tenant constraints | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/export-lifecycle.test.ts` | No — task-created | ⬜ pending |
| 08-20-02 | 20 | 13 | RPT-13–14 | T-08-20 | Export routes reauthorize owner/current permission and apply configurable D-03 defaults | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/export-lifecycle.test.ts` | No — task-created | ⬜ pending |
| 08-20-03 | 20 | 13 | RPT-13–14 | T-08-20 | PgBoss retry, MinIO lifecycle, expiry and cleanup are idempotent and scoped | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/export-lifecycle.test.ts` | No — task-created | ⬜ pending |
| 08-21-01 | 21 | 14 | RPT-11–12, RPT-15 | T-08-21 | Browser requests CSV with current report filters; PDF/XLSX controls absent | web E2E | `pnpm --filter @siteflow/web test:e2e -- tests/e2e/report-exports.spec.ts` | No — task-created | ⬜ pending |
| 08-21-02 | 21 | 14 | RPT-15 | T-08-21 | Pending/ready/failed/expired states use fresh authorized downloads | web E2E | `pnpm --filter @siteflow/web test:e2e -- tests/e2e/report-exports.spec.ts` | No — task-created | ⬜ pending |
| 08-22-01 | 22 | 15 | All phase requirements | T-08-22 | Full regression, schema generation/migration, build and web E2E gates pass | workspace/migration/web E2E | `pnpm test`; `pnpm --filter @siteflow/database db:generate`; `pnpm --filter @siteflow/database db:migrate`; `pnpm build`; `pnpm lint`; `pnpm typecheck`; `pnpm --filter @siteflow/web test:e2e` | Existing scripts | ⬜ pending |
| 08-22-02 | 22 | 15 | All phase requirements | T-08-22 | Final server route, tenant, retry, realtime, preference-suppression, and storage suites pass | server integration | `pnpm --filter @siteflow/server test -- tests/integration/reporting/report-routes.test.ts tests/integration/outbox/dispatcher.test.ts tests/integration/reporting/export-lifecycle.test.ts tests/integration/notification/realtime-authorization.test.ts tests/integration/notification/preferences.test.ts` | No — task-created | ⬜ pending |

---

## Wave 0 Requirements

Existing Vitest, Playwright, PostgreSQL test fixtures and workspace commands are in place. Phase-specific regression tests are created in their owning implementation tasks; no separate Wave 0 scaffold is required. Each task reads both mandatory planning/testing references.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Full new-route inventory, generated Swagger/OpenAPI request/response schemas, and bounded pagination cross-check | RPT-03, RPT-09–15, EVT/NTF routes | No dedicated OpenAPI audit script is defined in the repository; route integration tests cover executable behavior but the complete generated spec still requires review | Export/read the Fastify Swagger document from the test app; list every new route/method and compare params, query/body, response schema, auth and pagination bounds with the registered route and Zod contract. Record route/path evidence and mismatches in `08-F0-AUDIT.md`. |
| Query plan/index review for five most complex new report queries | RPT-01–10, RPT-13 | No phase-specific EXPLAIN harness is defined | Execute `EXPLAIN (ANALYZE, BUFFERS)` against representative PostgreSQL fixture data for each of the five queries; record the SQL/query identity, plan output, index use, row estimates, and any follow-up in `08-F0-AUDIT.md`. |
| Transaction/lock duration review | EVT-02–03, RPT-13–14 | No automated duration report exists for the new workload | Inspect transactional code and observed test logs for external calls inside transactions, lock ordering and normal-path duration; document evidence and remediation in the audit. |
| Deployment retention/signing override | RPT-13–14 | Deployment policy is environment-specific and not proven by the local compose setting | Inspect the actual verified deployment policy. If it requires other values, record source and effective values; otherwise use configurable 24-hour artifact and 5-minute signed URL defaults. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or explicit manual-evidence criteria.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verification.
- [ ] Wave 0 covers all missing references; feature test files are created by their owning tasks.
- [ ] No watch-mode flags appear in commands.
- [ ] Targeted feedback latency is under 60 seconds; full-suite runtime is recorded at first execution.
- [ ] Tier 2 covers migrations, OpenAPI, cross-tenant negatives, retry/concurrency, query plans/indexes, worker/storage, and full build.
- [ ] Tier 3 load/stress/capacity work remains explicitly pre-production only.
- [ ] `nyquist_compliant: true` set in frontmatter after execution evidence is complete.

**Approval:** pending execution.
