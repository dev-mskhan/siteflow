---
last_mapped_commit: d879191a607aa42d2df8631751e48ffd70621df0
last_mapped_at: 2026-10-07
---
# Technology Stack

**Analysis Date:** 2026-10-07

## Languages

**Primary:**
- TypeScript - API, web app, shared packages, database schema, and tooling.
- SQL - PostgreSQL migrations, query fragments, and database initialization.

**Secondary:**
- JavaScript/JSON/YAML - Node configuration and workspace/package metadata.

## Runtime

**Environment:**
- Node.js; repository engine requires `>=20.0.0`.
- pnpm `>=9.0.0`; lockfile is `pnpm-lock.yaml`.
- Workspace orchestration uses Turborepo (`turbo.json`).

## Frameworks

**Core:**
- Fastify 5 (`apps/server/src/app/index.ts`) - modular monolith HTTP API.
- React 18 + Vite (`apps/web`) - browser client.
- Drizzle ORM + PostgreSQL (`packages/database`) - typed persistence and migrations.
- Zod (`packages/shared`, `packages/env`) - request/shared-schema and environment validation.

**Testing:**
- Vitest 3 - server unit and integration tests.
- Playwright - web end-to-end test runner (`apps/web`).

**Build/Dev:**
- tsup - package and server builds.
- TypeScript 5.6, ESLint, Prettier, and `tsx` - type checking, linting, formatting, and dev.

## Key Dependencies

**Critical:**
- `fastify`, `@fastify/swagger` - HTTP application, OpenAPI and Swagger UI.
- `drizzle-orm`, `pg`, `postgres` - relational access and PostgreSQL clients.
- `@siteflow/shared`, `@siteflow/database`, `@siteflow/env`, `@siteflow/observability` - internal workspace packages.
- `zod`, `decimal.js` - input schemas and exact decimal financial arithmetic.

**Infrastructure:**
- `pg-boss` - persistent PostgreSQL-backed background jobs.
- `ioredis` - Redis cache and rate-limit support.
- `minio` - S3-compatible object storage.
- OpenTelemetry SDK/exporters and Pino - tracing/metrics/logging.
- `nodemailer`, `google-auth-library`, `jsonwebtoken`, `bcryptjs` - email, OAuth, tokens, and password hashing.

## Configuration

**Environment:**
- Validated server/client config is centralized in `packages/env/src/server.ts` and `packages/env/src/client.ts`.
- `.env.example` documents local settings; do not read or commit `.env`.

**Build:**
- Root workspace scripts are in `package.json`; package scripts are defined per workspace.
- TypeScript configuration is shared via `packages/typescript-config`.
- Lint configuration is shared via `packages/eslint-config`; formatting uses `.prettierrc.json`.
- Database migrations and Drizzle configuration are under `packages/database/drizzle/` and `packages/database/drizzle.config.ts`.

## Platform Requirements

**Development:**
- Node.js, pnpm, PostgreSQL, Redis, MinIO, and the local observability stack described by `docker-compose.yml`.
- Integration tests use PostgreSQL on port 5434 and expect Redis/MinIO test services.

**Production:**
- Node.js API and worker processes with PostgreSQL, Redis, S3-compatible storage, and an OTLP collector/backend.
- No CI workflow files were detected under `.github/`.

---

*Stack analysis: 2026-10-07*
