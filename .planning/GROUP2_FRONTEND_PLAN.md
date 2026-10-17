# Group 2 — Frontend Screens Plan

> Deep-read of all server modules completed. Every section below reflects the exact
> DTO shapes, Zod constraints, status enums, and RBAC gates that the server enforces.
> All permissions use `requirePermission(key)` (org-scoped) or `requireProjectPermission(key)` (project-scoped).

---

## A. Org-level modules (no projectId in path)

### A1 — Suppliers  
**Route prefix:** `/:organizationId/suppliers`  
**Permission:** `supplier:read` (list/get) · `supplier:create` · `supplier:update`

#### DTOs
```ts
SupplierDTO {
  id, organizationId, supplierCode, legalName, displayName,
  supplierType: 'MATERIAL_SUPPLIER' | 'SERVICE_PROVIDER' | 'EQUIPMENT_SUPPLIER' | 'GENERAL_SUPPLIER',
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  taxReference, email, phone, address, website, paymentTerms,
  currencyCode, notes, createdAt, updatedAt
}
SupplierContactDTO {
  id, organizationId, supplierId, name, role, email, phone,
  isPrimary: boolean, isActive: boolean, createdAt, updatedAt
}
```

#### Endpoints
| Method | Path | Body / Query |
|--------|------|--------------|
| GET | `/suppliers` | `?cursor&limit(1-100,def 50)&status` |
| POST | `/suppliers` | `CreateSupplierInput` |
| GET | `/suppliers/:supplierId` | — |
| PATCH | `/suppliers/:supplierId` | `UpdateSupplierInput` |
| POST | `/suppliers/:supplierId/contacts` | `CreateSupplierContactInput` |
| PATCH | `/suppliers/:supplierId/contacts/:contactId` | `UpdateSupplierContactInput` |

#### Key validation constraints
- `supplierCode`: string 1–50
- `legalName` / `displayName`: string 1–500
- `email`: valid email, max 254
- `website`: valid URL, max 500
- `currencyCode`: exactly 3 chars, uppercased
- `notes`: max 4000
- `contact.name`: 1–300
- `contact.role`: max 200

#### Screens needed
1. **Suppliers list page** — table with status badge, type, cursor pagination, status filter
2. **Create supplier form** — all fields, contact section optional
3. **Supplier detail page** — info + contacts list with inline edit
4. **Edit supplier drawer/modal**

---

### A2 — Materials (catalog)
**Route prefix:** `/:organizationId/materials`  
**Permission:** `material:read` · `material:create` · `material:update`

#### DTOs
```ts
MaterialDTO {
  id, organizationId, materialCode, name, description, category,
  defaultUnitCode, materialType: 'MATERIAL' | 'EQUIPMENT' | 'CONSUMABLE' | 'SERVICE' | 'OTHER',
  status: 'ACTIVE' | 'INACTIVE', defaultTaxCode, defaultCurrencyCode,
  createdAt, updatedAt
}
```

#### Endpoints
| Method | Path | Body / Query |
|--------|------|--------------|
| GET | `/materials` | `?cursor&limit&status&category` |
| POST | `/materials` | `CreateMaterialInput` |
| GET | `/materials/:materialId` | — |
| PATCH | `/materials/:materialId` | `UpdateMaterialInput` |

#### Key constraints
- `materialCode`: 1–100
- `name`: 1–500
- `description`: max 2000
- `category`: max 200
- `defaultUnitCode`: 1–20, uppercased
- `defaultCurrencyCode`: exactly 3 chars, uppercased

#### Screens needed
1. **Materials list page** — table with type badge, status toggle, category filter
2. **Create material form**
3. **Edit material inline/modal**

---

### A3 — Org Members (membership module)
**Route prefix:** `/:organizationId/members`  
**Permission:** `member:read` · `member:update` · `member:remove`

#### DTOs
```ts
MemberDTO {
  id, organizationId, userId, roleId, roleName, userEmail,
  userFirstName, userLastName, status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED',
  joinedAt, createdAt, updatedAt
}
```

#### Endpoints
| Method | Path | Body |
|--------|------|------|
| GET | `/members` | `?cursor&limit` |
| GET | `/members/:memberId` | — |
| PATCH | `/members/:memberId` | `{ roleId?: uuid, status?: 'ACTIVE' | 'SUSPENDED' }` |
| DELETE | `/members/:memberId` | — (204) |

*(Already implemented in Group 1 `MembersPage` — no new screen needed, but add suspend/resume toggle)*

