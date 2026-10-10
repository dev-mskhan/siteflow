# Phase 9 Plan 01 — H1–H3 Authorization Remediation

## Result
Implemented project-report authorization, caller-scoped portfolio reporting, bounded cursor pagination, and authenticated SSE tenant validation.

## Changes
- Project report routes now run `projectContext`, require `project:read`, and then enforce the relevant report capabilities before entering handlers.
- Portfolio reports derive the caller’s readable project set from current organization-level authority or active project memberships. Rows, totals, status counts, and currency aggregates use the same organization/project scope.
- Portfolio comparison rows support bounded cursor pagination; the response returns `nextCursor`.
- The portfolio service now requires an authenticated actor instead of accepting an unscoped organization-only read.
- SSE connections require authentication and organization context, reject URL tenant mismatch, and use configured application CORS without a wildcard override.
- Added multi-organization route coverage for missing project permissions, scoped portfolio rows/aggregates, cursor pagination, unauthenticated SSE, cross-organization SSE, and CORS.

## Verification
- `pnpm --filter @siteflow/server exec vitest run tests/integration/reporting/report-routes.test.ts tests/integration/notification/realtime-authorization.test.ts` — passed, 2 files / 19 tests.
- `pnpm --filter @siteflow/server typecheck` — passed.
- ESLint on the four directly edited implementation files — passed.
- Full server lint still reports four existing errors outside Plan 01: type-only imports in notification service files and CommonJS/dynamic-import annotations in reporting export files. It also reports existing warnings. No H1–H3 implementation file has a lint error.
- `git diff --check` — passed (Git reported only line-ending conversion notices).

## Scope
No architecture artifacts were changed. Phase 8 remains pending. No commit or push was created.
