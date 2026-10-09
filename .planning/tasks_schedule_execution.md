# SiteFlow — Phase 3: Schedule Execution Core (v2 Redesign)

> **This file supersedes v1.** Incorporates all 31 architectural corrections and strict construction scheduling requirements.
> Each chunk has a STATUS field.
> Pick up from the first `NOT STARTED` or `IN PROGRESS` chunk.
>
> **Project root**: `D:/summer/agentic-ai/siteflow`
> **Server app**: `apps/server/src/`
> **Database package**: `packages/database/src/schema/`

---

## How to Read This File

1. Read the **Global Architectural Decisions** section first — always.
2. Find the first chunk whose STATUS is not `DONE`.
3. Read its **prerequisites**, then implement the checklist in order.
4. When done, flip STATUS to `DONE` and commit.

---

## Existing Architecture (Do Not Break)

### Phase 1 — Auth Module (Complete)
- [`apps/server/src/modules/auth/`](file:///D:/summer/agentic-ai/siteflow/apps/server/src/modules/auth/) — JWT sessions, OAuth, email verification, password reset (319 integration tests passing)

### Phase 2 — Project Core (Complete)
| Sub-module | Path |
|---|---|
| Project CRUD + lifecycle | [`project/core/`](file:///D:/summer/agentic-ai/siteflow/apps/server/src/modules/project/core/) |
| Project members | [`project/members/`](file:///D:/summer/agentic-ai/siteflow/apps/server/src/modules/project/members/) |
| Project settings | [`project/settings/`](file:///D:/summer/agentic-ai/siteflow/apps/server/src/modules/project/settings/) |
| Project phases | [`project/phases/`](file:///D:/summer/agentic-ai/siteflow/apps/server/src/modules/project/phases/) |
| Project cost codes | [`project/cost-codes/`](file:///D:/summer/agentic-ai/siteflow/apps/server/src/modules/project/cost-codes/) |
| Project audit history | [`project/audit/`](file:///D:/summer/agentic-ai/siteflow/apps/server/src/modules/project/audit/) |
| Project cache service | [`project/core/project.cache.service.ts`](file:///D:/summer/agentic-ai/siteflow/apps/server/src/modules/project/core/project.cache.service.ts) |

---

## Corrected Implementation Sequence

```
PROJECT CORE (Phase 2 ✓)
    │
    ▼
3.1 TASK CORE
    │   ├── task types (TASK, MILESTONE, SUMMARY) & hierarchy
    │   ├── date semantics (current vs baseline vs actual - NO "planned")
    │   ├── progress model & BOQ extension point
    │   ├── task code (human ID) & external reference
    │   └── soft-delete & document link boundaries
    │
    ▼
3.2 SCHEDULE CALENDAR
    │   ├── project calendar & working week / working hours
    │   ├── holidays & exception dates
    │   └── calendar date math functions (addWorkingDays, etc.)
    │
    ▼
3.3 DEPENDENCY CORE & GRAPH LOCKING
    │   ├── dependency types (FS, SS, FF, SF) & lag_days
    │   ├── project schedule mutation lock (SELECT ... FOR UPDATE)
    │   └── cycle detection algorithm with concurrency safety
    │
    ▼
3.4 SCHEDULE ENGINE & CONSTRAINTS
    │   ├── pure, deterministic ScheduleEngine interface (DB-decoupled)
    │   ├── ScheduleValidator subsystem
    │   ├── schedule constraints (ASAP, SNET, FNLT)
    │   ├── forward/backward pass & float calculation (totalFloat <= 0)
    │   ├── schedule versioning / revision guard against race conditions
    │   └── sync fast-path (< 100 tasks) vs async worker (> 100 tasks)
    │
    ▼
3.5 BASELINE (IMMUTABLE SNAPSHOTS)
    │   ├── schedule_baselines & schedule_baseline_tasks
    │   ├── immutable activation (DRAFT → ACTIVE → SUPERSEDED)
    │   └── comparison snapshot model
    │
    ▼
3.6 FIELD EXECUTION & DAILY LOGS
    │   ├── daily_field_logs (DRAFT → SUBMITTED → LOCKED)
    │   ├── immutable locked log amendments
    │   ├── project unit system alignment for quantities
    │   └── task progress snapshots (NO auto-mutation of schedule)
    │
    ▼
3.7 EXCEPTIONS & IMPACT REPORTING
    │   ├── reported_impact_days vs approved_impact_days
    │   ├── issue schedule impact tracking
    │   └── future RFI / Change Order / Material Delay extension links
    │
    ▼
3.8 SCHEDULE HISTORY & DOMAIN EVENTS
    │   ├── source-aware schedule_changes (source_type, source_id)
    │   └── rich domain event payloads (TaskDateChanged, BaselineActivated)
    │
    ▼
3.9 SCHEDULE READ MODELS & REVISION-TIED CACHING
    │   ├── project_schedule_metrics materialized read model
    │   └── revision-tied Redis cache (schedule:metrics:{projectId}:{revision})
```

---

## Global Architectural Decisions (31 Core Rules)

### 1. PostgreSQL Owns Truth — Zero Schedule Caching in Phase 1
- PostgreSQL is the sole authoritative state.
- **Phase 1 (Chunks 3.1–3.8)**: NO caching of tasks, dependencies, calendars, baselines, or schedule states.
- **Phase 2 (Chunk 3.9 only)**: Optional read-model summary cache tied strictly to `schedule_revision`.

### 2. Rigorous Date Semantics — Absolute Field Names
Never use `planned_start` or `planned_end`. Standardized field terminology:
- **Baseline Dates** (`baseline_start_date`, `baseline_finish_date`, `baseline_duration_days`): Immutable snapshot from active baseline.
- **Current Dates** (`current_start_date`, `current_finish_date`, `current_duration_days`): Authoritative operational forecast.
- **Actual Dates** (`actual_start_date`, `actual_finish_date`): Historical field fact.
- **Date Format**: Plain ISO Date strings (`YYYY-MM-DD`) in project timezone. Never store midnight UTC timestamps for calendar dates to avoid timezone date shifts.

### 3. Task Types Enum — NO Loose Booleans
Every task has `task_type`:
- `TASK`: Normal executable task (has duration, progress, assignments, cost codes).
- `MILESTONE`: Zero duration date event (`current_duration_days = 0`). Cannot have child tasks.
- `SUMMARY`: Parent container aggregating child tasks. **Cannot be directly executed, assigned, or mutated in status/progress**. Summary progress is calculated as a weighted child average.

### 4. Project Calendar First Class Abstraction
No schedule calculation assumes 1 day = 24h or Mon–Fri = working days. `ScheduleCalendarService` provides:
- `addWorkingDays(startDate, days, calendar)`
- `subtractWorkingDays(endDate, days, calendar)`
- `calculateWorkingDuration(startDate, finishDate, calendar)`
- `isWorkingDay(date, calendar)`
- `nextWorkingDate(date, calendar)`

### 5. Dependency Graph Concurrency & Project Mutation Lock
To prevent concurrent dependency insertion race conditions (where Transaction A inserts `A → B` and Transaction B inserts `B → A` simultaneously without seeing uncommitted rows), every graph mutation MUST acquire a project-scoped schedule lock:
```sql
SELECT id FROM app.projects WHERE id = :projectId AND organization_id = :orgId FOR UPDATE;
```
All cycle checks, dependency insertions, and recalculations run inside this locked transaction.

### 6. Pure, Deterministic ScheduleEngine
The calculation core MUST be a pure, DB-decoupled TypeScript engine (`ScheduleEngine` class/interface):
```ts
export interface ScheduleEngine {
  validate(graph: ScheduleGraph): ScheduleValidationResult;
  calculateSchedule(graph: ScheduleGraph): ScheduleCalculationResult;
  calculateCriticalPath(graph: ScheduleGraph): CriticalPathResult;
}
```
DB queries fetch `ScheduleGraph`, engine produces `ScheduleCalculationResult`, service applies mutations within a DB transaction.

### 7. Schedule Versioning (`schedule_revision`)
The `projects` table maintains a `schedule_revision integer NOT NULL DEFAULT 1`.
- Any schedule date recalculation worker MUST pass expected `schedule_revision`.
- If `project.schedule_revision != expectedRevision`, the worker discards the stale calculation or retries.

### 8. Synchronous Fast-Path vs Asynchronous Worker
- **Small Affected Graph (< 100 tasks)**: Calculate schedule synchronously in the HTTP request transaction.
- **Large Affected Graph (≥ 100 tasks)**: Set project `schedule_status = 'CALCULATING'`, enqueue `PROPAGATE_SCHEDULE_IMPACT` PgBoss worker, and return HTTP 202 Accepted.

### 9. Granular Capability Permissions
Capabilities added to `project.policy.ts`:
- `project.task.create`, `project.task.update`, `project.task.delete`
- `project.dependency.create`, `project.dependency.delete`
- `project.calendar.manage`
- `project.schedule.read`, `project.schedule.edit`, `project.schedule.recalculate`
- `project.baseline.create`, `project.baseline.activate`
- `project.field_log.create`, `project.field_log.submit`, `project.field_log.approve`

### 10. Task Deletion Policy — Lifetime Soft Delete
Tasks with existing dependencies, daily logs, issues, or audit history CANNOT be hard deleted. Soft delete via `status = 'CANCELLED'`. Hard deletion is allowed only for `DRAFT` tasks with zero linked references.

---

---

# CHUNK 3.1 — Task Core

**STATUS**: `DONE`

**Prerequisites**: Phase 2 complete (319 tests passing).

**Goal**: Implement `tasks` schema with explicit `task_type` (`TASK`, `MILESTONE`, `SUMMARY`), strict date semantics (`current_start_date`, `current_finish_date`), `task_code`, parent-child hierarchy rules, and soft deletion.

---

### Key Decisions

- `taskTypeEnum`: `['TASK', 'MILESTONE', 'SUMMARY']`
- `taskStatusEnum`: `['NOT_STARTED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']`
- `taskPriorityEnum`: `['LOW', 'NORMAL', 'HIGH', 'CRITICAL']`
- Hierarchy: `parentTaskId` nullable FK → `tasks.id`.
  - Rule 1: `SUMMARY` task cannot have `current_duration_days` directly set — duration is derived from min(child `current_start_date`) to max(child `current_finish_date`).
  - Rule 2: `SUMMARY` task status cannot be directly transitioned — derived from children.
  - Rule 3: `MILESTONE` task MUST have `current_duration_days = 0` and `current_start_date = current_finish_date`. Cannot have `parentTaskId` pointing to a non-summary task.
- Document links: `task_document_links` table joining `taskId` to document entities (object storage boundary). No JSONB blobs.
- Human Identifier: `taskCode` (e.g. `T-001`, `01.02.003`) + `externalReference` (for future Primavera/MS Project imports).

---

### Database Schema

**File: `packages/database/src/schema/project.schema.ts`**

```ts
export const taskTypeEnum = appSchema.enum('task_type', ['TASK', 'MILESTONE', 'SUMMARY']);
export const taskStatusEnum = appSchema.enum('task_status', ['NOT_STARTED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']);
export const taskPriorityEnum = appSchema.enum('task_priority', ['LOW', 'NORMAL', 'HIGH', 'CRITICAL']);

export const tasks = appSchema.table('tasks', {
  id:                    text('id').primaryKey(),
  organizationId:        text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  projectId:             text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  phaseId:               text('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
  parentTaskId:          text('parent_task_id'), // hierarchical link
  taskCode:              text('task_code').notNull(),
  externalReference:     text('external_reference'),
  name:                  text('name').notNull(),
  description:           text('description'),
  taskType:              taskTypeEnum('task_type').notNull().default('TASK'),
  status:                taskStatusEnum('status').notNull().default('NOT_STARTED'),
  priority:              taskPriorityEnum('priority').notNull().default('NORMAL'),
  assignedTo:            text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  subcontractorId:       text('subcontractor_id'), // FK boundary for future subcontractor module

  // Authoritative operational forecast dates
  currentStartDate:      date('current_start_date'),
  currentFinishDate:     date('current_finish_date'),
  currentDurationDays:   integer('current_duration_days').notNull().default(1),

  // Historical field facts
  actualStartDate:       date('actual_start_date'),
  actualFinishDate:      date('actual_finish_date'),

  // Calculated schedule metrics
  floatDays:             integer('float_days'),
  isCritical:            boolean('is_critical').notNull().default(false),

  progressPercent:       integer('progress_percent').notNull().default(0), // 0-100
  position:              integer('position').notNull().default(0),
  version:               integer('version').notNull().default(1),
  createdBy:             text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:             timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  uniqueIndex('tasks_project_code_unique').on(t.projectId, t.taskCode),
  uniqueIndex('tasks_id_org_unique').on(t.id, t.organizationId),
  index('tasks_project_idx').on(t.projectId),
  index('tasks_org_project_idx').on(t.organizationId, t.projectId),
  index('tasks_project_parent_idx').on(t.projectId, t.parentTaskId),
  index('tasks_project_status_idx').on(t.projectId, t.status),
  index('tasks_project_type_idx').on(t.projectId, t.taskType),
  index('tasks_project_critical_idx').on(t.projectId, t.isCritical),
  check('tasks_progress_percent_range', sql`${t.progressPercent} >= 0 AND ${t.progressPercent} <= 100`),
]);

export const taskDocumentLinks = appSchema.table('task_document_links', {
  id:             text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  projectId:      text('project_id').notNull(),
  taskId:         text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  documentId:     text('document_id').notNull(),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('task_doc_unique').on(t.taskId, t.documentId),
]);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

---

### Implementation Checklist

- [ ] Create `packages/database/src/schema/project.schema.ts` updates & run `pnpm db:generate` + `pnpm db:migrate`
- [ ] Create `apps/server/src/modules/project/task/`:
  - `task.types.ts`
  - `task.errors.ts` (`TaskNotFoundError`, `TaskModifiedError`, `InvalidTaskTypeOperationError`)
  - `task.repository.ts`
  - `task.service.ts`
  - `task.schemas.ts`
  - `task.mapper.ts`
- [ ] Implement Parent/Child Summary aggregation rules in `task.service.ts`
- [ ] Update `project.policy.ts` with `project.task.create`, `project.task.update`, `project.task.delete`
- [ ] Write integration tests in `tests/integration/task/`:
  - `task.create.test.ts`
  - `task.hierarchy.test.ts`
  - `task.lifecycle.test.ts`
- [ ] `pnpm --filter server typecheck` & tests passing

---

---

# CHUNK 3.2 — Project Schedule Calendar

**STATUS**: `DONE`

**Prerequisites**: Chunk 3.1 complete.

**Goal**: Implement `project_calendars`, `calendar_holidays`, and `calendar_exceptions` tables along with a robust `ScheduleCalendarService` to handle non-working days, weekends, custom shifts, and working day math.

---

### Key Decisions

- Working Week: standard 7-bit/object config (`monday: true`, `tuesday: true`, `wednesday: true`, `thursday: true`, `friday: true`, `saturday: false`, `sunday: false`).
- Working Hours: e.g. `8.0` hours/day.
- Calendar Exceptions: specific dates marked as `HOLIDAY` or `WORKING_OVERRIDE`.
- `ScheduleCalendarService` helper methods for calendar calculations.

---

### Database Schema

```ts
export const projectCalendars = appSchema.table('project_calendars', {
  id:             text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  projectId:      text('project_id').notNull().unique().references(() => projects.id, { onDelete: 'cascade' }),
  name:           text('name').notNull().default('Standard Construction Calendar'),
  timezone:       text('timezone').notNull().default('UTC'),
  workDays:       jsonb('work_days').$type<{
    monday: boolean; tuesday: boolean; wednesday: boolean;
    thursday: boolean; friday: boolean; saturday: boolean; sunday: boolean;
  }>().notNull(),
  hoursPerDay:    numeric('hours_per_day', { precision: 4, scale: 2 }).notNull().default('8.00'),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const calendarExceptions = appSchema.table('calendar_exceptions', {
  id:             text('id').primaryKey(),
  calendarId:     text('calendar_id').notNull().references(() => projectCalendars.id, { onDelete: 'cascade' }),
  exceptionDate:  date('exception_date').notNull(),
  isWorkingDay:   boolean('is_working_day').notNull(), // false = holiday, true = working weekend
  name:           text('name').notNull(),
}, (t) => [
  uniqueIndex('cal_exc_date_unique').on(t.calendarId, t.exceptionDate),
]);
```

---

### Implementation Checklist

- [ ] Add schema to `project.schema.ts` & run migrations
- [ ] Create `apps/server/src/modules/project/calendar/`:
  - `calendar.types.ts`
  - `calendar.service.ts` (`addWorkingDays`, `subtractWorkingDays`, `calculateWorkingDuration`, `isWorkingDay`, `nextWorkingDate`)
  - `calendar.repository.ts`
  - `calendar.routes.ts` (`GET/PATCH /projects/:projectId/calendar`, `POST/DELETE exceptions`)
- [ ] Write integration tests in `tests/integration/calendar/calendar.test.ts`
- [ ] Typecheck & tests passing

---

---

# CHUNK 3.3 — Dependency Core & Concurrency Control

**STATUS**: `DONE`

**Prerequisites**: Chunk 3.2 complete.

**Goal**: Implement `task_dependencies` with FS, SS, FF, SF types, `lagDays`, and a project-scoped lock (`SELECT ... FOR UPDATE`) during graph mutations to prevent concurrent cycle creation.

---

### Key Decisions

- Dependency types: `FS` (Finish-to-Start), `SS` (Start-to-Start), `FF` (Finish-to-Finish), `SF` (Start-to-Finish).
- Lag Days: integer (positive for lag, negative for lead).
- Concurrency Lock: `SELECT id FROM projects WHERE id = :projectId FOR UPDATE` before cycle detection and insertion.

---

### Database Schema

```ts
export const dependencyTypeEnum = appSchema.enum('dependency_type', ['FS', 'SS', 'FF', 'SF']);

export const taskDependencies = appSchema.table('task_dependencies', {
  id:             text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  projectId:      text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskId:         text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  predecessorId: text('predecessor_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  dependencyType: dependencyTypeEnum('dependency_type').notNull().default('FS'),
  lagDays:        integer('lag_days').notNull().default(0),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('task_dependencies_unique').on(t.taskId, t.predecessorId),
  index('task_dependencies_project_idx').on(t.projectId),
  check('task_dep_no_self_ref', sql`${t.taskId} != ${t.predecessorId}`),
]);
```

---

### Implementation Checklist

- [ ] Schema & migration
- [ ] Create `apps/server/src/modules/project/dependency/`:
  - `dependency.service.ts` (with `SELECT ... FOR UPDATE` project lock)
  - Recursive CTE cycle detection query
  - `dependency.repository.ts`
  - `dependency.routes.ts`
- [ ] Integration tests in `tests/integration/dependency/`:
  - `dependency.cycle.test.ts`
  - `dependency.concurrency.test.ts` (simulated concurrent transactions)
- [ ] Typecheck & tests passing

---

---

# CHUNK 3.4 — Schedule Engine & Critical Path

**STATUS**: `DONE`

**Prerequisites**: Chunk 3.3 complete.

**Goal**: Build a pure, deterministic `ScheduleEngine` subsystem for topological sorting, forward/backward pass, total float (`totalFloat <= 0` threshold for critical path), schedule constraints (`ASAP`, `SNET`, `FNLT`), and sync/async recalculation execution guarded by `schedule_revision`.

---

### Key Decisions

- Constraint types enum: `['ASAP', 'START_NO_EARLIER_THAN', 'FINISH_NO_LATER_THAN']`.
- `ScheduleValidator`: pre-flight check returning `VALID` or `INVALID` with structured errors (e.g. invalid dates, circular references).
- Engine decoupling: Pure TS calculations accepting `ScheduleGraph` + `ProjectCalendar`.
- Sync/Async threshold: If project task count < 100, calculate synchronously. Else queue PgBoss job.

---

### Implementation Checklist

- [ ] Add `constraintTypeEnum` (`ASAP`, `SNET`, `FNLT`) and `constraintDate` column to `tasks` table
- [ ] Add `scheduleRevision` column to `projects` table
- [ ] Create `apps/server/src/modules/project/engine/`:
  - `schedule.validator.ts`
  - `schedule.engine.ts` (Forward/Backward pass, float, constraints)
  - `schedule.service.ts` (Handles sync vs async queue dispatch & revision check)
- [ ] Integration tests in `tests/integration/engine/`:
  - `critical_path.test.ts`
  - `constraints.test.ts`
  - `revision_guard.test.ts`
- [ ] Typecheck & tests passing

---

---

# CHUNK 3.5 — Baselines (Immutable Snapshots)

**STATUS**: `DONE`

**Prerequisites**: Chunk 3.4 complete.

**Goal**: Implement immutable schedule baseline snapshots (`schedule_baselines`, `schedule_baseline_tasks`). Enforce baseline status lifecycle: `DRAFT → ACTIVE → SUPERSEDED`. Once active, a baseline is 100% immutable.

---

### Key Decisions

- Baseline task snapshot stores: `baseline_start_date`, `baseline_finish_date`, `baseline_duration_days`, `calendar_id`.
- Immutability rule: Active baselines cannot be updated or modified. Any schedule change requires activating a new baseline.

---

### Database Schema

```ts
export const baselineStatusEnum = appSchema.enum('baseline_status', ['DRAFT', 'ACTIVE', 'SUPERSEDED']);

export const scheduleBaselines = appSchema.table('schedule_baselines', {
  id:             text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  projectId:      text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name:           text('name').notNull(),
  description:    text('description'),
  status:         baselineStatusEnum('status').notNull().default('DRAFT'),
  activatedAt:    timestamp('activated_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const scheduleBaselineTasks = appSchema.table('schedule_baseline_tasks', {
  id:                   text('id').primaryKey(),
  baselineId:           text('baseline_id').notNull().references(() => scheduleBaselines.id, { onDelete: 'cascade' }),
  taskId:               text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  baselineStartDate:    date('baseline_start_date').notNull(),
  baselineFinishDate:   date('baseline_finish_date').notNull(),
  baselineDurationDays: integer('baseline_duration_days').notNull(),
}, (t) => [
  uniqueIndex('baseline_task_unique').on(t.baselineId, t.taskId),
]);
```

---

### Implementation Checklist

- [ ] Schema & migration
- [ ] Create `apps/server/src/modules/project/baseline/`:
  - `baseline.service.ts`
  - `baseline.repository.ts`
  - `baseline.routes.ts`
- [ ] Integration tests in `tests/integration/baseline/`:
  - `baseline.lifecycle.test.ts`
  - `baseline.immutability.test.ts`
- [ ] Typecheck & tests passing

---

---

# CHUNK 3.6 — Field Execution & Daily Logs

**STATUS**: `DONE`

**Prerequisites**: Chunk 3.5 complete.

**Goal**: Site supervisors record daily logs (`daily_field_logs`). Lifecycle: `DRAFT → SUBMITTED → LOCKED`. Locked logs are strictly immutable. Amendments create correction records. Daily logs record field facts without directly mutating the schedule.

---

### Key Decisions

- Quantities align with project unit system (`unitId` or standardized unit enum).
- Task Progress snapshot: `completionPctRecorded` records field reality. Does NOT directly rewrite task dates.

---

### Database Schema

```ts
export const fieldLogStatusEnum = appSchema.enum('field_log_status', ['DRAFT', 'SUBMITTED', 'LOCKED']);

export const dailyFieldLogs = appSchema.table('daily_field_logs', {
  id:             text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  projectId:      text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  logDate:        date('log_date').notNull(),
  supervisorId:   text('supervisor_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  status:         fieldLogStatusEnum('status').notNull().default('DRAFT'),
  notes:          text('notes'),
  lockedAt:       timestamp('locked_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const fieldLogTaskEntries = appSchema.table('field_log_task_entries', {
  id:                    text('id').primaryKey(),
  logId:                 text('log_id').notNull().references(() => dailyFieldLogs.id, { onDelete: 'cascade' }),
  taskId:                text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  completionPctRecorded: integer('completion_pct_recorded').notNull(),
  quantityCompleted:     numeric('quantity_completed', { precision: 10, scale: 2 }),
  unit:                  text('unit'),
  notes:                 text('notes'),
});
```

---

### Implementation Checklist

- [x] Schema & migration
- [x] Create `apps/server/src/modules/project/field-log/`:
  - `field-log.service.ts`
  - `field-log.repository.ts`
  - `field-log.routes.ts`
- [x] Integration tests in `tests/integration/field_log.test.ts`
- [x] Typecheck & tests passing

---

---

# CHUNK 3.7 — Exceptions & Impact Reporting

**STATUS**: `DONE`

**Prerequisites**: Chunk 3.6 complete.

**Goal**: Distinguish between calculated schedule propagation and business-reported impact. Track `reported_impact_days` vs `approved_impact_days` on issues/RFIs/change orders without prematurely altering operational task dates.

---

### Key Decisions

- Extension links for future RFI, Change Order, and Material Delay entities via `source_type` and `source_id`.

---

### Database Schema

```ts
export const issueStatusEnum = appSchema.enum('issue_status', ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

export const issues = appSchema.table('issues', {
  id:                  text('id').primaryKey(),
  organizationId:      text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  projectId:           text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title:               text('title').notNull(),
  description:         text('description'),
  status:              issueStatusEnum('status').notNull().default('OPEN'),
  reportedImpactDays:  integer('reported_impact_days').notNull().default(0),
  approvedImpactDays:  integer('approved_impact_days').notNull().default(0),
  assignedTo:          text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt:           timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

---

### Implementation Checklist

- [x] Schema & migration
- [x] Create `apps/server/src/modules/project/issue/`
- [x] Integration tests in `tests/integration/issue.test.ts`
- [x] Typecheck & tests passing

---

---

# CHUNK 3.8 — Schedule History & Domain Events

**STATUS**: `DONE`

**Prerequisites**: Chunk 3.7 complete.

**Goal**: Implement `schedule_changes` append-only audit trail with `source_type` (`USER`, `ISSUE`, `RFI`, `CHANGE_ORDER`, `MATERIAL_DELAY`, `WEATHER`, `SYSTEM_CALCULATION`), `source_id`, old vs new dates, and rich domain events.

---

### Database Schema

```ts
export const scheduleSourceTypeEnum = appSchema.enum('schedule_source_type', [
  'USER', 'ISSUE', 'RFI', 'CHANGE_ORDER', 'MATERIAL_DELAY', 'WEATHER', 'SYSTEM_CALCULATION'
]);

export const scheduleChanges = appSchema.table('schedule_changes', {
  id:                  text('id').primaryKey(),
  organizationId:      text('organization_id').notNull(),
  projectId:           text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskId:              text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  sourceType:          scheduleSourceTypeEnum('source_type').notNull(),
  sourceId:            text('source_id'),
  oldStartDate:        date('old_start_date'),
  oldFinishDate:       date('old_finish_date'),
  newStartDate:        date('new_start_date'),
  newFinishDate:       date('new_finish_date'),
  reason:              text('reason'),
  actorUserId:         text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt:           timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

---

### Implementation Checklist

- [x] Schema & migration
- [x] Create `apps/server/src/modules/project/schedule-history/`
- [x] Integration tests in `tests/integration/schedule_history.test.ts`
- [x] Typecheck & tests passing

---

---

# CHUNK 3.9 — Read Models & Revision-Tied Caching

**STATUS**: `DONE`

**Prerequisites**: Chunk 3.8 complete.

**Goal**: Build `project_schedule_metrics` materialized summary table for dashboard queries. Implement optional Redis caching tied directly to `schedule_revision` (`siteflow:v1:schedule:metrics:{projectId}:{revision}`).

---

### Database Schema

```ts
export const projectScheduleMetrics = appSchema.table('project_schedule_metrics', {
  id:                  text('id').primaryKey(),
  organizationId:      text('organization_id').notNull(),
  projectId:           text('project_id').notNull().unique().references(() => projects.id, { onDelete: 'cascade' }),
  totalTasks:          integer('total_tasks').notNull().default(0),
  completedTasks:      integer('completed_tasks').notNull().default(0),
  criticalTaskCount:   integer('critical_task_count').notNull().default(0),
  scheduleRevision:    integer('schedule_revision').notNull(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

---

### Implementation Checklist

- [x] Schema & migration
- [x] Create `apps/server/src/modules/project/schedule-metrics/`
- [x] Cache key: `siteflow:v1:schedule:metrics:{projectId}:{revision}`
- [x] Integration tests in `tests/integration/schedule_metrics.test.ts`
- [x] Typecheck & tests passing

---

---

## Final Gate — Phase 3 Complete

- [x] All chunks 3.1–3.9 STATUS set to `DONE`
- [x] `pnpm --filter server typecheck` clean
- [x] All integration tests passing
- [x] Zero caching of task status, dates, version, dependencies, or baseline state
