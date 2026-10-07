---
last_mapped_commit: d879191a607aa42d2df8631751e48ffd70621df0
last_mapped_at: 2026-10-07
---
# Coding Conventions

**Analysis Date:** 2026-10-07

## Code Style

- TypeScript ESM with strict shared TypeScript configuration; imports reference compiled `.js` extensions.
- Prettier configuration: 100-column print width, two spaces, single quotes, semicolons, trailing commas (`.prettierrc.json`).
- Use named exports and explicit types at module boundaries.
- Use `async`/`await`; avoid broad `catch` blocks that hide errors.

## Naming

- Directories and module filenames are kebab-case: `apps/server/src/modules/project/cost-transaction/`.
- Classes/types use PascalCase; functions, variables, and object fields use camelCase.
- Domain files conventionally use `<domain>.<role>.ts`: `.routes`, `.handler`, `.service`, `.repository`, `.schemas`, `.types`, `.errors`.
- Database table/schema symbols use lower camelCase in TypeScript and snake_case SQL names.

## Module Organization

- Keep code in domain modules and avoid large cross-domain service/controller files.
- Route files declare URL, Fastify schema/OpenAPI metadata, and authorization pre-handlers.
- Handlers adapt request/response; services hold business orchestration; repositories encapsulate persistence.
- Shared request/response shapes belong in `packages/shared`; database types belong in `packages/database`.
- Add new exported schemas/types to their package barrel files.

## Validation and API

- Parse body, params, and query using Zod before invoking domain logic.
- Use the shared response helpers in `apps/server/src/shared/response.ts`.
- Define Fastify route schemas for OpenAPI and response serialization.
- Map expected domain errors to stable status/code/message through `apps/server/src/middleware/error-handler.ts`.
- Keep organization identity sourced from authenticated request context and perform ownership checks within the same write transaction.

## Persistence and Transactions

- Use Drizzle query builders and bound SQL expressions; never concatenate user input into SQL.
- Scope tenant/project reads and writes in database predicates.
- Make multi-row updates atomic with `db.transaction`; lock controlling rows for race-sensitive transitions.
- Preserve domain history for financial/state transitions; use decimal strings / `Decimal` for money.
- Generate migrations with the Drizzle toolchain; do not hand-edit generated journal/snapshot metadata.

## Errors and Logging

- Throw typed domain errors for expected failures; surface infrastructure failures instead of silently defaulting.
- Use `createLogger({ name })`/Fastify logger and structured fields; do not use `console.log`.
- Redact credentials and tokens; do not log request secrets or sensitive payloads.

## Background Work and Caching

- Register PgBoss job names and typed payloads in module `.jobs.ts`; handle them in `.worker.ts`.
- Include `organizationId` (and project/entity scope where applicable) in every tenant job payload and worker query.
- Make retryable handlers idempotent and route DB mutations through the transactional outbox where needed.
- Redis is optional cache-aside only: tenant/scope-bearing keys, bounded TTL, invalidation on writes, and database fallback.
- Never use Redis as authorization, locking, sequence allocation, or financial source of truth.

## Testing Conventions

- Server tests are Vitest TypeScript files under `apps/server/tests/`.
- Prefer real PostgreSQL and Fastify `app.inject()` integration tests for routes, tenant isolation, transactions, and concurrency.
- Unit-test pure policy/math separately; isolate infrastructure with established mocks/fixtures when real storage is unnecessary.
- Include positive and cross-organization negative cases for tenant-scoped resources.

---

*Convention analysis: 2026-10-07*
