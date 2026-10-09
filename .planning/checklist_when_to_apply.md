# SiteFlow — Production Readiness Checklist: When to Apply Each Item

> **Purpose:** This document answers one question for every checklist item across all 12 sections: *should this be enforced during phase implementation, at the end of each phase, or once before production launch?*
>
> It is the authoritative guide for when to apply production hardening practices across Phase 1 (Auth/Org), Phase 2 (Project Core), Phase 3 (Schedule Execution), Phase C (Partners & Procurement), and all future phases.
>
> **SiteFlow phase history for reference:**
> - Phase 1 — Auth, Organizations, RBAC, Memberships, Invitations, Audit ✅ DONE
> - Phase 2 — Project Core (members, phases, cost codes, settings) ✅ DONE
> - Phase 3 — Schedule Execution Core (tasks, calendar, dependencies, engine, baselines, field logs, issues, metrics) ✅ DONE
> - Phase C — Partners & Procurement (subcontractors, suppliers, materials, MRs, quotes, approvals, POs, costs, deliveries, receipts, inventory, performance) ✅ DONE
> - Production Hardening — DB pool, CORS, rate limiting, timeouts, graceful shutdown, health checks ✅ DONE
> - Phase D and beyond — future (document management, RFIs, billing, notifications, reporting, etc.)

---

## How to Read This Document

Each checklist item is classified into one of three tiers:

| Tier | When | Why |
|---|---|---|
| **Tier 1 — Build-in** | During every chunk of every phase, always | These are design decisions. Retrofitting them after the fact is expensive or impossible. They must be part of the implementation pattern itself, not a post-phase sweep. |
| **Tier 2 — End-of-Phase Gate** | After all chunks of a phase are done, before starting the next phase | These require the full module surface area to exist. Doing them mid-phase is waste — routes and schemas are still changing. One sweep per phase is the right cadence. |
| **Tier 3 — Pre-Production Gate** | Once, before the first production deployment | These require realistic data volumes, production-like infrastructure, and the full system to exist. They are meaningless at Phase 1 scale. |

Items marked **⚠️ CURRENTLY OPEN** are not yet satisfied in SiteFlow and need action.

---

## Section 1 — Server Performance

### Tier 1 — Build-in (do during every phase chunk)

- **Unnecessary DB queries eliminated** — every new service must use the minimum queries needed. Merging calls into a single JOIN is a build-time decision, not a cleanup task.
- **N+1 queries eliminated** — when writing a list endpoint handler, verify the query before committing. N+1 discovered post-phase requires service rewrites.
- **Over-fetching eliminated** — use `select({ field1, field2 })` column projection in Drizzle rather than `select()` on large tables. Decide this when writing the repository method.
- **Pagination bounded and efficient** — every list endpoint must have a `limit` cap (max 100), cursor-based pagination, and stable ordering (`createdAt DESC, id DESC`). This is a schema/API contract decision.
- **Sorting/filtering indexed and controlled** — when adding a new filter field, add the corresponding index in the same commit. Never add a filter without verifying the column is indexed.
- **Payload/request-size limits enforced** — every new route set should verify `bodyLimit` is appropriate. ⚠️ CURRENTLY OPEN: `bodyLimit` not set on Fastify constructor globally.
- **Timeouts configured appropriately** — `requestTimeout` and `statement_timeout` are global; verify they remain appropriate when adding new long-running operations (e.g. schedule engine recalculate).
- **Expensive operations moved out of synchronous request paths** — any operation that takes more than ~100ms under load must go into a PgBoss job. This is decided during design, not discovered post-phase.

### Tier 2 — End-of-Phase Gate (after each phase)

- **Hot request paths profiled** — after a phase is complete, identify the 5 most-called endpoints and verify they have no hidden overhead.
- **Middleware overhead reviewed** — after adding new middleware layers, check the chain for any phase-specific overhead.
- **Validation overhead reviewed** — Zod parses are cheap but composite schemas with many `.refine()` calls can add up. Audit once per phase.
- **Serialization/deserialization reviewed** — after a phase, verify that Fastify route schemas exist for all new endpoints (enabling fast AJV serialization rather than `JSON.stringify`). ⚠️ CURRENTLY OPEN: some procurement routes may be missing route-level response schemas.
- **Database queries reviewed with execution plans** — run `EXPLAIN ANALYZE` on the 5 most complex new queries introduced in the phase.
- **Required indexes verified** — review all new tables and query patterns; confirm every `WHERE` clause column is indexed.
- **Cache hit/miss behavior measured** — after adding Redis caching for a new entity, verify it actually improves latency. Log cache hits/misses at DEBUG level.
- **Cache failures gracefully fall back to PostgreSQL** — verify every new cache path has a try/catch DB fallback. Code review gate, not just convention.

