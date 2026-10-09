# SiteFlow — Phase C: Partners & Procurement

# Task Execution File (v2 — Architecture-corrected)

> **Depends on:** Phase 2 (Project Core) + Phase 3 (Schedule Execution Core) — both DONE
> **Next migration starts at:** 0015
> **Project root:** `D:/summer/agentic-ai/siteflow`
> **Server app:** `apps/server/src/`
> **Database schema:** `packages/database/src/schema/project.schema.ts`

---

## How to Read This File

1. Read the **Existing Infrastructure** and **Global Rules** sections first — always.
2. Find the first chunk whose STATUS is `NOT STARTED`.
3. Implement its checklist top-to-bottom.
4. Flip STATUS to `DONE` and commit before starting the next chunk.
5. Every chunk must pass its quality gate (typecheck + tests green) before proceeding.

---

## Implementation Order

```
C.1  Subcontractors
C.2  Suppliers
C.3  Materials
C.4  Document Number Allocator  ← new prerequisite chunk
C.5  Material Requests
C.6  Quotes
C.7  Approvals
C.8  Purchase Ordersu
C.9  Committed Cost             ← immediately after PO; does not require inventory
  
C.10 Deliveries & Receipts
C.11 Inventory Transactions
C.12 Supplier/Partner Performance History
```

Committed cost (C.9) follows PO (C.8) directly — it does not depend on inventory. Inventory (C.11) follows receipts (C.10). Performance (C.12) derives from C.8/C.10/C.11/C.1.

---

## Existing Infrastructure — DO NOT Recreate

### ORM: Drizzle (not Prisma)

All new tables go in `packages/database/src/schema/project.schema.ts` (auto-exported via the barrel). If a separate `procurement.schema.ts` is created, add its barrel export to `packages/database/src/schema/index.ts`.

### Column conventions — match exactly what exists in `project.schema.ts`

- IDs: `text('id').primaryKey()` — values from `generateId()` in `apps/server/src/lib/id.ts`
- Money: `numeric('col', { precision: 15, scale: 2 })` — matching `contractValue` on `projects`
- Quantity: `numeric('col', { precision: 15, scale: 3 })`
- Timestamps: `timestamp('col', { withTimezone: true }).defaultNow().notNull()`
- `updatedAt`: `.$onUpdate(() => new Date())`
- Calendar dates: `date('col')` — ISO YYYY-MM-DD strings only
- Enums: `appSchema.enum('enum_name', [...])` — `appSchema` from `'./auth.schema'`
- Tables: `appSchema.table('name', ...)` — all land in the `app` PostgreSQL schema

### Money arithmetic rule (global)

**Never use JavaScript floating-point arithmetic for authoritative monetary totals.**
All calculations (`quantity × unitPrice`, line totals, document totals) must use the `decimal.js` library or equivalent in the service layer, or push the calculation to PostgreSQL SQL expressions. Store exact `numeric(15,2)` results. This rule applies to every chunk.

### Auth + RBAC pipeline

```
authenticate              → apps/server/src/modules/auth/auth.middleware.ts
organizationContext       → apps/server/src/modules/rbac/permission.middleware.ts
requirePermission(...)    → org-level capability check
projectContext            → apps/server/src/modules/project/core/project.middleware.ts
requireProjectPermission  → project-scoped capability check
```

- Collection routes (org-level): `requirePermission('capability')`
- Project-item routes: `requireProjectPermission('capability')` inside `projectScoped` in `project.routes.ts`

### Capability strings

Dot-separated format matching Phase 3: `'project.subcontractor.read'`, `'project.purchase_order.approve'`.
Add every new capability to **both** `PROJECT_ROLE_CAPABILITIES` **and** `ORG_LEVEL_AUTHORITY_MAP` in `core/project.policy.ts`.

### Existing project roles

`projectRoleEnum`: `PROJECT_MANAGER`, `SITE_SUPERVISOR`, `PROJECT_MEMBER`, `FINANCE`, `PROCUREMENT`, `SUBCONTRACTOR`, `CLIENT`.
`PROCUREMENT` role must receive all procurement capabilities in Phase C.

### Service pattern — copy from `issue.service.ts`

```ts
export class XxxService {
  constructor(private repo = new XxxRepository()) {}
  private get db() { return getDb(); }
  async createXxx(...): Promise<XxxDTO> {
    return withSpan(tracer, 'xxx.create', async (span) => {
      return this.db.transaction(async (tx) => {
        const id = generateId();
        const row = await this.repo.create(tx as any, { id, ... });
        await auditService.log({ organizationId, actorUserId, action: 'xxx.created',
          resourceType: 'Xxx', resourceId: id, metadata: { projectId } }, tx);
        return toXxxDTO(row);
      });
    });
  }
}
```

### Repository pattern — copy from `issue.repository.ts`

Class-based; `db: any` as first parameter (supports both tx and non-tx). Import table + inferred type from `@siteflow/database/schema`. Use `.returning()` on inserts/updates.

### Outbox / domain events

`writeOutboxEvent(tx, eventType, payload, organizationId?)` from `apps/server/src/lib/outbox/outbox.service.ts` — call **inside** the transaction. Use a consistent `procurement.xxx.yyy` event naming convention throughout Phase C.

### Event naming convention

All Phase C domain events use the format: `procurement.{entity}.{action}`
Examples: `procurement.purchase_order.approved`, `procurement.receipt.posted`, `procurement.delivery.delivered`
This matches the outbox `eventType` field and must be consistent across services and worker consumers.

### Job queue

`sendJob(queueName, payload, options?)` from `apps/server/src/lib/queue/index.ts`.
Model `procurement.jobs.ts` after `project.jobs.ts`. Register new queues in `queue.ts` (JobPayloads + QUEUES spread).

### Routing for project-scoped procurement

All project-scoped routes go inside the `projectScoped` block in `project.routes.ts`.

### Routing for org-scoped resources (suppliers, materials)

New `supplier.routes.ts` / `material.routes.ts` registered in `apps/server/src/app/index.ts`. Guards: `authenticate` + `organizationContext` + `requirePermission(...)`.

### Response format

`createSuccessResponse(data, meta?)` from `apps/server/src/shared/response.ts`

### Error classes

```ts
export class XxxNotFoundError extends Error {
  statusCode = 404;
  code = 'XXX_NOT_FOUND';
  constructor(id: string) {
    super(`Xxx not found: ${id}`);
  }
}
```

### Existing FK targets

- `organizations` → `organizationId`
- `projects` → `projectId`
- `projectMembers` → `requestedByMemberId`, `createdByMemberId`, `receivedByMemberId`
- `projectPhases` → `phaseId`
- `projectCostCodes` → `costCodeId`
- `tasks` → `taskId`
- `users` → `createdBy`, `approvedBy`, `reviewedBy`
- `boqLineId`: always `text('boq_line_id')` with **no FK** — BOQ table does not exist yet

### Supplier is org-scoped, not project-scoped

Suppliers are organization-level entities. Project-specific supplier qualification / approved supplier lists belong to a future procurement-control extension. Do not create `supplier_project_links` in this phase.

---

## Global Rules for Every Chunk

1. **PostgreSQL is the source of truth.** Redis is acceleration only — never correctness, locking, or authorization.
2. Money: `numeric(15,2)`. Quantity: `numeric(15,3)`. Never JS floats for authoritative calculations — use decimal.js or PostgreSQL expressions.
3. List endpoints: cursor pagination (stable `createdAt DESC, id DESC` ordering), `limit` max 100, `status` filter minimum. True cursor — not offset disguised as cursor.
4. State transitions via explicit action routes (`/submit`, `/approve`, `/cancel`) — never `PATCH status`.
5. Approval / receipt / inventory mutations: PostgreSQL `FOR UPDATE` on a stable row. **No Redis locks for any correctness operation.**
6. Domain events via `writeOutboxEvent(tx, ...)` inside the transaction.
7. **Cross-entity ownership validation inside every mutation transaction:** every referenced entity (`supplierId`, `taskId`, `costCodeId`, `phaseId`, `materialId`) must be loaded and its `organizationId` (and where applicable `projectId`) verified against the current request's values — in the same transaction, before writing.
8. `boqLineId` columns: nullable `text`, no FK.
9. Do not modify existing Phase 2/3 tables except where explicitly noted.
10. **Idempotency on action routes:** POST `/approve`, `/send`, `/post`, `/void`, `/adjust` must be safely repeatable — return existing state or a well-defined conflict, never create duplicate records.
11. **Document numbers are allocated via the scoped number allocator (C.4)** — never via `COUNT(*)` under concurrency.
12. **Decimal arithmetic rule:** `quantity × unitPrice` and all derived totals use `decimal.js` (or equivalent) in TypeScript. Never `number * number` for stored monetary values.
13. **Financial calculation semantics:**
    ```
    lineSubtotal  = quantity × unitPrice
    lineDiscount  = discountAmount (per item)
    lineTax       = taxAmount (per item)
    lineTotal     = lineSubtotal - lineDiscount + lineTax

    documentSubtotal       = Σ lineSubtotal
    documentDiscountAmount = Σ lineDiscount
    documentTaxAmount      = Σ lineTax
    documentTotalAmount    = documentSubtotal - documentDiscountAmount + documentTaxAmount
    ```
    Client-provided totals are ignored. Server always recalculates.