---

### A4 — Invitations
**Route prefix:** `/organizations/:organizationId/invitations`  
**Permission:** `member:invite` (create) · `member:read` (list) · `invitation:cancel` (delete)  
**Public:** `POST /invitations/:token/accept` (authenticated user only)

#### DTOs
```ts
InvitationDTO {
  id, organizationId, email, roleId, roleName, status, expiresAt,
  acceptedAt, invitedBy, createdAt
}
```

#### Endpoints
| Method | Path | Body |
|--------|------|------|
| POST | `/invitations` | `{ email: email, roleId: uuid }` |
| GET | `/invitations` | `?cursor&limit&status` |
| DELETE | `/invitations/:id` | — |
| POST | `/invitations/:token/accept` | — |

#### Screens needed
1. **Invitations tab** (inside MembersPage) — pending invitations list, cancel, resend
2. **Invite member form** — email + roleId select

---

### A5 — Portfolio Report (org-level)
**Route:** `GET /:organizationId/reports/portfolio`  
**Permission:** `organizationContext` only (no project-level gate)

#### Screen needed
1. **Portfolio page** — summary of all projects with status, schedule, cost health indicators

---

## B. Project sub-modules (path: `/:organizationId/projects/:projectId/...`)

All routes require `authenticate → organizationContext → projectContext`.

---

### B1 — Tasks (Schedule)
**Permission:** `project.task.read` · `project.task.create` · `project.task.update` · `project.task.delete`

#### DTOs
```ts
TaskDTO {
  id, organizationId, projectId, phaseId, parentTaskId,
  taskCode, externalReference, name, description,
  taskType: 'TASK' | 'MILESTONE' | 'SUMMARY',
  status: 'NOT_STARTED' | 'READY' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED',
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL',
  constraintType: 'ASAP' | 'START_NO_EARLIER_THAN' | 'FINISH_NO_LATER_THAN',
  constraintDate, assignedTo, subcontractorId,
  currentStartDate, currentFinishDate, currentDurationDays,
  actualStartDate, actualFinishDate, floatDays, isCritical,
  progressPercent: 0–100, position, version, createdBy, createdAt, updatedAt
}
TaskListDTO { items: TaskDTO[], nextCursor, totalCount }
```

#### Endpoints
| Method | Path | Notes |
|--------|------|-------|
| GET | `/tasks` | filter: status/priority/taskType/phaseId/parentTaskId/assignedTo/isCritical/search |
| POST | `/tasks` | `CreateTaskInput` |
| GET | `/tasks/:taskId` | — |
| PATCH | `/tasks/:taskId` | `UpdateTaskInput` (requires `expectedVersion`) |
| POST | `/tasks/:taskId/transition` | `{ status, expectedVersion }` |
| DELETE | `/tasks/:taskId` | — |

#### Key constraints
- `name`: 1–255
- `description`: max 2000
- `constraintDate`: YYYY-MM-DD
- `currentDurationDays`: int ≥ 0
- `progressPercent`: int 0–100
- `expectedVersion`: int ≥ 1 (required on all mutations)

#### Screens needed
1. **Task list / schedule view** — list with phase grouping, status/priority badges, progress bar
2. **Create task form** — name, type, phase, dates, priority, assign
3. **Task detail drawer** — all fields + status transition buttons
4. **Dependencies view** — predecessor/successor list

---

### B2 — Dependencies
**Permission:** `project.task.read` (list) · `project.dependency.create` · `project.dependency.delete`

```ts
// from dependency.schema.ts (already open)
createDependencySchema = { predecessorId, successorId, dependencyType, lagDays? }
dependencyType: 'FS' | 'SS' | 'FF' | 'SF'
lagDays: int -365 to 365
```

Screens: handled as part of Task detail drawer (B1)

---

### B3 — Calendar
**Permission:** `project:read` (get) · `project.calendar.manage` (update)

#### Screens
1. **Calendar settings panel** — working days, hours per day, exception dates (holidays/shutdowns)

---

### B4 — Schedule Baselines
**Permission:** `project.baseline.read` · `project.baseline.create` · `project.baseline.activate` · `project.baseline.delete`

#### Screens
1. **Baselines list** — name, status (ACTIVE/DRAFT), created date
2. **Create baseline form** — name, description
3. **Baseline compare view** — current vs baseline variance table

---

### B5 — Field Logs
**Permission:** `project.field-log.read` · `project.field-log.create` · `project.field-log.update` · `project.field-log.submit` · `project.field-log.lock`