### Tier 3 — Pre-Production Gate (once, before launch)

- **Request/response latency measured** — run k6 or autocannon against the full API; record p50/p95/p99 per endpoint group.
- **p50/p95/p99 latency targets defined and verified** — define acceptable targets (e.g. p99 < 500ms for list endpoints, p99 < 2s for financial operations) and verify against load test results.
- **PostgreSQL connection pool behavior verified** — run concurrent load and observe pool queue depth and wait times.
- **Redis usage and latency verified** — measure Redis latency under load; verify no hot keys.
- **Performance tested under realistic data volumes** — seed the DB with production-scale data (1000 orgs, 50 projects each, full procurement histories) before running the load test. Small-data performance is meaningless.
- **Node.js CPU, memory, GC, and event-loop behavior checked** — profile with `--inspect` or clinic.js under load.
- **No obvious memory leaks or resource leaks** — run a 30-minute sustained load test and observe heap growth.

---

## Section 2 — Concurrency & Data Integrity

### Tier 1 — Build-in (do during every phase chunk)

- **Transactions used where atomicity is required** — every mutation that touches more than one table must use `this.db.transaction(async tx => {...})`. Non-negotiable pattern. Never retrofit.
- **Correct row/table locking used where required** — any operation reading a row then writing it (approve, cancel, post, receive) must use `SELECT ... FOR UPDATE` on the controlling row inside the transaction.
- **Optimistic concurrency/version protection used where appropriate** — entities that users edit concurrently (projects, tasks) must have a `version` column and optimistic lock check.
- **Unique constraints protect critical invariants** — every business rule of the form "there can only be one X per Y" must be enforced with a unique index in the schema, not just in service code.
- **Sequential numbering is concurrency-safe** — all document numbers must use `allocateDocumentNumber()` with `FOR UPDATE`. Never use `COUNT(*)` for sequence generation.
- **Rollback behavior verified** — every new transaction block must be designed so that an exception at any step causes full rollback. Test this during integration testing of the chunk.
- **Idempotency verified for applicable mutations** — any mutation that may be retried (from the outbox, from a worker, from a client retry) must return the same result on repeated calls. Design this in, don't add it later.
- **Approval/state transitions cannot be bypassed by races** — action routes (`/approve`, `/submit`, `/cancel`) must check current status inside the transaction after locking. Never trust pre-lock status.

### Tier 2 — End-of-Phase Gate (after each phase)

- **Concurrent requests tested** — write at least one concurrency integration test per phase that fires the same mutation from two concurrent calls and verifies exactly one succeeds.
- **Duplicate requests tested** — test that sending the same POST twice returns the correct idempotent result, not a duplicate record.
- **Race conditions identified** — after a phase, review every state transition and ask: "what happens if two users hit this simultaneously?" Document the answer.
- **Cache invalidation races reviewed** — after adding new cache paths, verify that a write immediately followed by a read from a different process gets fresh data (TTL + invalidation combined).
- **Deadlock risks reviewed** — review lock acquisition order for any new entities that lock multiple rows. Consistent ordering (always lock in ascending ID order) must be verified.
- **Transaction duration minimized** — after a phase, review all transactions and verify no slow external calls (email, Redis, HTTP) happen inside a transaction.
- **Multi-tenant concurrent workloads tested** — write at least one test where two different orgs perform the same operation concurrently, verifying no cross-tenant pollution.

### Tier 3 — Pre-Production Gate (once, before launch)

- **Concurrent workers cannot corrupt state** — run multiple worker instances simultaneously against the same job queue and verify no duplicate processing or state corruption.
- **API requests and background jobs cannot incorrectly overwrite each other** — simulate concurrent HTTP mutation + outbox delivery of the same entity.
- **Retry behavior tested under failure injection** — kill the DB mid-transaction and verify correct rollback and retry behavior.
- **Multi-tenant concurrent workloads load-tested** — not just functionally tested, but at volume: 50 orgs all hitting procurement endpoints simultaneously.

---

## Section 3 — API Hardening