---

## Chunk C.1 — Subcontractors

**STATUS:** `DONE`

**Prerequisites:** Phase 2 + Phase 3 complete.

**Goal:** Subcontractor directory, contacts, project assignments, task assignments.

---

### Schema additions

```ts
export const subcontractorStatusEnum = appSchema.enum('subcontractor_status', [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
]);
export const projectSubcontractorStatusEnum = appSchema.enum('project_subcontractor_status', [
  'ACTIVE',
  'INACTIVE',
]);

export const subcontractors = appSchema.table(
  'subcontractors',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    legalName: text('legal_name').notNull(),
    displayName: text('display_name').notNull(),
    trade: text('trade'),
    registrationReference: text('registration_reference'),
    taxReference: text('tax_reference'),
    status: subcontractorStatusEnum('status').notNull().default('ACTIVE'),
    primaryEmail: text('primary_email'),
    primaryPhone: text('primary_phone'),
    address: text('address'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('subcontractors_org_idx').on(t.organizationId),
    index('subcontractors_org_status_idx').on(t.organizationId, t.status),
  ],
);

export const subcontractorContacts = appSchema.table(
  'subcontractor_contacts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    subcontractorId: text('subcontractor_id')
      .notNull()
      .references(() => subcontractors.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role'),
    email: text('email'),
    phone: text('phone'),
    isPrimary: boolean('is_primary').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('subcontractor_contacts_sub_idx').on(t.subcontractorId),
    // Enforce at most one primary contact per subcontractor (DB partial unique index)
    uniqueIndex('subcontractor_contacts_primary_unique').on(t.subcontractorId),
    // .where(sql`${t.isPrimary} = true`)   ← add this partial index in raw SQL migration
  ],
);
// NOTE: Add the partial unique index for isPrimary=true in the raw migration SQL:
// CREATE UNIQUE INDEX subcontractor_contacts_primary_unique
//   ON app.subcontractor_contacts(subcontractor_id)
//   WHERE is_primary = true;

export const projectSubcontractors = appSchema.table(
  'project_subcontractors',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    subcontractorId: text('subcontractor_id')
      .notNull()
      .references(() => subcontractors.id, { onDelete: 'restrict' }),
    status: projectSubcontractorStatusEnum('status').notNull().default('ACTIVE'),
    scopeDescription: text('scope_description'),
    contractValue: numeric('contract_value', { precision: 15, scale: 2 }),
    currencyCode: text('currency_code'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('project_subcontractors_unique').on(t.projectId, t.subcontractorId),
    index('project_subcontractors_project_idx').on(t.projectId),
    index('project_subcontractors_org_idx').on(t.organizationId),
    check(
      'project_subcontractors_cv_gte_0',
      sql`${t.contractValue} IS NULL OR ${t.contractValue} >= 0`,
    ),
    check(
      'project_subcontractors_dates',
      sql`${t.endDate} IS NULL OR ${t.startDate} IS NULL OR ${t.endDate} >= ${t.startDate}`,
    ),
  ],
);

export const subcontractorTaskAssignments = appSchema.table(
  'subcontractor_task_assignments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    subcontractorId: text('subcontractor_id')
      .notNull()
      .references(() => subcontractors.id, { onDelete: 'restrict' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    assignmentRole: text('assignment_role'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('sub_task_assignments_unique').on(t.subcontractorId, t.taskId),
    index('sub_task_assignments_project_idx').on(t.projectId),
    index('sub_task_assignments_task_idx').on(t.taskId),
  ],
);

export type Subcontractor = typeof subcontractors.$inferSelect;
export type SubcontractorContact = typeof subcontractorContacts.$inferSelect;
export type ProjectSubcontractor = typeof projectSubcontractors.$inferSelect;
export type SubcontractorTaskAssignment = typeof subcontractorTaskAssignments.$inferSelect;
export type SubcontractorStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
```

> **Scope boundary:** `project_subcontractors` holds the project relationship and basic scope/value. Full contract lifecycle (versions, payment terms, change orders, billing, retainage, compliance documents) belongs to a future commercial module. Do not expand this table prematurely.

---

### New capabilities — `core/project.policy.ts`

`PROJECT_MANAGER` + `SITE_SUPERVISOR`: `'project.subcontractor.read'`, `'project.subcontractor.create'`, `'project.subcontractor.update'`, `'project.subcontractor.assign'`
`PROJECT_MEMBER` + `PROCUREMENT`: `'project.subcontractor.read'`
Add all to `ORG_LEVEL_AUTHORITY_MAP`.

---

### New files

```
apps/server/src/modules/project/subcontractor/
  subcontractor.errors.ts
  subcontractor.types.ts
  subcontractor.schemas.ts     — Zod; validate email format, trim inputs
  subcontractor.repository.ts
  subcontractor.service.ts
  subcontractor.handler.ts
```

---

### Routes — `projectScoped`

```
GET    /:organizationId/projects/:projectId/subcontractors
POST   /:organizationId/projects/:projectId/subcontractors
GET    /:organizationId/projects/:projectId/subcontractors/:subcontractorId
PATCH  /:organizationId/projects/:projectId/subcontractors/:subcontractorId
POST   /:organizationId/projects/:projectId/subcontractors/:subcontractorId/contacts
PATCH  /:organizationId/projects/:projectId/subcontractors/:subcontractorId/contacts/:contactId
POST   /:organizationId/projects/:projectId/subcontractors/:subcontractorId/task-assignments
DELETE /:organizationId/projects/:projectId/subcontractors/:subcontractorId/task-assignments/:taskId
```

---

### Domain event

`procurement.subcontractor.assigned` — write via `writeOutboxEvent(tx, ...)` in `assignTask()`.

---

### Checklist

- [x] Check whether `tasks.subcontractorId` already exists in `project.schema.ts` — reuse if present
- [x] Schema + `pnpm --filter @siteflow/database db:generate`
- [x] Add partial unique index for `isPrimary=true` in the generated migration SQL manually
- [x] Add capabilities to `project.policy.ts` (both maps)
- [x] Implement all module files
- [x] Contact CRUD: supports create, update (including deactivate), enforce single-primary invariant at service + DB level
- [x] Task assignment validates: `task.projectId === projectId` AND `task.organizationId === organizationId` AND `project_subcontractors(projectId, subcontractorId)` exists and is ACTIVE — inside same transaction
- [x] INACTIVE / SUSPENDED subcontractor cannot be assigned to project
- [x] Cross-entity ownership checked in transaction (Global Rule 7)
- [x] Add `procurement.subcontractor.assigned` to outbox
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/subcontractor_core.test.ts`:
  - CRUD subcontractor + contacts
  - Single-primary enforcement (second primary contact rejected)
  - Contact update/deactivate
  - Project assignment; INACTIVE/SUSPENDED subcontractor rejected
  - Task assignment: cross-project task rejected; subcontractor not assigned to project rejected
  - Tenant isolation: org A cannot read or act on org B subcontractors
  - Concurrent duplicate task-assignment attempt → unique constraint enforced
- [x] Tests green

---

---

## Chunk C.2 — Vendors / Suppliers

**STATUS:** `DONE`

**Prerequisites:** C.1 done.

**Goal:** Org-level supplier directory with contacts. Supplier directory is organization-scoped; project-specific supplier qualification belongs to a future extension.

---

### Schema additions

```ts
export const supplierTypeEnum = appSchema.enum('supplier_type', [
  'MATERIAL_SUPPLIER',
  'SERVICE_PROVIDER',
  'EQUIPMENT_SUPPLIER',
  'GENERAL_SUPPLIER',
]);
export const supplierStatusEnum = appSchema.enum('supplier_status', [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
]);

export const suppliers = appSchema.table(
  'suppliers',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    supplierCode: text('supplier_code').notNull(),
    legalName: text('legal_name').notNull(),
    displayName: text('display_name').notNull(),
    supplierType: supplierTypeEnum('supplier_type').notNull().default('GENERAL_SUPPLIER'),
    status: supplierStatusEnum('status').notNull().default('ACTIVE'),
    taxReference: text('tax_reference'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    website: text('website'),
    paymentTerms: text('payment_terms'), // informational text only — structured terms are future scope
    currencyCode: text('currency_code'), // default currency only; quote/PO currency is authoritative
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('suppliers_org_code_unique').on(t.organizationId, t.supplierCode),
    index('suppliers_org_idx').on(t.organizationId),
    index('suppliers_org_status_idx').on(t.organizationId, t.status),
  ],
);

