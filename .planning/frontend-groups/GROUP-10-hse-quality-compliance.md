# Group 10 — HSE, Quality & Compliance

**Status:** Not started  
**Priority:** 🟡 Medium — regulatory requirements, site safety  
**Depends on:** Group 1 (project shell), Group 9 (documents — all sub-modules support doc attachments)

---

## Backend Source Files

| File | Purpose |
|------|---------|
| `apps/server/src/modules/project/safety/safety.routes.ts` | Safety events + meetings routes |
| `apps/server/src/modules/project/safety/safety.handler.ts` | Handlers |
| `apps/server/src/modules/project/quality/quality.routes.ts` | Quality inspections + deficiencies + corrective actions |
| `apps/server/src/modules/project/quality/quality.handler.ts` | Dynamic handler factories by entity type |
| `apps/server/src/modules/project/quality/quality.repository.ts` | Defines `QualityEntityType = 'inspection' | 'deficiency' | 'action'` |
| `apps/server/src/modules/project/compliance/compliance.routes.ts` | Permits + compliance inspections + compliance records |
| `apps/server/src/modules/project/compliance/compliance.handler.ts` | Dynamic handler factories + permit transition + inspection complete + record verify |
| `apps/server/src/modules/project/compliance/compliance.repository.ts` | Defines `ComplianceEntityType = 'permit' | 'inspection' | 'record'` |

---

## HTTP Routes

### Safety Events
```
POST   /:orgId/projects/:projectId/safety-events                                      permission: project.safety.report
GET    /:orgId/projects/:projectId/safety-events                                      permission: project.safety.read
GET    /:orgId/projects/:projectId/safety-events/:eventId                             permission: project.safety.read
PATCH  /:orgId/projects/:projectId/safety-events/:eventId                             permission: project.safety.manage
POST   /:orgId/projects/:projectId/safety-events/:eventId/investigate                 permission: project.safety.investigate
POST   /:orgId/projects/:projectId/safety-events/:eventId/close                       permission: project.safety.manage
POST   /:orgId/projects/:projectId/safety-events/:eventId/corrective-actions          permission: project.safety.manage
POST   /:orgId/projects/:projectId/safety-events/:eventId/documents                   permission: project.safety.manage
```

### Safety Meetings
```
POST   /:orgId/projects/:projectId/safety-meetings                                    permission: project.safety.manage
GET    /:orgId/projects/:projectId/safety-meetings                                    permission: project.safety.read
GET    /:orgId/projects/:projectId/safety-meetings/:meetingId                         permission: project.safety.read
```

### Quality (same pattern for inspections, deficiencies, corrective-actions)
```
POST   /:orgId/projects/:projectId/quality-inspections                                permission: project.quality.inspect
GET    /:orgId/projects/:projectId/quality-inspections                                permission: project.quality.read
GET    /:orgId/projects/:projectId/quality-inspections/:inspectionId                  permission: project.quality.read
PATCH  /:orgId/projects/:projectId/quality-inspections/:inspectionId                  permission: project.quality.inspect
POST   /:orgId/projects/:projectId/quality-inspections/:inspectionId/start            permission: project.quality.inspect
POST   /:orgId/projects/:projectId/quality-inspections/:inspectionId/complete         permission: project.quality.inspect
POST   /:orgId/projects/:projectId/quality-inspections/:inspectionId/documents        permission: project.quality.inspect

POST   /:orgId/projects/:projectId/quality-deficiencies                               permission: project.quality.manage_deficiency
GET    /:orgId/projects/:projectId/quality-deficiencies                               permission: project.quality.read
GET    /:orgId/projects/:projectId/quality-deficiencies/:deficiencyId                 permission: project.quality.read
PATCH  /:orgId/projects/:projectId/quality-deficiencies/:deficiencyId                 permission: project.quality.manage_deficiency
POST   /:orgId/projects/:projectId/quality-deficiencies/:deficiencyId/resolve         permission: project.quality.manage_deficiency
POST   /:orgId/projects/:projectId/quality-deficiencies/:deficiencyId/close           permission: project.quality.manage_deficiency
POST   /:orgId/projects/:projectId/quality-deficiencies/:deficiencyId/documents       permission: project.quality.manage_deficiency

POST   /:orgId/projects/:projectId/corrective-actions                                 permission: project.quality.manage_deficiency
GET    /:orgId/projects/:projectId/corrective-actions                                 permission: project.quality.read
GET    /:orgId/projects/:projectId/corrective-actions/:actionId                       permission: project.quality.read
PATCH  /:orgId/projects/:projectId/corrective-actions/:actionId                       permission: project.quality.manage_deficiency
POST   /:orgId/projects/:projectId/corrective-actions/:actionId/complete              permission: project.quality.manage_deficiency
POST   /:orgId/projects/:projectId/corrective-actions/:actionId/verify                permission: project.quality.verify_corrective
```

