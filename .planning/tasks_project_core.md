# SiteFlow — Phase 2: Project Core Implementation Tasks (v2)

> **This file supersedes v1.** Updated to incorporate 17 architectural improvements
> from the final spec review. Each chunk has a STATUS field.
> Pick up from the first `NOT STARTED` or `IN PROGRESS` chunk.
>
> **Project root**: `D:/summer/agentic-ai/siteflow`
> **Server app**: `apps/server/src/`
> **Database package**: `packages/database/src/schema/`

---

## How to Read This File

1. Read the **Global Decisions** section first — always.
2. Find the first chunk whose STATUS is not `DONE`.
3. Read its **prerequisites**, then implement the checklist in order.
4. When done, flip STATUS to `DONE` and commit.

---

## Global Architectural Decisions (never skip this section)

### Authorization Model — Three Cases, Unified Policy

The old "if (!projectMember) throw Forbidden" is **banned**. Instead, every project action
routes through `projectPolicy.authorize()`, which internally resolves one of three cases:

```
Case 1 — Organization-wide privilege (org admin, org-level project:* permissions)
    → allow without project membership check

Case 2 — Project-scoped authority (user is project member with required project role)
    → check project membership + project role

Case 3 — Always deny
    → throw ForbiddenError
```

Key identity: **Project Manager on Project A must not automatically manage Project B.**

```ts
// project.policy.ts — the single authoritative decision point
projectPolicy.authorize({
  actor: request.projectCtx,         // ProjectContext (see below)
  action: 'project:update',          // capability string
})
// Throws ForbiddenError if denied. Returns void if allowed.
```

### ProjectContext — First-Class Request Concept

`ProjectContext` is the single trusted view of the current request's project scope.
It is established by the `projectContext` Fastify preHandler and set on `request.projectCtx`.
Controllers never recompute it.

```ts
// apps/server/src/modules/project/project.types.ts
export type ProjectContext = {
  organizationId: string;
  projectId: string;
  userId: string;

  // From organizationContext (already on request.orgContext):
  organizationMembership: OrganizationMembership;   // includes role + permissions
  // Project-level (may be null if user has org-level authority only):
  projectMembership: ProjectMembership | null;
};
```

`request.orgContext` (type `OrganizationContext`) is already set by the existing
`organizationContext` preHandler in `apps/server/src/modules/rbac/permission.middleware.ts`.
`request.projectCtx` is the new addition set by `projectContext` preHandler (new file).

**Middleware order for all project routes:**
```
authenticate → organizationContext → projectContext → [requireProjectPermission()] → controller
```

This pipeline serves every future module (Tasks, RFIs, Submittals, Costs, etc.).

### Data Access — Tenant Safety at Every Layer

| Rule | Detail |
|---|---|
| ALL repo methods take `organizationId` | First argument, always |
| `findByIdAndOrg(orgId, projectId)` | The canonical IDOR protection method |
| Never trust request body for `organizationId` | Always from `request.orgContext.organizationId` |
| Composite FK (DB-level IDOR protection) | `project_members`, `project_phases`, `project_cost_codes` all carry `organization_id` column and FK to `organizations(id)` |
| "No such resource" → 404 (not 403) | Never confirm existence to unauthorized callers |

### Concurrency Strategy — Two Models, Correct Scope

| Operation | Strategy | Reason |
|---|---|---|
| Lifecycle transitions | Pessimistic: `SELECT … FOR UPDATE` | State machine — exactly one transition must win |
| Metadata edits (PATCH) | Optimistic: `version` column + `WHERE version = ?` | Last-write-wins prevention |
| Optimistic conflict code | `PROJECT_MODIFIED` → HTTP 409 | Client must reload + retry |

```sql
-- Metadata update (optimistic)
UPDATE app.projects
SET name = ?, version = version + 1, updated_at = now()
WHERE id = ? AND organization_id = ? AND version = ?
-- 0 rows updated → throw ProjectModifiedError (409)
```

### Project Settings — Explicit Inheritance, Limited Scope

```
organization_settings (source of truth for org defaults)
        ↓ inherits
project_settings (nullable overrides only)
        ↓ merge at read time
Effective Project Settings (returned by API)
```

Overridable at project level (Phase 2 only — keep it small):
- `timezone`, `locale`, `dateFormat`, `timeFormat`, `unitSystem`, `weekStartsOn`

**NOT overridable at project level** (stay in org_settings):
- `fiscalYearStartMonth` — org-wide accounting period

`currency` lives on the **project row itself** (`projects.currency`), NOT in `project_settings`.
It defaults from `organization_settings.currency` at creation and becomes the stable
financial reference for all future budget/billing/procurement work.

**No `settings` JSONB column on projects.** Prefer typed columns in `project_settings`.

### Redis — Strict Non-Dependency Rule

```
PostgreSQL → authoritative source for EVERYTHING:
  project existence, membership, status, currency, financial state

Redis → optional acceleration for:
  RBAC permission cache (already exists)
  Rate limiting (already exists)
  Worker coordination (already exists)
```

**No project-entity caching in Phase 2.** No `siteflow:v1:project:*` keys yet.
PostgreSQL + proper indexes is sufficient. Add caching only when profiling shows a need.

If Redis is unavailable: all project reads/writes must succeed. No 500 errors.

### Soft Deletion — Only Where It Matters

| Entity | Deletion strategy |
|---|---|
| `projects` | NEVER delete. Use `CANCELLED` / `ARCHIVED` status |
| `project_members` | NEVER delete rows. Add `status` column: `ACTIVE` / `REMOVED` |
| `project_phases` | Add `status`: `ACTIVE` / `ARCHIVED` — not hard delete |
| `project_cost_codes` | Add `isActive boolean` — not hard delete |

Rationale: future tasks, costs, change orders, and documents will reference these entities.
Hard deleting them would break referential integrity and audit trails.

### Job Envelope — Mandatory for All Background Jobs

Every PgBoss job payload for project-related work **must** include:

```ts
// apps/server/src/modules/project/project.jobs.ts
export interface ProjectJobContext {
  organizationId: string;
  projectId?: string;
  actorUserId?: string;
  correlationId: string;
  idempotencyKey?: string;  // promoted to required for state-changing jobs
}
// Example concrete payload:
export interface ProjectCreatedPayload extends ProjectJobContext {
  projectId: string;
  projectNumber: string;
}
```

Workers must validate the envelope before doing anything. Add PROJECT_QUEUES
to `apps/server/src/lib/queue/queue.ts` → `QUEUES` constant and `JobPayloads` type,
following the exact same pattern as `AUTH_QUEUES` and `ORG_QUEUES`.

### Job Idempotency — Required, Not Optional

Workers retry. Every state-changing job must be idempotent:
- Use `idempotencyKey` (e.g., `project:{projectId}:created:{eventId}`)
- Or use the `outbox_events.id` as the deduplication key in the worker
- Worker should record processed event IDs or use UPSERT with `ON CONFLICT DO NOTHING`

### Composite FK Pattern — Selectively Applied

For important tenant-owned tables, enforce tenant relationship at DB level:

```sql
-- projects must have (id, organization_id) unique key so child tables can
-- reference both columns for composite FK enforcement
ALTER TABLE app.projects ADD UNIQUE (id, organization_id);

-- child table references both
FOREIGN KEY (project_id, organization_id)
  REFERENCES app.projects(id, organization_id)
```

