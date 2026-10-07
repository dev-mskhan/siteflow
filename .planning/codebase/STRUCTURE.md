---
last_mapped_commit: d879191a607aa42d2df8631751e48ffd70621df0
last_mapped_at: 2026-10-07
---
<!-- refreshed: 2026-10-07 -->

# Codebase Structure

**Analysis Date:** 2026-10-07

## Repository Layout

```text
siteflow/
├── apps/
│   ├── server/                 # Fastify API and worker processes
│   │   ├── src/app/            # Fastify construction and route registration
│   │   ├── src/lib/            # DB, queue, outbox, Redis, storage, email helpers
│   │   ├── src/middleware/     # Shared request/error middleware
│   │   ├── src/modules/        # Domain modules
│   │   └── tests/              # Vitest unit/integration suites
│   └── web/                    # React/Vite client and Playwright tests
├── packages/
│   ├── database/               # Drizzle schema, client, migrations
│   ├── shared/                 # Shared validation/contracts
│   ├── env/                    # Runtime environment validation
│   ├── observability/           # Pino and OpenTelemetry setup
│   ├── eslint-config/
│   └── typescript-config/
├── infra/docker/               # Local PostgreSQL/Redis/OTel config
├── docs/                       # Project documentation
└── .planning/                  # GSD planning and project context
```

## Key Locations

**Backend:**
- `apps/server/src/modules/auth/` - auth, sessions, OAuth, and auth jobs.
- `apps/server/src/modules/organization/`, `membership/`, `invitation/`, `rbac/` - organization identity and access.
- `apps/server/src/modules/project/` - project operations, schedules, documents, procurement, compliance, and commercial modules.
- `apps/server/src/lib/queue/`, `outbox/`, `db/`, `redis/`, `storage/` - infrastructure adapters.
- `apps/server/src/modules/project/project.routes.ts` - project route mounting and common project context.

**Data and contracts:**
- `packages/database/src/schema/` - concept-specific Drizzle schema files and barrel.
- `packages/database/drizzle/` - generated SQL migrations and snapshots.
- `packages/shared/src/modules/` - feature schemas/contracts.
- `packages/env/src/` - validated server/client environment.

**Frontend and tests:**
- `apps/web/src/` - current browser application entry and UI.
- `apps/web/tests/e2e/` - Playwright browser tests.
- `apps/server/tests/integration/` - route and database behavior.
- `apps/server/tests/unit/` - isolated domain/service logic.
- `apps/server/tests/helpers/fixtures.ts` and `tests/setup.ts` - test setup and reusable fixtures.

## Naming Conventions

- TypeScript source uses `.ts`/`.tsx`; ESM imports conventionally include `.js` specifiers.
- Domain modules use kebab-case directories and names such as `budget.service.ts`, `budget.repository.ts`, and `budget.routes.ts`.
- Database schemas use `<concept>.schema.ts`; shared schemas mirror domain names.
- Tests use `*.test.ts`; route/database tests are grouped under `tests/integration/`.
- Uppercase Markdown is used for GSD codebase reference documents.

## Where to Add Code

- Add an API feature under `apps/server/src/modules/<domain>/`; follow the route-handler-service-repository layering of its nearest analog.
- Add project features within `apps/server/src/modules/project/<domain>/` and register routes through `project.routes.ts`.
- Put reusable public Zod schemas in `packages/shared/src/modules/` and export them from its barrel.
- Put persistent schema in the concept-owned file in `packages/database/src/schema/`, export it from the schema barrel, and generate a Drizzle migration.
- Add focused unit tests under `apps/server/tests/unit/`; add HTTP/database coverage under `apps/server/tests/integration/`.
- Keep cross-cutting adapters in `apps/server/src/lib/`; avoid importing another module's private repository.

---

*Structure analysis: 2026-10-07*
