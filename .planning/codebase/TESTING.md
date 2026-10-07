---
last_mapped_commit: d879191a607aa42d2df8631751e48ffd70621df0
last_mapped_at: 2026-10-07
---
# Testing Strategy

**Analysis Date:** 2026-10-07

## Framework and Commands

- Server: Vitest 3, `apps/server/vitest.config.ts`; run with `pnpm --filter @siteflow/server test`.
- Server lint/typecheck/build: `pnpm --filter @siteflow/server lint`, `typecheck`, and `build`.
- Web end-to-end: Playwright via `pnpm --filter @siteflow/web test:e2e`.
- Workspace validation: root `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` invoke Turborepo.

## Test Layout

- `apps/server/tests/unit/` contains isolated auth, commercial, membership, organization, outbox, project, RBAC, and storage tests.
- `apps/server/tests/integration/` contains Fastify/PostgreSQL route and domain scenarios (50+ suites).
- `apps/server/tests/helpers/fixtures.ts` provides shared test data builders.
- `apps/server/tests/setup.ts` is loaded by Vitest.
- `apps/web/tests/e2e/` contains Playwright tests; the web app currently has a small E2E surface.

## Integration Environment

- Vitest runs in Node, uses one fork, and loads `tests/setup.ts`.
- Test DB default is PostgreSQL `siteflow_test` on port 5434; Redis is on 6379; MinIO is configured on 9000.
- `docker-compose.yml` and `infra/docker/` provide local dependencies.
- Tests should use dedicated test resources, unique fixtures, and generated migrations; avoid resetting shared databases.

## Test Patterns

- Build/inject Fastify app using the production app factory and assert status, response envelope, and persisted rows.
- Use fixture helpers for organization/user/project setup; create two real organizations when testing isolation.
- Verify both sides of security boundaries: owner organization succeeds, foreign organization is rejected without leaking existence.
- Test transaction rollback, unique constraints, stale versions, duplicate retries, and concurrent mutation outcomes at the DB/API boundary.
- For PgBoss/outbox, assert enqueue/persisted event behavior separately from deterministic worker integration tests.
- For cache behavior, cover hit, miss, invalidation, tenant-key isolation, and Redis outage fallback only when the path uses cache.
- Keep pure schedule calculations and financial Decimal/policy logic in unit suites.
- Use persisted state as the assertion source for derived metrics and financial summaries.

## Configuration and Exclusions

- `apps/server/vitest.config.ts` includes `tests/**/*.{test,spec}.ts`, excludes `.e2e.ts`, `node_modules`, and `dist`.
- Coverage uses V8 with text/JSON/HTML reports and includes `src/**/*.ts`.
- Server tests have a 30-second default timeout; integration tests can override for slow setup.
- Playwright tests are not part of the server Vitest invocation.

## Recommended Validation

- Run the narrow relevant suite first, e.g. `pnpm --filter @siteflow/server test -- tests/integration/tenant-isolation.test.ts`.
- Run server typecheck/lint/build for backend changes; run web typecheck/build/E2E for UI changes.
- Run full workspace checks only for phase exit or when shared contracts affect multiple packages.

---

*Testing analysis: 2026-10-07*