Apply to: `project_members`, `project_phases`, `project_cost_codes`, `project_settings`.
This gives a database-level second line of defense against IDOR/BOLA.

### Indexes — Deliberate, Not Automatic

```
projects:
  (organization_id)                          -- tenant scan
  (organization_id, project_number) UNIQUE   -- number lookup + uniqueness
  (organization_id, status)                  -- status filter
  (organization_id, created_at)              -- cursor pagination

project_members:
  (project_id, user_id) UNIQUE               -- join key + prevents duplicates
  (organization_id, user_id)                 -- "projects user is on" query
  (project_id, status)                       -- active member filter

project_phases:
  (project_id, sort_order)                   -- ordered list
  (organization_id, project_id)              -- tenant-scoped list

project_cost_codes:
  (project_id, code) UNIQUE                  -- uniqueness enforcement
  (organization_id, project_id)              -- tenant-scoped list
  (project_id, is_active)                    -- active-only filter
```

### Observability Pattern (from existing codebase)

```ts
// Same pattern as all existing services — mandatory
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
const tracer = trace.getTracer('project-service');

async createProject(...) {
  return withSpan(tracer, 'project.createProject', async (span) => {
    span.setAttribute('organization.id', orgId);
    // ...
  });
}
```

### Existing Patterns to Reuse (do not reinvent)

| What | Where in codebase |
|---|---|
| `organizationContext` preHandler | `apps/server/src/modules/rbac/permission.middleware.ts` L13 |
| `requirePermission(perm)` factory | `apps/server/src/modules/rbac/permission.middleware.ts` L51 |
| `OrganizationContext` type | `apps/server/src/modules/rbac/rbac.types.ts` |
| `rbacCacheService.invalidate()` | `apps/server/src/modules/rbac/rbac.cache.service.ts` |
| `writeOutboxEvent(tx, event)` | `apps/server/src/lib/outbox/outbox.service.ts` |
| `auditService.log(...)` | `apps/server/src/modules/audit/audit.service.ts` |
| `generateId()` | `apps/server/src/lib/id.ts` |
| `createSuccessResponse()` | `apps/server/src/shared/response.ts` |
| `withSpan(tracer, name, fn)` | `@siteflow/observability/server` |
| `getDb()` | `apps/server/src/lib/db/db.ts` |
| `sendJob(queue, payload)` | `apps/server/src/lib/queue/queue.ts` |
| ID format | `text` (not uuid column type) — matches existing schema |
| `document_sequences` lock pattern | `apps/server/src/modules/organization/sequences/sequences.repository.ts` |
| Org settings fields to inherit | `packages/database/src/schema/org.schema.ts` L117–145 |
| `audit_logs` table shape | `packages/database/src/schema/org.schema.ts` L274–294 |

> [!NOTE] The audit_logs table has `organizationId`, `actorUserId`, `action`, `resourceType`, `resourceId`, `metadata`, `ipAddress`, `userAgent`, `createdAt`. There is NO `projectId` column currently. For project audit history (Chunk 2.6), add a `projectId` nullable column via a new mini-migration OR use `resourceType = 'Project' AND resourceId = projectId` plus `metadata.projectId` for sub-entities.

---

## State Machine Reference

```
DRAFT ──activate──► ACTIVE ──hold──► ON_HOLD ──resume──► ACTIVE
ACTIVE ──complete──► COMPLETED
DRAFT | ACTIVE | ON_HOLD ──cancel──► CANCELLED
COMPLETED | CANCELLED ──archive──► ARCHIVED
```

Encoded as `VALID_TRANSITIONS` constant (never scattered if-else chains).

---

---

# CHUNK 2.1A — Project Schema Foundation

**STATUS**: `DONE`

**Prerequisites**: None.

**Goal**: Add all project-related tables, enums, and indexes. Generate and apply Drizzle migration.

---

### Key Decisions for This Chunk

- Use `text` for IDs (matches existing schema — NOT `uuid` Drizzle column type)
- `projects` has a `version integer` column for optimistic concurrency (starts at 1)
- `project_members` has `status memberStatusEnum`-style column with `ACTIVE` / `REMOVED` (new enum)
- `project_phases` has `status` column: `ACTIVE` / `ARCHIVED` (new enum)
- `project_cost_codes` has `isActive boolean default true`
- Add `UNIQUE (id, organization_id)` on `projects` for composite FK support in child tables
- `project_settings`: carry `organizationId` column with FK; use composite FK to `projects(id, organization_id)`
- `project_members`: composite FK `(project_id, organization_id)` → `projects(id, organization_id)`
- Same composite FK pattern for `project_phases`, `project_cost_codes`
- Respect existing enum definition style: `appSchema.enum('name', [...])` from `pgSchema('app')`
- Do NOT add a `settings` JSONB column to `projects`
- `audit_logs` gets a new nullable `projectId text` column (migration adds column + index)

---

### New Enums to Define (in `project.schema.ts`)

```ts
projectStatusEnum: ['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED']
projectTypeEnum: ['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER']
projectRoleEnum: ['PROJECT_MANAGER', 'SITE_SUPERVISOR', 'PROJECT_MEMBER',
                   'FINANCE', 'PROCUREMENT', 'SUBCONTRACTOR', 'CLIENT']
projectMemberStatusEnum: ['ACTIVE', 'REMOVED']
projectPhaseStatusEnum: ['ACTIVE', 'ARCHIVED']
```

---

### Implementation Checklist

**File: `packages/database/src/schema/project.schema.ts`**

- [ ] Import `pgSchema`, `text`, `boolean`, `timestamp`, `integer`, `numeric`, `date`,
      `uniqueIndex`, `index`, `check` from `drizzle-orm/pg-core`; import `sql` from `drizzle-orm`
- [ ] Import `users` from `./auth.schema` and `organizations` from `./org.schema`
- [ ] Reference the same `appSchema = pgSchema('app')` by importing it (or re-using the pattern —
      check if `appSchema` is exported from `org.schema.ts`; if not, define it locally)
- [ ] Define all 5 enums (projectStatusEnum, projectTypeEnum, projectRoleEnum,
      projectMemberStatusEnum, projectPhaseStatusEnum)
- [ ] Define `projects` table:
  - `id: text PK`
  - `organizationId: text NOT NULL FK → organizations.id onDelete restrict`
  - `projectNumber: text NOT NULL`
  - `name: text NOT NULL`
  - `description: text nullable`
  - `status: projectStatusEnum NOT NULL default 'DRAFT'`
  - `projectType: projectTypeEnum nullable`
  - `contractValue: numeric(15,2) nullable`
  - `currency: text(3) NOT NULL` (from org at creation; stored explicitly)
  - `plannedStartDate: date nullable`
  - `plannedEndDate: date nullable`
  - `actualStartDate: date nullable`
  - `actualEndDate: date nullable`
  - `version: integer NOT NULL default 1` ← optimistic concurrency
  - `createdBy: text FK → users.id onDelete setNull`
  - `createdAt: timestamp with tz defaultNow NOT NULL`
  - `updatedAt: timestamp with tz defaultNow $onUpdate NOT NULL`
  - Indexes: `(organization_id)`, `(organization_id, status)`, `(organization_id, created_at)`
  - Unique indexes: `(organization_id, project_number)`, `(id, organization_id)` ← for composite FK
  - Check: `currency_length: char_length(currency) = 3`