#### DTOs (inferred from schema)
```ts
FieldLog { logDate, status: 'DRAFT' | 'SUBMITTED' | 'LOCKED', notes, entries[] }
FieldLogEntry { taskId, completionPctRecorded: 0–100, quantityCompleted?, unit?, notes? }
Amendment { reason: 1–2000, correction: Record<string,unknown> (non-empty) }
```

#### Screens needed
1. **Field logs list** — date, status badge
2. **Field log form** — logDate, notes, task progress entries (inline table per task)
3. **Submit / Lock actions**
4. **Amendment form** — reason + correction JSON

---

### B6 — Issues (Site Issues tracker)
**Permission:** `project.issue.read` · `project.issue.create` · `project.issue.update` · `project.issue.transition`

#### Schema
```ts
status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
CreateIssue: { title: 1–500, description?: max 4000, reportedImpactDays: int ≥ 0, assignedTo? }
UpdateIssue: partial + approvedImpactDays?
TransitionIssue: { status }
```

#### Screens needed
1. **Issues list** — title, status badge, impact days, assignee
2. **Create issue form**
3. **Issue detail** — edit + transition (status pipeline)

---

### B7 — RFIs
**Permission:** `project.rfi.read` · (create/update/submit/respond inferred from routes)

#### Schema
```ts
status: 'DRAFT' | 'OPEN' | 'UNDER_REVIEW' | 'ANSWERED' | 'CLOSED' | 'CANCELLED'
priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
CreateRfi: { title: 1–500, question: 1–20000, discipline?, priority?, recipientName?,
             dueDate?, scheduleImpactDays: int ±36500, costImpact?, linkedTaskId?, notes? }
RespondRfi: { response: 1–20000, scheduleImpactDays?, costImpact? }
```

#### Screens needed
1. **RFI list** — number, title, status badge, priority, due date, overdue indicator
2. **Create RFI form**
3. **RFI detail** — question, response section, status pipeline, impact fields

---

### B8 — Submittals
**Permission:** `project.submittal.read` · (create/update/submit/review inferred)

#### Schema
```ts
status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REVISE_AND_RESUBMIT' | 'CLOSED'
CreateSubmittal: { title: 1–500, specReference?, discipline?, responsibleMemberId?,
                   reviewerMemberId?, dueDate?, notes? }
ReviewSubmittal: { response: 'APPROVED' | 'APPROVED_WITH_COMMENTS' | 'REVISE_AND_RESUBMIT' | 'REJECTED',
                   responseNotes? }
```

#### Screens needed
1. **Submittals list** — title, status badge, spec reference, discipline, due date
2. **Create submittal form**
3. **Submittal detail** — info + review action (role: reviewer)

---

### B9 — Quality
**Permission:** `project.quality.read` · (create/update/complete inferred)

#### Schema
```ts
InspectionStatus: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
DeficiencyStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'DISPUTED' | 'CANCELLED'
DeficiencySeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
CorrectiveActionStatus: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'CANCELLED'
```

#### Screens needed
1. **Inspections list** — type, scheduled date, inspector, status
2. **Create inspection form**
3. **Inspection detail** — complete (result: PASS/PASS_WITH_CONDITIONS/FAIL, findings, performedDate)
4. **Deficiencies list** — title, severity badge, status, due date
5. **Create deficiency form**
6. **Corrective actions list** — linked to deficiency or safety source

---

### B10 — Safety
**Permission:** `project.safety.read` · (create/update/investigate/close inferred)

#### Schema
```ts
eventType: 'INCIDENT' | 'NEAR_MISS' | 'UNSAFE_CONDITION' | 'UNSAFE_ACT' | 'FIRST_AID'
severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'FATALITY'
status: 'REPORTED' | 'UNDER_INVESTIGATION' | 'CORRECTIVE_ACTION_REQUIRED' | 'CORRECTIVE_ACTION_IN_PROGRESS' | 'CLOSED'
occurredAt: ISO datetime
```

#### Screens needed
1. **Safety events list** — type, severity badge, status, location, occurred date
2. **Report safety event form** — all fields, datetime picker for `occurredAt`
3. **Safety event detail** — info + investigate action + close action
4. **Safety meetings list**
5. **Create safety meeting form**

---

### B11 — Subcontractors (project-assigned)
**Permission:** `project.subcontractor.read` · `project.subcontractor.create` · `project.subcontractor.update` · `project.subcontractor.assign`

