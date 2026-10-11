# Deferred Items — Phase 10 Plan 13

## Pre-existing diagnostics outside Plan 10-13 scope

- `pnpm --filter @siteflow/server typecheck` still reports existing unused imports/types and audit argument mismatches in `apps/server/src/modules/billing/catalog.service.ts`, plus Fastify handler type mismatches in `apps/server/src/modules/billing/trial.routes.ts`. These were present in the completed Plan 10-12 verification and are outside this plan's changed code.
- ESLint reports the existing `@typescript-eslint/no-explicit-any` warning at `apps/server/src/app/index.ts:79`. Plan 10-13 only added the Portal route import and registration; the warning is on an unchanged rate-limit callback.

No Plan 10-13 files contain placeholder/TODO stubs. No migration or Drizzle journal changes were made.