- [ ] Define `project_settings` table:
  - `id: text PK`
  - `projectId: text UNIQUE FK → projects.id onDelete cascade`
  - `organizationId: text NOT NULL FK → organizations.id onDelete restrict`
  - `timezone: text nullable`
  - `locale: text nullable`
  - `dateFormat: dateFormatEnum nullable` (import enum from org.schema)
  - `timeFormat: timeFormatEnum nullable` (import enum from org.schema)
  - `unitSystem: unitSystemEnum nullable` (import enum from org.schema)
  - `weekStartsOn: integer nullable`
  - `updatedAt: timestamp with tz defaultNow $onUpdate NOT NULL`
  - Composite FK: `(project_id, organization_id)` → `projects(id, organization_id)`
  - Check: `week_starts_on_range: weekStartsOn >= 0 AND weekStartsOn <= 6` (only when not null)
- [ ] Define `project_members` table:
  - `id: text PK`
  - `projectId: text NOT NULL FK → projects.id onDelete cascade`
  - `organizationId: text NOT NULL FK → organizations.id onDelete restrict`
  - `userId: text NOT NULL FK → users.id onDelete cascade`
  - `role: projectRoleEnum NOT NULL`
  - `status: projectMemberStatusEnum NOT NULL default 'ACTIVE'`
  - `addedBy: text FK → users.id onDelete setNull`
  - `createdAt: timestamp with tz defaultNow NOT NULL`
  - `updatedAt: timestamp with tz defaultNow $onUpdate NOT NULL`
  - Unique: `(project_id, user_id)`
  - Indexes: `(organization_id, user_id)`, `(project_id, status)`
  - Composite FK: `(project_id, organization_id)` → `projects(id, organization_id)`
- [ ] Define `project_phases` table:
  - `id: text PK`
  - `projectId: text NOT NULL FK → projects.id onDelete cascade`
  - `organizationId: text NOT NULL FK → organizations.id onDelete restrict`
  - `name: text NOT NULL`
  - `description: text nullable`
  - `status: projectPhaseStatusEnum NOT NULL default 'ACTIVE'`
  - `sortOrder: integer NOT NULL default 0`
  - `startsAt: date nullable`
  - `endsAt: date nullable`
  - `createdBy: text FK → users.id onDelete setNull`
  - `createdAt: timestamp with tz defaultNow NOT NULL`
  - `updatedAt: timestamp with tz defaultNow $onUpdate NOT NULL`
  - Indexes: `(project_id, sort_order)`, `(organization_id, project_id)`
  - Composite FK: `(project_id, organization_id)` → `projects(id, organization_id)`
- [ ] Define `project_cost_codes` table:
  - `id: text PK`
  - `projectId: text NOT NULL FK → projects.id onDelete cascade`
  - `organizationId: text NOT NULL FK → organizations.id onDelete restrict`
  - `code: text NOT NULL`
  - `description: text nullable`
  - `isActive: boolean NOT NULL default true`
  - `createdBy: text FK → users.id onDelete setNull`
  - `createdAt: timestamp with tz defaultNow NOT NULL`
  - `updatedAt: timestamp with tz defaultNow $onUpdate NOT NULL`
  - Unique: `(project_id, code)`
  - Indexes: `(organization_id, project_id)`, `(project_id, is_active)`
  - Composite FK: `(project_id, organization_id)` → `projects(id, organization_id)`
- [ ] Export all Drizzle inferred types at bottom of file:
  ```ts
  export type Project = typeof projects.$inferSelect;
  export type NewProject = typeof projects.$inferInsert;
  // ... same for all tables
  ```

**File: `packages/database/src/schema/index.ts`**
- [ ] Export all new tables and types from `project.schema.ts`

**File: `packages/database/src/schema/org.schema.ts`**
- [ ] Add `projectId: text('project_id')` nullable column to `auditLogs` table definition
- [ ] Add `index('audit_logs_project_idx').on(t.projectId)` to the table's index array
- [ ] This allows project audit history queries without a UNION/metadata hack

**Migration**
- [ ] Run `pnpm --filter database generate` — review generated SQL for correctness
- [ ] Verify composite FK syntax in generated SQL
- [ ] Run `pnpm --filter database migrate` against dev DB
- [ ] Confirm in DB: `\dt app.*` shows 5 new tables; `\d app.projects` shows `version` column

---

### Test Requirements

- [ ] No app tests needed for pure schema chunk — integration tests in later chunks cover it
- [ ] Manual verification: connect to DB, run `SELECT * FROM app.projects LIMIT 0;` — confirms columns

---

---

# CHUNK 2.1B — Domain Types, Errors, Repositories, Mapper

**STATUS**: `DONE`

**Prerequisites**: Chunk 2.1A complete.

**Goal**: Build the data access layer and domain model. No HTTP yet.

---

### Files to Create

```
apps/server/src/modules/project/
├── project.types.ts
├── project.errors.ts
├── project.repository.ts
├── project-member.types.ts
├── project-member.repository.ts
├── project-settings.repository.ts
└── project.mapper.ts
```

---

### `project.errors.ts`

```ts
// Extends existing auth.errors.ts error classes
export class ProjectNotFoundError extends NotFoundError { code = 'PROJECT_NOT_FOUND' }
export class ProjectForbiddenError extends ForbiddenError { code = 'PROJECT_FORBIDDEN' }
export class ProjectConflictError extends ConflictError { code = 'PROJECT_CONFLICT' }
export class ProjectModifiedError extends ConflictError { code = 'PROJECT_MODIFIED' }  // optimistic lock
export class ProjectInvalidTransitionError extends UnprocessableError { code = 'PROJECT_INVALID_TRANSITION' }
export class ProjectLastManagerError extends UnprocessableError { code = 'PROJECT_LAST_MANAGER' }
export class ProjectMemberConflictError extends ConflictError { code = 'PROJECT_MEMBER_EXISTS' }
export class ProjectMemberNotFoundError extends NotFoundError { code = 'PROJECT_MEMBER_NOT_FOUND' }
```

---

### `project.types.ts`

```ts
// Domain types (camelCase, no DB-isms)
export type Project = { id, organizationId, projectNumber, name, description,
  status, projectType, contractValue, currency, plannedStartDate, plannedEndDate,
  actualStartDate, actualEndDate, version, createdBy, createdAt, updatedAt }

// DTO types (API response — never includes version for writes)
export type ProjectDTO = { id, projectNumber, name, description, status, projectType,
  contractValue, currency, plannedStartDate, plannedEndDate, actualStartDate,
  actualEndDate, createdBy, createdAt, updatedAt }

export type ProjectListDTO = { data: ProjectDTO[]; nextCursor: string | null }

// Input types
export type CreateProjectInput = { name, description?, projectType?, contractValue?,
  currency?, plannedStartDate?, plannedEndDate? }
export type UpdateProjectInput = { name?, description?, projectType?, contractValue?,
  plannedStartDate?, plannedEndDate?, expectedVersion: number }  // version required for PATCH

// State machine
export const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

// ProjectContext (the second middleware layer)
export type ProjectContext = {
  organizationId: string;
  projectId: string;
  userId: string;
  organizationMembership: { id: string; roleId: string; permissions: string[] };
  projectMembership: ProjectMembership | null;
};
```

---

### `project-member.types.ts`

