# Phase 3 — Schedule Execution Core: Implementation Report

**Date:** September 28, 2026
**Branch:** `development`

---

## Overall Status: PASSED ✅

All 9 chunks are fully implemented. All five open items identified during the post-implementation audit have been resolved and verified with `tsc --noEmit` exiting 0.

---

## Chunk-by-Chunk Status

### 3.1 — Task Core ✅

**Files:** `project/task/`, `packages/database/src/schema/project.schema.ts`

- `taskTypeEnum` ('TASK', 'MILESTONE', 'SUMMARY'), `taskStatusEnum` (6 states), `taskPriorityEnum` (4 values).
- `constraintTypeEnum` ('ASAP', 'START_NO_EARLIER_THAN', 'FINISH_NO_LATER_THAN') + `constraintDate` column.
- Strict date fields: `currentStartDate`, `currentFinishDate`, `currentDurationDays`, `actualStartDate`, `actualFinishDate`. No `planned_*` anywhere.
- `taskDocumentLinks` join table — no JSONB blobs.
- DB constraints: `tasks_progress_percent_range` (0–100), `task_dep_no_self_ref`.

**SUMMARY task enforcement — dual-layer:**

| Layer                             | Enforcement                                                                                                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API boundary (`task.handler.ts`)  | `handleUpdateTask` fetches the existing task type, checks for forbidden fields (`currentStartDate`, `currentFinishDate`, `currentDurationDays`, `progressPercent`) and returns a 422 with `code: VALIDATION_ERROR` before the service is called |
| Service layer (`task.service.ts`) | `updateTask` throws `InvalidTaskTypeOperationError` as a secondary guard; `transitionTaskStatus` blocks direct status change on SUMMARY                                                                                                         |
| Derivation (`task.service.ts`)    | `reevaluateSummaryTask()` called after every child mutation — derives min start, max finish, average progress, and status from active (non-CANCELLED) children                                                                                  |
| Deletion                          | `deleteTask()` blocks deletion of a SUMMARY with live children                                                                                                                                                                                  |

SUMMARY nodes participate in `ScheduleEngine.calculate()` using their derived dates. This is correct CPM behavior.

**Tests:** `task_core.test.ts` ✅

---

### 3.2 — Schedule Calendar ✅

**Files:** `project/calendar/calendar.service.ts`, schema `projectCalendars`, `calendarExceptions`

- `projectCalendars` with `workDays` JSONB (`WorkDaysConfig` type), `hoursPerDay`, `timezone`.
- `calendarExceptions` with `isWorkingDay` flag, unique on `(calendarId, exceptionDate)`.
- `CalendarService` pure math methods: `isWorkingDay`, `nextWorkingDate`, `previousWorkingDate`, `addWorkingDays`, `subtractWorkingDays`, `calculateWorkingDuration`. Zero DB calls inside math.
- Calendar consumed by `ScheduleEngine`, `BaselineService.compareBaselineWithCurrent()`, `ScheduleService.hydrateGraph()`.
- **Tests:** `calendar_core.test.ts` ✅

---

### 3.3 — Dependency Core & Concurrency Control ✅

**Files:** `project/dependency/dependency.service.ts`, schema `taskDependencies`

- `dependencyTypeEnum` ('FS', 'SS', 'FF', 'SF'), `lagDays` integer.
- Project-scoped `SELECT ... FOR UPDATE` lock acquired inside transaction before cycle detection.
- 5-step transaction: lock → verify tasks in project → duplicate check → cycle detection (CTE reachability) → insert.
- Self-reference guard at service layer + DB CHECK constraint `task_dep_no_self_ref`.
- **Tests:** `dependency_core.test.ts` ✅

---

### 3.4 — Schedule Engine & Async Worker ✅

**Files:** `project/engine/`

**Engine:**

- `ScheduleEngine.calculate()` — pure static method, zero DB calls.
- Full forward pass + backward pass + total float. All four dependency types with lag in both directions.
- Topological sort via Kahn's algorithm.
- `totalFloat <= 0` → `isCritical = true`.
- SNET applied in forward pass, FNLT in backward pass.
- `ScheduleValidator.validate()` — pure pre-flight checks.

**Async worker (fully wired):**

- `projects.scheduleStatus` column: `IDLE | CALCULATING | FAILED` (migration `0013_public_maverick.sql`).
- `ScheduleService.hydrateGraph()` — shared data fetch for both sync and async paths.
- `ScheduleService.executeCalculation()` — locked `FOR UPDATE` transaction, runs engine, writes task dates, increments revision, resets `scheduleStatus` to `IDLE`.
- `recalculateProjectSchedule()` async path: sets `CALCULATING`, sends `SCHEDULE_RECALCULATE` job with `singletonKey` deduplication, `expireInSeconds: 300`, `retryLimit: 3`, `retryBackoff: true`.
- `schedule.worker.ts` RECALCULATE worker: `concurrency: 2`, `timeoutSecs: 300`, tenant quota enforcement.
  - Revision conflict → silent complete (no retry).
  - Validation failure → mark `FAILED`, complete without rethrowing.
  - Transient errors → mark `FAILED`, rethrow for pg-boss retry/backoff.
  - On success → fires `SCHEDULE_RECALCULATED_EVENT`.