### Compliance
```
POST   /:orgId/projects/:projectId/permits                                            permission: project.permit.manage
GET    /:orgId/projects/:projectId/permits                                            permission: project.permit.read
GET    /:orgId/projects/:projectId/permits/:permitId                                  permission: project.permit.read
PATCH  /:orgId/projects/:projectId/permits/:permitId                                  permission: project.permit.manage
DELETE /:orgId/projects/:projectId/permits/:permitId                                  permission: project.permit.manage
POST   /:orgId/projects/:projectId/permits/:permitId/transition                       permission: project.permit.manage
POST   /:orgId/projects/:projectId/permits/:permitId/documents                        permission: project.permit.manage

POST   /:orgId/projects/:projectId/compliance-inspections                             permission: project.compliance_inspection.manage
GET    /:orgId/projects/:projectId/compliance-inspections                             permission: project.compliance_inspection.read
GET    /:orgId/projects/:projectId/compliance-inspections/:inspectionId               permission: project.compliance_inspection.read
PATCH  /:orgId/projects/:projectId/compliance-inspections/:inspectionId               permission: project.compliance_inspection.manage
DELETE /:orgId/projects/:projectId/compliance-inspections/:inspectionId               permission: project.compliance_inspection.manage
POST   /:orgId/projects/:projectId/compliance-inspections/:inspectionId/complete      permission: project.compliance_inspection.manage
POST   /:orgId/projects/:projectId/compliance-inspections/:inspectionId/documents     permission: project.compliance_inspection.manage

POST   /:orgId/projects/:projectId/compliance-records                                 permission: project.compliance_record.manage
GET    /:orgId/projects/:projectId/compliance-records                                 permission: project.compliance_record.read
GET    /:orgId/projects/:projectId/compliance-records/:recordId                       permission: project.compliance_record.read
PATCH  /:orgId/projects/:projectId/compliance-records/:recordId                       permission: project.compliance_record.manage
DELETE /:orgId/projects/:projectId/compliance-records/:recordId                       permission: project.compliance_record.manage
POST   /:orgId/projects/:projectId/compliance-records/:recordId/verify                permission: project.compliance_record.manage
POST   /:orgId/projects/:projectId/compliance-records/:recordId/documents             permission: project.compliance_record.manage

GET    /:orgId/projects/:projectId/expiring                                           permission: project.compliance_record.read
  query: days? (1-90, default 30), entityType? (document|permit|compliance_record)
```

---

## Key Field Constraints (from routes inline schemas)

### Safety event create body
```
eventType*    INCIDENT | NEAR_MISS | UNSAFE_CONDITION | UNSAFE_ACT | FIRST_AID
title*        string min:1 max:500
description*  string min:1 max:10000
occurredAt*   datetime ISO
severity?     LOW | MEDIUM | HIGH | CRITICAL | FATALITY
location?     string max:500
involvedParties? string max:5000
assignedTo?   memberId max:128
immediateAction? string max:5000
notes?        string max:5000
```

### Safety event list filters
```
status?: REPORTED | UNDER_INVESTIGATION | CORRECTIVE_ACTION_REQUIRED | CORRECTIVE_ACTION_IN_PROGRESS | CLOSED
eventType?: INCIDENT | NEAR_MISS | UNSAFE_CONDITION | UNSAFE_ACT | FIRST_AID
severity?: LOW | MEDIUM | HIGH | CRITICAL | FATALITY
```

### Quality inspection create body
```
inspectionType* string min:1 max:255
scheduledDate?  YYYY-MM-DD
inspectorMemberId? memberId
location?       string max:500
notes?          string max:5000
```

### Quality inspection complete body
```
result*         PASS | PASS_WITH_CONDITIONS | FAIL
performedDate*  YYYY-MM-DD
findings?       string | null max:5000
```

### Quality deficiency create body
```
title*              string min:1 max:500
severity?           LOW | MEDIUM | HIGH | CRITICAL
inspectionId?       string (links to quality inspection)
description?        string max:5000
responsibleMemberId? memberId
dueDate?            YYYY-MM-DD
location?           string max:500
notes?              string max:5000
```

### Quality deficiency list filters
```
status?: OPEN | IN_PROGRESS | RESOLVED | CLOSED | DISPUTED | CANCELLED
severity?: LOW | MEDIUM | HIGH | CRITICAL
inspectionId?: string
```

