---
last_mapped_commit: d879191a607aa42d2df8631751e48ffd70621df0
last_mapped_at: 2026-10-07
---
# Codebase Concerns

**Analysis Date:** 2026-10-07

## Verified Risks

**Schedule metrics repository omits organization predicate:**
- `apps/server/src/modules/project/schedule-metrics/schedule-metrics.repository.ts` looks up and upserts materialized rows using `projectId` only.
- The service resolves the current revision with both organization and project IDs, but later repository reads do not preserve that full scope.
- Before extending these metrics, make repository lookup/update tenant-scoped and verify cross-tenant tests against two organizations.

**Project cache uses broad key scans:**
- `apps/server/src/modules/project/core/project.cache.service.ts` uses Redis `KEYS` in `invalidateOrgProjectLists`.
- The production-readiness checklist `.planning/checklist_when_to_apply.md` disallows production `KEYS`; use bounded `SCAN` or a non-scan invalidation scheme before relying on this path at scale.

**Generic export job is only a declaration:**
- `apps/server/src/lib/queue/queue.ts` declares `RESOURCE_EXPORT` and an `ExportPayload`, but repository search found no worker or producer for it.
- Its payload has no `organizationId` and formats only `csv`/`pdf`; it is not yet a safe, complete report-export facility.

**Process-local idempotency is not durable:**
- `apps/server/src/modules/project/core/project.worker.ts` uses an in-memory `processedEvents` set.
- Such state resets with worker restarts and is not a durable deduplication boundary if handlers gain persistent side effects.

## Operational Gaps

- No CI workflow files were detected under `.github/`; lint, typecheck, build, and tests are available as package scripts but no checked-in automated pipeline was found.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, and core GSD project documents were absent at mapping time; project-wide GSD onboarding is pending.
- Phase F reporting scope is not represented in initialized GSD requirements/roadmap yet. Existing `tasks_phase_d.md` and `tasks_phase_e.md` are historical/project planning artifacts, not GSD state.

## Security and Performance Focus

- Treat organization/project ownership and contextual authorization as explicit requirements for every reporting query, export record, cache entry, and worker job.
- Verify bounded page sizes and indexed filters for report APIs; aggregate queries can multiply cost across project, portfolio, and date-range views.
- Large report generation must leave request handlers and use the existing PgBoss worker architecture; signed downloads should follow the existing MinIO document/storage access pattern.
- Do not add report caching speculatively. Existing schedule metrics already demonstrate a materialized DB row plus optional Redis; measure read patterns and scope cache keys/invalidation before reuse.
- The production-readiness checklist and testing context are key guardrails: `.planning/checklist_when_to_apply.md` and `.planning/siteflow_testing_context.md`.

## Known Scope Boundaries

- No platform subscription, payment, or usage-billing domain was detected in the current schema/module inventory.
- Project financial reporting exists in `apps/server/src/modules/project/commercial-summary/` and `financial-summary/`; extend authoritative services rather than re-deriving financial logic in UI/export code.
- Existing `.planning/` files are untracked or modified in the worktree. Preserve them; do not stage or commit them with the map.

---

*Concerns analysis: 2026-10-07*