#### Schema
```ts
AssignSubcontractorToProject: { subcontractorId, scopeDescription?, contractValue?,
                                 currencyCode?, startDate?, endDate? }
UpdateProjectSubcontractor: { status?: 'ACTIVE' | 'INACTIVE', scopeDescription?,
                               contractValue?, currencyCode?, startDate?, endDate? }
AssignSubcontractorTask: { taskId, assignmentRole? }
```

#### Screens needed
1. **Project subcontractors list** — display name, trade, contract value, status
2. **Assign subcontractor form** — pick from org-level supplier list, scope/contract fields
3. **Subcontractor detail** — contact list, task assignments, performance link

---

### B12 — Material Requests
**Permission:** `project.material_request.read` · `.create` · `.update` · `.submit` · `.cancel`

#### Schema
```ts
status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'PARTIALLY_ORDERED' | 'ORDERED' | 'FULFILLED' | 'CANCELLED' | 'REJECTED'
priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
CreateMaterialRequest: {
  requiredByDate?, deliveryLocation?, priority?, notes?,
  items: [{ materialId, description?, quantity: '>0 decimal', unitCode: uppercase,
             requiredByDate?, taskId?, phaseId?, costCodeId?, boqLineId?, notes? }] (min 1)
}
```

#### Screens needed
1. **Material requests list** — MR number, status badge, priority, required date, item count
2. **Create MR form** — header + multi-row items (material picker, qty, unit)
3. **MR detail** — header info + items table + submit/cancel actions

---

### B13 — Quotes (Supplier Quotes)
**Permission:** `project.quote.read` · `.create` · `.update` · `.submit` · `.accept` · `.reject`

#### Schema
```ts
status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
CreateQuote: {
  supplierId, materialRequestId?, quoteDate: YYYY-MM-DD, validUntil?,
  currencyCode: 3-char uppercase, notes?,
  items: [{ materialRequestItemId?, materialId, description?, quantity, unitCode, unitPrice,
             discountAmount?, taxAmount?, expectedDeliveryDate? }] (min 1)
}
UpdateQuote: { quoteDate?, validUntil?, notes? }
```

#### Screens needed
1. **Quotes list** — quote number, supplier, status badge, total amount, valid until
2. **Create quote form** — supplier picker, MR link, date, multi-row items
3. **Quote detail** — items table, totals, submit/accept/reject actions

---

### B14 — Purchase Orders
**Permission:** `project.purchase_order.read` · `.create` · `.update` · `.submit` · `.approve` · `.send` · `.cancel`

#### Status machine
`DRAFT → PENDING_APPROVAL → APPROVED → SENT → ACKNOWLEDGED → PARTIALLY_RECEIVED → RECEIVED → CANCELLED | CLOSED`

#### Schema
```ts
CreatePurchaseOrder: {
  supplierId, materialRequestId?, sourceQuoteId?, orderDate: YYYY-MM-DD,
  expectedDeliveryDate?, deliveryLocation?: max 500, currencyCode: 3-char,
  notes?: max 4000,
  items: [{ materialId, quantity: '>0', unitCode, unitPrice, discountAmount?, taxAmount?,
             materialRequestItemId?, sourceQuoteItemId?, taskId?, phaseId?, costCodeId?,
             boqLineId?, expectedDeliveryDate? }] (min 1)
}
UpdatePurchaseOrder: { expectedDeliveryDate?, deliveryLocation?, notes? }
```

#### Screens needed
1. **PO list** — PO number, supplier, status badge, total amount, order date
2. **Create PO form** — link from MR or quote, supplier, multi-row items
3. **PO detail** — full info + items table + lifecycle actions (submit → approve → send → cancel)

---

### B15 — Committed Costs (read-only)
**Permission:** `project.committed_cost.read`

#### Screens needed
1. **Committed costs list** — read-only view, cost code, PO number, amount, status

---

### B16 — Deliveries & Receipts
**Permission:** `project.delivery.read` · `.create` · `.update` · `project.receipt.read` · `.create` · `.post` · `.void`

#### Schema
```ts
CreateDelivery: {
  purchaseOrderId, scheduledDate?, supplierReference?, carrier?, trackingReference?, notes?,
  items: [{ purchaseOrderItemId, quantity: '>0', unitCode, notes? }] (min 1)
}
UpdateDelivery: { status?: 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED', 
                  scheduledDate?, actualDeliveryDate?, ... }
CreateReceipt: {
  purchaseOrderId, deliveryId?, receivedAt: ISO datetime, notes?,
  items: [{ purchaseOrderItemId, quantityDelivered, quantityAccepted, quantityRejected?,
             unitCode, rejectionReason?, condition?, notes? }] (min 1)
}
```

