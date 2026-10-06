# SiteFlow — Phase D: Documents, Compliance & Operations

**Chunks 6.1 – 6.9**

**Reference:** `checklist_when_to_apply.md` — Tier 1 rules apply during every chunk; Tier 2 gate runs after Chunk 6.9
**Compatibility contract:** Must not break Phase 1 (Auth/Org), Phase 2 (Project Core), Phase 3 (Schedule), Phase C (Procurement)
**Exit condition:** Project information, approvals, evidence, and compliance workflows are structured and auditable

---

## The one immutable rule for every Phase D chunk

> **No Phase D module may introduce its own alternative implementation of an existing platform concern.**

Phase D reuses — it does NOT reinvent:

| Concern                     | Where it lives — never duplicate this                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication              | `auth.middleware.ts` → `authenticate` hook                                                                                           |
| Org-level authorization     | `permission.middleware.ts` → `requirePermission(...)`                                                                                |
| Project-level authorization | `project.middleware.ts` → `requireProjectPermission(...)`                                                                            |
| Tenant isolation            | `organizationId` from `req.orgContext`, never from body/query                                                                        |
| Audit logging               | `auditService.log(...)` — same call, same table                                                                                      |
| Domain events               | `writeOutboxEvent(tx, ...)` inside the DB transaction                                                                                |
| Background jobs             | `PgBoss` via existing queue infrastructure                                                                                           |
| Redis caching               | Cache-aside, orgId in key, try/catch, no correctness ops                                                                             |
| API response shape          | `createSuccessResponse` / `createErrorResponse` from `shared/response.ts`                                                            |
| Error codes                 | Extend existing error classes in `auth.errors.ts` or create domain-specific `*.errors.ts`                                            |
| Observability               | `createLogger({ name: '...' })`, OTel auto-instrumentation                                                                           |
| Document numbers            | `documentNumberService.allocateDocumentNumber(tx, orgId, projectId, series, yyyymm())`                                               |
| Transaction pattern         | `db.transaction(async tx => {...})` — never multi-step outside a tx                                                                  |
| RBAC policy                 | Add new capabilities to **both** `PROJECT_ROLE_CAPABILITIES` and `ORG_LEVEL_AUTHORITY_MAP` in `project.policy.ts` in the same commit |

---

## Architecture constraints locked for all 8 domain chunks

**Storage:**

- PostgreSQL stores document truth and all metadata — binary files live in MinIO/S3 only
- Presigned URLs are generated server-side after authorization — server never proxies file bytes
- Object storage key format: `{orgId}/{projectId}/{category}/{YYYY/MM}/{fileId}.{ext}`
- `STORAGE_PRESIGN_EXPIRY_SECONDS` controls URL lifetime (default 3600s)

**Cross-module references (read-only FK, never duplicate truth):**

- `tasks.id` — RFI/submittal/quality/safety may reference a task; they do NOT own task dates
- `projects.id`, `project_members.id` — all Phase D tables scope to project membership
- `subcontractors.id` — compliance may reference a subcontractor; does NOT duplicate subcontractor master
- `suppliers.id`, `purchase_orders.id` — documents may attach to procurement entities via `document_entity_links`
- `schedule_source_type` enum already has `RFI` and `CHANGE_ORDER` — use these when linking schedule changes

**State machine rules (apply to every Phase D entity with lifecycle):**

- Status read inside transaction with `SELECT ... FOR UPDATE` (`findByIdForUpdate`) before every transition
- Invalid transition → 422 with machine-readable `code`
- Every transition writes `auditService.log(...)` and (where applicable) a scoped `writeOutboxEvent(tx, ...)`
- Terminal states (CLOSED, APPROVED where non-reversible, VOIDED) cannot transition further

**Concurrency rule:**

- Every action route (`/submit`, `/respond`, `/review`, `/close`, `/complete`, `/verify`) uses `findByIdForUpdate` — no exceptions

**Pagination rule:**

- All list endpoints: cursor-based (`createdAt DESC, id DESC`), `limit` max 100, `nextCursor` in response

**Indexes — every new table must have:**

- `(organization_id, project_id)` composite index
- `(project_id, status)` index where status is filterable
- FK columns indexed individually
- Partial indexes on `(expiry_date, expires_notified)` where applicable (for D.8 scanner)

---

## Phase D Foundation Primitives (establish in Chunk 6.1, reuse in 6.2–6.8)

These are the minimum shared patterns that every Phase D domain module reuses. Not a framework — just consistency.

### 1. `findByIdForUpdate<T>(tx, id)` pattern

Every domain-specific repository gets this method. Copy from `purchase-order.repository.ts`:

```ts
async findByIdForUpdate(tx: any, id: string): Promise<T | undefined> {
  await tx.execute(sql`SELECT id FROM app.<table> WHERE id = ${id} FOR UPDATE`);
  return this.findById(tx, id);
}
```

### 2. `DocumentEntityLink` helper (established in 6.1, used everywhere)

All Phase D entities attach evidence via `document_entity_links`. A single `linkDocument(tx, { orgId, docId, entityType, entityId, createdBy })` helper in the document service covers all modules.

### 3. Status transition validator pattern

Each module defines its own `validateTransition(current, target)` function that throws a typed error — same pattern as `purchase-order.service.ts` and `quote.service.ts`.

### 4. Shared `yyyymm()` utility

Already exists in `delivery.service.ts`. Move to `lib/date.ts` in Chunk 6.1 so all Phase D modules share it.

### 5. RBAC additions — single commit rule

When any chunk adds new capabilities, add them to **both** maps in `project.policy.ts` in the **same commit** as the route registration. Never register a route with a capability that isn't in the policy map.

---

## Completion Tracker

| Task | What                                                          | Status      |
| ---- | ------------------------------------------------------------- | ----------- |
| P.0  | Storage abstraction (`StorageService` interface + MinIO impl) | DONE |
| 6.1  | Document schema + migration + foundation primitives           | DONE |
| 6.2  | Document versions, access, relationships, API                 | DONE |
| 6.3  | Permits + inspections + compliance records                    | DONE |
| 6.4  | RFIs                                                          | DONE |
| 6.5  | Submittals                                                    | DONE |
| 6.6  | Quality inspections + deficiencies + corrective actions       | DONE |
| 6.7  | Safety events + meetings                                      | DONE |
| 6.8  | Compliance expiration scanner + event foundation              | DONE |
| 6.9  | Integration + security + concurrency + performance gate       | DONE |

---

## P.0 — Storage Abstraction

**STATUS:** DONE
**Must be done before 6.1**

**Location:** `apps/server/src/lib/storage/`

- `storage.interface.ts`
- `storage.service.ts` (MinIO implementation — package: `minio`)
- `index.ts` (singleton `getStorageService()`)

**Interface (keep this minimal — no more, no less):**

