# Phase 9: Architecture Findings Remediation

**Status:** User-authorized; remediation is prioritized ahead of the still-pending Phase 8 implementation plans.

## Goal and authority

Close the code-backed findings H1–H9 from `docs/architecture/findings.md` in the current SiteFlow checkout. The user explicitly authorized implementation fixes after the read-only architecture review and directed that each issue be fixed, tested, and verified. This phase does not mark Phase 8 complete: its 22 plans remain unexecuted and its broader capabilities remain pending.

## Requirements

- **REM-01 / H1:** Every project-report route enforces the existing report/source project-read capability; missing project membership fails closed.
- **REM-02 / H2:** Portfolio aggregates and rows include only projects the caller can read under existing project membership and organization-level cross-project authority; results use bounded cursor pagination.
- **REM-03 / H3:** SSE requires authenticated identity, derives tenant access from current server-side membership/authority, rejects URL-only tenant claims, and uses configured CORS policy. Do not claim realtime delivery is wired unless a registered caller is implemented and tested.
- **REM-04 / H4:** Validate the actual outbox envelope and tenant requirements; connect a single validated dispatch path with durable retry/idempotency, or remove/fence unused dispatcher code if the current runtime contract does not support safe wiring.
- **REM-05 / H5:** Trace reminder, email, and preference implementation against the existing product contract. Register and test only complete supported paths; remove or explicitly isolate dormant definitions rather than advertising unimplemented delivery.
- **REM-06 / H6:** Align browser/server filter naming; preserve useful errors; ensure a slow report is not silently swallowed or recalculated unnecessarily. Select async work before expensive report generation using a researched, measurable policy, while keeping bounded fast exports synchronous.
- **REM-07 / H7:** Authorize project scope at export creation and re-check current access at status/download; tenant-qualify every export mutation and audit request/download actions without recording report contents.
- **REM-08 / H8:** Implement the full declared preset contract and custom date bounds using the applicable project/organization timezone, with a consistent documented UTC fallback.
- **REM-09 / H9:** Make retry/idempotency durable across project-worker restarts/replicas and replace unbounded Redis `KEYS` invalidation with a bounded/scalable approach.

## Constraints

- Preserve tenant isolation as a hard boundary. Every changed repository operation must include organization scope and applicable project scope; never grant access based on an identifier, URL parameter, or role name alone.
- Reuse existing Fastify, Zod, Drizzle, PostgreSQL, PgBoss, outbox, Redis, MinIO, permission maps, test factories, and transaction patterns. Do not add infrastructure without source evidence and a tested need.
- Read and follow `.planning/checklist_when_to_apply.md` and `.planning/siteflow_testing_context.md` before implementation and at phase exit. Backend route tests must exercise the production Fastify app through `app.inject()` and PostgreSQL-backed fixtures; test cross-tenant boundaries with at least two organizations where applicable.
- Do not claim end-to-end capability from definitions alone. If a partial notification/dispatcher feature cannot safely be completed within the existing contract, keep its status explicitly unavailable and avoid speculative delivery wiring.
- Keep architecture outputs in `docs/architecture/` out of remediation commits and pushes. Do not modify source during the architecture deliverable stage; source changes belong only to Phase 9 implementation.
- Do not add PDF/XLSX, platform billing, or unrelated Phase 8 capabilities. No test-run results belong in diagrams or the architecture inventory.
- The user requested no questions. Resolve ordinary choices using the existing Phase 8 user decisions and repository conventions; record any genuine blocker rather than weakening authorization or fabricating a successful verification.

## Acceptance

Each requirement has a focused failing-before/passing-after regression test, appropriate integration coverage, and exact verification output. Run relevant type-check, lint, and integration tests, plus the required phase-level checks. Complete UAT/verification honestly; automated tests are not represented as human perceptual review. Commit and push only the source/planning remediation changes after all required checks pass; do not stage or push `docs/architecture/`.