#### Screens needed
1. **Deliveries list** — PO number, scheduled date, status, carrier
2. **Create delivery form** — PO picker, items from PO
3. **Receipts list** — delivery link, received date, accepted/rejected qty
4. **Create receipt form** — items with accepted/rejected quantities

---

### B17 — Inventory
**Permission:** `project.inventory.read` · `project.inventory.adjust`

#### Screens needed
1. **Inventory balances list** — material, on-hand qty, unit
2. **Inventory transactions** — per material history
3. **Adjust inventory form** — quantity + reason
4. **Transfer inventory form** — between projects

---

### B18 — Commercial: Cost Transactions
**Permission:** `project.cost_transaction.read` · `.create` · `.post` · `.void`

#### Schema
```ts
status: 'DRAFT' | 'POSTED' | 'VOIDED'
sourceType: 'MANUAL' | 'DOCUMENT' | 'TASK' | 'PHASE'
CreateCostTransaction: {
  costCodeId, phaseId?, taskId?, documentId?, sourceType, sourceId?,
  transactionDate: YYYY-MM-DD, description: 1–1000,
  quantity?, unit?, unitCost?,   // must all be present together if any provided
  subtotal?,  // required if no quantity/unitCost
  taxAmount: default '0.00', currencyCode: 3-char
}
VoidCostTransaction: { expectedVersion, reason: 1–500 }
```

#### Screens needed
1. **Cost transactions list** — cost code, date, description, total, status
2. **Create cost transaction form** — with quantity-based or subtotal entry
3. **Post / Void actions**

---

### B19 — Commercial: Change Orders
**Permission:** `project.change_order.read` · `.create` · `.update` · (submit/approve/reject/effect inferred)

#### Schema
```ts
status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PENDING_CLIENT_APPROVAL' | 'CLIENT_APPROVED' | 'REJECTED' | 'EFFECTED' | 'VOIDED'
CreateChangeOrder: {
  title: 1–200, reason: 1–2000, currencyCode: 3-char,
  scheduleDeltaDays: int ±36500, clientApprovalRequired: boolean,
  lines: [{ description: 1–1000, costCodeId, phaseId?, taskId?, documentId?, boqLineId?,
             costDelta: signed money, revenueDelta: signed money }] (1–200)
}
UpdateChangeOrder: CreateChangeOrder + expectedVersion (int > 0)
RejectChangeOrder: { expectedVersion, reason: 1–500 }
```

#### Screens needed
1. **Change orders list** — CO number, title, status badge, schedule delta, cost delta
2. **Create CO form** — header + multi-row lines
3. **CO detail** — lines table, totals, lifecycle actions

---

### B20 — Commercial: Schedule of Values
**Permission:** `project.schedule_of_values.read` · `.create` · `.update` (submit/approve inferred)

#### Schema
```ts
CreateScheduleOfValues: {
  contractValue: money, currencyCode: 3-char,
  lines: [{ description: 1–1000, costCodeId, phaseId?, boqLineId?,
             scheduledValue: money, retainagePercent: default '0.00' }] (1–200)
}
UpdateScheduleOfValues: + expectedVersion
```

#### Screens needed
1. **SOV page** — contract value, lines table with scheduled values and retainage %
2. **Create/Edit SOV form** — inline line editor

---

### B21 — Commercial: Payment Applications
**Permission:** `project.payment_application.read` · `.create` · `.update` (submit/approve/reject inferred)

#### Schema
```ts
CreatePaymentApplication: {
  billingPeriodStart: YYYY-MM-DD, billingPeriodEnd: YYYY-MM-DD,
  lines: [{ scheduleOfValueLineId, currentWork: money, storedMaterials: money }] (1–200, unique SOV line IDs)
}
ApprovePaymentApplication: { expectedVersion, lines: [{ scheduleOfValueLineId, approvedCurrentWork, approvedStoredMaterials }] }
RejectPaymentApplication: { expectedVersion, reason: 1–500 }
```

#### Screens needed
1. **Payment applications list** — app number, billing period, status, total requested
2. **Create payment application form** — billing period + SOV lines with current work input
3. **PA detail** — approve/reject actions with line-level approval amounts

---

