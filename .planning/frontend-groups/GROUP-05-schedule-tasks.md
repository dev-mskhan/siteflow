# Group 5 — Schedule, Tasks, Calendar & Baselines

**Status:** Not started  
**Priority:** 🔴 Critical — project execution core  
**Depends on:** Group 1 (project shell, phases), Group 2 (cost-codes)

---

## Backend Source Files

| File | Purpose |
|------|---------|
| `apps/server/src/modules/project/task/task.handler.ts` | All task CRUD + transition handlers |
| `apps/server/src/modules/project/task/task.service.ts` | Business logic, state machine, optimistic locking, SUMMARY rollup |
| `apps/server/src/modules/project/task/task.schemas.ts` | Re-exports from `@siteflow/shared` |
| `packages/shared/src/modules/project/task.schema.ts` | **Authoritative Zod schemas** |
| `apps/server/src/modules/project/baseline/baseline.handler.ts` | Create, activate, get, list, compare, delete |
| `apps/server/src/modules/project/baseline/baseline.service.ts` | Baseline snapshot + compare logic |
| `apps/server/src/modules/project/baseline/baseline.schemas.ts` | Input schemas |
| `apps/server/src/modules/project/calendar/calendar.handler.ts` | Get, update, add/remove exceptions |
| `apps/server/src/modules/project/calendar/calendar.schemas.ts` | Working days + exception schemas |
| `apps/server/src/modules/project/dependency/dependency.handler.ts` | Create, delete, list dependencies |
| `packages/shared/src/modules/project/dependency.schema.ts` | Dependency Zod schema |
| `apps/server/src/modules/project/schedule-history/schedule-history.handler.ts` | List project or task recalculation history |
| `apps/server/src/modules/project/schedule-metrics/schedule-metrics.handler.ts` | Get SPI/CPI/variance metrics |
| `apps/server/src/modules/project/engine/schedule.handler.ts` | POST recalculate trigger |
| `apps/server/src/modules/project/project.routes.ts` | All route registrations (lines ~340–520) |

---

## HTTP Routes

### Tasks
```
GET    /:orgId/projects/:projectId/tasks                    permission: project.task.read
POST   /:orgId/projects/:projectId/tasks                    permission: project.task.create
GET    /:orgId/projects/:projectId/tasks/:taskId            permission: project.task.read
PATCH  /:orgId/projects/:projectId/tasks/:taskId            permission: project.task.update
POST   /:orgId/projects/:projectId/tasks/:taskId/transition permission: project.task.update
DELETE /:orgId/projects/:projectId/tasks/:taskId            permission: project.task.delete
```

### Baselines
```
GET    /:orgId/projects/:projectId/baselines                permission: project.baseline.read
POST   /:orgId/projects/:projectId/baselines                permission: project.baseline.create
GET    /:orgId/projects/:projectId/baselines/:baselineId    permission: project.baseline.read
POST   /:orgId/projects/:projectId/baselines/:baselineId/activate  permission: project.baseline.activate
GET    /:orgId/projects/:projectId/baselines/:baselineId/compare   permission: project.baseline.read
DELETE /:orgId/projects/:projectId/baselines/:baselineId    permission: project.baseline.delete
```

### Calendar
```
GET    /:orgId/projects/:projectId/calendar                              permission: project:read
PATCH  /:orgId/projects/:projectId/calendar                              permission: project.calendar.manage
POST   /:orgId/projects/:projectId/calendar/exceptions                   permission: project.calendar.manage
DELETE /:orgId/projects/:projectId/calendar/exceptions/:exceptionId      permission: project.calendar.manage
```

### Dependencies
```
GET    /:orgId/projects/:projectId/dependencies             permission: project.task.read
POST   /:orgId/projects/:projectId/dependencies             permission: project.dependency.create
DELETE /:orgId/projects/:projectId/dependencies/:dependencyId permission: project.dependency.delete
```

### Schedule Engine
```
POST   /:orgId/projects/:projectId/schedule/recalculate     permission: project.schedule.recalculate
GET    /:orgId/projects/:projectId/schedule/history         permission: project:read  (query: taskId?)
GET    /:orgId/projects/:projectId/schedule/metrics         permission: project:read
```

---

## Key Schemas (from `packages/shared/src/modules/project/task.schema.ts`)

### Task types and statuses
```ts
TASK_TYPES     = ['TASK', 'MILESTONE', 'SUMMARY']
TASK_STATUSES  = ['NOT_STARTED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']
TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL']
CONSTRAINT_TYPES = ['ASAP', 'START_NO_EARLIER_THAN', 'FINISH_NO_LATER_THAN']
```

### createTaskSchema fields
```
name*           string min:1 max:255
taskCode?       string max:50  (auto-generated T-NNN if omitted)
description?    string max:2000
taskType?       TASK | MILESTONE | SUMMARY (default: TASK)
phaseId?        string
parentTaskId?   string (parent must be SUMMARY type)
priority?       LOW | NORMAL | HIGH | CRITICAL (default: NORMAL)
constraintType? ASAP | START_NO_EARLIER_THAN | FINISH_NO_LATER_THAN (default: ASAP)
constraintDate? YYYY-MM-DD
assignedTo?     userId (must be active project member)
subcontractorId? string
currentStartDate?  YYYY-MM-DD
currentFinishDate? YYYY-MM-DD
currentDurationDays? int >= 0 (MILESTONE always 0)
progressPercent? int 0-100
```

### updateTaskSchema — adds `expectedVersion: int >= 1` (optimistic locking)
Same fields as create but all optional + nullable. SUMMARY tasks cannot have dates/duration/progress set directly.