```ts
export interface StorageService {
  putPresignedUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string>;
  getPresignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
  headObject(key: string): Promise<{ size: number; etag: string; contentType: string } | null>;
  objectKey(
    orgId: string,
    projectId: string,
    category: string,
    fileId: string,
    ext: string,
  ): string;
}
```

**New env var:**
Add to `packages/env/src/server.ts`:

```ts
STORAGE_PRESIGN_EXPIRY_SECONDS: z.coerce.number().default(3600),
```

Add to `.env.example` under MinIO section:

```
STORAGE_PRESIGN_EXPIRY_SECONDS=3600
```

**Rule:** No direct MinIO import anywhere outside `lib/storage/storage.service.ts`.

**Quality gates:**

- `pnpm --filter server typecheck` exits 0
- `getStorageService()` returns same instance on repeated calls (singleton)
- Unit test: `objectKey()` produces correct path format

**Changes made:** Added the MinIO-backed `StorageService`, validated tenant-scoped object keys and presign expiries, documented the expiry setting, and verified the singleton/object-key behavior with storage tests.

---

## Chunk 6.1 — Object Storage + Document Foundation

**STATUS:** DONE
**Depends on:** P.0
**Tier 1 checklist sections:** §1 (performance), §2 (concurrency), §4 (multi-tenant), §8 (database)

### What this chunk delivers

- `packages/database/src/schema/documents.schema.ts` — all document tables
- Migration file via `pnpm db:generate` + `pnpm db:migrate`
- Move `yyyymm()` to `apps/server/src/lib/date.ts`
- Update `taskDocumentLinks` FK to reference `documents.id` (migration addendum)

### Schema: `documents`

```
id                text PK
organization_id   text NOT NULL → organizations.id RESTRICT
project_id        text NOT NULL → projects.id CASCADE
category          document_category_enum NOT NULL
title             text NOT NULL (max 500)
description       text
status            document_status_enum NOT NULL DEFAULT 'PENDING_UPLOAD'
current_version   integer NOT NULL DEFAULT 1
uploaded_by       text → users.id SET NULL
file_name         text NOT NULL
file_size         bigint NOT NULL                 -- bytes, must be > 0
content_type      text NOT NULL                   -- MIME type
checksum          text                            -- SHA-256 hex, set on complete
storage_key       text                            -- set on upload completion
access_policy     document_access_enum NOT NULL DEFAULT 'PROJECT_MEMBERS'
expiry_date       date
expires_notified  boolean NOT NULL DEFAULT false
created_at        timestamptz NOT NULL DEFAULT now()
updated_at        timestamptz NOT NULL DEFAULT now()
```

CHECK: `file_size > 0`

### Schema: `document_versions` (immutable once storage_key set)

```
id              text PK
document_id     text NOT NULL → documents.id CASCADE
organization_id text NOT NULL → organizations.id RESTRICT
version_number  integer NOT NULL
uploaded_by     text → users.id SET NULL
file_name       text NOT NULL
file_size       bigint NOT NULL
content_type    text NOT NULL
checksum        text
storage_key     text NOT NULL   -- never overwritten after set
notes           text
created_at      timestamptz NOT NULL DEFAULT now()
```

UNIQUE: `(document_id, version_number)`

### Schema: `document_entity_links` (Phase D universal attachment join table)

```
id              text PK
organization_id text NOT NULL
document_id     text NOT NULL → documents.id CASCADE
entity_type     text NOT NULL   -- 'task' | 'rfi' | 'submittal' | 'permit' | 'inspection' | 'compliance_record' | 'quality_inspection' | 'quality_deficiency' | 'safety_event' | 'purchase_order' | 'receipt'
entity_id       text NOT NULL
created_by      text → users.id SET NULL
created_at      timestamptz NOT NULL DEFAULT now()
```

UNIQUE: `(document_id, entity_type, entity_id)`

### Schema: `document_access_logs` (append-only, never updated)

```
id              text PK
organization_id text NOT NULL
document_id     text NOT NULL → documents.id CASCADE
accessed_by     text NOT NULL → users.id RESTRICT
access_type     text NOT NULL   -- 'DOWNLOAD' | 'UPLOAD_COMPLETE' | 'VERSION_CREATED'
ip_address      text
occurred_at     timestamptz NOT NULL DEFAULT now()
```

### Enums

```
document_category:  DRAWING, SPECIFICATION, PERMIT, CERTIFICATE, REPORT, PHOTO, VIDEO, CONTRACT, INVOICE, OTHER
document_status:    PENDING_UPLOAD, ACTIVE, SUPERSEDED, ARCHIVED, DELETED
document_access:    PROJECT_MEMBERS, PROJECT_MANAGERS_ONLY, ADMIN_ONLY
```

### Required indexes

```
documents_org_project_idx             on (organization_id, project_id)
documents_project_category_status_idx on (project_id, category, status)
documents_project_created_idx         on (project_id, created_at DESC, id DESC)
documents_expiry_partial_idx          on (expiry_date, expires_notified) WHERE status = 'ACTIVE'  -- partial
document_versions_doc_idx             on (document_id)
document_entity_links_entity_idx      on (entity_type, entity_id)
document_entity_links_doc_idx         on (document_id)
document_access_logs_doc_idx          on (document_id, occurred_at DESC)
```

### Quality gates

- `pnpm db:generate` produces migration
- `pnpm db:migrate` runs clean on fresh DB
- `taskDocumentLinks.documentId` FK updated in migration to reference `documents.id`
- `yyyymm()` removed from `delivery.service.ts` and `quote.service.ts`, imported from `lib/date.ts`
- `pnpm --filter server typecheck` exits 0

**Changes made:** Added document, version, entity-link, and access-log tables; generated migrations including the task-document FK; moved `yyyymm()` to `lib/date.ts`; and added the document processing fields needed to verify uploaded checksums asynchronously. Migration and server typecheck passed.

---

## Chunk 6.2 — Document Versions, Access & Relationships

**STATUS:** DONE
**Depends on:** 6.1, P.0
**Tier 1 checklist sections:** §4 (OWASP BOLA), §5 (auth), §6 (input security)

### Routes (10 total)