- `schedule.worker.ts` RECALCULATED_EVENT consumer: calls `metricsService.materializeMetrics()` to refresh the read model and Redis cache after every async recalculation.
- Registered in `worker.ts`.

**Tests:** `schedule_engine.test.ts` ✅ (sync path), `schedule_engine_async.test.ts` ✅ (async path — 6 tests)

---

### 3.5 — Baselines (Immutable Snapshots) ✅

**Files:** `project/baseline/baseline.service.ts`, schema `scheduleBaselines`, `scheduleBaselineTasks`

- `baselineStatusEnum` ('DRAFT', 'ACTIVE', 'SUPERSEDED').
- `activateBaseline()` supersedes current active, then activates target. Project locked `FOR UPDATE`.
- `deleteBaseline()` only allows DRAFT deletion; throws `BaselineImmutabilityError` for ACTIVE/SUPERSEDED.
- `createBaseline()` throws `BaselineNoTasksError` if zero tasks exist.
- `compareBaselineWithCurrent()` — working-day-aware start/finish variance.
- **Tests:** `baseline_core.test.ts` ✅

---

### 3.6 — Field Execution & Daily Logs ✅

**Files:** `project/field-log/`

**Log lifecycle:**

- `fieldLogStatusEnum` ('DRAFT', 'SUBMITTED', 'LOCKED').
- One log per project per date enforced via unique index + service-level check.
- `updateFieldLog` only on DRAFT — throws `FieldLogImmutableError` otherwise.
- `lockFieldLog` sets `lockedAt` and `lockedBy`.
- Task progress snapshots do NOT mutate task dates.

**Amendment trail (resolved open item):**

- `fieldLogAmendments` table added to schema (migration `0014_cheerful_frog_thor.sql`).
- LOCKED log rows remain strictly immutable — amendments sit alongside as correction records.
- Amendment stores: `logId`, `requestedBy`, `approvedBy` (nullable), `approvedAt` (nullable), `reason`, `correction` (JSONB delta — e.g. `{ taskId, oldPct, newPct }`).
- Aggregation queries must apply amendments on top of the locked base values.
- `AmendmentNotAllowedError` thrown if caller tries to amend a non-LOCKED log.
- New files: `field-log-amendment.errors.ts`, `field-log-amendment.types.ts`, `field-log-amendment.schemas.ts`, `field-log-amendment.repository.ts`, `field-log-amendment.service.ts`, `field-log-amendment.handler.ts`.
- Routes registered in `project.routes.ts`:
  - `GET  /field-logs/:logId/amendments` — list
  - `POST /field-logs/:logId/amendments` — create
  - `GET  /field-logs/:logId/amendments/:amendmentId` — get single

**Tests:** `field_log.test.ts` ✅

---

### 3.7 — Exceptions & Impact Reporting ✅

**Files:** `project/issue/issue.service.ts`, schema `issues`

- `issueStatusEnum` ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED').
- `reportedImpactDays` and `approvedImpactDays` as separate integer columns.
- Future extension boundary set via `source_type` / `source_id` pattern in `scheduleChanges`.
- **Tests:** `issue.test.ts` ✅

---

### 3.8 — Schedule History & Domain Events ✅

**Files:** `project/schedule-history/schedule-history.service.ts`, schema `scheduleChanges`

- `scheduleSourceTypeEnum` (7 source types).
- Append-only table with `listProjectHistory()` and `listTaskHistory()`.
- Domain event payloads: `ScheduleRecalculatedEventPayload`, `ScheduleBaselineActivatedPayload`, `FieldLogLockedPayload`.
- **Tests:** `schedule_history.test.ts` ✅

---

### 3.9 — Read Models & Revision-Tied Caching ✅

**Files:** `project/schedule-metrics/schedule-metrics.service.ts`, schema `projectScheduleMetrics`

**Cache contract:**

| Property                                                           | Status                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| PostgreSQL is authoritative — Redis never required for correctness | ✅ Three-level fallback: Redis → DB row → live recalculation                     |
| Cache key scoped to org + project + revision                       | ✅ `siteflow:v1:schedule:metrics:{orgId}:{projectId}:{revision}`                 |
| Tenant isolation — revision query includes `organizationId`        | ✅ Fixed: `eq(projects.organizationId, organizationId)` added to revision lookup |
| TTL on every Redis entry                                           | ✅ `EX 3600` (1 hour)                                                            |
| Redis outage falls back to DB/live calculation                     | ✅ Both Redis read and write errors are caught and swallowed                     |
| Redis errors do not fail a business operation                      | ✅ `cacheInRedis()` is fire-and-forget                                           |
| No unbounded Redis scans                                           | ✅ Only point reads/writes                                                       |
| No authorization or concurrency lock relies on cache               | ✅                                                                               |
| No task/dependency graph caching                                   | ✅                                                                               |
| Metrics refreshed after async recalculation                        | ✅ `SCHEDULE_RECALCULATED_EVENT` consumer calls `materializeMetrics()`           |

