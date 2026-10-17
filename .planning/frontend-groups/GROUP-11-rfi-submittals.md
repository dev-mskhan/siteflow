# Group 11 — RFI & Submittals (Document Control)

**Status:** Not started  
**Priority:** 🟡 Medium — formal document control workflow  
**Depends on:** Group 1 (project shell), Group 9 (documents — both modules support doc attachments)

---

## Backend Source Files

| File | Purpose |
|------|---------|
| `apps/server/src/modules/project/rfi/rfi.routes.ts` | Full RFI routes |
| `apps/server/src/modules/project/rfi/rfi.handler.ts` | Handlers |
| `apps/server/src/modules/project/submittal/submittal.routes.ts` | Full submittal routes |
| `apps/server/src/modules/project/submittal/submittal.handler.ts` | Handlers |

---

## HTTP Routes

### RFIs
```
POST   /:orgId/projects/:projectId/rfis                                   permission: project.rfi.create
GET    /:orgId/projects/:projectId/rfis                                   permission: project.rfi.read
GET    /:orgId/projects/:projectId/rfis/:rfiId                            permission: project.rfi.read
PATCH  /:orgId/projects/:projectId/rfis/:rfiId                            permission: project.rfi.create  (DRAFT only)
POST   /:orgId/projects/:projectId/rfis/:rfiId/submit                     permission: project.rfi.create
POST   /:orgId/projects/:projectId/rfis/:rfiId/respond                    permission: project.rfi.respond
POST   /:orgId/projects/:projectId/rfis/:rfiId/close                      permission: project.rfi.manage
POST   /:orgId/projects/:projectId/rfis/:rfiId/cancel                     permission: project.rfi.manage
POST   /:orgId/projects/:projectId/rfis/:rfiId/documents                  permission: project.rfi.create
```

### Submittals
```
POST   /:orgId/projects/:projectId/submittals                                              permission: project.submittal.create
GET    /:orgId/projects/:projectId/submittals                                              permission: project.submittal.read
GET    /:orgId/projects/:projectId/submittals/:submittalId                                 permission: project.submittal.read
PATCH  /:orgId/projects/:projectId/submittals/:submittalId                                 permission: project.submittal.create  (DRAFT only)
POST   /:orgId/projects/:projectId/submittals/:submittalId/submit                          permission: project.submittal.create
POST   /:orgId/projects/:projectId/submittals/:submittalId/review                          permission: project.submittal.review
POST   /:orgId/projects/:projectId/submittals/:submittalId/resubmit                        permission: project.submittal.create
POST   /:orgId/projects/:projectId/submittals/:submittalId/close                           permission: project.submittal.manage
GET    /:orgId/projects/:projectId/submittals/:submittalId/revisions                       permission: project.submittal.read
GET    /:orgId/projects/:projectId/submittals/:submittalId/revisions/:revisionId           permission: project.submittal.read
POST   /:orgId/projects/:projectId/submittals/:submittalId/documents                       permission: project.submittal.create
```

---

## Key Field Constraints (from `rfi.routes.ts` and `submittal.routes.ts` inline schemas)

### RFI create/update body
```
title*              string min:1 max:500 (required on create)
question*           string min:1 max:20000 (required on create)
discipline?         string | null max:255
priority?           LOW | NORMAL | HIGH | URGENT (default: NORMAL)
recipientName?      string | null max:255
dueDate?            YYYY-MM-DD | null
scheduleImpactDays? integer -36500 to 36500
costImpact?         number | null -9999999999999.99 to 9999999999999.99
linkedTaskId?       string | null
notes?              string | null max:5000
```

### RFI respond body
```
response*           string min:1 max:20000
scheduleImpactDays? integer -36500 to 36500
costImpact?         number | null
```

### RFI list filters (querystring)
```
cursor?, limit? (1-100 default 25)
status?   DRAFT | OPEN | UNDER_REVIEW | ANSWERED | CLOSED | CANCELLED
priority? LOW | NORMAL | HIGH | URGENT
```

### RFI attach document body
```
documentId* string min:1 max:128 (must be an existing project document ID)
```

### Submittal create/update body
```
title*              string min:1 max:500 (required on create)
specReference?      string | null max:255
discipline?         string | null max:255
responsibleMemberId? memberId | null
reviewerMemberId?   memberId | null
dueDate?            YYYY-MM-DD | null
notes?              string | null max:5000
```

### Submittal review body
```
response*       APPROVED | APPROVED_WITH_COMMENTS | REVISE_AND_RESUBMIT | REJECTED
responseNotes?  string | null max:5000
```

### Submittal list filters
```
cursor?, limit? (1-100 default 25)
status? DRAFT | SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | REVISE_AND_RESUBMIT | CLOSED
```

