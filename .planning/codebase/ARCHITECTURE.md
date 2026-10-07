---
last_mapped_commit: d879191a607aa42d2df8631751e48ffd70621df0
last_mapped_at: 2026-10-07
---
<!-- refreshed: 2026-10-07 -->

# Architecture

**Analysis Date:** 2026-10-07

## System Overview

```text
React/Vite browser app (`apps/web`)
              |
              v
Fastify modular monolith (`apps/server/src/app/index.ts`)
  routes -> handlers -> services -> repositories
              |
              +---- PostgreSQL / Drizzle (`packages/database`)
              +---- Redis (`apps/server/src/lib/redis`)
              +---- MinIO (`apps/server/src/lib/storage`)
              +---- PgBoss + transactional outbox (`apps/server/src/lib/queue`, `outbox`)
              +---- SMTP / Google OAuth / OTLP
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| API composition | Fastify setup, plugins, error handlers, route registration | `apps/server/src/app/index.ts` |
| HTTP process | Starts API and performs graceful shutdown | `apps/server/src/index.ts` |
| Background worker | Registers queue consumers and starts outbox polling | `apps/server/src/worker.ts` |
| Domain modules | Feature routes, handlers, services, repositories, schemas | `apps/server/src/modules/` |
| Database | PostgreSQL client and Drizzle schema/migrations | `packages/database/src/`, `packages/database/drizzle/` |
| Shared contracts | Cross-package Zod schemas and DTO types | `packages/shared/src/` |
| Browser client | React entry and application UI | `apps/web/src/` |

## Architectural Patterns

**Modular monolith:**
- Feature code is organized by domain, not split into network services.
- Project functionality is grouped below `apps/server/src/modules/project/<domain>/`.
- Keep a domain's routes, handlers, services, repositories, validation, and types together.

**Request flow:**
1. `project.routes.ts` registers scoped route plugins and `projectContext`.
2. Route pre-handlers authenticate and enforce organization/project capability.
3. Handler validates input and adapts HTTP response.
4. Service owns business rules and transaction boundaries.
5. Repository performs Drizzle queries with explicit tenant/project filters.

**Persistence and asynchronous flow:**
- PostgreSQL is the source of truth; Drizzle schema is in `packages/database/src/schema/`.
- Multi-record mutations use database transactions; related events are written to the outbox in-transaction.
- `apps/server/src/worker.ts` registers PgBoss consumers; `apps/server/src/document-worker.ts` isolates document processing.
- Long-running work is represented by module job payloads and worker handlers.

**Authorization and tenancy:**
- Organization identity is resolved by authentication/organization middleware, not request body fields.
- Project routes use `projectContext` and `requireProjectPermission` from `apps/server/src/modules/project/core/project.middleware.ts`.
- Tenant identifiers must accompany repository lookups, background payloads, audit writes, and tenant-specific cache keys.

## Data Flow

- API responses follow shared success/error envelope helpers in `apps/server/src/shared/response.ts`.
- Public validation/contracts are exported through `packages/shared/src/index.ts`.
- Database schemas are exported from `packages/database/src/schema/index.ts`; generate migrations with the database package scripts.
- Redis is a disposable optimization; domain truth and permission decisions must remain correct without cached values.
- MinIO object URLs are issued after the document service checks ownership and authorization.

## Entry Points

- HTTP API: `apps/server/src/index.ts`.
- Fastify factory for runtime and tests: `apps/server/src/app/index.ts`.
- General PgBoss/outbox worker: `apps/server/src/worker.ts`.
- Dedicated document worker: `apps/server/src/document-worker.ts`.
- Web application: `apps/web/src/main.tsx`.
- Local infrastructure: `docker-compose.yml`.

## Error Handling

- Domain errors expose stable codes and status metadata; map them through `apps/server/src/middleware/error-handler.ts`.
- Use repository/module error patterns; do not leak raw database errors or return success-shaped fallbacks.
- Log with the existing Pino/OpenTelemetry infrastructure rather than `console`.

## Cross-Cutting Concerns

- Environment validation: `packages/env/src/`.
- Logging/tracing: `packages/observability/src/`.
- RBAC and capability policy: `apps/server/src/modules/rbac/` and project core policy.
- Integration test app factory and shared fixtures are under `apps/server/tests/`.

---

*Architecture analysis: 2026-10-07*