export const supplierContacts = appSchema.table(
  'supplier_contacts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role'),
    email: text('email'),
    phone: text('phone'),
    isPrimary: boolean('is_primary').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('supplier_contacts_supplier_idx').on(t.supplierId),
    // Partial unique index for isPrimary added in migration SQL:
    // CREATE UNIQUE INDEX supplier_contacts_primary_unique
    //   ON app.supplier_contacts(supplier_id) WHERE is_primary = true;
  ],
);

export type Supplier = typeof suppliers.$inferSelect;
export type SupplierContact = typeof supplierContacts.$inferSelect;
export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
```

> **Future scope note:** Structured payment terms, bank/payment details, tax treatment, compliance/insurance, contract references belong to a future commercial supplier-management extension.

---

### Routes — org-level

```
GET    /api/v1/organizations/:organizationId/suppliers
POST   /api/v1/organizations/:organizationId/suppliers
GET    /api/v1/organizations/:organizationId/suppliers/:supplierId
PATCH  /api/v1/organizations/:organizationId/suppliers/:supplierId
POST   /api/v1/organizations/:organizationId/suppliers/:supplierId/contacts
PATCH  /api/v1/organizations/:organizationId/suppliers/:supplierId/contacts/:contactId
```

---

### Redis caching

Key: `siteflow:v1:org:{orgId}:supplier:{supplierId}` — TTL 1h. Invalidate on PATCH.
List cache: `siteflow:v1:org:{orgId}:supplier:list:{queryHash}` — TTL 5 min. Invalidate on create/update.
Redis failure falls back to DB (try/catch wrapping all cache ops).

---

### Checklist

- [x] Schema + migration (include partial unique index for isPrimary in SQL)
- [x] Normalize `supplierCode` (trim + uppercase) before uniqueness check
- [x] Validate email format in Zod schema
- [x] Contact CRUD: create, update (deactivate supported), single-primary enforced at service + DB
- [x] `findActiveById()` guard — INACTIVE/SUSPENDED supplier rejected for new POs
- [x] Register `supplier.routes.ts` in `app/index.ts`; capabilities in org RBAC (`supplier:read`, `supplier:create`, `supplier:update`)
- [x] Redis entity cache + list cache with invalidation
- [x] Cross-entity ownership (Global Rule 7) — `supplier.organizationId` must equal request `organizationId`
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/supplier_core.test.ts`:
  - CRUD + duplicate `supplierCode` rejection
  - Single-primary enforcement
  - INACTIVE/SUSPENDED guard in `findActiveById()`
  - Tenant isolation
  - Cache hit, invalidation on update, Redis outage fallback
- [x] Tests green

---

---

## Chunk C.3 — Material Catalog

**STATUS:** `DONE`

**Prerequisites:** C.2 done.

**Goal:** Org-level reusable catalog. No project-specific inventory or pricing stored here.

---

### Schema additions

```ts
export const materialTypeEnum = appSchema.enum('material_type', [
  'MATERIAL',
  'EQUIPMENT',
  'CONSUMABLE',
  'SERVICE',
  'OTHER',
]);
export const materialStatusEnum = appSchema.enum('material_status', ['ACTIVE', 'INACTIVE']);

export const materials = appSchema.table(
  'materials',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    materialCode: text('material_code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),
    defaultUnitCode: text('default_unit_code').notNull(),
    materialType: materialTypeEnum('material_type').notNull().default('MATERIAL'),
    status: materialStatusEnum('status').notNull().default('ACTIVE'),
    defaultTaxCode: text('default_tax_code'),
    defaultCurrencyCode: text('default_currency_code'), // informational default only
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('materials_org_code_unique').on(t.organizationId, t.materialCode),
    index('materials_org_idx').on(t.organizationId),
    index('materials_org_status_idx').on(t.organizationId, t.status),
    index('materials_org_category_idx').on(t.organizationId, t.category),
  ],
);

export type Material = typeof materials.$inferSelect;
export type MaterialStatus = 'ACTIVE' | 'INACTIVE';
```

---

### Unit/currency rules

- `material.defaultUnitCode` is the authoritative unit for this material. Requests/PO items using a different unit are rejected at the service layer unless a future unit-conversion service is present.
- `material.defaultCurrencyCode` is informational only — quote/PO currency is authoritative for commercial documents.

---

### Routes — org-level

```
GET    /api/v1/organizations/:organizationId/materials
POST   /api/v1/organizations/:organizationId/materials
GET    /api/v1/organizations/:organizationId/materials/:materialId
PATCH  /api/v1/organizations/:organizationId/materials/:materialId
```

---

### Checklist

- [x] Schema + migration
- [x] Normalize `materialCode` (trim + uppercase) before uniqueness check
- [x] `findActiveById()` rejects INACTIVE material for new procurement documents
- [x] Unit code validation in Zod — non-empty, normalise to uppercase
- [x] Register org-scoped routes in `app/index.ts`
- [x] Redis entity + list cache (same pattern as suppliers)
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/material_catalog.test.ts`:
  - CRUD + duplicate code rejection
  - INACTIVE material rejected in `findActiveById()`
  - Unit code normalisation
  - Tenant isolation
  - Cache invalidation on update
- [x] Tests green

---

---

## Chunk C.4 — Document Number Allocator

**STATUS:** `DONE`

**Prerequisites:** C.3 done.

**Goal:** Concurrency-safe, scoped human-readable number generation. Reused by all subsequent chunks. Never use `COUNT(*)` for number generation.

---

### Schema additions

```ts
export const documentNumberAllocators = appSchema.table(
  'document_number_allocators',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    series: text('series').notNull(), // 'MR' | 'QT' | 'PO' | 'DL' | 'RC'
    period: text('period').notNull(), // 'YYYYMM' for monthly; 'GLOBAL' for unbounded
    lastNumber: integer('last_number').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('doc_num_allocator_unique').on(
      t.organizationId,
      t.series,
      t.period,
      // project_id included when not null — use raw SQL partial index in migration:
      // CREATE UNIQUE INDEX doc_num_allocator_unique
      //   ON app.document_number_allocators(organization_id, project_id, series, period)
      //   WHERE project_id IS NOT NULL;
      // CREATE UNIQUE INDEX doc_num_allocator_org_unique
      //   ON app.document_number_allocators(organization_id, series, period)
      //   WHERE project_id IS NULL;
    ),
  ],
);

export type DocumentNumberAllocator = typeof documentNumberAllocators.$inferSelect;
```

---

### `allocateDocumentNumber(tx, orgId, projectId, series, period)` service

```ts
// Upsert-or-increment with FOR UPDATE lock on the allocator row
async allocateDocumentNumber(
  tx: any,
  orgId: string,
  projectId: string | null,
  series: string,   // 'MR', 'QT', 'PO', 'DL', 'RC'
  period: string,   // 'YYYYMM' or 'GLOBAL'
): Promise<string> {
  // 1. Upsert allocator row (INSERT ... ON CONFLICT DO NOTHING, then SELECT FOR UPDATE)
  // 2. Lock the row
  // 3. Increment lastNumber
  // 4. Return formatted number, e.g. 'MR-202610-007'
}
```

Two concurrent callers on the same series/period/project will serialize on the row lock and get different numbers.

---

### Checklist

- [x] Schema + migration (include raw SQL partial unique indexes)
- [x] Implement `DocumentNumberService` with `allocateDocumentNumber(tx, ...)`
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/document_number_allocator.test.ts`:
  - Concurrent allocations for the same series → no duplicate numbers
  - Different series produce independent sequences
  - Monthly period rolls over correctly
- [x] Tests green

---

---

## Chunk C.5 — Material Requests

**STATUS:** `DONE`

**Prerequisites:** C.4 done.

**Goal:** Project-scoped bridge between planned work and procurement. Items link to tasks, phases, cost codes, and BOQ (deferred FK).

**Approval rule:** Material Request approval and rejection are performed **exclusively** through the `procurement_approvals` workflow (C.7). No resource-specific `/approve` endpoint exists on Material Requests. This makes the approval authority unambiguous.

---

### Schema additions