```ts
export type ProjectMembership = { id, projectId, organizationId, userId, role, status, addedBy, createdAt, updatedAt }
export type ProjectMemberDTO = { id, userId, role, status, addedBy, createdAt }
// (join with users for display name/email — added in service layer)
export type ProjectMemberWithUser = ProjectMembership & { user: { id, firstName, lastName, email } }
```

---

### `project.repository.ts`

- [ ] `create(tx, data: NewProject): Promise<Project>`
- [ ] `findById(orgId, projectId): Promise<Project | null>`
- [ ] `findByIdOrThrow(orgId, projectId): Promise<Project>` — throws ProjectNotFoundError
- [ ] `findAll(orgId, opts: { cursor?, limit, status?, search? }): Promise<{ rows: Project[], nextCursor: string | null }>`
  - Cursor = base64 of `{ createdAt, id }` — use `createdAt < cursor.createdAt OR (createdAt = cursor.createdAt AND id < cursor.id)` for stable descending order
- [ ] `update(tx, orgId, projectId, data, expectedVersion): Promise<Project>`
  - SQL: `UPDATE … SET …, version = version + 1 WHERE id = ? AND organization_id = ? AND version = ?`
  - 0 rows → throw `ProjectModifiedError`
- [ ] `updateStatus(tx, orgId, projectId, status, extraFields?): Promise<Project>`
  - Used by lifecycle service; no version check (already under FOR UPDATE lock)
- [ ] `lockForUpdate(tx, orgId, projectId): Promise<Project>` — `SELECT … FOR UPDATE`; throws ProjectNotFoundError if not found
- [ ] `generateProjectNumber(tx, orgId): Promise<string>`
  - Lock `document_sequences` row WHERE `organization_id = ? AND type = 'PROJECT'` FOR UPDATE
  - Use existing `DocumentSequenceRepository.allocateNext()` pattern from
    `apps/server/src/modules/organization/sequences/sequences.repository.ts`
  - Returns formatted string using sequence `prefix + padding + nextValue`

---

### `project-member.repository.ts`

- [ ] `add(tx, data): Promise<ProjectMembership>`
- [ ] `findByProjectAndUser(orgId, projectId, userId): Promise<ProjectMembership | null>`
- [ ] `findActiveByProjectAndUser(orgId, projectId, userId): Promise<ProjectMembership | null>`
  — only ACTIVE status
- [ ] `findActiveMembers(orgId, projectId): Promise<ProjectMemberWithUser[]>`
  — JOIN with users table, only ACTIVE
- [ ] `updateRole(tx, orgId, projectId, userId, role): Promise<ProjectMembership>`
- [ ] `deactivate(tx, orgId, projectId, userId): Promise<void>`
  — sets status = 'REMOVED', not a hard delete
- [ ] `countActiveByRole(orgId, projectId, role): Promise<number>`
  — used for "last manager" guard

---

### `project-settings.repository.ts`

- [ ] `findByProject(orgId, projectId): Promise<ProjectSettingsRow | null>`
- [ ] `upsert(tx, orgId, projectId, data): Promise<ProjectSettingsRow>`

---

### `project.mapper.ts`

- [ ] `toProjectDomain(row: Project): ProjectDomain` — identity or minor transform
- [ ] `toProjectDTO(row: Project): ProjectDTO` — strips `version`, formats dates
- [ ] `toProjectMemberDTO(row: ProjectMemberWithUser): ProjectMemberDTO`
- [ ] `encodeCursor(row: Project): string` — base64 JSON of `{ createdAt, id }`
- [ ] `decodeCursor(cursor: string): { createdAt: string; id: string }` — safe parse

---

### Test Requirements (unit)

- [ ] `encodeCursor` / `decodeCursor` round-trip
- [ ] `VALID_TRANSITIONS` covers all 6 statuses and matches state machine diagram
- [ ] `ProjectModifiedError` is thrown when repository UPDATE returns 0 rows (mock test)

---

---

# CHUNK 2.1C — Project Service (Core)

**STATUS**: `DONE`

**Prerequisites**: Chunks 2.1A, 2.1B complete.

**Goal**: Business logic layer. Atomic project creation, read, list, update, lifecycle.

---

### Files to Create

```
apps/server/src/modules/project/
├── project.service.ts
├── project.lifecycle.service.ts   ← separate lifecycle concerns
└── project-settings.service.ts
```

---

### `project.service.ts`

**`createProject(actorUserId, orgId, input)`** — atomic transaction:
1. `getDb().transaction(async (tx) => {`
2. Generate project number: `projectRepository.generateProjectNumber(tx, orgId)`
3. Read org currency: `SELECT currency FROM organization_settings WHERE organization_id = ?`
4. Use `input.currency ?? orgCurrency` for project currency
5. INSERT project (version=1)
6. INSERT project_settings (all nulls — override-only)
7. INSERT project_member (actorUserId, role='PROJECT_MANAGER', status='ACTIVE')
8. `auditService.log({ …, projectId: project.id, resourceType: 'Project', action: 'project.created' })`
9. `writeOutboxEvent(tx, { type: 'project.created', organizationId, projectId, actorUserId, correlationId })`
10. COMMIT
- [ ] Returns `ProjectDTO` (mapped)

**`getProject(orgId, projectId): Promise<ProjectDTO>`**
- `projectRepository.findByIdOrThrow(orgId, projectId)` → map → return

**`requireProject(orgId, projectId): Promise<Project>`** ← public surface
- Same as `findByIdOrThrow`, returns domain type not DTO

**`listProjects(orgId, filters): Promise<ProjectListDTO>`**
- `projectRepository.findAll(orgId, filters)` → map each → build response

**`updateProject(actorUserId, orgId, projectId, input)`**
- Validate `expectedVersion` present in input
- `projectRepository.update(tx, orgId, projectId, data, input.expectedVersion)`
- Catches `ProjectModifiedError` and re-throws (HTTP 409 to client)
- Audit + outbox inside transaction

**`assertProjectAccess(orgId, projectId, userId, requiredRole?): Promise<void>`** ← public surface
- Load project membership for user
- If no membership: throw `ProjectForbiddenError`
- If `requiredRole` specified: check `membership.role === requiredRole`

**`getProjectSettings(orgId, projectId): Promise<EffectiveProjectSettings>`** ← public surface
- `projectSettingsRepository.findByProject(orgId, projectId)` → `orgSettingsRepository.find(orgId)`
- Merge: each field = project override ?? org default

---

### `project.lifecycle.service.ts`

**`transitionProject(actorUserId, orgId, projectId, transition)`**:
1. `getDb().transaction(async (tx) => {`
2. `project = await projectRepository.lockForUpdate(tx, orgId, projectId)` — pessimistic lock
3. Validate: `VALID_TRANSITIONS[project.status].includes(transition)` or throw `ProjectInvalidTransitionError`
4. Build `extraFields`: `activate` → sets `actualStartDate`; `complete` → sets `actualEndDate`
5. `projectRepository.updateStatus(tx, orgId, projectId, newStatus, extraFields)`
6. `auditService.log({ …, projectId, action: 'project.status_changed', metadata: { fromStatus, toStatus } })`
7. `writeOutboxEvent(tx, { type: 'project.status_changed', organizationId, projectId, fromStatus, toStatus, actorUserId, correlationId })`
8. COMMIT

---

### Test Requirements (integration)

