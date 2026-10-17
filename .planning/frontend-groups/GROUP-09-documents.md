# Group 9 — Document Management

**Status:** Not started  
**Priority:** 🟠 High — cross-cutting, referenced by RFI/Quality/Safety/Compliance  
**Depends on:** Group 1 (project shell)

---

## Backend Source Files

| File | Purpose |
|------|---------|
| `apps/server/src/modules/project/documents/document.routes.ts` | All document routes |
| `apps/server/src/modules/project/documents/document.handler.ts` | Handlers — initiate upload, complete, list, get, download, update, delete, versions |

---

## HTTP Routes

```
POST   /:orgId/projects/:projectId/documents                                          permission: project.document.upload
POST   /:orgId/projects/:projectId/documents/:documentId/complete                     permission: project.document.upload
GET    /:orgId/projects/:projectId/documents                                          permission: project.document.download
GET    /:orgId/projects/:projectId/documents/:documentId                              permission: project.document.download
GET    /:orgId/projects/:projectId/documents/:documentId/download                     permission: project.document.download
PATCH  /:orgId/projects/:projectId/documents/:documentId                              permission: project.document.manage
DELETE /:orgId/projects/:projectId/documents/:documentId                              permission: project.document.manage
POST   /:orgId/projects/:projectId/documents/:documentId/versions                     permission: project.document.upload
POST   /:orgId/projects/:projectId/documents/:documentId/versions/:versionId/complete permission: project.document.upload
GET    /:orgId/projects/:projectId/documents/:documentId/versions                     permission: project.document.download
GET    /:orgId/projects/:projectId/documents/:documentId/versions/:versionId          permission: project.document.download
```

---

## Key Schemas (from `document.routes.ts` inline schemas)

### Document categories (enum)
```
DRAWING | SPECIFICATION | PERMIT | CERTIFICATE | REPORT | PHOTO | VIDEO | CONTRACT | INVOICE | OTHER
```

### Document statuses (enum)
```
PENDING_UPLOAD | ACTIVE | SUPERSEDED | ARCHIVED | DELETED
```

### Processing statuses (enum)
```
NOT_STARTED | PENDING | PROCESSING | COMPLETED | FAILED
```

### Access policies (enum)
```
PROJECT_MEMBERS | PROJECT_MANAGERS_ONLY | ADMIN_ONLY
```

### Upload initiation body (`POST /documents`)
```
title*        string min:1 max:500
category*     enum documentCategories
fileName*     string min:1 max:255
contentType*  string mime-type pattern: /^[\w.+-]+\/[\w.+-]+$/  min:3 max:255
fileSize*     integer min:1 max:MAX_SAFE_INTEGER (bytes)
description?  string max:10000
accessPolicy? enum documentAccessPolicies (default: PROJECT_MEMBERS)
expiryDate?   YYYY-MM-DD
```
**Response**: `{ document: DocumentDTO, uploadUrl: string (presigned S3 URI) }`

### Upload completion body (`POST /documents/:id/complete`)
```
checksum*   string SHA-256 hex, pattern: /^[a-fA-F0-9]{64}$/
```

### New version body (`POST /documents/:id/versions`)
```
fileName*     string min:1 max:255
contentType*  string mime-type pattern
fileSize*     integer min:1
notes?        string max:10000
```
**Response**: `{ version: VersionDTO, uploadUrl: string (presigned S3 URI) }`

### Update body (`PATCH /documents/:id`)
```
title?        string min:1 max:500
description?  string | null max:10000
accessPolicy? enum
expiryDate?   string | null YYYY-MM-DD
minProperties: 1
```

### List query
```
cursor?, limit? (1-100 default 25), category? enum, status? enum
```

### DocumentDTO fields
```
id, organizationId, projectId, category, title, description?,
status, processingStatus, currentVersion (int),
uploadedBy?, fileName, fileSize, contentType, checksum?,
accessPolicy, expiryDate?, expiresNotified (bool),
createdAt, updatedAt
```

### VersionDTO fields
```
id, documentId, versionNumber, uploadedBy?, fileName, fileSize,
contentType, checksum?, notes?, createdAt
```

---

## S3 Upload Flow (Two-Phase)
1. **Initiate** → POST `/documents` → server returns `{ document, uploadUrl }`
2. **Frontend uploads** → PUT to `uploadUrl` directly (presigned S3 URL, no auth header)
3. **Complete** → POST `/documents/:id/complete` with `{ checksum: sha256hex }` → sets status ACTIVE
4. Same flow for new versions via `/versions`

---

## Frontend Pages to Build

### 9.1 `ProjectDocumentsPage` — `.../documents`
- Filter bar: category tabs + status filter
- Table: fileName | category | title | status badge | processingStatus | version | uploadedBy | expiryDate
- Upload button → modal or inline panel with:
  - File picker (reads `fileName`, `fileSize`, `contentType` from the File object)
  - `title` input
  - `category` select
  - `accessPolicy` select
  - `expiryDate` optional date input
  - `description` optional textarea
  - On submit: POST initiate → upload to S3 presigned URL → POST complete
- Status badge: PENDING_UPLOAD=gray, ACTIVE=green, SUPERSEDED=amber, ARCHIVED=muted, DELETED=red
- Delete button → soft-delete (sets status DELETED)
- Click row → document detail

### 9.2 `ProjectDocumentDetailPage` — `.../documents/:documentId`
- Header: title, category badge, status, access policy, expiry date
- Download button → GET `.../download` → open/navigate to `downloadUrl`
- Edit metadata panel (title, description, accessPolicy, expiryDate) → PATCH
- **Version history** section:
  - Table: versionNumber | fileName | uploadedBy | notes | createdAt
  - "Upload new version" button → same two-phase flow (version endpoint)
- Processing status chip (shown if NOT COMPLETED): animates when PROCESSING

---

## Frontend Files to Create

```
apps/web/src/types/documentTypes.ts
apps/web/src/fixtures/document.fixtures.ts
apps/web/src/api/documentApi.ts
apps/web/src/lib/s3Upload.ts          (helper: PUT file to presigned URL + return checksum)
apps/web/src/pages/ProjectDocumentsPage.tsx
apps/web/src/pages/ProjectDocumentDetailPage.tsx
```

Router additions under `projects/:projectId`:
```
{ path: 'documents', element: <ProjectDocumentsPage /> }
{ path: 'documents/:documentId', element: <ProjectDocumentDetailPage /> }
```

ProjectShell nav addition: **Documents**

---

## Implementation Notes

### S3 upload helper (`s3Upload.ts`)
```ts
async function uploadToS3(file: File, presignedUrl: string): Promise<string> {
  // 1. Compute SHA-256 checksum of file bytes
  // 2. PUT file to presignedUrl with Content-Type header
  // 3. Return hex checksum string for the /complete call
}
```
- Use `crypto.subtle.digest('SHA-256', buffer)` — available in all modern browsers
- PUT must include `Content-Type: file.type` header (required by S3 presigned URL)

### Mock behaviour in dev bypass mode
- Skip actual S3 upload; generate random checksum
- Set document status directly to ACTIVE in fixture

### Processing status polling
- After `/complete`, poll `GET /documents/:id` every 2s until `processingStatus === 'COMPLETED'` or `'FAILED'`
- Use RTK Query `pollingInterval` option

### Expiry warnings
- Documents with `expiryDate` within 30 days → amber warning chip
- Referenced by `operations-reminders.service.ts` (background job creates IN_APP notifications)