```ts
export const materialRequestStatusEnum = appSchema.enum('material_request_status', [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PARTIALLY_ORDERED',
  'ORDERED',
  'FULFILLED',
  'CANCELLED',
  'REJECTED',
]);
export const materialRequestPriorityEnum = appSchema.enum('material_request_priority', [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);

export const materialRequests = appSchema.table(
  'material_requests',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    requestNumber: text('request_number').notNull(),
    requestedByMemberId: text('requested_by_member_id').references(() => projectMembers.id, {
      onDelete: 'set null',
    }),
    status: materialRequestStatusEnum('status').notNull().default('DRAFT'),
    requiredByDate: date('required_by_date'),
    deliveryLocation: text('delivery_location'),
    priority: materialRequestPriorityEnum('priority').notNull().default('NORMAL'),
    notes: text('notes'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('material_requests_num_unique').on(t.projectId, t.requestNumber),
    index('material_requests_project_status_created_idx').on(t.projectId, t.status, t.createdAt),
    index('material_requests_org_project_idx').on(t.organizationId, t.projectId),
  ],
);

export const materialRequestItems = appSchema.table(
  'material_request_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    materialRequestId: text('material_request_id')
      .notNull()
      .references(() => materialRequests.id, { onDelete: 'cascade' }),
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'restrict' }),
    description: text('description'),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    requiredByDate: date('required_by_date'),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    phaseId: text('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
    costCodeId: text('cost_code_id').references(() => projectCostCodes.id, {
      onDelete: 'set null',
    }),
    boqLineId: text('boq_line_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('mat_req_items_request_idx').on(t.materialRequestId),
    index('mat_req_items_task_idx').on(t.taskId),
    check('mat_req_items_qty_gt_0', sql`${t.quantity} > 0`),
  ],
);

export type MaterialRequest = typeof materialRequests.$inferSelect;
export type MaterialRequestItem = typeof materialRequestItems.$inferSelect;
export type MaterialRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PARTIALLY_ORDERED'
  | 'ORDERED'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'REJECTED';
```

---

### Quantity semantics

`orderedQuantity` and `receivedQuantity` are **derived** read-model values calculated from linked PO items and receipts — not stored columns. API responses compute them via aggregate queries. `orderedQuantity` must not exceed `requestedQuantity` without explicit over-order permission.

---

### Routes — `projectScoped`

```
GET    /:organizationId/projects/:projectId/material-requests
POST   /:organizationId/projects/:projectId/material-requests
GET    /:organizationId/projects/:projectId/material-requests/:requestId
PATCH  /:organizationId/projects/:projectId/material-requests/:requestId
POST   /:organizationId/projects/:projectId/material-requests/:requestId/submit
POST   /:organizationId/projects/:projectId/material-requests/:requestId/cancel
```

---

### Checklist

- [x] Schema + migration
- [x] `requestNumber` via `documentNumberAllocator.allocateDocumentNumber(tx, orgId, projectId, 'MR', 'YYYYMM')`
- [x] Submit validation: ≥1 item; all `materialId` belong to org and are ACTIVE; `unitCode` equals `material.defaultUnitCode`; `taskId`/`phaseId`/`costCodeId` belong to same project; `quantity > 0`
- [x] Cross-entity ownership (Global Rule 7) in every mutation
- [x] Capabilities: `project.material_request.read/create/update/submit/cancel`
- [x] `writeOutboxEvent(tx, 'procurement.material_request.submitted', ...)` on submit
- [x] `writeOutboxEvent(tx, 'procurement.material_request.cancelled', ...)` on cancel
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/material_request.test.ts`:
  - DRAFT → SUBMITTED → CANCELLED
  - Zero-item submit rejected
  - Cross-project `taskId` rejected
  - Cross-org `materialId` rejected
  - Mismatched unit code rejected
  - INACTIVE material rejected
  - Concurrent number allocation → no duplicates
  - Tenant isolation
- [x] Tests green

---

---

## Chunk C.6 — Quotes

**STATUS:** `DONE`

**Prerequisites:** C.5 done.

**Goal:** Supplier quotes linked optionally to material requests. Server always calculates totals. Quote acceptance is performed via the central approval workflow (C.7) — the `/accept` endpoint triggers the same approval semantics. There is one approval path, not two.

---

### Schema additions

```ts
export const quoteStatusEnum = appSchema.enum('quote_status', [
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
]);

export const quotes = appSchema.table(
  'quotes',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    quoteNumber: text('quote_number').notNull(),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    materialRequestId: text('material_request_id').references(() => materialRequests.id, {
      onDelete: 'set null',
    }),
    status: quoteStatusEnum('status').notNull().default('DRAFT'),
    quoteDate: date('quote_date').notNull(),
    validUntil: date('valid_until'),
    currencyCode: text('currency_code').notNull(),
    subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
    discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    notes: text('notes'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('quotes_num_unique').on(t.projectId, t.quoteNumber),
    index('quotes_project_status_idx').on(t.projectId, t.status),
    index('quotes_supplier_idx').on(t.supplierId),
    check(
      'quotes_amounts_gte_0',
      sql`${t.subtotal} >= 0 AND ${t.taxAmount} >= 0 AND ${t.discountAmount} >= 0 AND ${t.totalAmount} >= 0`,
    ),
    check('quotes_valid_until', sql`${t.validUntil} IS NULL OR ${t.validUntil} >= ${t.quoteDate}`),
  ],
);

export const quoteItems = appSchema.table(
  'quote_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    materialRequestItemId: text('material_request_item_id').references(
      () => materialRequestItems.id,
      { onDelete: 'set null' },
    ),
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'restrict' }),
    description: text('description'),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    lineSubtotal: numeric('line_subtotal', { precision: 15, scale: 2 }).notNull(),
    lineTotal: numeric('line_total', { precision: 15, scale: 2 }).notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('quote_items_quote_idx').on(t.quoteId),
    check('quote_items_qty_gt_0', sql`${t.quantity} > 0`),
    check('quote_items_unit_price_gte_0', sql`${t.unitPrice} >= 0`),
  ],
);

export type Quote = typeof quotes.$inferSelect;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type QuoteStatus = 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
```

---

### Approval authority rule

Quote acceptance (`SUBMITTED → ACCEPTED`) must go through the central `procurement_approvals` workflow. The `/accept` and `/reject` routes are **thin wrappers** that create a `procurement_approval` record and execute the approval transaction — they do not bypass the approval record. This ensures there is exactly one approval path per quote.

### At-most-one-accepted invariant

At most one quote per `materialRequestId` may be in `ACCEPTED` status. Enforce at service level (checked in transaction).

---

### Routes — `projectScoped`

```
GET    /:organizationId/projects/:projectId/quotes
POST   /:organizationId/projects/:projectId/quotes
GET    /:organizationId/projects/:projectId/quotes/:quoteId
PATCH  /:organizationId/projects/:projectId/quotes/:quoteId
POST   /:organizationId/projects/:projectId/quotes/:quoteId/submit
POST   /:organizationId/projects/:projectId/quotes/:quoteId/accept
POST   /:organizationId/projects/:projectId/quotes/:quoteId/reject
```

---

### Checklist

- [x] Schema + migration
- [x] Number via allocator: series `'QT'`, period `'YYYYMM'`
- [x] Server calculates all totals using **decimal.js**: `lineSubtotal = qty × unitPrice`; `lineTotal = lineSubtotal - discount + tax`; document totals per Global Rule 13
- [x] Expiry check on submit-for-acceptance: if `validUntil < today`, reject with `QUOTE_EXPIRED`
- [x] Accepted quotes are **immutable** — PATCH rejected when status is ACCEPTED
- [x] `/accept` and `/reject` create a `procurement_approval` record internally (not an independent code path)
- [x] At-most-one-accepted invariant enforced in transaction
- [x] Double-accept idempotency: return current state if already ACCEPTED
- [x] Cross-org supplier validation in same transaction
- [x] Capabilities: `project.quote.read/create/update/submit/accept/reject`
- [x] `writeOutboxEvent(tx, 'procurement.quote.accepted', ...)` and `'procurement.quote.rejected'`
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/quote_core.test.ts`:
  - CRUD + server-calculated totals (verify client total is ignored)
  - Accept/reject lifecycle
  - Expired quote accept rejected
  - Double-accept is idempotent
  - Second quote acceptance when one already accepted → rejected
  - ACCEPTED quote is immutable
  - Cross-org supplier rejected
  - Tenant isolation
- [x] Tests green

---

---

## Chunk C.7 — Procurement Approvals

**STATUS:** `DONE`

**Prerequisites:** C.6 done.

**Goal:** Central transactional approval record for Material Requests, Quotes, and Purchase Orders. Not a boolean. Uses `FOR UPDATE`. One active approval per resource at a time.

---

### Schema additions