- [ ] `createProject` → verify project, project_settings, project_member, audit_log, outbox_event rows all exist
- [ ] Currency defaults from org when not supplied; explicit currency stored when supplied
- [ ] Project number is formatted as `PRJ-0001` (prefix from sequence, padded)
- [ ] `updateProject` with correct `expectedVersion` → 200; with stale version → 409 `PROJECT_MODIFIED`
- [ ] Two concurrent `updateProject` calls → exactly one succeeds, one gets 409
- [ ] `transitionProject` DRAFT→ACTIVE → sets `actualStartDate`
- [ ] `transitionProject` ACTIVE→COMPLETED → sets `actualEndDate`
- [ ] `transitionProject` invalid (ARCHIVED→ACTIVE) → 422 `PROJECT_INVALID_TRANSITION`
- [ ] Two concurrent lifecycle transitions → FOR UPDATE ensures only one executes

---

---

# CHUNK 2.1D — Project Policy & ProjectContext Middleware

**STATUS**: `DONE`

**Prerequisites**: Chunks 2.1A, 2.1B, 2.1C complete.

**Goal**: Build the `projectContext` preHandler and `projectPolicy.authorize()`. These are the
unified authorization layer used by ALL subsequent project routes.

---

### Files to Create

```
apps/server/src/modules/project/
├── project.policy.ts
└── project.middleware.ts    ← projectContext preHandler + requireProjectPermission()
```

**Extend existing:**
```
apps/server/src/modules/rbac/rbac.types.ts   ← add ProjectContext to FastifyRequest
```

---

### `project.middleware.ts`

**`projectContext` preHandler:**
```ts
export async function projectContext(request, _reply): Promise<void> {
  // Requires: request.user (from authenticate), request.orgContext (from organizationContext)
  if (!request.orgContext) throw new ForbiddenError('Organization context required');

  const { projectId } = request.params as { projectId: string };
  if (!projectId) throw new ValidationError('Project ID missing');

  // Load project — 404 hides existence from wrong-org callers
  const project = await projectRepository.findById(request.orgContext.organizationId, projectId);
  if (!project) throw new ProjectNotFoundError();

  // Tenant boundary: project must belong to request's org
  // (already enforced by findById scoping, but be explicit)
  if (project.organizationId !== request.orgContext.organizationId) {
    throw new ProjectNotFoundError();  // NOT ForbiddenError — don't leak existence
  }

  // Load project membership (may be null — org admins don't need project membership)
  const projectMembership = await projectMemberRepository.findActiveByProjectAndUser(
    request.orgContext.organizationId, projectId, request.orgContext.userId,
  );

  request.projectCtx = {
    organizationId: request.orgContext.organizationId,
    projectId,
    userId: request.orgContext.userId,
    organizationMembership: {
      id: request.orgContext.membershipId,
      roleId: request.orgContext.roleId,
      permissions: request.orgContext.permissions,
    },
    projectMembership,
  };
}
```

**`requireProjectPermission(action)` factory:**
```ts
export function requireProjectPermission(action: string) {
  return async function projectPermissionGuard(request, _reply): Promise<void> {
    if (!request.projectCtx) throw new ForbiddenError('Project context not established');
    projectPolicy.authorize({ actor: request.projectCtx, action });
    // authorize() throws ForbiddenError internally if denied; returns void if allowed
  };
}
```

**Extend `rbac.types.ts`:**
```ts
declare module 'fastify' {
  interface FastifyRequest {
    orgContext?: OrganizationContext;
    projectCtx?: ProjectContext;   // ← add this
  }
}
```

---

### `project.policy.ts`

```ts
// The three authorization cases for every project action
export const projectPolicy = {
  authorize({ actor, action }: { actor: ProjectContext; action: string }): void {
    // Case 1: org-level authority (org admin or global project permission)
    if (hasOrgLevelAuthority(actor, action)) return;

    // Case 2: project-scoped authority (membership + role)
    if (hasProjectLevelAuthority(actor, action)) return;

    // Case 3: deny
    throw new ProjectForbiddenError(`Missing authority for action: ${action}`);
  }
};

// Org-level authority grants:
//   project:read:any  → all read operations
//   project:write:any → all write operations
//   project:admin     → everything including member management
// These map to org RBAC permissions (strings in request.orgContext.permissions)
function hasOrgLevelAuthority(actor: ProjectContext, action: string): boolean { ... }

// Project-level authority:
//   Read: any ACTIVE project member
//   Update metadata: PROJECT_MANAGER, SITE_SUPERVISOR
//   Lifecycle: PROJECT_MANAGER only
//   Member management: PROJECT_MANAGER only
//   Settings: PROJECT_MANAGER only
//   Phase/cost-code management: PROJECT_MANAGER, FINANCE
function hasProjectLevelAuthority(actor: ProjectContext, action: string): boolean {
  const membership = actor.projectMembership;
  if (!membership || membership.status !== 'ACTIVE') return false;
  return PROJECT_ROLE_CAPABILITIES[membership.role]?.includes(action) ?? false;
}

// Capability map — clear, auditable
const PROJECT_ROLE_CAPABILITIES: Record<ProjectRole, string[]> = {
  PROJECT_MANAGER: ['project:read', 'project:update', 'project:lifecycle',
                    'project:member:manage', 'project:settings:update',
                    'project:phase:manage', 'project:cost-code:manage', 'project:audit:read'],
  SITE_SUPERVISOR: ['project:read', 'project:update', 'project:phase:manage'],
  PROJECT_MEMBER:  ['project:read'],
  FINANCE:         ['project:read', 'project:cost-code:manage'],
  PROCUREMENT:     ['project:read'],
  SUBCONTRACTOR:   ['project:read'],
  CLIENT:          ['project:read'],
};
```

---

### Test Requirements

- [ ] Org admin with `project:admin` permission → authorized for all actions without project membership
- [ ] `PROJECT_MANAGER` on Project A → authorized for Project A `project:lifecycle`
- [ ] `PROJECT_MANAGER` on Project A → NOT authorized for Project B (separate `projectCtx`)
- [ ] `PROJECT_MEMBER` → can `project:read`; cannot `project:update`; 403 returned
- [ ] User with no project membership AND no org-level permission → 403
- [ ] `projectContext` middleware: wrong-org `projectId` → 404 (not 403)
- [ ] Concurrent requests: `projectCtx` is request-scoped (no shared state)

---

---

# CHUNK 2.1E — Project API Routes (CRUD + Lifecycle)

**STATUS**: `DONE`

**Prerequisites**: Chunks 2.1A through 2.1D complete.

**Goal**: HTTP layer — routes, handlers, Fastify schemas for project CRUD and all 6 lifecycle transitions.

---

### CRUD Endpoints

```
POST   /api/v1/organizations/:organizationId/projects                   → 201
GET    /api/v1/organizations/:organizationId/projects                   → 200 (cursor paginated)
GET    /api/v1/organizations/:organizationId/projects/:projectId        → 200
PATCH  /api/v1/organizations/:organizationId/projects/:projectId        → 200
```

### Lifecycle Endpoints

```
POST   /api/v1/organizations/:organizationId/projects/:projectId/activate  → 200
POST   /api/v1/organizations/:organizationId/projects/:projectId/hold      → 200
POST   /api/v1/organizations/:organizationId/projects/:projectId/resume    → 200
POST   /api/v1/organizations/:organizationId/projects/:projectId/complete  → 200
POST   /api/v1/organizations/:organizationId/projects/:projectId/cancel    → 200
POST   /api/v1/organizations/:organizationId/projects/:projectId/archive   → 200
```