### Corrective action create body (shared by quality + safety source)
```
sourceType*  QUALITY_DEFICIENCY | SAFETY_INCIDENT | SAFETY_OBSERVATION
sourceId*    string
title*       string min:1 max:500
description? string max:5000
assignedTo?  memberId
dueDate?     YYYY-MM-DD
notes?       string max:5000
```

### Corrective action list filters
```
status?:     OPEN | IN_PROGRESS | COMPLETED | VERIFIED | CANCELLED
sourceType?: QUALITY_DEFICIENCY | SAFETY_INCIDENT | SAFETY_OBSERVATION
sourceId?:   string
```

### Permit create body
```
permitType*         string min:1 max:255
referenceNumber?    string max:255
issuingAuthority?   string max:255
responsibleMemberId? memberId
issueDate?          YYYY-MM-DD
effectiveDate?      YYYY-MM-DD
expiryDate?         YYYY-MM-DD
notes?              string max:5000
```

### Permit transition body
```
status* APPLIED | ISSUED | ACTIVE | REVOKED | CANCELLED
```

### Permit list filters
```
status?: PENDING | APPLIED | ISSUED | ACTIVE | EXPIRED | REVOKED | CANCELLED
```

### Compliance record create body
```
requirementType*    string min:1 max:255
subjectType?        SUBCONTRACTOR | PROJECT | ORGANIZATION
subjectId?          string
responsibleMemberId? memberId
effectiveDate?      YYYY-MM-DD
expiryDate?         YYYY-MM-DD
verificationRef?    string max:500
notes?              string max:5000
```

### Compliance record list filters
```
status?: PENDING | ACTIVE | EXPIRING_SOON | EXPIRED | CANCELLED | VERIFIED
```

### Compliance inspection complete body
```
result*         PASS | PASS_WITH_CONDITIONS | FAIL | INCONCLUSIVE
performedDate*  YYYY-MM-DD
findings?       string | null max:5000
```

---

## State Machines

### Safety Event
```
REPORTED → UNDER_INVESTIGATION (investigate)
UNDER_INVESTIGATION → CORRECTIVE_ACTION_REQUIRED (update with status field)
CORRECTIVE_ACTION_REQUIRED → CORRECTIVE_ACTION_IN_PROGRESS (corrective action created)
CORRECTIVE_ACTION_IN_PROGRESS → CLOSED (close with notes*)
```

### Quality Inspection
```
SCHEDULED → IN_PROGRESS (start) → COMPLETED (complete with result) | CANCELLED
```

### Quality Deficiency
```
OPEN → IN_PROGRESS → RESOLVED (resolve) → CLOSED (close)
Any → DISPUTED | CANCELLED
```

### Corrective Action
```
OPEN → IN_PROGRESS → COMPLETED (complete) → VERIFIED (verify with optional notes) | CANCELLED
```

### Permit
```
PENDING → APPLIED → ISSUED → ACTIVE → REVOKED | CANCELLED | EXPIRED (auto on expiryDate)
```

### Compliance Record
```
PENDING → ACTIVE → EXPIRING_SOON (auto) → EXPIRED (auto) | VERIFIED (verify)
Any → CANCELLED
```

---

## Frontend Pages to Build

### 10.1 `ProjectSafetyPage` — `.../safety-events` (tabbed with meetings)
- Tab: Events | Meetings
- Events: table + create form + status filter + severity filter
- Event detail: full info, investigate, close, corrective actions sub-list, attach docs
- Meetings: create toolbox/safety meeting, list

### 10.2 `ProjectQualityPage` — `.../quality-inspections` (tabbed)
- Tab: Inspections | Deficiencies | Corrective Actions
- Each: list + create + lifecycle actions

### 10.3 `ProjectCompliancePage` — `.../permits` (tabbed)
- Tab: Permits | Inspections | Records | Expiring
- Permits: lifecycle transition buttons
- Expiring: cross-entity dashboard (uses `GET /expiring?days=30`)

---

## Frontend Files to Create

```
apps/web/src/types/safetyTypes.ts
apps/web/src/types/qualityTypes.ts
apps/web/src/types/complianceTypes.ts
apps/web/src/fixtures/hse.fixtures.ts
apps/web/src/api/safetyApi.ts
apps/web/src/api/qualityApi.ts
apps/web/src/api/complianceApi.ts
apps/web/src/pages/hse/ProjectSafetyPage.tsx
apps/web/src/pages/hse/ProjectQualityPage.tsx
apps/web/src/pages/hse/ProjectCompliancePage.tsx
```

Router additions under `projects/:projectId`:
```
{ path: 'safety', element: <ProjectSafetyPage /> }
{ path: 'quality', element: <ProjectQualityPage /> }
{ path: 'compliance', element: <ProjectCompliancePage /> }
```

ProjectShell nav additions: **Safety** | **Quality** | **Compliance**