```ts
export const procurementApprovalStatusEnum = appSchema.enum('procurement_approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);
export const procurementApprovalResourceTypeEnum = appSchema.enum(
  'procurement_approval_resource_type',
  ['MATERIAL_REQUEST', 'QUOTE', 'PURCHASE_ORDER'],
);

export const procurementApprovals = appSchema.table(
  'procurement_approvals',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    resourceType: procurementApprovalResourceTypeEnum('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    status: procurementApprovalStatusEnum('status').notNull().default('PENDING'),
    requestedBy: text('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    decisionReason: text('decision_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    // Partial unique index: at most one PENDING approval per resource
    // Add in migration SQL:
    // CREATE UNIQUE INDEX procurement_approvals_pending_unique
    //   ON app.procurement_approvals(resource_type, resource_id)
    //   WHERE status = 'PENDING';
    index('procurement_approvals_resource_idx').on(t.resourceType, t.resourceId),
    index('procurement_approvals_project_status_idx').on(t.projectId, t.status),
  ],
);

export type ProcurementApproval = typeof procurementApprovals.$inferSelect;
export type ProcurementApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ProcurementApprovalResourceType = 'MATERIAL_REQUEST' | 'QUOTE' | 'PURCHASE_ORDER';
```

---

### Resource ownership validation

Because `resourceId` is polymorphic (no FK), the service must validate in the same transaction:

- Load the resource by `resourceId` and its declared `resourceType`
- Confirm `resource.organizationId === approval.organizationId`
- Confirm `resource.projectId === approval.projectId`

### Segregation of duties note

The system supports a `creator !== approver` rule at the capability level (e.g. `PROCUREMENT` creates, `FINANCE` approves). This is enforced via the capability map in `project.policy.ts`. While full segregation-of-duties enforcement is a future policy configuration, the design must not silently allow self-approval where roles prohibit it.

### Approve/reject transaction pattern

```ts
await this.db.transaction(async (tx) => {
  // 1. Lock the resource row (FOR UPDATE)
  await tx.execute(sql`SELECT id FROM app.material_requests WHERE id = ${resourceId} FOR UPDATE`);
  // 2. Verify resource current status allows approval
  // 3. Verify resource ownership (org + project)
  // 4. Verify approver permission
  // 5. Transition resource status
  // 6. Update procurement_approval record
  // 7. auditService.log(...)
  // 8. writeOutboxEvent(tx, ...)
});
```

---

### Routes — `projectScoped`

```
GET    /:organizationId/projects/:projectId/procurement-approvals
POST   /:organizationId/projects/:projectId/procurement-approvals
GET    /:organizationId/projects/:projectId/procurement-approvals/:approvalId
POST   /:organizationId/projects/:projectId/procurement-approvals/:approvalId/approve
POST   /:organizationId/projects/:projectId/procurement-approvals/:approvalId/reject
POST   /:organizationId/projects/:projectId/procurement-approvals/:approvalId/cancel
```

---

### Checklist

- [x] Schema + migration (partial unique index for PENDING in SQL)
- [x] `FOR UPDATE` on resource row inside approve/reject
- [x] Resource ownership validated in same transaction
- [x] At-most-one-PENDING partial unique index
- [x] Approve idempotency: already-APPROVED returns current state
- [x] Capabilities: `project.procurement_approval.read/create/approve/reject`
- [x] `writeOutboxEvent(tx, 'procurement.approval.approved', ...)` and `'procurement.approval.rejected'`
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/procurement_approval.test.ts`:
  - Create approval → approve → resource status transitions correctly
  - Create approval → reject → resource status transitions correctly
  - Concurrent approve race → exactly one wins
  - Double PENDING approval for same resource rejected (partial unique constraint)
  - Double-approve is idempotent
  - Resource from different org/project rejected
  - Tenant isolation
- [x] Tests green

---

---

## Chunk C.8 — Purchase Orders

**STATUS:** `DONE`

**Prerequisites:** C.7 done.

**Goal:** Financial/procurement commitment document. Server calculates all totals. After APPROVED: supplier and currency immutable; line changes require amendment.

---

### Schema additions

```ts
export const purchaseOrderStatusEnum = appSchema.enum('purchase_order_status', [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'ACKNOWLEDGED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
  'CLOSED',
]);