```
POST   /:orgId/projects/:projectId/documents
       body: { title, category, fileName, contentType, fileSize, description?, accessPolicy?, expiryDate? }
       → 201: { document: DocumentDTO, uploadUrl: string }

POST   /:orgId/projects/:projectId/documents/:docId/complete
       body: { checksum: string }
       → 200: { document: DocumentDTO }

GET    /:orgId/projects/:projectId/documents
       query: { cursor?, limit?, category?, status? }
       → 200: { data: DocumentDTO[], nextCursor: string | null }

GET    /:orgId/projects/:projectId/documents/:docId
       → 200: { document: DocumentDTO }

GET    /:orgId/projects/:projectId/documents/:docId/download
       → 200: { downloadUrl: string, expiresIn: number }

PATCH  /:orgId/projects/:projectId/documents/:docId
       body: { title?, description?, accessPolicy?, expiryDate? }
       → 200: { document: DocumentDTO }

DELETE /:orgId/projects/:projectId/documents/:docId
       → 204  (soft-delete: status → DELETED, storage_key retained)

POST   /:orgId/projects/:projectId/documents/:docId/versions
       body: { fileName, contentType, fileSize, notes? }
       → 201: { version: DocumentVersionDTO, uploadUrl: string }

POST   /:orgId/projects/:projectId/documents/:docId/versions/:versionId/complete
       body: { checksum: string }
       → 200: { version: DocumentVersionDTO, document: DocumentDTO }

GET    /:orgId/projects/:projectId/documents/:docId/versions
       → 200: { versions: DocumentVersionDTO[] }
```

### Service responsibilities

- `initiateUpload()` — creates `documents` row with `PENDING_UPLOAD`, returns `storageService.putPresignedUrl(key, contentType, expiresIn)`
- `completeUpload()` — `storageService.headObject(key)` to verify file exists, sets `status=ACTIVE` + `checksum` inside tx, writes `document.uploaded` outbox event, appends `document_access_logs` entry
- `getDownloadUrl()` — enforces `access_policy` check, calls `storageService.getPresignedUrl()`, appends `document_access_logs` entry, returns URL
- `initiateNewVersion()` — creates `document_versions` row, returns presigned PUT URL; does NOT change `current_version` yet
- `completeVersion()` — sets checksum on version row, increments `documents.current_version`, writes `document.version_created` outbox event
- `deleteDocument()` — sets `status=DELETED` only; does NOT call `storageService.deleteObject()` (physical cleanup is a separate admin operation — retains audit trail)
- `linkDocument(tx, { orgId, docId, entityType, entityId, createdBy })` — creates `document_entity_links` row; this helper is called by D.3–D.7

### Access policy enforcement (in `getDownloadUrl`)

| Policy                  | Who can download                               |
| ----------------------- | ---------------------------------------------- |
| `PROJECT_MEMBERS`       | Any active project member                      |
| `PROJECT_MANAGERS_ONLY` | Role is `PROJECT_MANAGER` or `SITE_SUPERVISOR` |
| `ADMIN_ONLY`            | Org-level `project:admin` permission           |

Wrong-org `docId` → 404 always. Never return presigned URL before authorization passes.

### RBAC capabilities (add to `project.policy.ts` in same commit as route registration)

```
project.document.upload          PM, SS, PM_MEMBER, FINANCE, PROCUREMENT
project.document.download        PM, SS, PM_MEMBER, FINANCE, PROCUREMENT, SUBCONTRACTOR, CLIENT
project.document.manage          PM, SS
project.document.version         PM, SS, PROCUREMENT
```

Org-level authority map entries: all read capabilities → `['project:read:any', 'project:write:any', 'project:admin']`, write → `['project:write:any', 'project:admin']`

### Outbox events

- `document.uploaded` — `{ organizationId, projectId, documentId, category }`
- `document.version_created` — `{ organizationId, projectId, documentId, versionNumber }`

### Shared schema

`packages/shared/src/modules/project/document.schema.ts` — export Zod schemas for all request bodies and query params

### Quality gates

- Upload → complete → status=ACTIVE verified in integration test
- Wrong-org `docId` on download → 404 (not presigned URL)
- Version: v1 `storage_key` unchanged after v2 created
- `access_policy=PROJECT_MANAGERS_ONLY` blocks `PROJECT_MEMBER` download
- `pnpm --filter server typecheck` exits 0

**Changes made:** Implemented all ten document routes, request schemas, RBAC, tenant-scoped access checks, audit/outbox writes, versioning, soft deletion, and asynchronous checksum verification. Integration coverage exercises upload, processing, download authorization, cross-tenant 404, and immutable prior-version storage keys.

---

## Chunk 6.3 — Permits, Inspections & Compliance Records

**STATUS:** DONE
**Depends on:** 6.1 (document_entity_links)
**Tier 1 checklist sections:** §2 (concurrency — permit status transitions), §4 (tenant isolation)

### Design principle

Free-text `permit_type`, `inspection_type`, `requirement_type` — not jurisdiction-specific enums. The generic model covers any construction context.

### New schema file: `packages/database/src/schema/compliance.schema.ts`

**`permits`**

```
id                   text PK
organization_id      text NOT NULL → organizations.id RESTRICT
project_id           text NOT NULL → projects.id CASCADE
permit_type          text NOT NULL          -- 'Building Permit', 'Environmental', etc.
reference_number     text
issuing_authority    text
responsible_member_id text → project_members.id SET NULL
status               permit_status_enum NOT NULL DEFAULT 'PENDING'
issue_date           date
effective_date       date
expiry_date          date
expires_notified     boolean NOT NULL DEFAULT false
notes                text
created_by           text → users.id SET NULL
created_at           timestamptz NOT NULL DEFAULT now()
updated_at           timestamptz NOT NULL DEFAULT now()
```

**`compliance_inspections`** (separate from quality_inspections in D.6)

```
id                   text PK
organization_id      text NOT NULL → organizations.id RESTRICT
project_id           text NOT NULL → projects.id CASCADE
permit_id            text → permits.id SET NULL
inspection_type      text NOT NULL          -- free text
scheduled_date       date
performed_date       date
inspector_name       text
responsible_member_id text → project_members.id SET NULL
status               compliance_inspection_status_enum NOT NULL DEFAULT 'SCHEDULED'
result               compliance_inspection_result_enum
findings             text
notes                text
created_by           text → users.id SET NULL
created_at           timestamptz NOT NULL DEFAULT now()
updated_at           timestamptz NOT NULL DEFAULT now()
```

**`compliance_records`**

```
id                   text PK
organization_id      text NOT NULL → organizations.id RESTRICT
project_id           text NOT NULL → projects.id CASCADE
requirement_type     text NOT NULL          -- 'Insurance', 'License', 'Certificate', 'Safety', etc.
subject_type         text                   -- 'SUBCONTRACTOR' | 'PROJECT' | 'ORGANIZATION'
subject_id           text                   -- FK value (subcontractor_id etc.) — not a hard FK
responsible_member_id text → project_members.id SET NULL
status               compliance_status_enum NOT NULL DEFAULT 'PENDING'
effective_date       date
expiry_date          date
expires_notified     boolean NOT NULL DEFAULT false
verification_ref     text
notes                text
created_by           text → users.id SET NULL
created_at           timestamptz NOT NULL DEFAULT now()
updated_at           timestamptz NOT NULL DEFAULT now()
```

### Enums

