# Production Hardening Tasks

## Overview

Nine production-readiness gaps identified and verified against the actual codebase. All tasks involve code changes only — no schema migrations, no test changes, no procurement/schedule modules.

---

## Task 1 — Merge `projectContext` middleware to single DB query + Redis cache

**STATUS:** DONE  
**Goal:** Replace 2 sequential queries (project + membership) with one LEFT JOIN query. Add Redis cache keyed `siteflow:v1:proj-ctx:{orgId}:{projectId}:{userId}` with TTL 120s. Invalidate on membership add/remove/role change.

**Files changed:**

- `apps/server/src/modules/project/core/project.repository.ts` — added `findByIdWithMembership()` LEFT JOIN method
- `apps/server/src/modules/project/core/project.middleware.ts` — replaced 2 queries with merged query + Redis cache
- `apps/server/src/modules/project/members/project-member.service.ts` — added `invalidateProjectContextCache` call after add/updateRole/remove

**Checklist:**

- [x] Add `findByIdWithMembership(orgId, projectId, userId)` to `ProjectRepository`
- [x] Update `projectContext` middleware to use the new merged method
- [x] Wrap the merged result in Redis cache (get → miss → DB → set), TTL 120s
- [x] Invalidate cache in `ProjectMemberService.addProjectMember`, `updateMemberRole`, `removeProjectMember`

---

## Task 2 — RBAC permission lookup cache for `getPermissionsForRole`

**STATUS:** DONE  
**Goal:** Cache `getPermissionsForRole(roleId)` results in Redis. Key: `siteflow:v1:rbac:role:{roleId}:perms`, TTL 300s.

**Files changed:**

- `apps/server/src/modules/rbac/rbac.cache.service.ts` — added `getRolePermissions`, `setRolePermissions`, `invalidateRolePermissions`
- `apps/server/src/modules/rbac/rbac.repository.ts` — wrapped `getPermissionsForRole` with cache

**Checklist:**

- [x] Add role cache methods to `RbacCacheService`
- [x] Wrap `getPermissionsForRole` with Redis cache (fail-open)

---

## Task 3 — DB connection pool configuration from env

**STATUS:** DONE  
**Goal:** Read pool config from env and pass to `createDatabaseClient`. Added 3 env vars.

**Files changed:**

- `packages/env/src/server.ts` — added `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`
- `packages/database/src/client.ts` — added `DatabasePoolOptions` interface, updated function signature
- `apps/server/src/lib/db/db.ts` — passes pool config to `createDatabaseClient`

**Checklist:**

- [x] Add env vars to `packages/env/src/server.ts`
- [x] Update `createDatabaseClient` signature to accept optional pool options
- [x] Pass pool config from `serverEnv` in `db.ts`

---

## Task 4 — Fix CORS broken in production

**STATUS:** DONE  
**Goal:** Replace `false` origin with parsed `CORS_ORIGIN` env var array.

**Files changed:**

- `packages/env/src/server.ts` — added `CORS_ORIGIN`
- `apps/server/src/app/index.ts` — parses comma-separated origins and passes to `@fastify/cors`

**Checklist:**

- [x] Add `CORS_ORIGIN: z.string().default('http://localhost:5173')` to env
- [x] Parse comma-separated origins and pass to `@fastify/cors`

---

## Task 5 — Add rate limiting

**STATUS:** DONE  
**Goal:** Global 300 req/min per userId/IP, stricter 10 req/15min on auth routes.

**Files changed:**

- `apps/server/package.json` — added `@fastify/rate-limit@^10.2.0`
- `apps/server/src/app/index.ts` — registered global + auth-scoped rate limits

**Checklist:**

- [x] Add `@fastify/rate-limit` to `apps/server/package.json`
- [x] Register global rate limit with `keyGenerator` using `req.orgContext?.userId ?? req.ip`
- [x] Register stricter rate limit on auth routes plugin scope

---

## Task 6 — Add request timeout

**STATUS:** DONE  
**Goal:** `connectionTimeout: 30000`, `requestTimeout` from env.

**Files changed:**

- `packages/env/src/server.ts` — added `REQUEST_TIMEOUT_MS`
- `apps/server/src/app/index.ts` — added timeout options to `Fastify({...})`

**Checklist:**

- [x] Add `REQUEST_TIMEOUT_MS: z.coerce.number().default(25000)` to env
- [x] Add timeout options to Fastify constructor

---

## Task 7 — Graceful shutdown

**STATUS:** DONE  
**Goal:** SIGTERM/SIGINT close Fastify + stop PgBoss cleanly.

**Files changed:**

- `apps/server/src/index.ts` — added `shutdown` function and signal handlers

**Checklist:**

- [x] Import `stopQueue` from `./lib/queue/index.js`
- [x] Add `shutdown` async function
- [x] Register `process.on('SIGTERM')` and `process.on('SIGINT')`

---

## Task 8 — Deep health / readiness endpoint

**STATUS:** DONE  
**Goal:** `GET /health/ready` pings DB + Redis, returns 200 ready or 503 degraded.

**Files changed:**

- `apps/server/src/modules/health/health.routes.ts` — added `/ready` route

**Checklist:**

- [x] Ping PostgreSQL with `SELECT 1`
- [x] Ping Redis with `PING`
- [x] Return `{ status, checks: { db, redis } }`
- [x] Return HTTP 503 when degraded

---

## Task 9 — Postgres statement timeout

**STATUS:** DONE  
**Goal:** `SET statement_timeout` on every new connection via postgres.js `connection` option.

**Files changed:**

- `packages/env/src/server.ts` — added `DB_STATEMENT_TIMEOUT_MS`
- `packages/database/src/client.ts` — passes `connection.statement_timeout` to postgres.js
- `apps/server/src/lib/db/db.ts` — passes `statementTimeoutMs` from env

**Checklist:**

- [x] Add `DB_STATEMENT_TIMEOUT_MS: z.coerce.number().default(20000)` to env
- [x] Pass `statementTimeoutMs` via postgres.js `connection` option