### B22 — Commercial: Invoices & Payments
**Permission:** `project.invoice.read` · `.create` (submit/approve/reject/void inferred)

#### Schema
```ts
InvoiceDirection: 'RECEIVABLE' | 'PAYABLE'
InvoiceStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'VOIDED'
CreateInvoice (discriminated union):
  RECEIVABLE: { invoiceNumber, invoiceDate, dueDate?, subtotal, taxAmount, retainageAmount,
                paymentApplicationId, billToName }
  PAYABLE:    { invoiceNumber, invoiceDate, dueDate?, subtotal, taxAmount, retainageAmount,
                purchaseOrderId }
CreatePayment: { amount: money, paymentDate: YYYY-MM-DD, method: 1–64, reference?: max 256 }
PaymentStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'VOIDED'
```

#### Screens needed
1. **Invoices list** — direction badge, invoice number, date, status, amount
2. **Create invoice form** — type-split (receivable links to PA; payable links to PO)
3. **Invoice detail** — approve/reject/void actions
4. **Payments list** — linked invoice, amount, method, status
5. **Create payment form**

---

### B23 — Commercial: Retainage
**Permission:** `project.retainage.read` · (release inferred)

#### Schema
```ts
RetainageStatus: 'HELD' | 'PARTIALLY_RELEASED' | 'RELEASED'
ReleaseRetainage: { expectedVersion, amount: money, reason: 1–500 }
```

#### Screens needed
1. **Retainage list** — payment application link, held amount, released amount, status
2. **Release retainage form** — partial or full release with reason

---

### B24 — Commercial Summary (read-only aggregates)
**Permission:** `project.financial_summary.read` (inferred)

#### Screens needed
1. **Commercial summary page** — budget vs committed vs actual vs forecast table by cost code

---

### B25 — Reporting
**Permission:** varies per report (all require `project:read` + report-specific capabilities)

#### Endpoints
| Method | Path | Capabilities |
|--------|------|-------------|
| GET | `/reports/health` | `project.task.read`, `project.issue.read`, `project.rfi.read` |
| GET | `/reports/schedule` | `project.task.read`, `project.baseline.read` |
| GET | `/reports/cost` | `project.financial_summary.read` |
| GET | `/reports/procurement` | `project.material_request.read`, `project.purchase_order.read`, `project.delivery.read`, `project.receipt.read`, `project.inventory.read` |
| GET | `/reports/subcontractor` | `project.subcontractor.read`, `project.task.read`, `project.purchase_order.read` |
| GET | `/reports/executive-summary` | all of the above combined |
| GET | `/:orgId/reports/portfolio` | org-level only, no project gate |

#### Screens needed
1. **Project Health report page** — schedule, issues, RFI summary metrics
2. **Schedule report page** — SPI, variance table, critical path summary
3. **Cost report page** — budget vs actuals vs forecast by cost code
4. **Procurement report page** — MR → PO → delivery → receipt funnel
5. **Subcontractor performance page** — per-subcontractor cost + delivery metrics
6. **Executive summary page** — combined all-in-one project snapshot
7. **Portfolio page** (org-level) — all projects health overview

---

### B26 — BOQ (Bill of Quantities)
**Permission:** `project.boq.read` · `.create` · (import/approve/lock inferred)

#### Schema
```ts
CreateBoq: { title: 1–160, description?: max 5000, currencyCode: 3-char uppercase }
ReviseBoq: { expectedVersion, reason: 10–500 }
BoqListQuery: { limit, cursor, status?: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'LOCKED' }
BOQ_CSV_MAX_BYTES: 2 MB — CSV import via text field
```

#### Screens needed
1. **BOQ list** — title, status, revision number, currency
2. **Create BOQ form**
3. **BOQ detail** — line items table, CSV import, transition actions

---

### B27 — Procurement Approvals
**Permission:** `project.procurement_approval.read` · `.create` · `.approve` · `.reject`

#### Screens needed
1. **Procurement approvals list** — linked to PO/MR, status, requested/approved by

---

### B28 — Performance (read-only)
**Permission:** `project.performance.read`

#### Endpoints
- `GET /performance/suppliers/:supplierId` — delivery rate, quality rate, lead time avg
- `GET /performance/subcontractors/:subcontractorId` — task completion, cost performance

#### Screens: surfaced within supplier/subcontractor detail pages (B3, B11)

---

## C. What's Already Done (Group 1)

