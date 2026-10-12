---
gsd_state_version: "1.0"
current_phase: 11
current_plan: 7
status: 11-07 built (baselines pass, operations notes written); full suite has 9 pre-existing failures; push pending
stopped_at: Planned Phase 11 (7 plans)
last_updated: "2026-10-12T00:00:00.000Z"
last_activity: 2026-10-12
last_activity_desc: Phase 10 closed (api:access allowed per policy); Phase 11 plans 11-01..11-07 created
state_head: b74b747
progress:
  total_phases: 11
  completed_phases: 1
  total_plans: 51
  completed_plans: 44
  percent: 86
current_phase_name: Platform Administration & Operational Controls
---

# Project State

## Current Position

**Current phase:** Phase 11 — Platform Administration & Operational Controls
Current Plan: 0
Total Plans in Phase: 7
**Phase status:** In progress. Plan 11-01 (platform RBAC foundation) complete: migrations 0050 and 0051 applied to siteflow_test and siteflow (main), guard, Redis-cached permission lookup with invalidation, env bootstrap (commit 7871353). (PLATFORM_BOOTSTRAP_EMAIL). Phase 10 (SaaS Billing) is closed.
**Last activity:** 2026-10-12 — Completed 11-01. platform-rbac integration tests 8/8 pass. Pre-existing failure in task3_rbac_tenant_isolation (invitation seat check NO_ENTITLEMENT, Phase 10 billing enforcement); not caused by 11-01.
**11-02:** Read APIs and Swagger committed (`bfcd11d`, `5e03f05`). Slug prefix EXPLAIN: seq scan on 743 rows, 5.8 ms; prefix index deferred.
**11-03 built:** Migration 0052 (applied) adds `platform_idempotency_keys` and a `lower(slug) text_pattern_ops` index. Slug search uses `lower(slug) LIKE prefix%`. `platform-lifecycle.service.ts` covers account suspend/reactivate (conditional transitions, session revoke, cache invalidation, outbox), and org suspension via second-operator approval plus org reactivate. Routes are under `/api/v1/platform` with Swagger docs. Non-tenant outbox contracts for `platform.account.*` and `platform.organization.*` queues in `platform.jobs.ts`.
**Tests:** `platform-lifecycle.test.ts` 6/6, `platform-lifecycle-http.test.ts` 3/3 (401 anon, org user denied, support denied), `platform-rbac` and `platform-read` pass. Typecheck clean. Lint 0 errors. Build OK.
**Open items (not built):** Idempotency-Key replay (table exists, unused). Rate limit 30 writes/min not wired. Reactivation is status-only; billing and entitlement re-check is not done. Member session revocation on org suspend not built. Confirm the reactivation policy with the user.
**11-03 additions:** Org suspension revokes all ACTIVE members' sessions after approval and invalidates their caches. Reactivation is blocked while the current subscription is UNPAID, RESTRICTED or CANCELED (assumed rule, pending user confirmation). Lifecycle writes are rate-limited to 30/min per route via `config.rateLimit`. Limiter key is IP (the global keyGenerator), not per operator. Known gap: counter-accumulation across repeated `app.inject` calls is unverified, so the HTTP test asserts the `x-ratelimit-limit: 30` header only.
**Tests:** lifecycle service 6/6, lifecycle HTTP 4/4, lifecycle controls 3/3, task3 RBAC 3/3, `tsc --noEmit` clean.
**11-04 built:** Migration 0053 (applied to siteflow and siteflow_test) adds `write:billing_sync`, granted to `prole_admin`. `platform-billing.service.ts` provides a read-only org billing view (subscription snapshot plus last 10 invoices), a platform webhook inbox summary, and a re-authenticated Stripe webhook recovery trigger (202, outbox `platform.billing.webhook_recovery_requested`). Entitlement overrides are deferred until an approved policy exists.
**Open risks:** Recovery rate limit is IP-keyed. Outbox event `platform.billing.webhook_recovery_requested` has no registry entry. Reactivation blocklist (UNPAID, RESTRICTED, CANCELED) still awaits confirmation.
**Tests:** `platform-billing-http.test.ts` 6/6, `platform-lifecycle-http.test.ts` and `platform-lifecycle-controls.test.ts` pass (3 files). `tsc --noEmit` clean.
**11-05 built:** Migration 0054 (applied to siteflow and siteflow_test) adds `app.platform_support_grants` (status CHECKs, approver ≠ requester, TTL ≤ 24h) and permission `use:support_grant` (granted to `prole_support` and `prole_admin`). Migration 0055 (applied to both DBs) adds the `expired` status; the sweep sets `expired` for time-based expiry. `platform-support-grant.service.ts` provides request, approve, revoke, use, `getOrganizationView` (read-only: summary with owner user ID and non-removed member count, subscription, entitlements; no emails or hashes), and `expireDueGrants`. Outbox payloads carry `organizationId`. Routes and Swagger docs are under `/api/v1/platform/support-grants`. Tests: `platform-support-grant-http.test.ts` 8/8, `platform-lifecycle-http.test.ts` 4/4 (12/12 across both). `tsc --noEmit` clean.
**Confirmed:** Reactivation blocklist (UNPAID, RESTRICTED, CANCELED) and per-IP rate limiting. Expired grants use an explicit `expired` state. The org view stays server-side only.
**11-06 built:** Migration 0056 (applied to siteflow and siteflow_test) grants `read:diagnostics` to `prole_admin` only. `platform-diagnostics.service.ts` provides health, queue (`pgboss.job` state counts, bounded to 1–24h window, oldest waiting age, webhook inbox counts), and per-org diagnostics (404 if the org is missing; reminder delivery counts; storage bytes from documents and versions). Routes: `GET /diagnostics/health`, `GET /diagnostics/queue`, `GET /organizations/:orgId/diagnostics`. Fixed outbox contract for `platform.billing.webhook_recovery_requested` (non-tenant, schema in `outbox.service.ts`). Tests: `platform-diagnostics-http.test.ts` 8/8, `platform-support-grant-http.test.ts` 8/8. `tsc --noEmit` clean. Known: `tests/unit/outbox/outbox.service.test.ts` fails at import because its `queue.js` mock lacks `QUEUES` (pre-existing). Deferred: platform-wide notification and storage totals (unbounded without an aggregate table). Quarantine is reported through the webhook inbox, not pg-boss.
**Next action:** Commit and push 11-05 extension and 11-06 (phase files only, no Copilot trailer). Phase 11 excluding 11-07 is then complete pending user review.

