# Group 6 — Subcontractors & Performance

**Status:** Not started  
**Priority:** 🔴 Critical — field operations + commercial tracking  
**Depends on:** Group 1 (project shell), Group 5 (tasks, for task assignments)

---

## Backend Source Files

| File | Purpose |
|------|---------|
| `apps/server/src/modules/project/subcontractor/subcontractor.handler.ts` | All subcontractor handlers |
| `apps/server/src/modules/project/subcontractor/subcontractor.service.ts` | Business logic |
| `apps/server/src/modules/project/subcontractor/subcontractor.schemas.ts` | Zod validation schemas |
| `apps/server/src/modules/project/performance/performance.handler.ts` | Supplier + subcontractor performance event lists |
| `apps/server/src/modules/project/performance/performance.service.ts` | Event pagination service |
| `apps/server/src/modules/project/project.routes.ts` | Route registrations (subcontractor + performance sections) |
| `packages/database/src/schema/procurement.schema.ts` | `subcontractors`, `subcontractorContacts`, `projectSubcontractors`, `subcontractorTaskAssignments` table definitions |

---

## HTTP Routes

### Project-scoped Subcontractors
```
GET    /:orgId/projects/:projectId/subcontractors                                    permission: project.subcontractor.read
POST   /:orgId/projects/:projectId/subcontractors                                    permission: project.subcontractor.create
GET    /:orgId/projects/:projectId/subcontractors/:subcontractorId                   permission: project.subcontractor.read
PATCH  /:orgId/projects/:projectId/subcontractors/:subcontractorId                   permission: project.subcontractor.update
POST   /:orgId/projects/:projectId/subcontractors/:subcontractorId/contacts          permission: project.subcontractor.update
PATCH  /:orgId/projects/:projectId/subcontractors/:subcontractorId/contacts/:contactId  permission: project.subcontractor.update
POST   /:orgId/projects/:projectId/subcontractors/:subcontractorId/task-assignments  permission: project.subcontractor.assign
DELETE /:orgId/projects/:projectId/subcontractors/:subcontractorId/task-assignments/:taskId  permission: project.subcontractor.assign
```

### Performance
```
GET    /:orgId/projects/:projectId/performance/suppliers/:supplierId        permission: project.performance.read
GET    /:orgId/projects/:projectId/performance/subcontractors/:subcontractorId  permission: project.performance.read
```

---

## Key Schemas (from `apps/server/src/modules/project/subcontractor/subcontractor.schemas.ts`)

### assignSubcontractorToProjectSchema
```
subcontractorId*  string (must exist in org-level subcontractors table)
scopeDescription? string max:2000
contractValue?    string decimal pattern
currencyCode?     string len:3
startDate?        YYYY-MM-DD
endDate?          YYYY-MM-DD (must be >= startDate)
```

### updateProjectSubcontractorSchema
```
scopeDescription?, contractValue?, currencyCode?, startDate?, endDate?, status: ACTIVE|INACTIVE
```

### createContactSchema
```
name*      string max:255
role?      string max:255
email?     string email
phone?     string max:50
isPrimary? boolean (partial unique index: only one primary per subcontractor)
```

### assignTaskSchema
```
taskId*          string (must belong to same project)
assignmentRole?  string max:255
```

---

## Database Schema Notes (from `procurement.schema.ts`)

**subcontractors** table:
- `status`: ACTIVE | INACTIVE | SUSPENDED
- `trade`: optional string
- `registrationReference`, `taxReference`: optional strings
- `primaryEmail`, `primaryPhone`, `address`: optional

**projectSubcontractors** table:
- Links `subcontractorId` to `projectId`
- `status`: ACTIVE | INACTIVE
- Has DB check: `endDate >= startDate`
- Has DB check: `currencyCode` must be 3 chars

**subcontractorContacts** table:
- Partial unique index on `(subcontractor_id) WHERE is_primary = true`
- `isActive` boolean

**subcontractorTaskAssignments** table:
- Links task + subcontractor within a project
- `assignmentRole` optional text

**Performance events** (from `partnerPerformanceEvents`):
- `partnerType`: SUPPLIER | SUBCONTRACTOR
- `sourceType`: DELIVERY | RECEIPT | TASK
- `eventType`: DELIVERY_ON_TIME | DELIVERY_LATE | RECEIPT_REJECTION | TASK_COMPLETE_ON_TIME | TASK_COMPLETE_LATE
- `metricValue`: optional decimal (e.g. rejection quantity)

---

## Frontend Pages to Build

### 6.1 `ProjectSubcontractorsPage` — `.../projects/:projectId/subcontractors`
- Table: displayName | trade | contractValue | status | startDate | endDate
- "Assign subcontractor" inline panel:
  - `subcontractorId` dropdown (from org-level list — reuse existing supplier API pattern but for subs)
  - `scopeDescription`, `contractValue`, `currencyCode`, `startDate`, `endDate`
- Click row → detail
- Permission gates: `project.subcontractor.create`, `project.subcontractor.update`

### 6.2 `ProjectSubcontractorDetailPage` — `.../subcontractors/:subcontractorId`
- Header: legalName, trade, status badge, contractValue, scope description
- Edit section: update scope/value/dates/status
- **Contacts sub-section**:
  - Table: name | role | email | phone | isPrimary badge
  - Add contact form (name*, role, email, phone, isPrimary toggle)
  - Edit contact inline
- **Task assignments sub-section**:
  - Table: taskCode | taskName | assignmentRole
  - Add assignment: task selector dropdown + role input
  - Remove button per row (DELETE .../task-assignments/:taskId)
- **Performance tab**:
  - Fetches `.../performance/subcontractors/:subcontractorId`
  - Event list: date | sourceType | eventType | metricValue

### 6.3 `SupplierPerformancePage` — `.../performance/suppliers/:supplierId`
- Accessible from SupplierDetailPage as a tab
- Event list: date | sourceType (DELIVERY/RECEIPT) | eventType | metricValue
- Summary counts: on-time deliveries, late deliveries, receipt rejections

---

## Frontend Files to Create

```
apps/web/src/types/subcontractorTypes.ts
apps/web/src/types/performanceTypes.ts
apps/web/src/fixtures/subcontractor.fixtures.ts
apps/web/src/api/subcontractorApi.ts
apps/web/src/api/performanceApi.ts
apps/web/src/pages/ProjectSubcontractorsPage.tsx
apps/web/src/pages/ProjectSubcontractorDetailPage.tsx
```

Also update:
```
apps/web/src/pages/app/SupplierDetailPage.tsx  (add Performance tab)
```

Router additions under `projects/:projectId` children:
```
{ path: 'subcontractors', element: <ProjectSubcontractorsPage /> }
{ path: 'subcontractors/:subcontractorId', element: <ProjectSubcontractorDetailPage /> }
```

ProjectShell nav addition: **Subcontractors**

---

## Design Notes
- Flat design system throughout — CSS vars, font-mono labels
- Contract value displayed as `{currencyCode} {amount}` (same pattern as PO total)
- Performance event badges: DELIVERY_ON_TIME=green, DELIVERY_LATE=amber, RECEIPT_REJECTION=red
- `isPrimary` contact shown with a small MONO badge "PRIMARY"
- Task assignment rows link back to task detail
