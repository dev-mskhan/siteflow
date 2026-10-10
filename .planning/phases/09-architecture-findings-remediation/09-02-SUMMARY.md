# Phase 9 Plan 02 — H4–H6 Outbox, Worker Boundary, and Export Flow

## Result

Validated the active outbox publishing contract, fenced the unused in-memory dispatcher, retained the intentionally unavailable reminder/notification delivery boundary, and fixed export request filtering and sync/async classification.

## Changes

- Added Zod validation for supported auth/invitation queue payloads and tenant scope. Generic event names are syntax-checked, require `organizationId`, and reject tenant mismatches; domain-event envelopes are parsed against the shared schema.
- The outbox poller revalidates persisted events before dispatch and passes the outbox event ID as PgBoss `singletonKey` to reduce duplicate active jobs. Duplicate outbox row IDs remain rejected by the database primary key.
- The unused generic `EventDispatcher` now fails explicitly instead of claiming in-memory idempotent delivery.
- Extracted `registerWorkers` into `worker-registration.ts`; the process entry point delegates to it. A recording PgBoss test protects supported registrations and asserts that incomplete reminder/email delivery remains unregistered.
- Aligned the web export request field with the server's canonical `filters` field. Added a validated, config-backed set of report types eligible for synchronous export, decided before fetching. Eligible report failures mark the export failed and surface the error rather than falling through to a duplicate async generation.
- Carried the authenticated portfolio actor through export requests and queued work so organization portfolio exports use the caller-scoped report path.

## Verification

- Focused H4–H6 integration/regression run — passed, 5 files / 20 tests, including transactional publishing, dispatcher fence, export lifecycle, worker registration, and reminder boundary.
- `pnpm --filter @siteflow/server typecheck` — passed.
- `pnpm --filter @siteflow/web typecheck` — passed.
- ESLint on changed Wave 2 files — passed with 12 `no-explicit-any` warnings; no errors.
- `git diff --check` — passed; Git emitted line-ending conversion notices only.

## Scope

No `docs/architecture/` files were changed. Phase 8 remains pending. No commit or push was created.