These screens are already implemented — do not rebuild:
- Auth flows (login, register, verify-email, forgot/reset password)
- OrgBootstrap, AppLayout, DashboardPage
- MembersPage (list + update + remove)
- ProjectListPage, ProjectShell (sub-nav)
- ProjectOverviewPage, ProjectPhasesPage, ProjectCostCodesPage
- ProjectBudgetPage (create, edit, submit, approve)
- ProjectTeamPage (list + add + role change + remove)
- ProjectSettingsPage

---

## D. Implementation Priority Order

**Wave 1 — Org catalog (prerequisite for project procurement)**
1. A1 Suppliers (list + create + detail + contacts)
2. A2 Materials (list + create + edit)
3. A4 Invitations (add to existing MembersPage)

**Wave 2 — Project schedule**
4. B1 Tasks (list + create + detail + status transitions)
5. B5 Field Logs (list + create + submit/lock)
6. B6 Issues (list + create + detail + transition)
7. B4 Schedule Baselines (list + create + activate)
8. B3 Calendar settings

**Wave 3 — Project engineering (RFI/Submittal/Quality/Safety)**
9. B7 RFIs
10. B8 Submittals
11. B9 Quality (Inspections + Deficiencies + Corrective Actions)
12. B10 Safety (Events + Meetings)

**Wave 4 — Procurement**
13. B11 Subcontractors (project-assigned)
14. B12 Material Requests
15. B13 Quotes
16. B14 Purchase Orders
17. B15 Committed Costs (read-only)
18. B16 Deliveries + Receipts
19. B17 Inventory

**Wave 5 — Commercial / Financial**
20. B18 Cost Transactions
21. B19 Change Orders
22. B20 Schedule of Values
23. B21 Payment Applications
24. B22 Invoices + Payments
25. B23 Retainage
26. B24 Commercial Summary

**Wave 6 — Reporting**
27. B25 All report pages
28. A5 Portfolio report
29. B26 BOQ (if preconstruction module is in scope)

---

## E. Shared Frontend Infrastructure Needed

### New API slices (RTK Query)
Each group of screens needs a new `createApi` (mock-queryFn pattern matching existing budgetApi/phaseApi):
- `supplierApi` — suppliers + contacts
- `materialApi` — materials
- `invitationApi` — invitations
- `taskApi` — tasks
- `dependencyApi` — dependencies
- `calendarApi` — calendar + exceptions
- `baselineApi` — baselines
- `fieldLogApi` — field logs + amendments
- `issueApi` — issues
- `rfiApi` — RFIs
- `submittalApi` — submittals
- `qualityApi` — inspections + deficiencies + corrective actions
- `safetyApi` — events + meetings
- `projectSubcontractorApi` — project subcontractors
- `materialRequestApi` — MRs
- `quoteApi` — quotes
- `purchaseOrderApi` — POs
- `committedCostApi` — read-only
- `deliveryApi` — deliveries + receipts
- `inventoryApi` — balances + transactions + adjustments
- `costTransactionApi` — cost transactions
- `changeOrderApi` — change orders
- `sovApi` — schedule of values
- `paymentApplicationApi` — payment apps
- `invoicePaymentApi` — invoices + payments
- `retainageApi` — retainage
- `reportingApi` — all report endpoints (baseApi injection)
- `boqApi` — BOQ

### New fixture files
- `supplier.fixtures.ts` — MOCK_SUPPLIERS, MOCK_SUPPLIER_CONTACTS
- `material.fixtures.ts` — MOCK_MATERIALS
- `task.fixtures.ts` — MOCK_TASKS per projectId
- `procurement.fixtures.ts` — MOCK_MATERIAL_REQUESTS, MOCK_QUOTES, MOCK_PURCHASE_ORDERS, MOCK_DELIVERIES, MOCK_RECEIPTS
- `commercial.fixtures.ts` — MOCK_COST_TRANSACTIONS, MOCK_CHANGE_ORDERS, MOCK_SOV, MOCK_PAYMENT_APPLICATIONS, MOCK_INVOICES, MOCK_PAYMENTS, MOCK_RETAINAGE
- `quality.fixtures.ts`, `safety.fixtures.ts`, `rfi.fixtures.ts`, `submittal.fixtures.ts`

### New types file
- `supplierTypes.ts`, `materialTypes.ts`, `taskTypes.ts`, `procurementTypes.ts`, `commercialTypes.ts`, `qualityTypes.ts`, `safetyTypes.ts`, etc.
  All typed to mirror the exact server DTOs documented above.