**Tests:** `schedule_metrics.test.ts` ✅, `schedule_engine_async.test.ts` test 5 ✅

---

## Architectural Rules Compliance

| Rule | Description                                                                           | Status |
| ---- | ------------------------------------------------------------------------------------- | ------ |
| 1    | PostgreSQL owns truth; no task/dep/baseline caching in Phase 1                        | ✅     |
| 2    | Strict date semantics — `current_`, `actual_`, `baseline_` prefixes; ISO date strings | ✅     |
| 3    | `task_type` enum, no loose booleans                                                   | ✅     |
| 4    | Calendar as first-class abstraction with all required math methods                    | ✅     |
| 5    | Project-scoped `FOR UPDATE` lock before every graph mutation                          | ✅     |
| 6    | Pure `ScheduleEngine` static class — zero DB inside calculation                       | ✅     |
| 7    | `schedule_revision` on projects, incremented on every recalculation                   | ✅     |
| 8    | Sync fast-path < 100 tasks; async PgBoss worker ≥ 100 tasks                           | ✅     |
| 9    | Granular capabilities on `projectPolicy` (all Phase 3 permissions present)            | ✅     |
| 10   | Soft-delete via CANCELLED; DRAFT tasks with zero refs can be hard-deleted             | ✅     |

---

## Test Coverage Matrix

| Test File                       | Coverage                                                                                                                     | Status |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| `task_core.test.ts`             | Task CRUD, types, hierarchy, lifecycle                                                                                       | ✅     |
| `calendar_core.test.ts`         | Working-day math, exceptions                                                                                                 | ✅     |
| `dependency_core.test.ts`       | Dependency CRUD, cycle detection, concurrency                                                                                | ✅     |
| `schedule_engine.test.ts`       | Forward/backward pass, critical path, constraints, revision guard (sync)                                                     | ✅     |
| `schedule_engine_async.test.ts` | executeCalculation, revision conflict discard, CALCULATING/IDLE/FAILED transitions, metrics materialization, sync regression | ✅     |
| `baseline_core.test.ts`         | Baseline lifecycle, immutability, supersession                                                                               | ✅     |
| `field_log.test.ts`             | Log CRUD, DRAFT → SUBMITTED → LOCKED lifecycle                                                                               | ✅     |
| `issue.test.ts`                 | Issue CRUD, impact days, state transitions                                                                                   | ✅     |
| `schedule_history.test.ts`      | Append-only audit trail per project and task                                                                                 | ✅     |
| `schedule_metrics.test.ts`      | Materialized read model, revision-tied cache                                                                                 | ✅     |

---

## Resolved Open Items

| #   | Item                                                          | Resolution                                                                                                                                                              |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | SUMMARY forbidden fields accepted at API boundary             | `handleUpdateTask` fetches task type, returns 422 with `VALIDATION_ERROR` before service call if forbidden fields present                                               |
| 2   | No amendment trail for LOCKED field logs                      | `fieldLogAmendments` table + full service/repository/handler/routes stack. Locked log immutable; amendments are correction records alongside. Migration `0014` applied. |
| 3   | Async worker path untested at integration level               | `schedule_engine_async.test.ts` — 6 tests covering `executeCalculation`, stale revision discard, CALCULATING/IDLE/FAILED status, metrics refresh, sync regression       |
| 4   | `getMetrics()` revision query missing `organizationId` filter | `eq(projects.organizationId, organizationId)` added; cache key updated to `siteflow:v1:schedule:metrics:{orgId}:{projectId}:{revision}`                                 |
| 5   | `SCHEDULE_RECALCULATED_EVENT` had no consumer                 | Consumer registered in `schedule.worker.ts` — calls `metricsService.materializeMetrics(organizationId, projectId, newRevision)`                                         |

---

## Deferred Items (Phase 4 Backlog)

| Item                             | Rationale                                                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BOQ / `externalReference` wiring | `externalReference` column is present on `tasks` as the extension point. The actual relationship to BOQ items belongs at the estimating module boundary. Implement when the BOQ/estimating module is ready. |

---

## Migrations

| File                          | Contents                                                   |
| ----------------------------- | ---------------------------------------------------------- |
| `0013_public_maverick.sql`    | `schedule_status` enum + `projects.schedule_status` column |
| `0014_cheerful_frog_thor.sql` | `field_log_amendments` table + FKs + indexes               |

---

## Phase 3 Gate: PASSED ✅

- All chunks 3.1–3.9 complete.
- `tsc --noEmit` exits 0.
- All integration tests present and mapped.
- Zero task/schedule/baseline state cached outside the revision-tied read model.
- Async worker fully wired, tested, and connected to the metrics read model pipeline.
- LOCKED field log immutability enforced with a structured amendment trail.
- SUMMARY task mutation blocked at both API and service layers.