---

### Files to Create

```
apps/server/src/modules/project/
├── project.routes.ts
├── project.handler.ts
├── project.schemas.ts            # Zod body/query validation
├── docs/
│   └── project.api.schemas.ts   # Fastify JSON Schema (serializer + OpenAPI)
└── index.ts                     # Public surface exports only
```

---

### Implementation Checklist

**`project.schemas.ts`** (Zod — input validation)
- [ ] `createProjectSchema`: name (required, min 1), description?, projectType?, contractValue?, currency? (3-char), plannedStartDate?, plannedEndDate?
- [ ] `updateProjectSchema`: all optional, no status field allowed, `expectedVersion: z.number().int().positive()` REQUIRED
- [ ] `listProjectsQuerySchema`: cursor (string?), limit (1–100 default 20), status?, search?
- [ ] `lifecycleParamSchema`: organizationId uuid, projectId uuid

**`docs/project.api.schemas.ts`** (Fastify JSON Schema)
- [ ] `projectDTOSchema`: all ProjectDTO fields explicitly declared (serializer will strip undeclared fields)
- [ ] `projectResponseSchema`: `{ data: projectDTOSchema, meta: metaSchema }` (use `additionalProperties: true` on meta)
- [ ] `projectListResponseSchema`: `{ data: [projectDTOSchema], nextCursor: { type: ['string', 'null'] }, meta: metaSchema }`
- [ ] Lifecycle response schema: same as `projectResponseSchema` (returns updated project)
- [ ] Error schemas: 400, 403, 404, 409, 422

**`project.handler.ts`**
- [ ] `handleCreateProject` — parse body with `createProjectSchema`, call service, 201
- [ ] `handleListProjects` — parse query, call service, 200
- [ ] `handleGetProject` — call service, 200
- [ ] `handleUpdateProject` — parse body, call service, 200. Catch `ProjectModifiedError` → 409
- [ ] `handleTransition(transition)` — factory: `(req, rep) => service.transitionProject(..., transition)`, 200

**`project.routes.ts`**
- [ ] CRUD routes: preHandlers = `[authenticate, organizationContext]`
  - POST (create): add `requirePermission('project:create')` before controller
  - GET list: add `requirePermission('project:read')` (or keep open to any org member?)
  - GET one: add `projectContext` + `requireProjectPermission('project:read')`
  - PATCH: add `projectContext` + `requireProjectPermission('project:update')`
- [ ] Lifecycle routes: preHandlers = `[authenticate, organizationContext, projectContext, requireProjectPermission('project:lifecycle')]`
- [ ] Register module in `apps/server/src/app/index.ts` under `/api/v1/organizations`

**`index.ts`** (public surface — future modules import from here only)
```ts
export { projectService } from './project.service.js';
// Exposed methods: getProject, requireProject, assertProjectAccess, getProjectSettings
```

---

### Test Requirements

- [ ] `POST /projects` → 201, all DTO fields present (none stripped by serializer)
- [ ] `POST /projects` → project number format `PRJ-0001`
- [ ] `POST /projects` → currency from org when not in body
- [ ] `POST /projects` missing name → 400
- [ ] `POST /projects` non-member of org → 401 or 403
- [ ] `GET /projects` → 200, `data` array, `nextCursor` field present (null on last page)
- [ ] `GET /projects?status=ACTIVE` → filters correctly
- [ ] `GET /projects/:id` → 200 full DTO
- [ ] `GET /projects/:id` wrong org → 404 (IDOR)
- [ ] `PATCH /projects/:id` with correct `expectedVersion` → 200
- [ ] `PATCH /projects/:id` with stale `expectedVersion` → 409 `PROJECT_MODIFIED`
- [ ] `PATCH /projects/:id` with `status` in body → 400 (Zod rejects)
- [ ] `POST /projects/:id/activate` DRAFT project → 200, status = ACTIVE
- [ ] `POST /projects/:id/activate` already ACTIVE → 422 `PROJECT_INVALID_TRANSITION`
- [ ] `POST /projects/:id/archive` ACTIVE project (invalid) → 422
- [ ] All lifecycle endpoints: `PROJECT_MEMBER` role → 403

---

---

# CHUNK 2.2 — Project Members

**STATUS**: `DONE`

**Prerequisites**: Chunks 2.1A through 2.1E complete.

**Goal**: Member management CRUD + guards + cache invalidation.

---

### Endpoints

```
GET    /api/v1/organizations/:orgId/projects/:projectId/members
POST   /api/v1/organizations/:orgId/projects/:projectId/members
PATCH  /api/v1/organizations/:orgId/projects/:projectId/members/:userId
DELETE /api/v1/organizations/:orgId/projects/:projectId/members/:userId
```

---

### Files to Create

```
apps/server/src/modules/project/
├── project-member.service.ts
└── project-member.schemas.ts
(extend project.routes.ts and project.handler.ts)
```

---

### `project-member.service.ts`

**`addProjectMember(actorUserId, orgId, projectId, targetUserId, role)`**:
1. Verify target is ACTIVE org member (`rbacService.getOrganizationContext(orgId, targetUserId)`)
   - If throws → user is not org member → 422 (not 403)
2. Check `findByProjectAndUser(orgId, projectId, targetUserId)`:
   - If ACTIVE row exists → throw `ProjectMemberConflictError` (409)
   - If REMOVED row exists → reactivate it (UPDATE status='ACTIVE', role=role)
   - If no row → INSERT new member
3. Inside transaction: member upsert → audit → outbox event
4. `rbacCacheService.invalidate(orgId, targetUserId)` after commit

**`updateMemberRole(actorUserId, orgId, projectId, targetUserId, newRole)`**:
1. Last-PM guard: if target is `PROJECT_MANAGER` AND `newRole !== 'PROJECT_MANAGER'` →
   count remaining active PMs → if would drop to 0 → throw `ProjectLastManagerError`
2. UPDATE role in transaction → audit → outbox
3. `rbacCacheService.invalidate(orgId, targetUserId)`

**`removeProjectMember(actorUserId, orgId, projectId, targetUserId)`**:
1. Last-PM guard: if target is `PROJECT_MANAGER` →
   count remaining active PMs after removal → if 0 → throw `ProjectLastManagerError`
2. `projectMemberRepository.deactivate(tx, ...)` — sets status='REMOVED', NOT a delete
3. Audit + outbox inside transaction
4. `rbacCacheService.invalidate(orgId, targetUserId)`

**`listProjectMembers(orgId, projectId)`**:
- `projectMemberRepository.findActiveMembers(orgId, projectId)`
- Returns array of `ProjectMemberDTO` with user display info

---

### Outbox Events

```ts
{ type: 'project.member_added',        organizationId, projectId, targetUserId, role, actorUserId, correlationId }
{ type: 'project.member_role_changed', organizationId, projectId, targetUserId, fromRole, toRole, actorUserId, correlationId }
{ type: 'project.member_removed',      organizationId, projectId, targetUserId, actorUserId, correlationId }
```

---

### Test Requirements

