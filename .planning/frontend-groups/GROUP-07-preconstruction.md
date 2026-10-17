# Group 7 — Pre-construction (Tenders, Takeoffs, Estimates, BOQ, Pricing, Proposals)

**Status:** Not started  
**Priority:** 🟠 High — revenue entry point, pre-contract workflow  
**Depends on:** Group 1 (project shell), Group 5 (tasks/phases for BOQ mapping)

---

## Backend Source Files

| File | Purpose |
|------|---------|
| `apps/server/src/modules/project/proposal/proposal.routes.ts` | Tender + Proposal route registrations |
| `apps/server/src/modules/project/proposal/proposal.handler.ts` | All handlers |
| `apps/server/src/modules/project/takeoff/takeoff.routes.ts` | Takeoff sheet + measurements + sources |
| `apps/server/src/modules/project/takeoff/takeoff.handler.ts` | Handlers |
| `apps/server/src/modules/project/takeoff/takeoff.schemas.ts` | Zod schemas |
| `apps/server/src/modules/project/estimate/estimate.routes.ts` | Estimate CRUD + lifecycle |
| `apps/server/src/modules/project/estimate/estimate.handler.ts` | Handlers |
| `apps/server/src/modules/project/boq/boq.routes.ts` | BOQ CRUD + import + revisions + export |
| `apps/server/src/modules/project/boq/boq.handler.ts` | Handlers |
| `apps/server/src/modules/project/pricing/pricing.routes.ts` | Rate versions CRUD |
| `apps/server/src/modules/project/pricing/pricing.handler.ts` | Handlers |
| `apps/server/src/modules/project/pricing/pricing.schemas.ts` | Zod schemas |
| `apps/server/src/modules/project/docs/preconstruction.api.schemas.ts` | Full API schema docs for proposal/tender |

---

## HTTP Routes

### Tenders (org-scoped, no projectId)
```
POST   /:orgId/tenders                           permission: project:write:any
GET    /:orgId/tenders                           permission: project:read:any
GET    /:orgId/tenders/:tenderId                 permission: project:read:any
PATCH  /:orgId/tenders/:tenderId                 permission: project:write:any
POST   /:orgId/tenders/:tenderId/submit          permission: project:write:any
POST   /:orgId/tenders/:tenderId/award           permission: project:write:any
POST   /:orgId/tenders/:tenderId/lost            permission: project:write:any
POST   /:orgId/tenders/:tenderId/withdraw        permission: project:write:any
```

### Proposals (project-scoped)
```
POST   /:orgId/projects/:projectId/proposals                               permission: project.proposal.create
GET    /:orgId/projects/:projectId/proposals                               permission: project.proposal.read
GET    /:orgId/projects/:projectId/proposals/:proposalId                   permission: project.proposal.read
PATCH  /:orgId/projects/:projectId/proposals/:proposalId                   permission: project.proposal.update
POST   /:orgId/projects/:projectId/proposals/:proposalId/submit            permission: project.proposal.submit
POST   /:orgId/projects/:projectId/proposals/:proposalId/approve           permission: project.proposal.approve
POST   /:orgId/projects/:projectId/proposals/:proposalId/reject            permission: project.proposal.approve
POST   /:orgId/projects/:projectId/proposals/:proposalId/issue             permission: project.proposal.issue
POST   /:orgId/projects/:projectId/proposals/:proposalId/respond           permission: project.proposal.respond
POST   /:orgId/projects/:projectId/proposals/:proposalId/withdraw          permission: project.proposal.withdraw
GET    /:orgId/projects/:projectId/proposals/:proposalId/revisions         permission: project.proposal.read
GET    /:orgId/projects/:projectId/proposals/:proposalId/revisions/:revisionId  permission: project.proposal.read
GET    /:orgId/projects/:projectId/proposals/:proposalId/client-events     permission: project.proposal.read
POST   /:orgId/projects/:projectId/proposals/:proposalId/convert           permission: project.proposal.convert
```