### Tier 1 — Build-in (do during every phase chunk)

- **API contracts are consistent** — every new route must use `createSuccessResponse()` / `createErrorResponse()` from `shared/response.ts`. No naked `reply.send({})` calls.
- **Request validation is centralized and strict** — every request body and query string must have a Zod schema. No `req.body as any` without prior parse.
- **Response shapes are consistent** — `{ success: true, data: {...} }` for success; `{ success: false, error: {...} }` for errors. No exceptions.
- **Errors have stable machine-readable codes** — every new error class must define a `code` string constant (e.g. `PURCHASE_ORDER_NOT_FOUND`). No generic messages as codes.
- **Correct HTTP status codes are used** — 201 for creates, 204 for no-content deletes, 422 for validation, 409 for conflict, 404 for not found. These are determined when writing the handler.
- **Filtering is validated/whitelisted** — filter fields must use `z.enum([...])` for status filters and `z.string().max(N)` for text filters. Never pass raw query params to the DB.
- **Sorting fields are validated/whitelisted** — if user-controlled sort is added, it must be an enum of allowed column names. No dynamic ORDER BY from user input.
- **Sensitive fields cannot be accidentally returned** — `passwordHash`, `tokenHash`, `refreshTokenHash` must never appear in any DTO. Verify during code review of every new entity.
- **Internal database details are never exposed** — raw Postgres errors (constraint names, column names) must be caught and mapped to domain errors before reaching the response.
- **Idempotency strategy defined for retryable operations** — action routes must return the current state if the operation has already been performed (not a conflict error). Design this during implementation.

### Tier 2 — End-of-Phase Gate (after each phase)

- **OpenAPI/API documentation matches implementation** — after a phase is complete, verify every new route has a Swagger schema with correct params, body, querystring, and response shapes. ⚠️ CURRENTLY OPEN: some procurement routes may still be missing full response schemas.
- **API inventory is complete** — after a phase, list all routes and verify every one is registered, documented, and reachable.
- **Maximum page sizes enforced** — audit all new list endpoints to verify `limit` max is set in the Zod schema.
- **Search inputs are bounded** — verify all new text search/filter inputs have `maxLength` in their Zod schema.
- **Request payload limits enforced** — verify `bodyLimit` on Fastify is appropriate for the largest payloads introduced in the phase (e.g. PO with 100 items).
- **API behavior is predictable under malformed input** — run at least 5 malformed-input tests per new entity (missing required fields, wrong types, null where required, oversized strings).
- **Deprecated/unused endpoints identified** — after adding new routes, confirm no old stubs or test routes were left registered.
- **Concurrency/version handling exposed consistently** — any entity with optimistic locking must return the current `version` in every response so clients can use it.

### Tier 3 — Pre-Production Gate (once, before launch)

- **API behavior is predictable under high load** — run load tests specifically targeting edge cases (cursor at the very last page, concurrent creates of the same entity, all filters combined).
- **API contract tests pass** — run a full suite of contract tests verifying request/response shapes match the OpenAPI spec.

---

## Section 4 — Multi-Tenant Isolation

### Tier 1 — Build-in (do during every phase chunk)

- **Every tenant-scoped operation enforces tenant isolation** — every repository method that queries by `projectId` or entity ID must also include `organizationId` in the `WHERE` clause. This is verified during code review of the repository.
- **Tenant context cannot be spoofed by request input** — `organizationId` must always come from `req.orgContext` (derived from JWT + RBAC lookup), never from `req.body` or `req.query`.
- **Object-level authorization verified** — wrong-org IDs must return 404, not 403, to prevent existence leakage. Pattern: load entity scoped to org; if not found, throw `EntityNotFoundError`.
- **Cross-entity ownership validated in every mutation transaction** — when creating or updating a resource that references another entity (e.g. a PO references a supplier), load and verify the referenced entity's `organizationId` matches the current org inside the same transaction.
- **Background jobs preserve tenant context** — every PgBoss job payload must include `organizationId`. Workers must scope all DB queries to that `organizationId`.
- **Audit records preserve tenant context** — every `auditService.log()` call must include `organizationId`. No audit log entry without a tenant.
- **Tenant-scoped Redis keys** — all Redis keys for tenant data must include `orgId` in the key path. Never use a globally-keyed cache for tenant-specific data.

### Tier 2 — End-of-Phase Gate (after each phase)

