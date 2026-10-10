# Phase 9 Plan 03 — H7–H9 Export, Date, and Reliability Remediation

## Result

Scoped report exports to their authenticated organization, project, and requesting actor; completed date-preset normalization; and replaced project-list `KEYS` invalidation with generation-based keys. Removed the process-local project-worker deduplication `Set`.

## Changes

- Export creation requires a current organization actor and rechecks project-read authority for project exports. Status and download requests recheck export ownership, organization scope, and current project-read authority.
- Export lifecycle updates (`PROCESSING`, `READY`, `FAILED`, and `EXPIRED`) include export ID, organization ID, and the expected nullable project ID in their predicates. Export request and successful download actions write project/organization-scoped audit records without including report contents.
- Async export workers confirm the stored requester and project scope, reload current organization membership before report generation, recheck project authority, and reauthorize before uploading the generated artifact.
- Implemented `TODAY`, `THIS_WEEK`, `THIS_MONTH`, `LAST_30_DAYS`, `THIS_QUARTER`, `THIS_YEAR`, and validated `CUSTOM` ranges. Calendar dates use project settings, then organization settings, then UTC; weekly boundaries honor the configured week start.
- Replaced project-list Redis pattern deletion with an organization generation counter. Cache keys include the generation, and stale list fills are discarded if invalidation advances the generation while the database query is in flight.
- Made report-export retention and signed-URL lifetime validated environment settings with the documented defaults of 24 hours and 5 minutes; `.env.example` documents both values.
- Removed the module-local `Set` from project workers. Source inspection confirms these project handlers currently perform only logging and tracing; business mutations and member-cache invalidation occur in request services, while project events are persisted through the transactional outbox and dispatched to PgBoss with a stable singleton key (explicit event idempotency key when supplied, otherwise outbox event ID). There is no effectful project-worker operation requiring a separate database execution ledger today.

## Verification

- Focused H7–H9 integration run — passed, 3 files / 33 tests (`export-lifecycle`, `report-foundation`, and `project-worker` cache-generation coverage).
- Complete Phase 9 focused regression run — passed, 9 files / 66 tests.
- `pnpm --filter @siteflow/env typecheck` and `pnpm --filter @siteflow/env build` — passed.
- `pnpm --filter @siteflow/server typecheck` — passed.
- `pnpm --filter @siteflow/web typecheck` — passed.
- ESLint on changed Wave 3 implementation and tests — passed with one `no-explicit-any` warning; no errors.
- `git diff --check` — passed; Git emitted line-ending conversion notices only.
- Full server lint remains blocked by four existing errors in unchanged `notification.service.ts`, `preference.service.ts`, and `exports/report-renderer.ts`; focused lint for changed Wave 3 files is clean of errors.

## Scope

No `docs/architecture/` files were changed. Phase 8 remains pending and unexecuted. No commit or push was created.