```
permit_status:                     PENDING, APPLIED, ISSUED, ACTIVE, EXPIRED, REVOKED, CANCELLED
compliance_inspection_status:      SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, FAILED
compliance_inspection_result:      PASS, PASS_WITH_CONDITIONS, FAIL, INCONCLUSIVE
compliance_status:                 PENDING, ACTIVE, EXPIRING_SOON, EXPIRED, CANCELLED, VERIFIED
```

### State machines

**Permit:**

```
PENDING → APPLIED → ISSUED → ACTIVE → EXPIRED (system-set by D.8)
Any non-terminal → REVOKED (admin action)
Any non-terminal → CANCELLED
```

**Compliance record:**

```
PENDING → ACTIVE (on verification)
ACTIVE → VERIFIED (on manual verification confirmation)
ACTIVE → EXPIRING_SOON (system-set by D.8)
EXPIRING_SOON → EXPIRED (system-set by D.8)
Any non-terminal → CANCELLED
```

### Routes (15 total across 3 entities)

```
POST/GET/GET/:id/PATCH/DELETE  /:orgId/projects/:projectId/permits
POST                           /:orgId/projects/:projectId/permits/:permitId/transition
                               body: { status: 'APPLIED'|'ISSUED'|'ACTIVE'|'REVOKED'|'CANCELLED' }
POST                           /:orgId/projects/:projectId/permits/:permitId/documents

POST/GET/GET/:id/PATCH/DELETE  /:orgId/projects/:projectId/compliance-inspections
POST                           /:orgId/projects/:projectId/compliance-inspections/:id/complete
                               body: { result, findings?, performedDate }
POST                           /:orgId/projects/:projectId/compliance-inspections/:id/documents

POST/GET/GET/:id/PATCH/DELETE  /:orgId/projects/:projectId/compliance-records
POST                           /:orgId/projects/:projectId/compliance-records/:id/verify
                               body: { verificationRef? }
POST                           /:orgId/projects/:projectId/compliance-records/:id/documents
```

### Required indexes

```
permits_project_status_expiry_idx         on (project_id, status, expiry_date)
permits_expiry_partial_idx                on (expiry_date, expires_notified) WHERE status IN ('ISSUED','ACTIVE')
compliance_records_project_status_idx     on (project_id, status)
compliance_records_expiry_partial_idx     on (expiry_date, expires_notified) WHERE status = 'ACTIVE'
compliance_inspections_project_status_idx on (project_id, status)
compliance_inspections_permit_idx         on (permit_id)
```

### RBAC capabilities

```
project.permit.read      PM, SS, PM_MEMBER, FINANCE
project.permit.manage    PM, SS
project.compliance_inspection.read    PM, SS, PM_MEMBER
project.compliance_inspection.manage  PM, SS
project.compliance_record.read    PM, SS, PM_MEMBER, FINANCE
project.compliance_record.manage  PM, SS
```

### Outbox events

- `permit.status_changed` — `{ organizationId, projectId, permitId, status }`
- `compliance_record.verified` — `{ organizationId, projectId, complianceRecordId }`

### Shared schema

`packages/shared/src/modules/project/compliance.schema.ts`

### Quality gates

- `POST .../permits/:id/documents` creates `document_entity_links` row with `entity_type='permit'`
- Permit transition invalid → 422
- Wrong-org `permitId` → 404
- `pnpm --filter server typecheck` exits 0

**Changes made:** Added the Drizzle schemas and migration, shared validation, scoped CRUD/list/detail routes, project RBAC, audit/outbox handling, transactional ownership checks, row-locked permit transitions, inspection completion, compliance-record activation/verification, and document evidence links. Added an integration test covering transition rejection, scoped pagination, document linking, foreign-project permit/subcontractor rejection, verified records, and cross-tenant read/update/delete 404s.

---

## Chunk 6.4 — RFIs

**STATUS:** DONE
**Depends on:** 6.2 (document attachment), 6.1 (document_entity_links)
**Tier 1 checklist sections:** §2 (FOR UPDATE on transitions), §4 (task cross-reference)

### Core principle

RFI records decision/evidence/impact. It does NOT own task schedule truth.

- `linked_task_id` is a soft reference — if the task is deleted, the RFI record remains
- `schedule_impact_days` is recorded information only — the actual task dates are updated separately by PM via the schedule engine

### New schema file: `packages/database/src/schema/rfi.schema.ts`

**`rfis`**

```
id                    text PK
organization_id       text NOT NULL → organizations.id RESTRICT
project_id            text NOT NULL → projects.id CASCADE
rfi_number            text NOT NULL          -- series 'RFI' via documentNumberService
title                 text NOT NULL
question              text NOT NULL
discipline            text                   -- 'Structural', 'MEP', 'Architectural', etc.
status                rfi_status_enum NOT NULL DEFAULT 'DRAFT'
priority              rfi_priority_enum NOT NULL DEFAULT 'NORMAL'
submitted_by          text → users.id SET NULL
recipient_name        text
due_date              date
response              text
responded_by          text → users.id SET NULL
responded_at          timestamptz
schedule_impact_days  integer NOT NULL DEFAULT 0  -- recorded info only
cost_impact           numeric(15,2)
linked_task_id        text → tasks.id SET NULL    -- informational reference
notes                 text
created_by            text → users.id SET NULL
created_at            timestamptz NOT NULL DEFAULT now()
updated_at            timestamptz NOT NULL DEFAULT now()
```

### Enums

```
rfi_status:   DRAFT, OPEN, UNDER_REVIEW, ANSWERED, CLOSED, CANCELLED
rfi_priority: LOW, NORMAL, HIGH, URGENT
```

### State machine

```
DRAFT → OPEN         (submit — requireProjectPermission('project.rfi.create'))
OPEN → UNDER_REVIEW  (respond begins — system transition, or manual by reviewer)
UNDER_REVIEW → ANSWERED  (respond complete — requireProjectPermission('project.rfi.respond'))
ANSWERED → CLOSED    (close — requireProjectPermission('project.rfi.manage'))
Any non-CLOSED/CANCELLED → CANCELLED  (requireProjectPermission('project.rfi.manage'))
```

All transitions: `findByIdForUpdate` inside tx, validate transition, write audit log, write outbox event.

### Routes (9 total)

```
POST   /:orgId/projects/:projectId/rfis
GET    /:orgId/projects/:projectId/rfis          query: { cursor?, limit?, status?, priority? }
GET    /:orgId/projects/:projectId/rfis/:rfiId
PATCH  /:orgId/projects/:projectId/rfis/:rfiId   (DRAFT only)
POST   /:orgId/projects/:projectId/rfis/:rfiId/submit
POST   /:orgId/projects/:projectId/rfis/:rfiId/respond   body: { response, scheduledImpactDays?, costImpact? }
POST   /:orgId/projects/:projectId/rfis/:rfiId/close
POST   /:orgId/projects/:projectId/rfis/:rfiId/cancel
POST   /:orgId/projects/:projectId/rfis/:rfiId/documents
```