- **Cross-tenant reads tested** — for every new entity introduced in the phase, write a negative test: org A user attempts to read org B entity → must return 403 or 404.
- **Cross-tenant updates tested** — org A user attempts to mutate org B entity → must be rejected.
- **Cross-tenant deletes tested** — org A user attempts to delete org B entity → must be rejected.
- **Cross-tenant cache access tested** — verify that a cache read by org A cannot return data cached by org B. Key collision test.
- **Tenant-scoped database queries reviewed** — review all new repository methods; confirm every query includes `AND organization_id = $orgId`.
- **No tenant data leaks through errors** — verify that error messages for not-found entities don't reveal whether the resource exists for another org.
- **Function-level authorization verified** — after a phase, audit the capability map (`PROJECT_ROLE_CAPABILITIES` + `ORG_LEVEL_AUTHORITY_MAP`) to confirm all new capabilities are registered for the correct roles.

### Tier 3 — Pre-Production Gate (once, before launch)

- **Property/field-level authorization verified** — confirm there are no fields in any response DTO that should be hidden from certain roles but are currently visible to all.
- **Cross-tenant concurrent workloads tested** — run concurrent requests from two different orgs against the same endpoint and verify no cross-contamination in responses or cache.
- **No tenant data leaks through logs or caches** — full audit of pino log output under load to confirm no tenant payloads appear in log lines.

---

## Section 5 — Authentication & Authorization Security

### Tier 1 — Build-in (do during every phase chunk)

- **Authorization is enforced server-side** — every new route must have `preHandler: [authenticate, organizationContext, requirePermission(...)]` or `preHandler: [requireProjectPermission(...)]`. No route without auth guards.
- **Permission checks cannot be bypassed through alternate endpoints** — every mutation path (including action routes like `/submit`, `/approve`) must have its own permission check. Verify there is no "side door" to the same operation.
- **Every new capability string added to both maps** — when a new capability is introduced (e.g. `project.receipt.void`), it must be added to both `PROJECT_ROLE_CAPABILITIES` and `ORG_LEVEL_AUTHORITY_MAP` in the same commit. ⚠️ Pattern already established; must be maintained.
- **Authorization failures return safe responses** — 403 errors must not reveal which permission was missing or what roles would grant it. Generic "Forbidden" message only.
- **Security-sensitive actions are auditable** — any action that changes financial state, membership, or approval status must write an audit log entry.

### Tier 2 — End-of-Phase Gate (after each phase)

- **RBAC rules verified** — after a phase, review the capability map and confirm: (a) every new capability is assigned to the correct roles, (b) no role has capabilities it shouldn't have, (c) PROCUREMENT role has all procurement capabilities.
- **Privilege escalation paths tested** — write tests: a PROJECT_MEMBER cannot approve a PO, a CLIENT cannot submit a material request, a SUBCONTRACTOR cannot update a delivery.
- **Sensitive administrative operations protected** — verify that any "admin-only" operation (org suspension, role assignment, baseline activation) is guarded by the appropriate high-level org capability.
- **Authentication endpoints protected against abuse** — verify rate limiting on `/auth/*` routes is still appropriate given any new auth flows added in the phase.

### Tier 3 — Pre-Production Gate (once, before launch)

- **Authentication flows reviewed end-to-end** — JWT expiry, refresh rotation, session revocation, Google OAuth account link/unlink — all verified in sequence.
- **Token/session validation reviewed** — verify that revoked sessions are rejected even if the JWT is still within its expiry window.
- **Expiration/revocation behavior verified** — simulate session revocation and verify the next request with the revoked token is rejected.

---

## Section 6 — Input & Application Security

### Tier 1 — Build-in (do during every phase chunk)

- **All external input validated** — Zod schema on every `req.body`, `req.query`, and `req.params` before the value is used. No exceptions.
- **Unexpected fields handled safely** — Zod `.strip()` (default) removes unknown fields. Verify no `z.object().passthrough()` is used on security-sensitive inputs.
- **Injection risks reviewed** — Drizzle ORM parameterizes all queries. Any new `sql\`...\`` template literal must be reviewed to confirm it contains only bound parameters, never string-concatenated user input.
- **Sensitive information removed from errors** — 500-level errors in production must not include stack traces, column names, constraint names, or internal IDs. Verify the error handler sanitizes these.
- **Secrets never logged** — pino `redact` covers authorization and cookie headers globally. Any new log statement that might contain a token, password, or secret must use `[REDACTED]`.