export const purchaseOrders = appSchema.table(
  'purchase_orders',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    poNumber: text('po_number').notNull(),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    materialRequestId: text('material_request_id').references(() => materialRequests.id, {
      onDelete: 'set null',
    }),
    sourceQuoteId: text('source_quote_id').references(() => quotes.id, { onDelete: 'set null' }),
    status: purchaseOrderStatusEnum('status').notNull().default('DRAFT'),
    orderDate: date('order_date').notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    deliveryLocation: text('delivery_location'),
    currencyCode: text('currency_code').notNull(),
    subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
    discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    notes: text('notes'),
    createdByMemberId: text('created_by_member_id').references(() => projectMembers.id, {
      onDelete: 'set null',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('purchase_orders_num_unique').on(t.projectId, t.poNumber),
    index('purchase_orders_project_status_created_idx').on(t.projectId, t.status, t.createdAt),
    index('purchase_orders_supplier_idx').on(t.supplierId),
    index('purchase_orders_org_project_idx').on(t.organizationId, t.projectId),
    check(
      'purchase_orders_amounts_gte_0',
      sql`${t.subtotal} >= 0 AND ${t.taxAmount} >= 0 AND ${t.discountAmount} >= 0 AND ${t.totalAmount} >= 0`,
    ),
    check(
      'purchase_orders_delivery_date',
      sql`${t.expectedDeliveryDate} IS NULL OR ${t.expectedDeliveryDate} >= ${t.orderDate}`,
    ),
  ],
);

export const purchaseOrderItems = appSchema.table(
  'purchase_order_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    purchaseOrderId: text('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'restrict' }),
    description: text('description'),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    lineSubtotal: numeric('line_subtotal', { precision: 15, scale: 2 }).notNull(),
    lineTotal: numeric('line_total', { precision: 15, scale: 2 }).notNull(),
    materialRequestItemId: text('material_request_item_id').references(
      () => materialRequestItems.id,
      { onDelete: 'set null' },
    ),
    sourceQuoteItemId: text('source_quote_item_id').references(() => quoteItems.id, {
      onDelete: 'set null',
    }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    phaseId: text('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
    costCodeId: text('cost_code_id').references(() => projectCostCodes.id, {
      onDelete: 'set null',
    }),
    boqLineId: text('boq_line_id'),
    expectedDeliveryDate: date('expected_delivery_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('po_items_po_idx').on(t.purchaseOrderId),
    index('po_items_material_idx').on(t.materialId),
    index('po_items_task_idx').on(t.taskId),
    check('po_items_qty_gt_0', sql`${t.quantity} > 0`),
    check('po_items_unit_price_gte_0', sql`${t.unitPrice} >= 0`),
  ],
);

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'CLOSED';
```

---

### Post-approval immutability

After `APPROVED`:

- **Immutable:** `supplierId`, `currencyCode`, all line items (material, quantity, unitPrice, tax, discount, total), project attribution
- **Operationally mutable:** `expectedDeliveryDate`, delivery acknowledgement, notes
- Changes to immutable fields require: cancel PO + create new PO (amendment/revision pattern is future scope)

### PO cancellation → committed cost lifecycle

When an APPROVED or SENT PO is cancelled:

- Service must call `committedCostService.cancelFromPO(tx, poId)` to release/cancel the committed cost
- Emit `procurement.purchase_order.cancelled` event

### Route — `projectScoped`

```
GET    /:organizationId/projects/:projectId/purchase-orders
POST   /:organizationId/projects/:projectId/purchase-orders
GET    /:organizationId/projects/:projectId/purchase-orders/:poId
PATCH  /:organizationId/projects/:projectId/purchase-orders/:poId
POST   /:organizationId/projects/:projectId/purchase-orders/:poId/submit
POST   /:organizationId/projects/:projectId/purchase-orders/:poId/approve
POST   /:organizationId/projects/:projectId/purchase-orders/:poId/send
POST   /:organizationId/projects/:projectId/purchase-orders/:poId/cancel
```

---

### Checklist

- [x] Schema + migration
- [x] Number via allocator: series `'PO'`, period `'YYYYMM'`
- [x] Server calculates all totals via decimal.js (Global Rule 13)
- [x] Cross-entity ownership (Global Rule 7): supplier, task, costCode, phase all validated in transaction
- [x] `FOR UPDATE` on PO row during approve/send/cancel
- [x] Post-approval immutability enforced: PATCH on immutable fields after APPROVED → 422
- [x] PO cancellation calls `committedCostService.cancelFromPO(tx, ...)` (stub until C.9)
- [x] Capabilities: `project.purchase_order.read/create/update/submit/approve/send/cancel`
- [x] `writeOutboxEvent(tx, 'procurement.purchase_order.approved', ...)`
- [x] `writeOutboxEvent(tx, 'procurement.purchase_order.sent', ...)` = `MaterialOrdered`
- [x] `writeOutboxEvent(tx, 'procurement.purchase_order.cancelled', ...)`
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/purchase_order.test.ts`:
  - Full lifecycle DRAFT → PENDING_APPROVAL → APPROVED → SENT
  - Server-calculated totals (client total ignored, verify discrepancy rejected)
  - Cross-org supplier rejected
  - Concurrent approve race → one wins
  - Approved PO: supplier/line change rejected
  - Cancelled approved PO → committed cost released
  - Tenant isolation
- [x] Tests green

---

---

## Chunk C.9 — Committed Cost

**STATUS:** `DONE`

**Prerequisites:** C.8 done. (Does not require C.10/C.11.)

**Goal:** Financial commitment record. Created idempotently on PO approval. One logical commitment per source. Lifecycle follows the PO.

---

### Schema additions

```ts
export const committedCostStatusEnum = appSchema.enum('committed_cost_status', [
  'ACTIVE',
  'RELEASED',
  'CANCELLED',
]);
export const committedCostSourceTypeEnum = appSchema.enum('committed_cost_source_type', [
  'PURCHASE_ORDER',
]);
// SUBCONTRACTOR_COMMITMENT reserved for future commercial subcontract module.
// Only PURCHASE_ORDER is implemented in Phase C.

export const committedCosts = appSchema.table(
  'committed_costs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sourceType: committedCostSourceTypeEnum('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    purchaseOrderId: text('purchase_order_id').references(() => purchaseOrders.id, {
      onDelete: 'set null',
    }),
    costCodeId: text('cost_code_id').references(() => projectCostCodes.id, {
      onDelete: 'set null',
    }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    boqLineId: text('boq_line_id'),
    currencyCode: text('currency_code').notNull(),
    committedAmount: numeric('committed_amount', { precision: 15, scale: 2 }).notNull(),
    status: committedCostStatusEnum('status').notNull().default('ACTIVE'),
    committedAt: timestamp('committed_at', { withTimezone: true }).notNull(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('committed_costs_source_unique').on(t.organizationId, t.sourceType, t.sourceId),
    index('committed_costs_project_idx').on(t.projectId),
    index('committed_costs_org_project_idx').on(t.organizationId, t.projectId),
  ],
);

export type CommittedCost = typeof committedCosts.$inferSelect;
export type CommittedCostStatus = 'ACTIVE' | 'RELEASED' | 'CANCELLED';
export type CommittedCostSourceType = 'PURCHASE_ORDER';
```

---

### Lifecycle rules

- `APPROVED PO` → `ACTIVE` committed cost (created in the approve transaction)
- `APPROVED PO cancelled` → committed cost transitions to `CANCELLED`; `releasedAt` set
- Worker retry safety: if `(organizationId, 'PURCHASE_ORDER', poId)` already exists, return existing record (unique index catches duplicates; service catches `UniqueConstraintError` and returns existing)

---

### Routes — `projectScoped`

```
GET    /:organizationId/projects/:projectId/committed-costs
GET    /:organizationId/projects/:projectId/committed-costs/:committedCostId
```

No direct PATCH — committed costs are created and released by the system.

---

### Checklist

- [x] Schema + migration
- [x] Replace stub in C.8 PO approve: call `CommittedCostService.createFromPO(tx, po)`
- [x] Replace stub in C.8 PO cancel: call `CommittedCostService.cancelFromPO(tx, poId)`
- [x] Idempotency: catch unique constraint on `(organizationId, sourceType, sourceId)` → return existing
- [x] Capabilities: `project.committed_cost.read`
- [x] `writeOutboxEvent(tx, 'procurement.committed_cost.created', ...)`
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/committed_cost.test.ts`:
  - PO approved → committed cost created with correct amount and currency
  - Duplicate PO approval (retry) → exactly one committed cost (idempotent)
  - PO cancelled → committed cost status = CANCELLED
  - Tenant isolation
- [x] Tests green

---

---

## Chunk C.10 — Deliveries & Receipts

**STATUS:** `DONE`

**Prerequisites:** C.9 done.

**Goal:** Delivery = logistics event from supplier. Receipt = project acknowledgement. Quantity semantics are explicit. Delivery cumulative quantity cannot exceed PO quantity.

---

### Quantity semantics for receipts

```
quantityDelivered  = total quantity the supplier sent (what arrived on site)
quantityAccepted   = quantity accepted after inspection
quantityRejected   = quantity rejected after inspection

invariants:
  quantityAccepted + quantityRejected <= quantityDelivered
  quantityDelivered <= remaining undelivered PO item quantity (enforced in transaction)

inventory receives only: quantityAccepted
```

---

### Schema additions

```ts
export const deliveryStatusEnum = appSchema.enum('delivery_status', [
  'SCHEDULED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
]);
export const receiptStatusEnum = appSchema.enum('receipt_status', ['DRAFT', 'POSTED', 'VOIDED']);

export const deliveries = appSchema.table(
  'deliveries',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    purchaseOrderId: text('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'restrict' }),
    deliveryNumber: text('delivery_number').notNull(),
    status: deliveryStatusEnum('status').notNull().default('SCHEDULED'),
    scheduledDate: date('scheduled_date'),
    actualDeliveryDate: date('actual_delivery_date'),
    supplierReference: text('supplier_reference'),
    carrier: text('carrier'),
    trackingReference: text('tracking_reference'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('deliveries_num_unique').on(t.projectId, t.deliveryNumber),
    index('deliveries_po_idx').on(t.purchaseOrderId),
    index('deliveries_project_status_scheduled_idx').on(t.projectId, t.status, t.scheduledDate),
  ],
);

export const deliveryItems = appSchema.table(
  'delivery_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    deliveryId: text('delivery_id')
      .notNull()
      .references(() => deliveries.id, { onDelete: 'cascade' }),
    purchaseOrderItemId: text('purchase_order_item_id')
      .notNull()
      .references(() => purchaseOrderItems.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    notes: text('notes'),
  },
  (t) => [
    index('delivery_items_delivery_idx').on(t.deliveryId),
    check('delivery_items_qty_gt_0', sql`${t.quantity} > 0`),
  ],
);

export const receipts = appSchema.table(
  'receipts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    purchaseOrderId: text('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'restrict' }),
    deliveryId: text('delivery_id').references(() => deliveries.id, { onDelete: 'set null' }),
    receiptNumber: text('receipt_number').notNull(),
    status: receiptStatusEnum('status').notNull().default('DRAFT'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    receivedByMemberId: text('received_by_member_id').references(() => projectMembers.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('receipts_num_unique').on(t.projectId, t.receiptNumber),
    index('receipts_po_idx').on(t.purchaseOrderId),
    index('receipts_project_status_idx').on(t.projectId, t.status),
  ],
);

export const receiptItems = appSchema.table(
  'receipt_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    receiptId: text('receipt_id')
      .notNull()
      .references(() => receipts.id, { onDelete: 'cascade' }),
    purchaseOrderItemId: text('purchase_order_item_id')
      .notNull()
      .references(() => purchaseOrderItems.id, { onDelete: 'restrict' }),
    quantityDelivered: numeric('quantity_delivered', { precision: 15, scale: 3 }).notNull(),
    quantityAccepted: numeric('quantity_accepted', { precision: 15, scale: 3 }).notNull(),
    quantityRejected: numeric('quantity_rejected', { precision: 15, scale: 3 })
      .notNull()
      .default('0'),
    unitCode: text('unit_code').notNull(),
    rejectionReason: text('rejection_reason'),
    condition: text('condition'),
    notes: text('notes'),
  },
  (t) => [
    index('receipt_items_receipt_idx').on(t.receiptId),
    index('receipt_items_po_item_idx').on(t.purchaseOrderItemId),
    check('receipt_items_qty_delivered_gte_0', sql`${t.quantityDelivered} >= 0`),
    check('receipt_items_qty_accepted_gte_0', sql`${t.quantityAccepted} >= 0`),
    check('receipt_items_qty_rejected_gte_0', sql`${t.quantityRejected} >= 0`),
    check(
      'receipt_items_accepted_plus_rejected',
      sql`${t.quantityAccepted} + ${t.quantityRejected} <= ${t.quantityDelivered}`,
    ),
  ],
);

export type Delivery = typeof deliveries.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
export type ReceiptItem = typeof receiptItems.$inferSelect;
```

---

### Post receipt transaction

```
BEGIN
  lock PO row FOR UPDATE
  lock PO item rows FOR UPDATE
  validate: SUM(existing delivered + new delivered) <= PO item quantity
  validate: quantityAccepted + quantityRejected <= quantityDelivered
  insert receipt + receipt_items
  for each item: call inventoryService.recordReceipt(tx, projectId, materialId, quantityAccepted, ...)
  update PO status (PARTIALLY_RECEIVED or RECEIVED based on outstanding)
  auditService.log(...)
  writeOutboxEvent(tx, 'procurement.receipt.posted', ...)      = MaterialReceived