- [ ] Add member → 201, appears in list
- [ ] Add duplicate active member → 409
- [ ] Add non-org-member → 422
- [ ] Add removed member → reactivates them
- [ ] Update role of last PM → 422 `PROJECT_LAST_MANAGER`
- [ ] Remove last PM → 422 `PROJECT_LAST_MANAGER`
- [ ] Remove member → status=REMOVED in DB; 404 if you GET that userId from members list
- [ ] `rbacCacheService.invalidate` called with correct `(orgId, userId)` on role change (spy)
- [ ] Only PROJECT_MANAGER or org admin can add/update/remove members → 403 otherwise
- [ ] Audit log row written for add, role-change, remove
- [ ] Outbox event written for add, role-change, remove

---

---

# CHUNK 2.3 — Project Settings

**STATUS**: `DONE`

**Prerequisites**: Chunks 2.1A, 2.1B, 2.1C complete (project_settings table + org settings exist).

**Goal**: Expose and update effective settings. No caching in Phase 2.

---

### Endpoints

```
GET   /api/v1/organizations/:orgId/projects/:projectId/settings
PATCH /api/v1/organizations/:orgId/projects/:projectId/settings
```

---

### Effective Settings Logic

```ts
// Overridable fields only (from spec):
const effective: EffectiveProjectSettings = {
  timezone:      project.timezone     ?? org.timezone,
  locale:        project.locale       ?? org.locale,
  dateFormat:    project.dateFormat   ?? org.dateFormat,
  timeFormat:    project.timeFormat   ?? org.timeFormat,
  unitSystem:    project.unitSystem   ?? org.unitSystem,
  weekStartsOn:  project.weekStartsOn ?? org.weekStartsOn,
  // currency lives on project row, not in settings
  currency:      project_row.currency,
};
```

---

### Files to Create/Extend

```
apps/server/src/modules/project/
└── project-settings.schemas.ts   (Zod for PATCH)
(extend project.routes.ts, project.handler.ts, project-settings.repository.ts already done in 2.1B)
```

---

### Implementation Checklist

- [ ] `project-settings.service.ts`:
  - `getEffectiveSettings(orgId, projectId): Promise<EffectiveProjectSettings>`
  - `updateProjectSettings(actorUserId, orgId, projectId, input)`: validate → upsert → audit
- [ ] `project-settings.schemas.ts`: Zod schema (all 6 fields optional)
- [ ] GET handler: call service, merge, return DTO
- [ ] PATCH handler: validate body, call service, return updated effective settings
- [ ] `getProjectSettings()` exported from `modules/project/index.ts`

---

### Test Requirements

- [ ] GET settings: returns org default when no project override
- [ ] GET settings: project override takes precedence field-by-field
- [ ] PATCH settings: subsequent GET reflects update
- [ ] PATCH settings with `weekStartsOn: 7` → 400 (Zod rejects out-of-range)
- [ ] Non-PM cannot PATCH settings → 403
- [ ] Audit log written on PATCH

---

---

# CHUNK 2.4 — Project Phases

**STATUS**: `DONE`

**Prerequisites**: Chunk 2.1A complete.

**Goal**: CRUD + sort-order management for project phases.

---

### Endpoints

```
GET    /api/v1/organizations/:orgId/projects/:projectId/phases
POST   /api/v1/organizations/:orgId/projects/:projectId/phases
PATCH  /api/v1/organizations/:orgId/projects/:projectId/phases/:phaseId
DELETE /api/v1/organizations/:orgId/projects/:projectId/phases/:phaseId  → ARCHIVE not delete
POST   /api/v1/organizations/:orgId/projects/:projectId/phases/reorder
```

---

### Key Rules

- Phases list: order by `sort_order ASC`, only `ACTIVE` phases in normal list
- Create: `sortOrder = max(existing sortOrders) + 1` (or 0 if first)
- "Delete" = set `status = 'ARCHIVED'` — never hard delete
- Reorder: body `{ orderedIds: string[] }` → validate all belong to project + org → batch UPDATE sortOrder in transaction
- IDOR: phase from wrong project → 404; phase from wrong org → 404

---

### Files to Create

```
apps/server/src/modules/project/
├── project-phase.repository.ts
├── project-phase.service.ts
└── project-phase.schemas.ts
(extend routes + handler)
```

---

### Implementation Checklist

- [ ] Repository: `create`, `findAll(orgId, projectId, includeArchived?)`, `findById(orgId, projectId, phaseId)`, `update`, `archive` (status=ARCHIVED), `batchUpdateSortOrder(tx, [{ id, sortOrder }])`
- [ ] Service: `createPhase`, `listPhases`, `updatePhase`, `archivePhase`, `reorderPhases`
  - Each mutating op: transaction → audit → (no outbox required for phases)
- [ ] Routes: GET/POST/PATCH/DELETE(→archive)/POST reorder
  - All behind `projectContext` + `requireProjectPermission('project:phase:manage')` except GET (read)
- [ ] Zod schemas for create/update/reorder body

---

### Test Requirements

- [ ] Create phase → sortOrder auto-increments correctly
- [ ] List phases → ordered by sortOrder, ARCHIVED excluded by default
- [ ] Reorder → subsequent list reflects new order
- [ ] Archive phase → no longer in active list; DB row status = ARCHIVED
- [ ] Phase from different project → 404
- [ ] Phase from different org → 404
- [ ] Non-PM cannot create/update/archive/reorder → 403
- [ ] Reorder with IDs from different project → 422
- [ ] Audit log written on create/update/archive

---

---

# CHUNK 2.5 — Project Cost-Code Foundation

**STATUS**: `DONE`

**Prerequisites**: Chunk 2.1A complete.

**Goal**: CRUD for cost codes with project-scoped uniqueness, soft deactivation.

---

### Endpoints

```
GET    /api/v1/organizations/:orgId/projects/:projectId/cost-codes
POST   /api/v1/organizations/:orgId/projects/:projectId/cost-codes
PATCH  /api/v1/organizations/:orgId/projects/:projectId/cost-codes/:codeId
DELETE /api/v1/organizations/:orgId/projects/:projectId/cost-codes/:codeId  → sets isActive=false
```

---

### Key Rules

- `code` must match `/^[A-Z0-9\-]{1,50}$/` — uppercase, alphanumeric, hyphens only
- Service uppercases `code` before insert
- Duplicate `code` in same project → DB constraint violation → catch → `ProjectConflictError` (409)
- Same `code` in different project → allowed (uniqueness is project-scoped)
- "Delete" = `isActive = false` — never hard delete (future line items will reference cost codes)
- Normal list excludes `isActive = false` entries (add query param `?includeInactive=true` for admin views)

---

### Files to Create

```
apps/server/src/modules/project/
├── project-cost-code.repository.ts
├── project-cost-code.service.ts
└── project-cost-code.schemas.ts
(extend routes + handler)
```

---

### Implementation Checklist

- [ ] Repository: `create`, `findAll(orgId, projectId, includeInactive?)`, `findById(orgId, projectId, codeId)`, `update`, `deactivate` (isActive=false)
- [ ] Service: `createCostCode` (uppercase + duplicate handling), `listCostCodes`, `updateCostCode`, `deactivateCostCode`
  - transaction → audit on all mutations
- [ ] Zod schemas: code format validation

---

### Test Requirements