### Tier 2 — End-of-Phase Gate (after each phase)

- **Path/file input reviewed** — if any new endpoint accepts a file path, URL, or external reference, review for path traversal and SSRF.
- **SSRF risks reviewed** — if any new phase introduces external URL fetching (e.g. webhook delivery, document storage), review for SSRF mitigations (allowlist, DNS rebinding protection).
- **Resource-exhaustion attacks considered** — for any new operation that accepts a variable-length array (e.g. PO line items, receipt items), verify a reasonable max count is enforced in the Zod schema.
- **Large payload abuse tested** — send a request with a body at the maximum allowed size and verify it is handled correctly without crashing or hanging.
- **Expensive query abuse tested** — send a list request with `limit=100` and complex filters and verify it completes within the statement timeout.
- **Sensitive data handling reviewed** — after a phase, check all new entities for columns that contain PII or financial data and confirm they are not over-exposed in list responses.

### Tier 3 — Pre-Production Gate (once, before launch)

- **Unsafe external API consumption reviewed** — full review of every third-party API call (Google OAuth, SMTP) for error handling, timeout, and credential security.
- **Rate limiting/throttling requirements finalized** — confirm global and per-route rate limits are tuned for expected production traffic patterns, not just development defaults.

---

## Section 7 — Redis & Caching

### Tier 1 — Build-in (do during every phase chunk)

- **PostgreSQL remains the source of truth** — Redis is never written as the primary store for any business-critical data. Correctness operations (approve, post, void) always go to Postgres.
- **No Redis locks for correctness operations** — financial operations, approvals, inventory mutations, and state transitions must use PostgreSQL `FOR UPDATE`, never Redis locks.
- **Cache keys contain required tenant/scope dimensions** — every new cache key must include `orgId` at minimum. Project-scoped cache keys must include both `orgId` and `projectId`.
- **Cache invalidation defined for every cached write path** — when adding a cache for an entity, define invalidation in the same commit. Cache without invalidation is a bug, not an optimization.
- **TTLs are set appropriately** — set TTLs based on how stale the data can reasonably be: org permissions (300s), project context (120s), supplier (3600s), list caches (300s).
- **Redis outage does not take down the API** — every Redis call must be wrapped in try/catch with DB fallback. No uncaught Redis promise rejections.
- **No production `KEYS` usage** — any cache invalidation that scans keys must use `SCAN` with a cursor loop, never `KEYS *`. Enforce this in code review.

### Tier 2 — End-of-Phase Gate (after each phase)

- **Cache misses behave correctly** — verify: (1) cold start works, (2) after cache expiry the next request goes to DB and repopulates, (3) invalidation on write causes the next read to go to DB.
- **Redis is used only where appropriate** — after a phase, review all new Redis usage and confirm each one actually reduces DB load for a hot path. Remove speculative caching.
- **Cache serialization cost reviewed** — for large objects being cached, verify the JSON.stringify cost is lower than the DB query cost it replaces.
- **Sensitive cached data reviewed** — confirm no new cache entries contain full financial records, PII, or tokens that should not be stored in Redis.
- **Hot keys identified** — if a single Redis key will be read on every request (e.g. a global config), flag it for review.

### Tier 3 — Pre-Production Gate (once, before launch)

- **Memory/eviction behavior reviewed** — set `maxmemory` policy on Redis (e.g. `allkeys-lru`); verify behavior when Redis approaches memory limit.
- **Cache hit ratio and latency observable** — instrument Redis operations with OTel spans or custom metrics; verify hit ratio is measurable in the observability stack.
- **Redis connection/resource behavior verified** — run load test and observe ioredis connection count and command queue depth.

---

## Section 8 — Database & Resource Management

### Tier 1 — Build-in (do during every phase chunk)

- **Foreign-key/index relationships reviewed** — every new table must have explicit FK references defined in Drizzle and indexes on all FK columns and common query columns. Verify in the same commit as schema additions.
- **Long-running transactions identified and prevented** — no Redis calls, HTTP calls, or email sends inside a DB transaction. If you need to do something after a transaction commits, use the outbox.
- **Database timeout behavior verified** — statement timeout (20s) is global. If a new operation legitimately needs longer (e.g. bulk migration), it must explicitly override with a session-level `SET statement_timeout`.

### Tier 2 — End-of-Phase Gate (after each phase)