## Project Snapshot

- SiteFlow is an existing multi-tenant construction operations platform with project, schedule, procurement, document/compliance, and commercial capabilities.
- Phases 1–7 are recorded as completed history in `.planning/ROADMAP.md`.
- The codebase map is in `.planning/codebase/` and was committed in `18f87fa`.
- Phase F includes the approved F.0–F.18 event, notification, realtime, scheduled automation, project/portfolio reporting, API, web, CSV-export, and hardening capabilities. PDF/XLSX are explicitly deferred.
- Realtime delivery is autonomous: F.0 verifies any compatible existing runtime, otherwise plans native Fastify SSE with current tenant/permission checks. Export defaults are configurable 24-hour artifact retention and 5-minute signed URL expiry, overridden only by verified deployment policy.
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
- Trace each report family into CSV from the same server-produced result, and identify the minimum web surfaces required. PDF/XLSX have no Phase 8 implementation tasks.
- Read `.planning/checklist_when_to_apply.md` and `.planning/siteflow_testing_context.md` before planning; account for the schedule-metrics organization-scope gap before reuse.

## Session Continuity

**Last session:** 2026-10-11T12:03:19.491Z
**Stopped at:** Completed 10-08-PLAN.md
**Resume file:** None

- Phase 8 scope and decisions are recorded in `08-CONTEXT.md`; the discussion log distinguishes user-confirmed choices from planning assumptions.
- Phase 8 plans `08-01` through `08-22`, research, context, and `08-VALIDATION.md` exist; review remaining technical probes and command-checker findings before execution.
- Existing task documents remain historical references; no Phase 1–7 plans were generated or rewritten.
- Preserve unrelated worktree changes.

## Accumulated Context

### Roadmap Evolution

- Phase 10 added: Registered Phase 10 SaaS Billing & Subscription Management with secure Stripe-backed subscriptions, tenant-scoped entitlements, explicit construction-finance boundary, shared validation, OpenAPI/Archify documentation, and mandatory appropriate test gates; Phase 8 remains pending.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 10 P13 | 38min | 1 tasks | 8 files |
| Phase 10 P07 | 23 min | 1 tasks | 11 files |
| Phase 10 P14 | 31 min | 1 tasks | 10 files |
| Phase 10 P08 | 39 min | 2 tasks | 12 files |

## Decisions

- [Phase 10]: Reuse billing:manage for the combined payment-method mutation and invoice-history Portal; source grants it to Organization Admin, while Finance has billing:read only.
- [Phase 10]: Require an explicit Stripe Portal configuration ID and retrieve/validate its active feature set before session creation.
- [Phase 10]: Resolve Stripe customers only by authenticated organization ID and current Stripe mode; never create a customer as a Portal side effect.
- [Phase 10]: Verify Stripe webhook signatures over route-scoped original raw bytes before persistence.
- [Phase 10]: Store only bounded provider event/object references; never infer tenant scope from event metadata.
- [Phase 10]: Use unique-conflict no-op for duplicates so pending/retry state remains available to Plan 10-14 recovery.
- [Phase 10]: Recover acknowledged Stripe inbox events directly at startup and on a durable one-minute PgBoss schedule.
- [Phase 10]: Persist a local Stripe event-time high-water mark in existing subscription metadata to prevent late older work from regressing accepted state without a schema migration.
- [Phase 10]: Resolve webhook organization ownership only through persisted mode-qualified SiteFlow customer/subscription associations; never use provider event metadata.
- [Phase 10]: Invoice ownership is resolved only through persisted mode-qualified customer/subscription associations, never webhook metadata.
- [Phase 10]: Invoice amounts, currency, status, and attempt outcomes come from retrieved verified Stripe invoice facts.
- [Phase 10]: Use dedicated SaaS invoice/payment tables and approved unjournaled additive SQL, applied only to siteflow_test.
- [Phase 10]: BILL-07 remains pending until conditional Stripe Tax owned by Plan 10-16 is delivered.