### Takeoffs
```
POST   /:orgId/projects/:projectId/takeoffs/sheets                          permission: project.takeoff.create
GET    /:orgId/projects/:projectId/takeoffs/sheets                          permission: project.takeoff.read
GET    /:orgId/projects/:projectId/takeoffs/sheets/:sheetId                 permission: project.takeoff.read
PATCH  /:orgId/projects/:projectId/takeoffs/sheets/:sheetId                 permission: project.takeoff.update
POST   /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/submit          permission: project.takeoff.submit
POST   /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/approve         permission: project.takeoff.approve
POST   /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/reject          permission: project.takeoff.approve
POST   /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/revisions       permission: project.takeoff.revise
GET    /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/revisions       permission: project.takeoff.read
GET    /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/revisions/compare  permission: project.takeoff.read
GET    /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/measurements    permission: project.takeoff.read
POST   /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/measurements    permission: project.takeoff.measure
PATCH  /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/measurements/:measurementId  permission: project.takeoff.measure
GET    /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/sources         permission: project.takeoff.read
POST   /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/sources         permission: project.takeoff.source
POST   /:orgId/projects/:projectId/takeoffs/formulas/preview                permission: project.takeoff.measure
GET    /:orgId/projects/:projectId/takeoffs/summary                         permission: project.takeoff.read
```

### Estimates
```
POST   /:orgId/projects/:projectId/estimates                           permission: project.estimate.create
GET    /:orgId/projects/:projectId/estimates                           permission: project.estimate.read
GET    /:orgId/projects/:projectId/estimates/:estimateId               permission: project.estimate.read
PATCH  /:orgId/projects/:projectId/estimates/:estimateId               permission: project.estimate.update
GET    /:orgId/projects/:projectId/estimates/:estimateId/compare       permission: project.estimate.actuals.read
POST   /:orgId/projects/:projectId/estimates/:estimateId/submit        permission: project.estimate.submit
POST   /:orgId/projects/:projectId/estimates/:estimateId/approve       permission: project.estimate.review
POST   /:orgId/projects/:projectId/estimates/:estimateId/reject        permission: project.estimate.review
```

### BOQ
```
POST   /:orgId/projects/:projectId/boqs                              permission: project.boq.create
GET    /:orgId/projects/:projectId/boqs                              permission: project.boq.read
GET    /:orgId/projects/:projectId/boqs/:boqId                       permission: project.boq.read
POST   /:orgId/projects/:projectId/boqs/:boqId/revisions             permission: project.boq.update
GET    /:orgId/projects/:projectId/boqs/:boqId/revisions             permission: project.boq.read
GET    /:orgId/projects/:projectId/boqs/:boqId/revisions/:revisionId permission: project.boq.read
POST   /:orgId/projects/:projectId/boqs/:boqId/imports/preview       permission: project.boq.import
POST   /:orgId/projects/:projectId/boqs/:boqId/imports/commit        permission: project.boq.import
POST   /:orgId/projects/:projectId/boqs/:boqId/submit                permission: project.boq.update
POST   /:orgId/projects/:projectId/boqs/:boqId/approve               permission: project.boq.approve
POST   /:orgId/projects/:projectId/boqs/:boqId/lock                  permission: project.boq.approve
PUT    /:orgId/projects/:projectId/boqs/:boqId/items/:itemId/mapping  permission: project.boq.map
GET    /:orgId/projects/:projectId/boqs/:boqId/export                permission: project.boq.export
```

### Pricing Rates
```
POST   /:orgId/projects/:projectId/pricing/rates                     permission: project.pricing.manage
GET    /:orgId/projects/:projectId/pricing/rates                     permission: project.pricing.read
GET    /:orgId/projects/:projectId/pricing/rates/:rateId             permission: project.pricing.read
POST   /:orgId/projects/:projectId/pricing/rates/:rateId/approve     permission: project.pricing.approve
POST   /:orgId/projects/:projectId/pricing/rates/:rateId/retire      permission: project.pricing.manage
GET    /:orgId/projects/:projectId/pricing/resolve                   permission: project.pricing.read
```

---

## State Machines

### Tender
```
DRAFT → SUBMITTED (via /submit)
SUBMITTED → AWARDED (via /award) | LOST (via /lost) | WITHDRAWN (via /withdraw)
Any → WITHDRAWN
```