- **Critical indexes verified** — after a phase, run `EXPLAIN ANALYZE` on the 5 most complex new queries. Confirm no sequential scans on large tables.
- **Slow queries identified** — enable `log_min_duration_statement = 1000` on the development DB during phase testing and review the slow query log.
- **Query plans reviewed** — for any query with a JOIN across two tables over 10k rows, review the query plan and verify index usage.
- **Sequential scans investigated** — any `Seq Scan` on a table with > 1000 rows is a candidate for an index. Investigate every one.
- **Connection pool sizing reviewed** — after each phase that adds significant new load paths (e.g. procurement with many concurrent PO operations), review whether `DB_POOL_MAX=20` is still appropriate.
- **Lock contention investigated** — after adding new `FOR UPDATE` lock patterns, verify lock duration is minimal (< 50ms in the normal path) and that the locked rows are accessed in a consistent order to prevent deadlocks.
- **Graceful shutdown releases resources correctly** — verify `app.close()` → `stopQueue()` sequence still works correctly after any new infrastructure additions in the phase.

### Tier 3 — Pre-Production Gate (once, before launch)

- **Connection exhaustion tested** — run a load test that opens the maximum number of connections simultaneously and verify the pool queue handles it gracefully.
- **Redis connection/resource behavior verified** — verify ioredis pool behavior under concurrent load.
- **Worker/queue resource usage verified** — run PgBoss under load and verify no memory leak or job accumulation.
- **HTTP/socket resource usage verified** — run a sustained load test and verify file descriptor count stays bounded.

---

## Section 9 — Background Jobs & Async Processing

### Tier 1 — Build-in (do during every phase chunk)

- **HTTP requests do not perform unnecessary long-running work** — any operation that takes > 100ms under load must be moved to a PgBoss job. Decide during design.
- **Existing outbox/PgBoss architecture remains consistent** — all domain events must go through `writeOutboxEvent(tx, ...)` inside the DB transaction. No `sendJob()` calls outside a transaction for domain events.
- **Jobs are idempotent where retries are possible** — every new job handler must be safe to call twice with the same payload. Design idempotency using unique constraints or status checks.
- **Tenant context is preserved** — every new job payload must include `organizationId`. Every worker must scope all DB queries to that `organizationId`.
- **Worker failures do not corrupt domain state** — domain state must be committed to the DB before the job is dispatched. The job can fail and retry without corrupting the committed state.
- **Duplicate job execution is safe** — if PgBoss delivers the same job twice (at-least-once delivery), the second execution must be harmless.

### Tier 2 — End-of-Phase Gate (after each phase)

- **Failed jobs retry safely** — verify that failing a job mid-execution leaves the DB in a state where the retry can succeed. Test with a failure injected at each step.
- **Job concurrency is controlled** — verify `teamSize` and `teamConcurrency` are set appropriately for each new worker. High-volume workers (email, notifications) need different tuning than low-volume workers (schedule engine).
- **Queue backpressure is understood** — after a phase, estimate the maximum job throughput needed and verify PgBoss can sustain it. Flag any queues that may accumulate under load.
- **Existing outbox/PgBoss architecture remains intact** — after any infrastructure change, verify the outbox poller and LISTEN/NOTIFY mechanism still functions correctly.

### Tier 3 — Pre-Production Gate (once, before launch)

- **Concurrent workers cannot corrupt state** — deploy two worker instances simultaneously and run a load test. Verify no duplicate records or corrupted state.
- **API requests and background jobs cannot incorrectly overwrite each other** — simulate concurrent HTTP mutation + outbox delivery of the same entity.
- **Retry behavior tested under failure injection** — inject failures at: DB unavailable, Redis unavailable, job handler throws, job times out. Verify recovery in each case.

---

## Section 10 — Observability

### Tier 1 — Build-in (do during every phase chunk)

- **Request IDs/correlation IDs available** — `genReqId: () => crypto.randomUUID()` is globally configured. Every new route inherits it automatically. Verify new routes pass `requestId` through to error responses.
- **Structured logging verified** — every new service must use `createLogger({ name: 'module-name' })`. No `console.log`. Log at appropriate levels: `info` for lifecycle, `debug` for cache hits, `error` for failures.
- **Security-relevant events auditable** — every mutation that changes financial state, membership, approval status, or lifecycle must call `auditService.log(...)`.
- **Logs do not expose secrets or tenant data** — any new log statement that includes a business payload must not log raw financial values, PII, or tokens. Use field names and IDs only.