### New route entries in `router.tsx`
```
/org/:orgId/suppliers                          → SuppliersPage
/org/:orgId/suppliers/:supplierId              → SupplierDetailPage
/org/:orgId/materials                          → MaterialsPage
/org/:orgId/projects/:projectId/tasks          → ProjectTasksPage
/org/:orgId/projects/:projectId/field-logs     → ProjectFieldLogsPage
/org/:orgId/projects/:projectId/issues         → ProjectIssuesPage
/org/:orgId/projects/:projectId/rfi            → ProjectRfiPage
/org/:orgId/projects/:projectId/submittals     → ProjectSubmittalsPage
/org/:orgId/projects/:projectId/quality        → ProjectQualityPage
/org/:orgId/projects/:projectId/safety         → ProjectSafetyPage
/org/:orgId/projects/:projectId/subcontractors → ProjectSubcontractorsPage
/org/:orgId/projects/:projectId/material-requests → ProjectMRPage
/org/:orgId/projects/:projectId/quotes         → ProjectQuotesPage
/org/:orgId/projects/:projectId/purchase-orders → ProjectPOsPage
/org/:orgId/projects/:projectId/deliveries     → ProjectDeliveriesPage
/org/:orgId/projects/:projectId/inventory      → ProjectInventoryPage
/org/:orgId/projects/:projectId/cost-transactions → ProjectCostTransactionsPage
/org/:orgId/projects/:projectId/change-orders  → ProjectChangeOrdersPage
/org/:orgId/projects/:projectId/schedule-of-values → ProjectSOVPage
/org/:orgId/projects/:projectId/payment-applications → ProjectPaymentAppsPage
/org/:orgId/projects/:projectId/invoices       → ProjectInvoicesPage
/org/:orgId/projects/:projectId/reports/*      → ProjectReportsPage (tabbed)
/org/:orgId/reports/portfolio                  → PortfolioPage
```

### ProjectShell nav update
Add new nav links to the project shell for the new sub-routes above.

---

## F. Pagination Pattern (consistent across all lists)

Server uses cursor-based pagination:
- Request: `?cursor=<string>&limit=<1-100, default varies>`
- Response: `{ data: [...], nextCursor: string | null }` OR `{ items: [...], nextCursor, totalCount }`
- All API slices must use `providesTags` for cache invalidation
- "Load more" button pattern (not infinite scroll) — matches existing project list UI

---

## G. Status Badge Color Mapping

| Status | Color scheme |
|--------|-------------|
| DRAFT | gray (`--surface-2` / `--muted`) |
| PENDING_APPROVAL / SUBMITTED / OPEN / SCHEDULED | amber (`#fde68a` bg / `#92400e` text) |
| APPROVED / ACTIVE / COMPLETED / LOCKED | green (`#bbf7d0` bg / `#166534` text) |
| REJECTED / CANCELLED / VOIDED / CLOSED | red (`#fecaca` bg / `#991b1b` text) |
| IN_PROGRESS / UNDER_REVIEW / SENT | blue (`#bfdbfe` bg / `#1e40af` text) |
| BLOCKED / CRITICAL severity | orange-red |
| SUSPENDED / INACTIVE | gray |

---

## H. Key Implementation Rules (from server constraints)

1. **Optimistic concurrency** — All `PATCH` mutations on tasks, change orders, SOV, payment apps, invoices, payments require `expectedVersion: int ≥ 1`. Frontend must track version from last GET and pass it. On 409, show "record was updated by someone else — please reload."

2. **Money fields** — Always strings matching `/^\d{1,13}(?:\.\d{1,2})?$/`. Display with `formatCurrency()`, edit as text input with validation. Never use `number` type for financial values.

3. **Date fields** — Always YYYY-MM-DD strings. Use `<input type="date">` or a date picker that formats correctly. `occurredAt` on safety events is full ISO datetime.

4. **Actor separation** — Budget approve (already done). Change order submit ≠ approve. Payment approve ≠ creator. Show warning banners when the current user cannot act.

5. **Min items validation** — All line-based creates (PO, MR, Quote, CO, SOV, PA, receipt, delivery) require `items.min(1)`. The create button must be disabled when the items array is empty.

6. **Permissions** — Every action button must be gated by `usePermission(key)` (org-level) or project-context equivalent. Disabled when permission missing, not hidden (accessibility).

7. **Status transitions** — Lifecycle buttons shown only for valid next states (match state machines above). No generic status PATCH — only explicit transition endpoints.