COMMIT
```

### Void receipt

Creates a `ADJUSTMENT_OUT` inventory transaction (via `inventoryService.reverseReceipt(tx, ...)`) in the same transaction. Sets receipt status to `VOIDED`. Does not mutate original receipt items.

### Delivery DELIVERED event

When delivery status transitions to `DELIVERED`, compare `scheduledDate` vs `actualDeliveryDate` and call `PerformanceService.recordEvent(tx, ...)` (C.12). Emit `procurement.delivery.delivered` = `MaterialDelivered`.

---

### Routes — `projectScoped`

```
GET    /:organizationId/projects/:projectId/deliveries
POST   /:organizationId/projects/:projectId/deliveries
GET    /:organizationId/projects/:projectId/deliveries/:deliveryId
PATCH  /:organizationId/projects/:projectId/deliveries/:deliveryId
GET    /:organizationId/projects/:projectId/receipts
POST   /:organizationId/projects/:projectId/receipts
GET    /:organizationId/projects/:projectId/receipts/:receiptId
POST   /:organizationId/projects/:projectId/receipts/:receiptId/post
POST   /:organizationId/projects/:projectId/receipts/:receiptId/void
```

---

### Checklist

- [x] Schema + migration
- [x] Numbers via allocator: series `'DL'` and `'RC'`
- [x] Delivery creation: validate cumulative delivery quantity <= PO item quantity (in transaction)
- [x] Post receipt: `FOR UPDATE` on PO + items; quantity invariants enforced; calls inventory service in same tx
- [x] Void receipt: creates reversal inventory transaction; does not mutate original receipt items
- [x] Delivery DELIVERED → performance event recorded (C.12 integration point)
- [x] Receipt rejection creates `RECEIPT_REJECTION` performance event (C.12)
- [x] Capabilities: `project.delivery.read/create/update`, `project.receipt.read/create/post/void`
- [x] `writeOutboxEvent(tx, 'procurement.receipt.posted', ...)` and `'procurement.delivery.delivered'`
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/delivery_receipt.test.ts`:
  - Create delivery → mark DELIVERED
  - Create receipt → post → inventory balance updated with `quantityAccepted` only
  - Over-delivery (exceeds PO item quantity) rejected
  - `quantityAccepted + quantityRejected > quantityDelivered` rejected
  - Concurrent receipt post for same PO item → no over-receipt
  - Void receipt → inventory balance reverses
  - Late delivery creates performance event
  - Receipt rejection creates performance event
  - Tenant isolation
- [x] Tests green

---

---

## Chunk C.11 — Inventory Transactions

**STATUS:** `DONE`

**Prerequisites:** C.10 done.

**Goal:** Append-only ledger. Balance = SUM(inbound) − SUM(outbound). Quantities always positive. Transaction type determines direction. Concurrency via `project_inventory_items` scope row lock.

---

### Schema additions

```ts
export const inventoryTransactionTypeEnum = appSchema.enum('inventory_transaction_type', [
  'RECEIPT', // + inbound from receipt
  'ISSUE', // - issued to work
  'CONSUMPTION', // - consumed on task
  'RETURN', // + returned to stock
  'ADJUSTMENT_IN', // + correction: stock added
  'ADJUSTMENT_OUT', // - correction: stock removed
  'TRANSFER_IN', // + received from another location
  'TRANSFER_OUT', // - sent to another location
]);
export const inventoryTransactionSourceTypeEnum = appSchema.enum(
  'inventory_transaction_source_type',
  ['RECEIPT', 'FIELD_LOG', 'ADJUSTMENT', 'TRANSFER', 'MANUAL'],
);

// ── Inventory scope row (stable lock target) ──────────────────────────────────
// One row per (project, material, location) bucket. This is the row we lock
// FOR UPDATE before computing balance and inserting a new transaction.
// It holds no quantity — quantity is always derived from the ledger.
export const projectInventoryItems = appSchema.table(
  'project_inventory_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'restrict' }),
    location: text('location').notNull().default('default'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('project_inventory_items_unique').on(t.projectId, t.materialId, t.location),
    index('project_inventory_items_project_idx').on(t.projectId),
  ],
);

// ── Inventory transfers (group two ledger entries) ────────────────────────────
export const inventoryTransfers = appSchema.table(
  'inventory_transfers',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    fromLocation: text('from_location').notNull(),
    toLocation: text('to_location').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdByMemberId: text('created_by_member_id').references(() => projectMembers.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('inv_transfers_project_idx').on(t.projectId),
    check('inv_transfers_different_locations', sql`${t.fromLocation} != ${t.toLocation}`),
    check('inv_transfers_qty_gt_0', sql`${t.quantity} > 0`),
  ],
);

export const inventoryTransactions = appSchema.table(
  'inventory_transactions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    inventoryItemId: text('inventory_item_id')
      .notNull()
      .references(() => projectInventoryItems.id, { onDelete: 'restrict' }),
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'restrict' }),
    transactionType: inventoryTransactionTypeEnum('transaction_type').notNull(),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    sourceType: inventoryTransactionSourceTypeEnum('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    transferId: text('transfer_id').references(() => inventoryTransfers.id, {
      onDelete: 'set null',
    }),
    reversalOfTransactionId: text('reversal_of_transaction_id'), // self-reference, no FK (append-only)
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    costCodeId: text('cost_code_id').references(() => projectCostCodes.id, {
      onDelete: 'set null',
    }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdByMemberId: text('created_by_member_id').references(() => projectMembers.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('inv_tx_project_material_idx').on(t.projectId, t.materialId),
    index('inv_tx_org_project_idx').on(t.organizationId, t.projectId),
    index('inv_tx_source_idx').on(t.sourceType, t.sourceId),
    index('inv_tx_task_idx').on(t.taskId),
    index('inv_tx_transfer_idx').on(t.transferId),
    check('inv_tx_qty_gt_0', sql`${t.quantity} > 0`), // always positive; direction from transaction_type
  ],
);

export type ProjectInventoryItem = typeof projectInventoryItems.$inferSelect;
export type InventoryTransfer = typeof inventoryTransfers.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InventoryTransactionType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'CONSUMPTION'
  | 'RETURN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';
```

---

### Concurrency-safe consume pattern

```ts
// Always positive quantities. Direction implied by transaction_type.
// INBOUND types:  RECEIPT, RETURN, ADJUSTMENT_IN, TRANSFER_IN  → add to balance
// OUTBOUND types: ISSUE, CONSUMPTION, ADJUSTMENT_OUT, TRANSFER_OUT → subtract from balance

async consume(tx, orgId, projectId, materialId, location, quantity, ...) {
  // 1. Upsert project_inventory_items row (INSERT ... ON CONFLICT DO NOTHING)
  // 2. Lock the inventory scope row FOR UPDATE
  // 3. Calculate current balance from inventory_transactions ledger
  // 4. Verify balance >= quantity (reject if insufficient)
  // 5. Insert CONSUMPTION transaction (quantity > 0)
}
```

### Transfer pattern

One `inventoryTransfers` record + two `inventoryTransactions` (TRANSFER_OUT from `fromLocation`, TRANSFER_IN to `toLocation`), all in one transaction.

### Reversal linkage

When voiding a receipt or correcting: the new correction transaction sets `reversalOfTransactionId = originalTransactionId`. The original transaction is never mutated.

---

### Balance query

```sql
SELECT SUM(CASE
  WHEN transaction_type IN ('RECEIPT','RETURN','ADJUSTMENT_IN','TRANSFER_IN') THEN quantity
  ELSE -quantity
END) AS balance
FROM app.inventory_transactions
WHERE project_id = $1 AND material_id = $2 AND inventory_item_id = $3
```

---

### Routes — `projectScoped`

```
GET    /:organizationId/projects/:projectId/inventory
GET    /:organizationId/projects/:projectId/inventory/:materialId
GET    /:organizationId/projects/:projectId/inventory/:materialId/transactions
POST   /:organizationId/projects/:projectId/inventory/adjustments
POST   /:organizationId/projects/:projectId/inventory/transfers
```

---

### Checklist