### Cross-module constraint

`linked_task_id` validation: if provided, task must belong to same `projectId` → 422 if from another project.

### RBAC capabilities

```
project.rfi.read     PM, SS, PM_MEMBER, CLIENT
project.rfi.create   PM, SS, PM_MEMBER
project.rfi.respond  PM, SS
project.rfi.manage   PM, SS
```

### Outbox events

- `rfi.submitted` — `{ organizationId, projectId, rfiId, rfiNumber }`
- `rfi.responded` — `{ organizationId, projectId, rfiId }`
- `rfi.closed` — `{ organizationId, projectId, rfiId }`

### Required indexes

```
rfis_project_status_created_idx  on (project_id, status, created_at DESC, id DESC)
rfis_org_project_idx             on (organization_id, project_id)
rfis_task_idx                    on (linked_task_id) WHERE linked_task_id IS NOT NULL
```

### Shared schema

`packages/shared/src/modules/project/rfi.schema.ts`

### Quality gates

- `rfiNumber` format `RFI-YYYYMM-NNN` from `documentNumberService`
- State machine: DRAFT → OPEN → ANSWERED → CLOSED tested; invalid transitions → 422
- `linked_task_id` from other project → 422
- `pnpm --filter server typecheck` exits 0

**Changes made:** Added RFI schema, status/priority enums, numbering through the shared allocator, tenant-scoped routes with bounded cursor pagination, draft-only updates, row-locked lifecycle transitions, task ownership validation, document evidence linking, audit/outbox events, RBAC, and integration coverage for numbering, lifecycle errors, evidence, and cross-project isolation.

---

## Chunk 6.5 — Submittals

**STATUS:** DONE
**Depends on:** 6.2
**Tier 1 checklist sections:** §2 (revision uniqueness constraint), §4 (reviewer ownership)

### Core principle

Revision history is first-class and append-only. A submittal has an auditable progression. Old revision rows are never deleted.

### New schema file: `packages/database/src/schema/submittal.schema.ts`

**`submittals`** (header)

```
id                     text PK
organization_id        text NOT NULL → organizations.id RESTRICT
project_id             text NOT NULL → projects.id CASCADE
submittal_number       text NOT NULL          -- series 'SUB'
title                  text NOT NULL
spec_reference         text
discipline             text
responsible_member_id  text → project_members.id SET NULL
reviewer_member_id     text → project_members.id SET NULL
status                 submittal_status_enum NOT NULL DEFAULT 'DRAFT'
due_date               date
notes                  text
created_by             text → users.id SET NULL
created_at             timestamptz NOT NULL DEFAULT now()
updated_at             timestamptz NOT NULL DEFAULT now()
```

**`submittal_revisions`** (append-only — never UPDATE or DELETE)

```
id              text PK
submittal_id    text NOT NULL → submittals.id CASCADE
organization_id text NOT NULL → organizations.id RESTRICT
revision_number integer NOT NULL        -- 1, 2, 3...
status          revision_status_enum NOT NULL DEFAULT 'SUBMITTED'
submitted_by    text → users.id SET NULL
submitted_at    timestamptz NOT NULL DEFAULT now()
reviewed_by     text → users.id SET NULL
reviewed_at     timestamptz
response        submittal_response_enum
response_notes  text
```

UNIQUE: `(submittal_id, revision_number)`

### Enums

```
submittal_status:   DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, REVISE_AND_RESUBMIT, CLOSED
revision_status:    SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, REVISE_AND_RESUBMIT
submittal_response: APPROVED, APPROVED_WITH_COMMENTS, REVISE_AND_RESUBMIT, REJECTED
```

### State machine (header `submittals.status`)

```
DRAFT → SUBMITTED            (submit — creates revision 1)
SUBMITTED → UNDER_REVIEW     (reviewer begins review)
UNDER_REVIEW → APPROVED      (review: response=APPROVED)
UNDER_REVIEW → REJECTED      (review: response=REJECTED)
UNDER_REVIEW → REVISE_AND_RESUBMIT  (review: response=REVISE_AND_RESUBMIT)
REVISE_AND_RESUBMIT → SUBMITTED     (resubmit — creates revision N+1)
APPROVED → CLOSED            (close)
REJECTED → CLOSED            (close)
```

All transitions: `findByIdForUpdate` on submittal inside tx.

Concurrent review guard: two reviewers hitting `/review` simultaneously — only one succeeds due to FOR UPDATE lock.

### Routes (11 total)

```
POST   /:orgId/projects/:projectId/submittals
GET    /:orgId/projects/:projectId/submittals   query: { cursor?, limit?, status? }
GET    /:orgId/projects/:projectId/submittals/:subId
PATCH  /:orgId/projects/:projectId/submittals/:subId   (DRAFT only)
POST   /:orgId/projects/:projectId/submittals/:subId/submit
POST   /:orgId/projects/:projectId/submittals/:subId/review    body: { response, responseNotes? }
POST   /:orgId/projects/:projectId/submittals/:subId/resubmit
POST   /:orgId/projects/:projectId/submittals/:subId/close
GET    /:orgId/projects/:projectId/submittals/:subId/revisions
POST   /:orgId/projects/:projectId/submittals/:subId/documents
```

### RBAC capabilities

```
project.submittal.read     PM, SS, PM_MEMBER, CLIENT
project.submittal.create   PM, SS, PM_MEMBER
project.submittal.review   PM, SS
project.submittal.manage   PM, SS
```

### Outbox events

- `submittal.submitted` — `{ organizationId, projectId, submittalId, submittalNumber, revisionNumber }`
- `submittal.reviewed` — `{ organizationId, projectId, submittalId, response }`
- `submittal.resubmitted` — `{ organizationId, projectId, submittalId, revisionNumber }`
- `submittal.closed` — `{ organizationId, projectId, submittalId }`

### Required indexes

```
submittals_project_status_created_idx  on (project_id, status, created_at DESC, id DESC)
submittals_org_project_idx             on (organization_id, project_id)
submittal_revisions_submittal_idx      on (submittal_id)
```

### Shared schema

`packages/shared/src/modules/project/submittal.schema.ts`

### Quality gates

- After `REVISE_AND_RESUBMIT` review, `resubmit` creates revision_number=2; revision 1 remains in DB
- Two concurrent `/review` requests → only one succeeds
- `pnpm --filter server typecheck` exits 0

**Changes made:** Added submittal and immutable revision/review schemas, allocated SUB numbers with the shared transactional allocator, implemented all 11 scoped routes, draft-only updates, reviewer ownership checks, FOR UPDATE lifecycle transitions, evidence links, audit/outbox events, and integration coverage for revision 2 retention, unauthorized reviewers, and competing reviews (exactly one succeeds).