### Tier 2 — End-of-Phase Gate (after each phase)

- **Error rates measurable** — verify OTel span status is set correctly (ERROR) on all new failure paths so error rate dashboards pick them up.
- **Database latency measurable** — verify OTel auto-instrumentation covers all new DB query patterns (it should automatically via postgres.js instrumentation, but verify no raw `pg.Client` calls bypass it).
- **Worker/queue health observable** — verify PgBoss job state (pending, completed, failed counts) is queryable from the DB for ops monitoring.

### Tier 3 — Pre-Production Gate (once, before launch)

- **p50/p95/p99 measurable** — configure OTel exporter to a backend (Grafana, Datadog, etc.) and verify latency histograms are visible.
- **Cache hit/miss ratio measurable** — add custom OTel counter increments on cache hit/miss in `AuthCacheService`, `RbacCacheService`, `projectContext` middleware.
- **Connection pool pressure observable** — add a custom metric or periodic log for pool queue depth.
- **CPU/memory usage observable** — configure `@opentelemetry/host-metrics` or equivalent for Node.js runtime metrics.
- **Event-loop lag observable** — add `perf_hooks` based event-loop lag measurement (or use clinic.js in pre-production profiling).

---

## Section 11 — Load, Stress & Failure Testing

> **This entire section is Tier 3 — Pre-Production Gate only.**
>
> None of these tests are meaningful during individual phase execution. The system is too small and the data volumes are too low. All load/stress/failure tests are run once, before the first production deployment, against a full-stack staging environment with production-scale data.

- **Normal-load test completed** — run k6 at expected average traffic for 10 minutes.
- **High-concurrency test completed** — ramp to 10× expected traffic and observe behavior.
- **Peak-load test completed** — spike test: 0 to peak in 30 seconds.
- **Multi-tenant workload tested** — 100 orgs each with 10 concurrent users.
- **Large-tenant workload tested** — one org with 10,000 projects and full procurement history.
- **Many-small-tenant workload tested** — 10,000 orgs each with 1 user.
- **Read-heavy workload tested** — 90% GET, 10% POST/PATCH.
- **Write-heavy workload tested** — 50% writes across financial operations.
- **Concurrent mutation workload tested** — two users approving the same PO simultaneously.
- **Duplicate/retry workload tested** — same request sent twice in rapid succession.
- **Cold-cache workload tested** — load test immediately after Redis flush.
- **Warm-cache workload tested** — load test after 5 minutes of warm traffic.
- **Redis degradation tested** — kill Redis mid-test; verify API continues with degraded but functional behavior.
- **PostgreSQL pressure tested** — load test with DB CPU at 80%+.
- **Worker pressure tested** — queue 10,000 jobs and verify processing without corruption.
- **Failure/recovery behavior tested** — kill one app instance mid-test; verify traffic failover and no data corruption.
- **No unacceptable data corruption observed** — financial totals, inventory balances, committed costs must all be exactly correct after load tests.
- **No unacceptable cross-tenant leakage observed** — spot-check 100 random API responses from the multi-tenant workload test for any cross-org data.
- **Performance bottlenecks identified and addressed** — any p99 > target threshold gets a follow-up investigation and fix.

---

## Section 12 — Final Quality Gate

### Tier 1 — Build-in (do at end of every chunk)

- **Unit tests pass** — every new service/utility with pure logic must have unit tests. Run before committing each chunk.
- **Typecheck passes** — `pnpm --filter server typecheck` must exit 0 after every chunk. Never leave a phase with type errors.
- **Lint passes** — `pnpm --filter server lint` must be clean.
- **PostgreSQL remains authoritative** — reviewed per-chunk as the "never use Redis for correctness" rule.
- **Redis remains an acceleration layer** — same per-chunk rule.
- **Existing outbox/PgBoss architecture remains intact** — verify no new code bypasses the outbox pattern.

### Tier 2 — End-of-Phase Gate (after each phase)

- **Integration tests pass** — all integration tests (including new ones written for the phase) must be green before the phase is declared complete.
- **API contract tests pass** — Swagger documentation verified to match implementation.
- **Database migrations verified** — `db:generate` + `db:migrate` runs cleanly against a fresh database.
- **Multi-tenant isolation verified** — cross-tenant negative tests green for all new entities in the phase.
- **Build passes** — full Turborepo build clean.
- **No unrelated architectural changes introduced** — phase scope is respected; no "while I was here" changes to unrelated modules.
- **Existing Phase behavior remains intact** — run the full integration test suite (not just the new tests) to verify no regressions.
- **No known critical/high security issues remain** — review new code for auth bypass, injection, privilege escalation, and tenant isolation gaps.
- **No known critical concurrency/data-integrity issues remain** — review all new transactions, locks, and unique constraints.