- [x] Schema + migration
- [x] Upsert `project_inventory_items` row + `FOR UPDATE` lock before every consumption/adjustment
- [x] `recordReceipt(tx, ...)` and `reverseReceipt(tx, ...)` (called from C.10)
- [x] `consume(tx, ...)` with balance check and lock
- [x] `transfer(tx, ...)` creates both TRANSFER_OUT + TRANSFER_IN in one transaction
- [x] `adjust(tx, ...)` creates ADJUSTMENT_IN or ADJUSTMENT_OUT
- [x] All quantities stored positive; direction from transaction type
- [x] `reversalOfTransactionId` set for all reversal transactions
- [x] Capabilities: `project.inventory.read/adjust`
- [x] `writeOutboxEvent(tx, 'procurement.inventory.adjusted', ...)` for manual adjustments
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/inventory.test.ts`:
  - Balance correctly derived from ledger (never stored)
  - Concurrent consumption → balance respected (only one succeeds if stock covers only one)
  - Adjustment creates inverse transaction, not mutation
  - Transfer: both locations updated atomically
  - Reversal transaction links to original via `reversalOfTransactionId`
  - Negative balance attempt rejected
  - Tenant isolation
- [x] Tests green

---

---

## Chunk C.12 — Supplier / Partner Performance History

**STATUS:** `DONE`

**Prerequisites:** C.11 done (or C.10 for the delivery/receipt facts).

**Goal:** Append-only operational performance facts for both suppliers and subcontractors. No scoring formula invented in this phase.

---

### Schema additions

```ts
export const partnerTypeEnum = appSchema.enum('partner_type', ['SUPPLIER', 'SUBCONTRACTOR']);

export const partnerPerformanceEventTypeEnum = appSchema.enum('partner_performance_event_type', [
  // Supplier facts
  'DELIVERY_ON_TIME',
  'DELIVERY_LATE',
  'DELIVERY_PARTIAL',
  'DELIVERY_CANCELLED',
  'RECEIPT_REJECTION',
  'RECEIPT_DISCREPANCY',
  'PO_CANCELLED',
  // Subcontractor facts
  'WORK_COMPLETED',
  'WORK_COMPLETED_LATE',
  'WORK_DELAYED',
  'SCOPE_CHANGE',
  'QUALITY_ISSUE',
]);

export const partnerPerformanceEvents = appSchema.table(
  'partner_performance_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    partnerType: partnerTypeEnum('partner_type').notNull(),
    supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    subcontractorId: text('subcontractor_id').references(() => subcontractors.id, {
      onDelete: 'set null',
    }),
    sourceType: text('source_type').notNull(), // 'DELIVERY' | 'RECEIPT' | 'PURCHASE_ORDER' | 'TASK'
    sourceId: text('source_id').notNull(),
    eventType: partnerPerformanceEventTypeEnum('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    metricValue: numeric('metric_value', { precision: 10, scale: 2 }),
    unit: text('unit'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('partner_perf_events_source_unique').on(
      t.sourceType,
      t.sourceId,
      t.eventType,
      t.supplierId,
      t.subcontractorId,
    ),
    // Partial: supplierId or subcontractorId must be non-null (enforced in service)
    index('partner_perf_events_supplier_idx').on(t.supplierId),
    index('partner_perf_events_sub_idx').on(t.subcontractorId),
    index('partner_perf_events_project_idx').on(t.projectId),
    index('partner_perf_events_source_idx').on(t.sourceType, t.sourceId),
  ],
);

export type PartnerPerformanceEvent = typeof partnerPerformanceEvents.$inferSelect;
export type PartnerType = 'SUPPLIER' | 'SUBCONTRACTOR';
export type PartnerPerformanceEventType =
  | 'DELIVERY_ON_TIME'
  | 'DELIVERY_LATE'
  | 'DELIVERY_PARTIAL'
  | 'DELIVERY_CANCELLED'
  | 'RECEIPT_REJECTION'
  | 'RECEIPT_DISCREPANCY'
  | 'PO_CANCELLED'
  | 'WORK_COMPLETED'
  | 'WORK_COMPLETED_LATE'
  | 'WORK_DELAYED'
  | 'SCOPE_CHANGE'
  | 'QUALITY_ISSUE';
```

---

### Idempotency

The unique index on `(sourceType, sourceId, eventType, supplierId, subcontractorId)` prevents duplicate performance events for the same operational fact. Worker retries are safe. Service catches unique constraint violations and returns existing event.

### Event generation (inside existing service transactions)

- Delivery → DELIVERED: compare `scheduledDate` vs `actualDeliveryDate` → `DELIVERY_ON_TIME` or `DELIVERY_LATE`
- Receipt posted with `quantityRejected > 0`: → `RECEIPT_REJECTION`
- Delivery is `PARTIAL` (delivered quantity < ordered): → `DELIVERY_PARTIAL`
- Approved PO cancelled: → `PO_CANCELLED`
- Subcontractor task completed vs planned: → `WORK_COMPLETED` or `WORK_COMPLETED_LATE`

> C.12 stores **immutable operational facts** synchronously. Aggregate scores, dashboards, and analytics are future read-model work (Phase F). Do not invent a score formula.

---

### Routes — `projectScoped`

```
GET    /:organizationId/projects/:projectId/performance/suppliers/:supplierId
GET    /:organizationId/projects/:projectId/performance/subcontractors/:subcontractorId
```

---

### Checklist

- [x] Schema + migration (unique index in SQL for partial case)
- [x] `PartnerPerformanceService.recordEvent(tx, ...)` — called from delivery and receipt services
- [x] Idempotency: catch unique constraint on duplicate source event, return existing
- [x] Subcontractor performance facts recorded when task-assignment task completes
- [x] Both supplier and subcontractor facts handled by the same `partnerPerformanceEvents` table
- [x] New files: `performance/` — types, repository, service, handler
- [x] Routes in `project.routes.ts`
- [x] `pnpm --filter server typecheck` — clean
- [x] `tests/integration/performance_history.test.ts`:
  - Late delivery creates `DELIVERY_LATE` event
  - On-time delivery creates `DELIVERY_ON_TIME` event
  - Receipt rejection creates `RECEIPT_REJECTION` event
  - Worker retry on same source → idempotent (one event, not duplicates)
  - Subcontractor task completion creates `WORK_COMPLETED` or `WORK_COMPLETED_LATE`
  - Supplier and subcontractor events separate and correctly typed
  - Tenant isolation
- [x] Tests green

---

---

## Phase C Exit Gate

**ALL of the following must be true before Phase C is declared complete:**

### Functional

- [x] All 12 chunks STATUS = DONE
- [x] End-to-end: Project → Material Request → Quote → Approval → PO → Committed Cost → Delivery → Receipt → Inventory
- [x] End-to-end: Project → Subcontractor → Project Assignment → Task Assignment → Performance event

### Correctness

- [x] Concurrent PO approval race → exactly one winner
- [x] Concurrent receipt posting race → no over-receipt; delivery quantity enforced
- [x] Concurrent inventory consumption race → balance respected
- [x] Committed cost idempotency → exactly one record per PO (tested with worker-retry simulation)
- [x] Document number allocator → no duplicates under concurrency

### Isolation

- [x] Cross-org: every create/update/action on every procurement entity fails when org mismatches
- [x] Cross-project: taskId, costCodeId, phaseId from other project rejected in all create flows
- [x] Cross-org supplier used in another org's PO rejected

### Financial

- [x] Server-calculated totals match expected values (decimal arithmetic — no float rounding errors)
- [x] Subtotal / discount / tax / total semantics correct per Global Rule 13
- [x] Committed cost amount matches PO totalAmount at approval time
- [x] PO cancellation releases committed cost

### Infrastructure

- [x] Redis: cache hit, invalidation on write, TTL expiry fallback, Redis outage → DB fallback, tenant key isolation — all verified
- [x] No Redis locks used for any approval, receipt, inventory, or commitment operation
- [x] All domain events via `writeOutboxEvent()` inside transactions
- [x] Consistent `procurement.xxx.yyy` event naming across all modules

### Quality

- [x] `pnpm --filter server typecheck` — clean
- [x] All integration + concurrency tests green
- [x] No N+1 queries on list endpoints (verified with query count assertion or EXPLAIN)
- [x] All list endpoints paginated (`createdAt DESC, id DESC` cursor, limit ≤ 100)
- [x] No existing Phase 2/3 tests broken (full suite runs clean)

### Schedule integration (connection to Phase 3 Schedule Execution Core)

- [x] `procurement.purchase_order.sent` event = `MaterialOrdered` — consumed or ready to be consumed by schedule-impact workflow
- [x] `procurement.delivery.delivered` event = `MaterialDelivered` — emitted and named consistently
- [x] `procurement.receipt.posted` event = `MaterialReceived` — emitted and named consistently
- [x] These events do NOT directly modify task dates — they are inputs to the existing schedule-impact workflow

---

## What Must NOT Be Built in This Phase

```
RFIs / Submittals / Document management
Quality / Safety / Compliance
Change Orders for POs
Subcontractor contract versioning / payment applications / retainage
Project Budget / Actual Cost / Billing / Invoices / Payments
Notifications
Reporting dashboards / analytics / scoring
AI Procurement Agent
BOQ table (boqLineId columns are nullable text only)
Unit conversion system
Structured payment terms on suppliers
supplier_project_links / approved-supplier-list per project
SUBCONTRACTOR_COMMITMENT source type for committed costs
```