---

## Chunk 6.6 — Quality Inspections, Deficiencies & Corrective Actions

**STATUS:** DONE
**Depends on:** 6.2
**Tier 1 checklist sections:** §2 (deficiency and corrective action independent lifecycles)

### Core principle

A deficiency has its own lifecycle independent of the inspection. The `corrective_actions` table is shared with D.7 (safety) via `source_type`.

### New schema file: `packages/database/src/schema/quality.schema.ts`

**`quality_inspections`**

```
id                    text PK
organization_id       text NOT NULL → organizations.id RESTRICT
project_id            text NOT NULL → projects.id CASCADE
inspection_number     text NOT NULL          -- series 'QI'
inspection_type       text NOT NULL          -- free text: 'Structural', 'MEP', 'Concrete Pour', etc.
scheduled_date        date
performed_date        date
inspector_member_id   text → project_members.id SET NULL
status                quality_inspection_status_enum NOT NULL DEFAULT 'SCHEDULED'
result                quality_result_enum
location              text
notes                 text
created_by            text → users.id SET NULL
created_at            timestamptz NOT NULL DEFAULT now()
updated_at            timestamptz NOT NULL DEFAULT now()
```

**`quality_deficiencies`**

```
id                    text PK
organization_id       text NOT NULL → organizations.id RESTRICT
project_id            text NOT NULL → projects.id CASCADE
inspection_id         text → quality_inspections.id SET NULL   -- can exist standalone
deficiency_number     text NOT NULL          -- series 'DEF'
title                 text NOT NULL
description           text
severity              deficiency_severity_enum NOT NULL DEFAULT 'MEDIUM'
status                deficiency_status_enum NOT NULL DEFAULT 'OPEN'
responsible_member_id text → project_members.id SET NULL
due_date              date
location              text
notes                 text
closed_at             timestamptz
created_by            text → users.id SET NULL
created_at            timestamptz NOT NULL DEFAULT now()
updated_at            timestamptz NOT NULL DEFAULT now()
```

**`corrective_actions`** (shared with D.7 safety via source_type)

```
id              text PK
organization_id text NOT NULL → organizations.id RESTRICT
project_id      text NOT NULL → projects.id CASCADE
source_type     text NOT NULL   -- 'QUALITY_DEFICIENCY' | 'SAFETY_INCIDENT' | 'SAFETY_OBSERVATION'
source_id       text NOT NULL
title           text NOT NULL
description     text
assigned_to     text → users.id SET NULL
status          corrective_action_status_enum NOT NULL DEFAULT 'OPEN'
due_date        date
completed_at    timestamptz
verified_by     text → users.id SET NULL
verified_at     timestamptz
notes           text
created_by      text → users.id SET NULL
created_at      timestamptz NOT NULL DEFAULT now()
updated_at      timestamptz NOT NULL DEFAULT now()
```

INDEX on `(source_type, source_id)` — used to list corrective actions for a given deficiency or safety event.

### Enums

```
quality_inspection_status: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
quality_result:            PASS, PASS_WITH_CONDITIONS, FAIL
deficiency_severity:       LOW, MEDIUM, HIGH, CRITICAL
deficiency_status:         OPEN, IN_PROGRESS, RESOLVED, CLOSED, DISPUTED
corrective_action_status:  OPEN, IN_PROGRESS, COMPLETED, VERIFIED, CANCELLED
```

### State machines

**Quality inspection:**

```
SCHEDULED → IN_PROGRESS → COMPLETED
SCHEDULED → CANCELLED
IN_PROGRESS → CANCELLED
```

**Quality deficiency (independent of inspection):**

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
OPEN → DISPUTED
OPEN → CANCELLED
IN_PROGRESS → DISPUTED
```

**Corrective action:**

```
OPEN → IN_PROGRESS → COMPLETED → VERIFIED
OPEN → CANCELLED
IN_PROGRESS → CANCELLED
```

`VERIFIED` requires `verified_by` + `verified_at` to be set.

### Routes

```
POST/GET/GET/:id/PATCH              /:orgId/projects/:projectId/quality-inspections
POST /:orgId/projects/:projectId/quality-inspections/:id/start
POST /:orgId/projects/:projectId/quality-inspections/:id/complete   body: { result, findings?, performedDate }
POST /:orgId/projects/:projectId/quality-inspections/:id/documents

POST/GET/GET/:id/PATCH              /:orgId/projects/:projectId/quality-deficiencies
POST /:orgId/projects/:projectId/quality-deficiencies/:id/resolve
POST /:orgId/projects/:projectId/quality-deficiencies/:id/close
POST /:orgId/projects/:projectId/quality-deficiencies/:id/documents