- [ ] Create cost code → 201, appears in list
- [ ] Duplicate code in same project → 409
- [ ] Same code in different project → 201
- [ ] IDOR: cost code from different project → 404
- [ ] IDOR: cost code from different org → 404
- [ ] Deactivate → code no longer in default list; `includeInactive=true` shows it
- [ ] Only PROJECT_MANAGER, FINANCE can create/update/deactivate → others 403
- [ ] Audit log written on create/update/deactivate

---

---

# CHUNK 2.6 — Project Audit History

**STATUS**: `DONE`

**Prerequisites**: All chunks 2.1A–2.5 complete (audit rows must be written throughout).

**Goal**: Paginated, filterable audit history endpoint scoped to a project.

---

### Endpoint

```
GET /api/v1/organizations/:orgId/projects/:projectId/audit
```

---

### Key Rules

- Reads from `audit_logs` WHERE `organization_id = ? AND project_id = ?`
  (uses the `projectId` column added to `audit_logs` in Chunk 2.1A)
- Filters: `resourceType`, `actorUserId`, `dateFrom`, `dateTo`, `action`
- Cursor pagination on `created_at DESC` + `id`
- Authorization: PROJECT_MANAGER or org-level `project:audit:read` permission
- **Do not** expose org-wide audit logs here — strictly project-scoped

---

### Files to Create

```
apps/server/src/modules/project/
└── project-audit.repository.ts
(extend project.routes.ts and project.handler.ts)
```

---

### Implementation Checklist

- [ ] `project-audit.repository.ts`:
  - `findByProject(orgId, projectId, filters, cursor, limit)` — query `audit_logs` with `project_id = ?` AND `organization_id = ?`
  - Return `{ rows: AuditLog[], nextCursor: string | null }`
- [ ] Service method: `getProjectAuditHistory(actor, orgId, projectId, filters)` — policy check → repo call → map
- [ ] Handler + route + Fastify response schema

---

### Audit Log Consistency Check

Verify that all prior chunks write to `audit_logs` with:
- `organizationId` always set
- `projectId` always set (new column from Chunk 2.1A)
- `resourceType`: `'Project'`, `'ProjectMember'`, `'ProjectPhase'`, `'ProjectCostCode'`, `'ProjectSettings'`
- `action`: namespaced strings like `'project.created'`, `'project.status_changed'`, `'project.member.added'`, etc.

---

### Test Requirements

- [ ] Returns audit entries for project creation, status changes, member add/remove, settings update, phase ops, cost-code ops
- [ ] Cursor pagination correct across two pages
- [ ] `resourceType` filter works
- [ ] `dateFrom` / `dateTo` filter works
- [ ] `actorUserId` filter works
- [ ] Non-PM (e.g., PROJECT_MEMBER) cannot access audit → 403
- [ ] Org admin with `project:audit:read` CAN access audit
- [ ] IDOR: audit for project in different org → 404

---

---

# CHUNK 2.7 — Background Jobs & Worker Registration

**STATUS**: `DONE`

**Prerequisites**: Chunks 2.1C–2.1E complete (outbox events being written).

**Goal**: Register workers that consume project outbox events. Add PROJECT_QUEUES to queue registry.
Enforce job envelope and idempotency.

---

### Files to Create/Modify

```
apps/server/src/modules/project/
└── project.jobs.ts         # job types, queue names, payload interfaces

apps/server/src/lib/queue/queue.ts
  → add PROJECT_QUEUES and payload types

apps/server/src/worker.ts
  → register project workers
```

---

### Implementation Checklist

**`project.jobs.ts`**:
- [ ] Define `PROJECT_QUEUES` object with queue names
- [ ] Define `ProjectJobContext` interface (mandatory envelope with `organizationId`, `correlationId`, etc.)
- [ ] Define typed payloads: `ProjectCreatedPayload`, `ProjectStatusChangedPayload`, `ProjectMemberChangedPayload`

**`queue.ts`**:
- [ ] Add `...PROJECT_QUEUES` to `QUEUES` constant
- [ ] Add payload types to `JobPayloads` union

**Worker implementations**:
- [ ] `onProjectCreated` worker: validate envelope → send welcome/notification email (placeholder logic)
  - Idempotency: check if already processed by key `project:created:{projectId}`
- [ ] `onProjectStatusChanged` worker: validate envelope → log + notify (placeholder)
- [ ] Register in `worker.ts` alongside existing `registerAuthWorkers` and `registerOrgWorkers`

---

### Test Requirements

- [ ] Worker receives `ProjectCreatedPayload` with required envelope fields
- [ ] Missing `organizationId` in payload → worker rejects (does not process)
- [ ] Duplicate event (same `idempotencyKey`) → worker skips gracefully
- [ ] Worker failure → outbox retries (existing outbox retry mechanism handles this)

---

---

# FINAL GATE — Phase 2 Completion Criteria

**STATUS**: `DONE`

**Prerequisites**: All chunks 2.1A through 2.7 complete.

**Exit Condition**: An organization can securely create and manage projects.

---

### Code Quality

- [ ] `pnpm --filter server lint` → zero errors
- [ ] `pnpm --filter server typecheck` → zero errors
- [ ] `pnpm --filter server build` → zero builds
- [ ] Zero `any` without a justification comment

### Authorization Coverage

- [ ] Org admin → cross-project access works for all read/write operations
- [ ] PM on Project A → cannot access Project B (every endpoint tested)
- [ ] Every project endpoint has at least one 403 test for insufficient permission
- [ ] No endpoint allows status mutation via PATCH body
- [ ] "Last PM" guard enforced on both role-change AND member removal

### Concurrency

- [ ] Two concurrent `PATCH /projects/:id` with same `expectedVersion` → only one succeeds, other gets 409
- [ ] Two concurrent lifecycle transitions → FOR UPDATE ensures only one executes (no double transition)

### IDOR / Tenant Isolation

- [ ] User from Org A cannot read/write any resource from Org B (all 5 resource types tested)
- [ ] Wrong `projectId` in correct org → 404 for all endpoints
- [ ] Composite FK constraint tested: attempt to insert project_member with mismatched `organizationId` → DB rejects

### Data Integrity

- [ ] Project creation: all 4 records in one transaction (project, settings, member, audit, outbox) — verify atomicity by simulating failure mid-transaction
- [ ] Project deletion: zero hard deletes in project module — all use status/isActive
- [ ] `audit_logs.project_id` populated for all project-related audit entries

### Regression

- [ ] All 294 existing tests still pass: `pnpm --filter server test tests/integration/`
- [ ] New tests: `pnpm --filter server test tests/integration/project_*.test.ts`

### Observability

- [ ] `withSpan(tracer, 'project.*', ...)` on all service and lifecycle service methods
- [ ] Structured logs on create, transition, error, and member change

### Public Interface Verification

```ts
// modules/project/index.ts must export ONLY:
export { projectService } from './project.service.js';
// projectService.getProject()
// projectService.requireProject()
// projectService.assertProjectAccess()
// projectService.getProjectSettings()
// NO other internal classes/repos/types exported
```

### What We Did NOT Build (intentional)

```
❌ Generic workflow engine
❌ Generic approval engine
❌ Generic settings JSON column
❌ Event sourcing / CQRS
❌ Separate project microservice
❌ Multi-currency accounting engine
❌ Configurable project-role designer
❌ Project entity caching in Redis
❌ Second queue/event architecture
```

---

*Last updated: 2026-09-26 v2 | Status: update each chunk STATUS field as work progresses (NOT STARTED → IN PROGRESS → DONE)*