---

## State Machines

### RFI
```
DRAFT → OPEN (submit)
OPEN → UNDER_REVIEW → ANSWERED (respond) → CLOSED (close) | CANCELLED (cancel)
Any non-CLOSED → CANCELLED (cancel)
```

### Submittal
```
DRAFT → SUBMITTED (submit)
SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED | REVISE_AND_RESUBMIT (review)
REVISE_AND_RESUBMIT → SUBMITTED again (resubmit — creates new revision)
APPROVED → CLOSED (close)
Any → CLOSED (close)
```

---

## RFI Data Model Notes
- `scheduleImpactDays`: can be negative (schedule recovery) or positive (delay)
- `costImpact`: can be negative (credit) or positive (cost increase)
- `linkedTaskId`: optional FK to a project task
- Document attachment: links an existing document ID (not upload — document must already exist via Group 9 flow)
- Operations reminder worker (`operations-reminders.service.ts`) scans overdue RFIs (status=OPEN + dueDate < today) and fires IN_APP notifications

## Submittal Data Model Notes
- Each `resubmit` creates a new **revision** (increment of revisionNumber)
- Revisions list shows history of submittal cycles
- Each revision has its own review response

---

## Frontend Pages to Build

### 11.1 `ProjectRFIsPage` — `.../rfis`
- Table: rfiNumber | title | status | priority | discipline | dueDate | scheduleImpact | costImpact
- Status filter tabs + priority filter
- Create form: title*, question*, discipline, priority, recipientName, dueDate, scheduleImpactDays, costImpact, linkedTaskId, notes
- Per-row actions: submit (DRAFT→OPEN), respond (OPEN/UNDER_REVIEW), close (ANSWERED), cancel
- Click row → RFI detail

### 11.2 `ProjectRFIDetailPage` — `.../rfis/:rfiId`
- Full detail: question, response fields, impact numbers, linked task link
- Status pipeline: DRAFT → OPEN → UNDER_REVIEW → ANSWERED → CLOSED
- Edit form (DRAFT only): all create fields
- Respond form (OPEN/UNDER_REVIEW): response*, scheduleImpactDays, costImpact
- Document attachments section: list linked docs, attach by selecting from project documents
- Action buttons: submit, close, cancel

### 11.3 `ProjectSubmittalsPage` — `.../submittals`
- Table: submittalNumber | title | status | discipline | specReference | dueDate | responsibleMember | reviewerMember
- Status filter tabs
- Create form: title*, specReference, discipline, responsibleMemberId, reviewerMemberId, dueDate, notes
- Per-row actions: submit, close
- Click row → detail

### 11.4 `ProjectSubmittalDetailPage` — `.../submittals/:submittalId`
- Full detail with revision history panel
- Status pipeline: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED/REVISE_AND_RESUBMIT → CLOSED
- Review form (reviewer only): response dropdown + responseNotes
- Resubmit button (after REVISE_AND_RESUBMIT)
- Revision list: table of all previous review cycles
- Document attachments section

---

## Frontend Files to Create

```
apps/web/src/types/rfiTypes.ts
apps/web/src/types/submittalTypes.ts
apps/web/src/fixtures/rfi.fixtures.ts
apps/web/src/fixtures/submittal.fixtures.ts
apps/web/src/api/rfiApi.ts
apps/web/src/api/submittalApi.ts
apps/web/src/pages/ProjectRFIsPage.tsx
apps/web/src/pages/ProjectRFIDetailPage.tsx
apps/web/src/pages/ProjectSubmittalsPage.tsx
apps/web/src/pages/ProjectSubmittalDetailPage.tsx
```

Router additions under `projects/:projectId`:
```
{ path: 'rfis', element: <ProjectRFIsPage /> }
{ path: 'rfis/:rfiId', element: <ProjectRFIDetailPage /> }
{ path: 'submittals', element: <ProjectSubmittalsPage /> }
{ path: 'submittals/:submittalId', element: <ProjectSubmittalDetailPage /> }
```

ProjectShell nav additions: **RFIs** | **Submittals**

---

## Design Notes
- Priority badges: LOW=gray, NORMAL=gray, HIGH=amber, URGENT=red (same as MR priority)
- Submittal review response badges: APPROVED=green, APPROVED_WITH_COMMENTS=amber, REVISE_AND_RESUBMIT=amber, REJECTED=red
- Impact numbers: show `+N days / -N days` in schedule impact; use accounting format for cost impact
- Overdue RFIs (dueDate < today + status OPEN): highlight row in amber tint background
- Document attachment via select-from-existing pattern (not file upload — upload is done via Group 9 documents flow)