POST/GET/GET/:id/PATCH              /:orgId/projects/:projectId/corrective-actions
POST /:orgId/projects/:projectId/corrective-actions/:id/complete
POST /:orgId/projects/:projectId/corrective-actions/:id/verify       body: { notes? }
```

### RBAC capabilities

```
project.quality.read              PM, SS, PM_MEMBER
project.quality.inspect           PM, SS
project.quality.manage_deficiency PM, SS
project.quality.verify_corrective PM, SS
```

### Outbox events

- `quality.inspection_completed` — `{ organizationId, projectId, inspectionId, result }`
- `quality.deficiency_closed` — `{ organizationId, projectId, deficiencyId }`
- `quality.corrective_action_verified` — `{ organizationId, projectId, correctiveActionId }`

### Quality gates

- Deficiency status OPEN after inspection COMPLETED — verified in test
- Corrective action `verify` blocked if not COMPLETED first
- `corrective_actions` source_type='QUALITY_DEFICIENCY' links correctly
- `pnpm --filter server typecheck` exits 0

**Changes made:** _[record when DONE]_

---

## Chunk 6.7 — Safety Events, Meetings & Corrective Actions

**STATUS:** DONE
**Depends on:** 6.2, 6.6 (`corrective_actions` table reused)
**Tier 1 checklist sections:** §2 (HIGH/CRITICAL event concurrency), §10 (audit on all safety mutations)

### Core principle

Jurisdiction-neutral — country-specific regulatory requirements are configured above this generic model. The `corrective_actions` table from D.6 is reused with `source_type='SAFETY_INCIDENT'` or `'SAFETY_OBSERVATION'`.

### New schema file: `packages/database/src/schema/safety.schema.ts`

**`safety_events`** (incidents, near misses, observations, unsafe conditions)

```
id                 text PK
organization_id    text NOT NULL → organizations.id RESTRICT
project_id         text NOT NULL → projects.id CASCADE
event_number       text NOT NULL          -- series 'SAF'
event_type         safety_event_type_enum NOT NULL
title              text NOT NULL
description        text NOT NULL
status             safety_event_status_enum NOT NULL DEFAULT 'REPORTED'
severity           safety_severity_enum NOT NULL DEFAULT 'LOW'
occurred_at        timestamptz NOT NULL
location           text
involved_parties   text                   -- free text, names/contractors/subcontractors
reported_by        text → users.id SET NULL
assigned_to        text → users.id SET NULL
root_cause         text                   -- filled during investigation
immediate_action   text
closed_at          timestamptz
notes              text
created_by         text → users.id SET NULL
created_at         timestamptz NOT NULL DEFAULT now()
updated_at         timestamptz NOT NULL DEFAULT now()
```

**`safety_meetings`**

```
id                 text PK
organization_id    text NOT NULL → organizations.id RESTRICT
project_id         text NOT NULL → projects.id CASCADE
meeting_number     text NOT NULL          -- series 'MTG'
meeting_type       text NOT NULL          -- 'Toolbox Talk', 'Safety Briefing', 'Weekly Review', etc.
title              text NOT NULL
scheduled_at       timestamptz NOT NULL
conducted_at       timestamptz
facilitator_id     text → users.id SET NULL
attendee_count     integer
topics_covered     text
notes              text
created_by         text → users.id SET NULL
created_at         timestamptz NOT NULL DEFAULT now()
updated_at         timestamptz NOT NULL DEFAULT now()
```

### Enums

```
safety_event_type:   INCIDENT, NEAR_MISS, UNSAFE_CONDITION, UNSAFE_ACT, FIRST_AID
safety_event_status: REPORTED, UNDER_INVESTIGATION, CORRECTIVE_ACTION_REQUIRED, CORRECTIVE_ACTION_IN_PROGRESS, CLOSED
safety_severity:     LOW, MEDIUM, HIGH, CRITICAL, FATALITY
```

### State machine (`safety_events.status`)

```
REPORTED → UNDER_INVESTIGATION     (investigate — requireProjectPermission('project.safety.investigate'))
UNDER_INVESTIGATION → CORRECTIVE_ACTION_REQUIRED   (after root cause recorded)
CORRECTIVE_ACTION_REQUIRED → CORRECTIVE_ACTION_IN_PROGRESS  (on corrective action created)
CORRECTIVE_ACTION_IN_PROGRESS → CLOSED   (all corrective actions VERIFIED)
REPORTED → CLOSED                  (for LOW/MEDIUM with no investigation needed)
Any non-CLOSED → CLOSED            (manual close by PM — requires notes)
```

All transitions: `findByIdForUpdate` inside tx.

### Corrective action link

Create corrective action for a safety event via:
`POST /:orgId/projects/:projectId/safety-events/:id/corrective-actions`

This creates a `corrective_actions` row with `source_type = 'SAFETY_INCIDENT'` and `source_id = safety_event.id`. Uses the same table and service from D.6 — no duplication.

### Routes

```
POST/GET/GET/:id/PATCH  /:orgId/projects/:projectId/safety-events
POST /:orgId/projects/:projectId/safety-events/:id/investigate
POST /:orgId/projects/:projectId/safety-events/:id/close          body: { notes? }
POST /:orgId/projects/:projectId/safety-events/:id/corrective-actions
POST /:orgId/projects/:projectId/safety-events/:id/documents

POST/GET/GET/:id        /:orgId/projects/:projectId/safety-meetings
```

### RBAC capabilities

```
project.safety.read        PM, SS, PM_MEMBER
project.safety.report      PM, SS, PM_MEMBER    (create event)
project.safety.investigate PM, SS
project.safety.manage      PM, SS               (close, delete)
```

### Outbox events

- `safety.incident_reported` — fires for `severity IN ('HIGH', 'CRITICAL', 'FATALITY')` only — `{ organizationId, projectId, eventId, severity, eventType }`
- `safety.event_closed` — `{ organizationId, projectId, eventId }`

### Required indexes

```
safety_events_project_status_severity_idx on (project_id, status, severity)
safety_events_org_project_idx             on (organization_id, project_id)
safety_meetings_project_idx               on (project_id, scheduled_at DESC)
```

### Quality gates

- HIGH/CRITICAL event triggers `safety.incident_reported` outbox event
- LOW event does NOT trigger the outbox event
- `corrective_actions` row `source_type='SAFETY_INCIDENT'` created correctly
- `pnpm --filter server typecheck` exits 0

**Changes made:** _[record when DONE]_

---

## Chunk 6.8 — Compliance Expiration Scanner & Event Foundation

**STATUS:** DONE
**Depends on:** 6.1 (documents.expiry_date), 6.3 (permits.expiry_date, compliance_records.expiry_date)
**Tier 1 checklist sections:** §9 (PgBoss idempotency), §4 (scoped queries — never global COUNT)

### Core principle

The compliance record IS the source of truth. The scanner observes it and emits outbox events. The full notification/reminder system is Phase F — do NOT build it here. Build only the event boundary.

### 1. Expiry scanner worker

**Location:** `apps/server/src/workers/expiry-scanner.worker.ts`

**PgBoss scheduled job:**

```ts
queue: 'compliance:scan-expiry';
schedule: '0 6 * * *'; // 6am UTC daily
singletonKey: 'compliance:scan-expiry';
retryLimit: 2;
```

**Worker logic (scoped, idempotent):**

```
For each entity type (documents, permits, compliance_records):
  SELECT id, organization_id, project_id, expiry_date, title
  FROM app.<table>
  WHERE status IN (<active_statuses>)
    AND expiry_date IS NOT NULL
    AND expiry_date <= now() + (30 days)     -- configurable via EXPIRY_SCAN_DAYS_AHEAD env var
    AND expires_notified = false
  ORDER BY expiry_date ASC
  LIMIT 500 per run                          -- process in batches, not unbounded

For each result row (inside db.transaction):
  - writeOutboxEvent(tx, '<entity>.expiring', { organizationId, projectId, entityType, entityId: id, expiryDate, title })
  - UPDATE app.<table> SET expires_notified = true WHERE id = $id