### transitionTaskStatusSchema
```
status*          enum TASK_STATUSES
expectedVersion* int >= 1
```

### listTasksQuerySchema
```
status?, priority?, taskType?, phaseId?, parentTaskId?, assignedTo?, isCritical?, search?, cursor?, limit? (max 100)
```

---

## State Machine: Tasks

```
NOT_STARTED → READY | IN_PROGRESS | CANCELLED
READY       → IN_PROGRESS | BLOCKED | CANCELLED
IN_PROGRESS → BLOCKED | COMPLETED | CANCELLED
BLOCKED     → IN_PROGRESS | READY | CANCELLED
COMPLETED   → IN_PROGRESS | CANCELLED
CANCELLED   → NOT_STARTED

Side effects:
  → IN_PROGRESS: sets actualStartDate = today if not set
  → COMPLETED:   sets actualFinishDate = today + progressPercent = 100
  SUMMARY tasks: status + dates + progress DERIVED from children (never direct transition)
```

---

## Business Rules (from task.service.ts)

1. **SUMMARY tasks**: dates, duration, progressPercent are read-only — computed from active children
2. **MILESTONE tasks**: `currentDurationDays` always 0; start = finish date
3. **Optimistic locking**: all PATCH + transition + DELETE require `expectedVersion`; conflict → 409
4. **Task codes**: auto-generated `T-NNN` if not provided; must be unique per project
5. **Parent must be SUMMARY type**: enforced at service level → 422 `INVALID_TASK_TYPE_OPERATION`
6. **assignedTo**: must be an active project member → 422 if not found
7. **Delete**: soft delete (sets status=CANCELLED); cannot delete SUMMARY with children
8. **Dependency schema** (from `packages/shared/src/modules/project/dependency.schema.ts`):
   ```
   predecessorTaskId*, successorTaskId*, dependencyType: FS|SS|FF|SF (default FS), lagDays? int
   ```

---

## Frontend Pages to Build

### 5.1 `ProjectTasksPage` — `/org/:orgId/projects/:projectId/tasks`
- Flat list view with column headers: Code | Name | Type | Phase | Status | Priority | Assignee | Start | Finish | Progress
- Filter bar: status, type, phase, assignee, search
- Inline quick-status badge click → transition modal (confirm + expectedVersion)
- "New task" inline form (name, type, phase, dates optional)
- Click row → navigate to task detail
- Status badge colors: NOT_STARTED=gray, READY=blue, IN_PROGRESS=amber, BLOCKED=red, COMPLETED=green, CANCELLED=muted
- SUMMARY row shows collapse/expand children indicator
- Permission gates: `project.task.create`, `project.task.update`, `project.task.delete`

### 5.2 `ProjectTaskDetailPage` — `.../tasks/:taskId`
- Full detail: all fields read-only by default
- Edit form (inline, not modal) — gated on `project.task.update`
- Status pipeline display for current state
- Transition actions: buttons for allowed next states
- Parent/child breadcrumb links
- Dependency list section (predecessors + successors)

### 5.3 `ProjectBaselinesPage` — `.../baselines`
- List: name, createdAt, isActive badge
- Create button → name input → POST baselines
- Each row: "Activate" button (POST .../activate), "Compare" link, "Delete" button (DEL)
- Compare view: side-by-side table of baseline dates vs current dates per task, variance column

### 5.4 `ProjectCalendarPage` — `.../calendar`
- Working days grid: Mon–Sun toggle (checkbox per day)
- Working hours start/end inputs
- Exceptions table: date, type (WORKING_DAY/NON_WORKING_DAY), description — add/remove rows
- "Recalculate schedule" button → POST .../schedule/recalculate

### 5.5 `ProjectScheduleMetricsPanel` — embedded in ProjectOverviewPage or own tab
- Read-only KPI cards: SPI, CPI, % complete, critical task count, overdue count

---

## Frontend Files to Create

```
apps/web/src/types/taskTypes.ts               (extend existing stub with full DTO)
apps/web/src/types/baselineTypes.ts
apps/web/src/types/calendarTypes.ts
apps/web/src/types/dependencyTypes.ts
apps/web/src/fixtures/task-full.fixtures.ts   (replace stub, add hierarchy)
apps/web/src/fixtures/baseline.fixtures.ts
apps/web/src/fixtures/calendar.fixtures.ts
apps/web/src/api/taskFullApi.ts               (replace stub, all endpoints)
apps/web/src/api/baselineApi.ts
apps/web/src/api/calendarApi.ts
apps/web/src/api/dependencyApi.ts
apps/web/src/pages/ProjectTasksPage.tsx
apps/web/src/pages/ProjectTaskDetailPage.tsx
apps/web/src/pages/ProjectBaselinesPage.tsx
apps/web/src/pages/ProjectCalendarPage.tsx
```

Router additions under `projects/:projectId` children:
```
{ path: 'tasks', element: <ProjectTasksPage /> }
{ path: 'tasks/:taskId', element: <ProjectTaskDetailPage /> }
{ path: 'baselines', element: <ProjectBaselinesPage /> }
{ path: 'calendar', element: <ProjectCalendarPage /> }
```

ProjectShell nav additions: **Tasks** | **Schedule** (→ baselines + calendar)

---

## Design Notes
- Follow existing theme: CSS vars `--ink/--muted/--paper/--surface-2/--hairline-2`, flat borders, `font-mono text-[9px] uppercase tracking-[0.14em]` labels
- Status badges: same inline pattern as Issues page
- No rounded corners, no shadows
- Optimistic locking errors (409) → toast "Another user updated this task. Refresh and retry."