### Proposal
```
DRAFT → SUBMITTED (via /submit)
SUBMITTED → APPROVED (via /approve) | REJECTED (via /reject)
APPROVED → ISSUED (via /issue)
ISSUED → [client ACCEPTED/REJECTED/COUNTERED] (via /respond)
Any → WITHDRAWN (via /withdraw)
APPROVED/ISSUED → creates revision on re-submit
convert: creates new project from approved proposal
```

### Takeoff Sheet
```
DRAFT → SUBMITTED (via /submit)
SUBMITTED → APPROVED (via /approve) | REJECTED (via /reject)
APPROVED → new DRAFT revision (via /revisions POST)
```

### Estimate
```
DRAFT → SUBMITTED (via /submit)
SUBMITTED → APPROVED (via /approve) | REJECTED (via /reject)
```

### BOQ
```
DRAFT → SUBMITTED (via /submit)
SUBMITTED → APPROVED (via /approve)
APPROVED → LOCKED (via /lock)
Any non-LOCKED → new revision possible
```

### Pricing Rate
```
DRAFT → APPROVED (via /approve)
APPROVED → RETIRED (via /retire)
```

---

## Frontend Pages to Build

### 7.1 `TendersPage` — `/org/:orgId/tenders`
- Org-level page (outside project shell, in AppLayout)
- Table: tenderNumber | title | status | value | deadline | client
- Lifecycle action buttons per row
- Create inline form

### 7.2 `TenderDetailPage` — `/org/:orgId/tenders/:tenderId`
- Full detail + edit + lifecycle buttons (submit/award/lost/withdraw)
- Link to associated proposal if awarded

### 7.3 `ProjectTakeoffsPage` — `.../takeoffs/sheets`
- Sheet list: name | status | createdAt
- Create sheet form
- Click → sheet detail with measurements, sources, revisions

### 7.4 `ProjectEstimatesPage` — `.../estimates`
- List + create + lifecycle (submit/approve/reject)
- Estimate detail with compare-to-actuals view

### 7.5 `ProjectBOQPage` — `.../boqs`
- BOQ list + create + lifecycle (submit/approve/lock)
- BOQ detail: line items table, revision history, CSV import/export
- Item mapping: link each BOQ line to a cost-code

### 7.6 `ProjectPricingPage` — `.../pricing/rates`
- Rate versions list: name | status | effectiveDate | approvedBy
- Create rate version, approve, retire
- Resolve lookup helper panel

### 7.7 `ProjectProposalsPage` — `.../proposals`
- Proposal list + lifecycle pipeline
- Detail: full proposal text, revision history, client event log, convert-to-project button

---

## Frontend Files to Create

```
apps/web/src/types/tenderTypes.ts
apps/web/src/types/proposalTypes.ts
apps/web/src/types/takeoffTypes.ts
apps/web/src/types/estimateTypes.ts
apps/web/src/types/boqTypes.ts
apps/web/src/types/pricingTypes.ts
apps/web/src/fixtures/preconstruction.fixtures.ts
apps/web/src/api/tenderApi.ts
apps/web/src/api/proposalApi.ts
apps/web/src/api/takeoffApi.ts
apps/web/src/api/estimateApi.ts
apps/web/src/api/boqApi.ts
apps/web/src/api/pricingApi.ts
apps/web/src/pages/TendersPage.tsx
apps/web/src/pages/TenderDetailPage.tsx
apps/web/src/pages/preconstruction/ProjectTakeoffsPage.tsx
apps/web/src/pages/preconstruction/ProjectEstimatesPage.tsx
apps/web/src/pages/preconstruction/ProjectBOQPage.tsx
apps/web/src/pages/preconstruction/ProjectPricingPage.tsx
apps/web/src/pages/preconstruction/ProjectProposalsPage.tsx
apps/web/src/pages/preconstruction/PreconstructionShell.tsx
```

Router additions:
- Org-level: `{ path: 'tenders', element: <TendersPage /> }`, `{ path: 'tenders/:tenderId', element: <TenderDetailPage /> }`
- Project-level shell: `{ path: 'preconstruction', element: <PreconstructionShell />, children: [...] }`

ProjectShell nav addition: **Pre-construction** (dropdown or sub-shell with Takeoffs | Estimates | BOQ | Pricing | Proposals)