```

**Idempotency:** `expires_notified=true` prevents re-processing until `expiry_date` changes. If the scanner runs twice in a day, the second run finds zero rows.

**`expires_notified` reset rule:** Every PATCH handler for documents/permits/compliance_records must reset `expires_notified = false` if `expiry_date` is changed.

**New env var:**

```ts
EXPIRY_SCAN_DAYS_AHEAD: z.coerce.number().default(30),  // in packages/env/src/server.ts
```

### 2. Expiring items query endpoint

```
GET /:orgId/projects/:projectId/expiring
query: { days?: number (default 30, max 90), entityType?: 'document'|'permit'|'compliance_record' }
→ 200: { items: ExpiringItemDTO[], total: number }
```

`ExpiringItemDTO`:

```ts
{
  entityType: 'document' | 'permit' | 'compliance_record';
  entityId: string;
  title: string;
  expiryDate: string; // YYYY-MM-DD
  daysUntilExpiry: number;
}
```

Query is a UNION across the three tables, scoped to `organization_id + project_id`. No global COUNT.

### RBAC: reuses `project.compliance_record.read` from D.3

### Outbox events emitted by scanner

- `document.expiring` — `{ organizationId, projectId, entityType: 'document', entityId, expiryDate, title }`
- `permit.expiring` — `{ organizationId, projectId, entityType: 'permit', entityId, expiryDate, title }`
- `compliance_record.expiring` — `{ organizationId, projectId, entityType: 'compliance_record', entityId, expiryDate, title }`

### Worker registration

Register in `apps/server/src/worker.ts` alongside existing workers.

### Quality gates

- Scanner running twice in a row emits zero duplicate events (idempotency verified in test)
- `expires_notified` reset to `false` when `expiry_date` changed via PATCH
- `/expiring` endpoint returns only own-org items
- `EXPIRY_SCAN_DAYS_AHEAD` env var controls lookahead
- `pnpm --filter server typecheck` exits 0

**Changes made:** _[record when DONE]_

---

## Chunk 6.9 — Integration, Security, Concurrency & Performance Gate

**STATUS:** IN PROGRESS
**Depends on:** All of 6.1–6.8 DONE

This chunk is NOT a business module. It is the Phase D verification gate — the equivalent of the hardening pass we did after Phase C. Every item below must be checked off before Phase D is declared complete.

### Complete chain test

Write at least one integration test that exercises the full Phase D chain end-to-end:

```
Create project
  → Upload document (presigned PUT → complete)
    → Create RFI, link document
      → Respond to RFI
        → Create submittal from RFI context
          → Submit → Review (APPROVED)
            → Create permit, link document
              → Create compliance record, link permit
                → Run expiry scanner (manual trigger in test)
                  → Verify outbox events present and scoped correctly
```

**Complete-chain test:** DONE — `tests/integration/phase-d-chain.test.ts`

### Security checks (verify all of the following)

- [x] Document download: wrong-org `docId` → 404, no presigned URL returned
- [x] Presigned URL uses different storage key per upload — not shared across orgs
- [x] `PROJECT_MANAGERS_ONLY` access policy blocks `PROJECT_MEMBER` download (confirmed in test)
- [x] `ADMIN_ONLY` access policy blocks any non-admin download
- [x] RFI `linked_task_id` from other project → 422
- [x] Submittal `reviewer_member_id` from other project → 422
- [x] Compliance `subject_id` referring to subcontractor from other org is validated at service level
- [x] All Phase D list endpoints: other-org resource absent by explicit ID check (not count)
- [x] No storage keys or presigned URL values in pino logs (verified by log inspection)
- [x] No `document_access_logs` rows contain the presigned URL value — only access metadata

### Concurrency tests (write at minimum these)

- [x] Two users simultaneously submit same RFI → exactly one OPEN, one 422
- [x] Two reviewers simultaneously review same submittal → one succeeds, one gets 409 or idempotent 200
- [x] Two users simultaneously close same safety event → exactly one succeeds
- [x] Two expiry scanner runs simultaneously → zero duplicate outbox events (singletonKey prevents double-execution; test verifies)

### Performance checks

- [x] `EXPLAIN ANALYZE` on document list with `category + status` filter — uses `documents_project_category_status_idx`
- [x] `EXPLAIN ANALYZE` on expiry scanner query — uses partial index `documents_expiry_partial_idx`
- [x] `EXPLAIN ANALYZE` on compliance_records expiry query — uses `compliance_records_expiry_partial_idx`
- [x] Presigned URL generation latency < 100ms in local test (observed ~80.4ms; no file bytes through app server)
- [x] All new list endpoints: `limit` cap at 100 in Zod schema (audit all new shared schemas)

### API audit

- [x] Every new route registered in `project.routes.ts` (or appropriate module router)
- [x] Every new route has Swagger schema wired (method, params, body, response)
- [x] Every new capability added to both `PROJECT_ROLE_CAPABILITIES` and `ORG_LEVEL_AUTHORITY_MAP` in `project.policy.ts`
- [x] All new Zod schemas exported from `packages/shared/src/index.ts`
- [x] No `req.body as any` without prior Zod parse anywhere in Phase D handlers

### Database

- [x] All new migrations run clean on fresh DB (`pnpm db:generate && pnpm db:migrate`)
- [x] FK indexes verified for all new tables (zero missing Phase D FK indexes)
- [x] `taskDocumentLinks.documentId` FK migration verified
- [x] `corrective_actions` `(source_type, source_id)` index verified

### Jobs

- [x] Expiry scanner worker registered and runs via `pnpm --filter server dev:worker`
- [x] Worker is idempotent (double-run produces zero side effects after first run)
- [x] Worker includes `organizationId` in every outbox event payload
- [x] `EXPIRY_SCAN_DAYS_AHEAD` env var documented in `.env.example`

### Full regression

- [x] `pnpm --filter server test` exits 0 — all Phase 1–C tests still pass (52 files, 571 tests)
- [x] `pnpm --filter server typecheck` exits 0
- [x] `pnpm --filter server lint` exits 0 (580 `no-explicit-any` warnings; no lint errors)
- [x] `pnpm build` exits 0

**Changes made:** Added the compliance expiry queue to the centralized PgBoss registry so startup pre-creates it before scheduling. Added explicit foreign-ID isolation assertions for every Phase D collection list, document versions, and submittal revisions. Restored server linting with the existing shared flat rules and their missing dependencies, and fixed lint errors without changing application architecture. Full regression, server typecheck, monorepo build, fresh-database migrations, worker startup, concurrency checks, query plans, FK indexes, log redaction, and presigned URL latency are verified.

---

## Completion Tracker

| Task | What                                                              | Status      |
| ---- | ----------------------------------------------------------------- | ----------- |
| P.0  | Storage abstraction — `StorageService` interface + MinIO impl     | DONE |
| 6.1  | Document schema + migration + Phase D foundation primitives       | DONE |
| 6.2  | Document versions, access, API (10 routes)                        | DONE |
| 6.3  | Permits + compliance inspections + compliance records (15 routes) | DONE |
| 6.4  | RFIs (9 routes)                                                   | DONE |
| 6.5  | Submittals + revision history (11 routes)                         | DONE |
| 6.6  | Quality inspections + deficiencies + corrective actions           | DONE |
| 6.7  | Safety events + meetings (corrective actions reused from 6.6)     | DONE |
| 6.8  | Expiry scanner worker + `/expiring` endpoint                      | DONE |
| 6.9  | Integration + security + concurrency + performance gate           | DONE |

**Phase D is COMPLETE only when all 10 tasks are DONE.**