### Tier 3 — Pre-Production Gate (once, before launch)

- **Concurrency tests pass** — dedicated concurrency test harness with parallel request firing.
- **Security tests pass** — full negative test suite including cross-tenant, privilege escalation, malformed input, and rate limit bypass attempts.
- **Load/performance tests pass** — all Section 11 items complete.
- **Performance baseline documented** — p50/p95/p99 per endpoint group recorded.
- **Bottlenecks and capacity limits documented** — "the system handles X concurrent users before latency degrades" is written down.
- **Production-readiness review completed** — senior review of all three tiers before deployment.
- **Phase marked COMPLETE only after all required checks pass.**

---

## Quick Reference Summary

### Every Chunk of Every Phase (Tier 1 — Build-in)

| Category | Must Do |
|---|---|
| Performance | Min queries, no N+1, bounded pagination, indexed filters, async for slow ops |
| Concurrency | Transactions for atomicity, FOR UPDATE for read-modify-write, unique constraints for invariants, idempotent mutations, no COUNT(*) for sequences |
| API | createSuccessResponse/createErrorResponse everywhere, Zod on all inputs, stable error codes, correct HTTP statuses, no sensitive fields in DTOs |
| Multi-Tenant | orgId in every WHERE clause, orgId from JWT never from body, 404 not 403 for wrong-org IDs, orgId in all job payloads, orgId in all Redis keys |
| Auth/Security | auth + org/project permission guards on every route, new capabilities in both policy maps, audit log on every state-changing mutation |
| Input Security | Zod on all inputs, parameterized queries only, no secrets in logs |
| Redis | Postgres is truth, no Redis locks for correctness, orgId in all cache keys, invalidation defined alongside caching, try/catch on all Redis ops, SCAN not KEYS |
| Database | FK + indexes in every new schema, no external calls inside transactions |
| Jobs | Outbox pattern for all domain events, idempotent handlers, orgId in all payloads |
| Observability | createLogger per module, audit log on mutations, no PII/secrets in logs |
| Quality | typecheck clean, lint clean after every chunk |

### End of Every Phase (Tier 2 — Phase Gate)

| Category | Must Do |
|---|---|
| Performance | Profile hot paths, EXPLAIN ANALYZE on complex queries, verify cache behavior, check serialization has Fastify schemas |
| Concurrency | Concurrency integration tests, race condition review, deadlock order review, transaction duration audit |
| API | Swagger docs match implementation, audit all new route schemas, malformed input tests |
| Multi-Tenant | Cross-tenant negative tests for every new entity, Redis key collision test |
| Auth/Security | RBAC capability map audit, privilege escalation tests |
| Input Security | Resource exhaustion checks, large payload test |
| Redis | Cache miss behavior verified, sensitive data review, hot key identification |
| Database | EXPLAIN ANALYZE on 5 most complex queries, slow query log review, lock contention check |
| Jobs | Retry behavior tested, job concurrency tuned |
| Observability | OTel error status on all new failure paths, DB latency coverage verified |
| Quality | Full integration test suite green, migrations verified, cross-tenant negative tests green, no regressions |

### Once Before Production (Tier 3 — Pre-Production Gate)

| Category | Must Do |
|---|---|
| Performance | Load test: p50/p95/p99 measured and documented; realistic data volumes; event-loop profiling |
| Concurrency | Multi-worker corruption test, failure injection, concurrent tenant load test |
| API | Full contract test suite, high-load edge case tests |
| Multi-Tenant | Concurrent cross-tenant isolation test at load, log audit for leakage |
| Auth/Security | Full auth flow end-to-end, session revocation, token expiry verified |
| Redis | maxmemory policy set, connection behavior under load |
| Database | Connection exhaustion test, full pool pressure test |
| Jobs | Multi-worker concurrency, retry failure injection |
| Observability | OTel backend configured, all metrics visible, baseline documented |
| Load Testing | All 19 Section 11 items complete |
| Quality | All tests pass, baseline documented, capacity limits documented, production-readiness sign-off |
