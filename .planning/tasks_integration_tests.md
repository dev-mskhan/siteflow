
# SiteFlow — Integration Test Tasks

**Reference:** `siteflow_testing_context.md` (mandatory reading before implementing any task)
**Test location:** `apps/server/tests/integration/`
**Helper location:** `apps/server/tests/helpers/`
**Runner:** Vitest (`pnpm --filter server test`)
**Infrastructure:** Real PostgreSQL (port 5434), Real Redis, Real PgBoss

> **How to execute a task:**
> 1. Read `siteflow_testing_context.md` completely first.
> 2. Read every source file listed under "Source files to read" for that task.
> 3. Build the full scenario matrix (§9 of context) before writing a single test.
> 4. Implement tests — real `buildApp()` + `app.inject()` only.
> 5. Run `pnpm --filter server test <file>` and fix until green.
> 6. Flip STATUS to `DONE` and fill "Tests written" count.

---

## Pre-flight: Infrastructure & OTEL Setup

### T.0 — SigNoz observability for test runs

**STATUS:** NOT STARTED
**Priority:** P0 — do this before any test task

**Problem:**
`initTelemetry()` in `packages/observability/src/server/index.ts` short-circuits on `NODE_ENV=test`, so test spans never reach SigNoz. Test runs are invisible in SigNoz dashboards.

**Fix required (3 changes):**

**1. `packages/observability/src/server/index.ts`**
Add `OTEL_ENABLE_IN_TEST` guard:
```ts
const isTest = process.env.NODE_ENV === 'test';
const enableInTest = process.env.OTEL_ENABLE_IN_TEST === 'true';
if (isTest && !enableInTest) return; // skip unless explicitly enabled
```
Replace the current `if (process.env.NODE_ENV === 'test') return;` line.

**2. `apps/server/vitest.config.ts`**
Add to the `env` block:
```ts
OTEL_ENABLE_IN_TEST: 'true',
OTEL_SERVICE_NAME: 'siteflow-server-test',
OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
```

**3. `.env.example`**
Add under the OTEL section:
```
# Set to 'true' to send test run spans to SigNoz (useful for debugging flaky tests)
OTEL_ENABLE_IN_TEST=false
```

**Quality gates:**
- `pnpm --filter @siteflow/observability build` exits 0
- `pnpm --filter server test tests/integration/auth.test.ts` exits 0 and test spans appear in SigNoz under service `siteflow-server-test`

**Changes made:**
_[record here when DONE]_

---

### T.0b — Fix unscoped `countOutboxEvents` in fixtures.ts

**STATUS:** NOT STARTED
**Priority:** P0 — do this before any test task

**Problem:**
`countOutboxEvents()` in `tests/helpers/fixtures.ts` runs `SELECT * FROM outbox_events WHERE event_type = X` with no scope. In an accumulating test database this returns rows from all previous test runs, making count assertions unreliable (testing context §6, §34, Rule #5).

**Fix:**
Replace `countOutboxEvents` with a scoped helper `getOutboxEvent` that finds a specific event by `resourceId` + `eventType`:

```ts
/**
 * Finds the most recent outbox event matching eventType + a payload field.
 * Always scoped to a specific resource — never counts globally.
 */
export async function getOutboxEvent(
  eventType: string,
  resourceId: string,
): Promise<{ found: boolean; payload: Record<string, unknown> }> {
  const db = getDb();
  const events = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.eventType, eventType));
  const match = events.find((e) => {
    const p = e.payload as Record<string, unknown>;
    return (
      p['resourceId'] === resourceId ||
      p['supplierId'] === resourceId ||
      p['materialId'] === resourceId ||
      p['quoteId'] === resourceId ||
      p['purchaseOrderId'] === resourceId ||
      p['materialRequestId'] === resourceId ||
      p['receiptId'] === resourceId ||
      p['approvalId'] === resourceId ||
      p['committedCostId'] === resourceId ||
      p['subcontractorId'] === resourceId
    );
  });
  return {
    found: !!match,
    payload: (match?.payload as Record<string, unknown>) ?? {},
  };
}
```

Also keep `countOutboxEvents` but add a required `organizationId` param to scope it:
```ts
export async function countOutboxEvents(
  eventType: string,
  organizationId: string,
): Promise<number> {
  const db = getDb();
  const events = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.eventType, eventType));
  return events.filter((e) => {
    const p = e.payload as Record<string, unknown>;
    return p['organizationId'] === organizationId;
  }).length;
}
```

**Quality gates:**
- `fixtures.ts` has both `getOutboxEvent` and updated `countOutboxEvents` with `organizationId` scope
- All existing tests still pass: `pnpm --filter server test` exits 0

**Changes made:**
_[record here when DONE]_

---

## Tier 1 — Catalog APIs

### T.1 — `supplier.test.ts`

**STATUS:** NOT STARTED
**Priority:** P1
**Route count:** 6
**Estimated test cases:** ~35

**Routes to cover:**
```
POST   /api/v1/organizations/:orgId/suppliers
GET    /api/v1/organizations/:orgId/suppliers
GET    /api/v1/organizations/:orgId/suppliers/:supplierId
PATCH  /api/v1/organizations/:orgId/suppliers/:supplierId
POST   /api/v1/organizations/:orgId/suppliers/:supplierId/contacts
PATCH  /api/v1/organizations/:orgId/suppliers/:supplierId/contacts/:contactId
```

**Source files to read before writing:**
- `apps/server/src/modules/supplier/supplier.routes.ts`
- `apps/server/src/modules/supplier/supplier.handler.ts`
- `apps/server/src/modules/supplier/supplier.service.ts`
- `apps/server/src/modules/supplier/supplier.repository.ts`
- `packages/shared/src/modules/supplier/supplier.schema.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | Create supplier — valid full payload | 201, supplier returned, supplierCode uppercased |
| 2 | Create supplier — minimal required fields only | 201 |
| 3 | Create supplier — duplicate supplierCode same org | 409 |
| 4 | Create supplier — duplicate supplierCode different org | 201 (isolated) |
| 5 | Create supplier — missing legalName | 400 |
| 6 | Create supplier — invalid email format | 400 |
| 7 | Create supplier — invalid website URL | 400 |
| 8 | Create supplier — currencyCode wrong length | 400 |
| 9 | Create supplier — supplierCode too long (>50 chars) | 400 |
| 10 | Create supplier — unauthenticated | 401 |
| 11 | Create supplier — wrong org (IDOR) | 403/404 |
| 12 | Create supplier — privileged fields injected (status, id, organizationId) | ignored or 400 |
| 13 | List suppliers — returns only own org suppliers | 200, other org supplier absent |
| 14 | List suppliers — cursor pagination (limit=1) yields nextCursor | 200, nextCursor set |
| 15 | List suppliers — status filter (INACTIVE) | 200, only inactive |
| 16 | Get supplier by ID — own org | 200, correct fields |
| 17 | Get supplier by ID — other org supplier ID | 404 |
| 18 | Get supplier by ID — nonexistent ID | 404 |
| 19 | Update supplier — valid patch | 200, updated |
| 20 | Update supplier — suspend (status: SUSPENDED) | 200 |
| 21 | Update supplier — other org supplier | 404 |
| 22 | Update supplier — unauthenticated | 401 |
| 23 | Redis cache invalidation after update — subsequent GET reflects change | 200, updated value |
| 24 | Create contact — valid, isPrimary=true | 201, contact returned |
| 25 | Create contact — duplicate primary contact | 409 |
| 26 | Create contact — invalid email | 400 |
| 27 | Create contact — supplier belongs to other org | 404 |
| 28 | Update contact — demote primary, promote another | 200 |
| 29 | Update contact — deactivate contact | 200, isActive=false |
| 30 | Update contact — contact belongs to other org's supplier | 404 |
| 31 | Audit log — supplier.created event scoped to this test's orgId | present |
| 32 | Supplier list — does not contain other org's supplier | explicit ID check |
| 33 | Create supplier — no permission (non-member token) | 403 |

**File path:** `apps/server/tests/integration/supplier.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

### T.2 — `material.test.ts`

**STATUS:** NOT STARTED
**Priority:** P1
**Route count:** 4
**Estimated test cases:** ~28

**Routes to cover:**
```
POST   /api/v1/organizations/:orgId/materials
GET    /api/v1/organizations/:orgId/materials
GET    /api/v1/organizations/:orgId/materials/:materialId
PATCH  /api/v1/organizations/:orgId/materials/:materialId
```

**Source files to read before writing:**
- `apps/server/src/modules/material/material.routes.ts`
- `apps/server/src/modules/material/material.handler.ts`
- `apps/server/src/modules/material/material.service.ts`
- `apps/server/src/modules/material/material.repository.ts`
- `packages/shared/src/modules/material/material.schema.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | Create material — valid payload | 201, materialCode uppercased |
| 2 | Create material — duplicate materialCode same org | 409 |
| 3 | Create material — duplicate materialCode different org | 201 (isolated) |
| 4 | Create material — missing materialCode | 400 |
| 5 | Create material — materialType invalid enum | 400 |
| 6 | Create material — defaultUnitCode missing | 400 |
| 7 | Create material — unauthenticated | 401 |
| 8 | Create material — no org permission | 403 |
| 9 | List materials — own org only | 200, other org material absent |
| 10 | List materials — cursor pagination | 200, nextCursor works |
| 11 | List materials — status=INACTIVE filter | 200 |
| 12 | List materials — category filter | 200 |
| 13 | Get material — own org | 200 |
| 14 | Get material — other org's materialId | 404 |
| 15 | Get material — cache hit after create | 200 |
| 16 | Update material — valid patch | 200 |
| 17 | Update material — set status to INACTIVE | 200 |
| 18 | Update material — other org's material | 404 |
| 19 | Update material — invalid materialType | 400 |
| 20 | Redis cache invalidated after update — re-fetch reflects change | 200 |
| 21 | List materials — does not contain other org's material by explicit ID check | absent |
| 22 | Audit log — material.created event scoped to orgId | present |
| 23 | Create material — privileged fields injected (organizationId, status) | ignored |

**File path:** `apps/server/tests/integration/material.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

## Tier 2 — Partner APIs

### T.3 — `subcontractor.test.ts`

**STATUS:** NOT STARTED
**Priority:** P1
**Route count:** 8
**Estimated test cases:** ~45

**Routes to cover:**
```
POST   /api/v1/organizations/:orgId/subcontractors
GET    /api/v1/organizations/:orgId/subcontractors
GET    /api/v1/organizations/:orgId/subcontractors/:subId
PATCH  /api/v1/organizations/:orgId/subcontractors/:subId
POST   /api/v1/organizations/:orgId/subcontractors/:subId/contacts
PATCH  /api/v1/organizations/:orgId/subcontractors/:subId/contacts/:contactId
POST   /api/v1/organizations/:orgId/projects/:projectId/subcontractors
GET    /api/v1/organizations/:orgId/projects/:projectId/subcontractors
```

**Source files to read before writing:**
- `apps/server/src/modules/project/subcontractor/subcontractor.routes.ts`
- `apps/server/src/modules/project/subcontractor/subcontractor.handler.ts`
- `apps/server/src/modules/project/subcontractor/subcontractor.service.ts`
- `packages/shared/src/modules/project/subcontractor.schema.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | Create subcontractor — valid | 201 |
| 2 | Create subcontractor — missing legalName | 400 |
| 3 | Create subcontractor — invalid email | 400 |
| 4 | Create subcontractor — unauthenticated | 401 |
| 5 | List subcontractors — own org only | 200 |
| 6 | List subcontractors — other org absent by explicit ID | absent |
| 7 | List subcontractors — status filter | 200 |
| 8 | Get subcontractor — own org | 200 |
| 9 | Get subcontractor — other org's ID | 404 |
| 10 | Update subcontractor — valid patch | 200 |
| 11 | Update subcontractor — suspend | 200, status=SUSPENDED |
| 12 | Update subcontractor — other org | 404 |
| 13 | Create contact — valid isPrimary=true | 201 |
| 14 | Create contact — duplicate primary | 409 |
| 15 | Create contact — invalid email | 400 |
| 16 | Update contact — deactivate | 200 |
| 17 | Update contact — promote new primary demotes old | 200 |
| 18 | Assign subcontractor to project — valid | 201 |
| 19 | Assign subcontractor to project — INACTIVE subcontractor | 422 |
| 20 | Assign subcontractor to project — duplicate assignment same project | 409 |
| 21 | Assign subcontractor to project — subcontractor from other org | 404 |
| 22 | Assign subcontractor to project — project from other org | 403/404 |
| 23 | List project subcontractors — N+1 resolved (single DB call) | 200, all sub details populated |
| 24 | List project subcontractors — other org's project | 403/404 |
| 25 | Outbox event — procurement.subcontractor.assigned after task assignment | present, scoped |
| 26 | Audit log — subcontractor.created scoped to org | present |

**File path:** `apps/server/tests/integration/subcontractor.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

## Tier 3 — Procurement Flow (write order matters)

### T.4 — `material_request.test.ts`

**STATUS:** NOT STARTED
**Priority:** P1
**Route count:** 6
**Estimated test cases:** ~40

**Routes to cover:**
```
POST   /api/v1/organizations/:orgId/projects/:projectId/material-requests
GET    /api/v1/organizations/:orgId/projects/:projectId/material-requests
GET    /api/v1/organizations/:orgId/projects/:projectId/material-requests/:mrId
PATCH  /api/v1/organizations/:orgId/projects/:projectId/material-requests/:mrId
POST   /api/v1/organizations/:orgId/projects/:projectId/material-requests/:mrId/submit
POST   /api/v1/organizations/:orgId/projects/:projectId/material-requests/:mrId/cancel
```

**Source files to read before writing:**
- `apps/server/src/modules/project/material-request/material-request.routes.ts`
- `apps/server/src/modules/project/material-request/material-request.handler.ts`
- `apps/server/src/modules/project/material-request/material-request.service.ts`
- `packages/shared/src/modules/project/material-request.schema.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | Create MR — valid payload with items | 201, requestNumber=MR-YYYYMM-NNN |
| 2 | Create MR — empty items array | 400 |
| 3 | Create MR — item quantity=0 | 400 |
| 4 | Create MR — item unitCode mismatch with material | 422 |
| 5 | Create MR — materialId from other org | 404/422 |
| 6 | Create MR — taskId from other project | 422 |
| 7 | Create MR — unauthenticated | 401 |
| 8 | Create MR — no project:procurement_manage permission | 403 |
| 9 | List MRs — own project only | 200 |
| 10 | List MRs — other project's MR absent by explicit ID | absent |
| 11 | List MRs — status filter | 200 |
| 12 | List MRs — cursor pagination + nextCursor | 200 |
| 13 | Get MR — own project | 200, items populated (no N+1) |
| 14 | Get MR — other project's MR ID | 404 |
| 15 | Update MR — DRAFT state valid | 200 |
| 16 | Update MR — after SUBMITTED state | 422 (invalid transition) |
| 17 | Submit MR — DRAFT → SUBMITTED | 200, submittedAt set |
| 18 | Submit MR — already SUBMITTED (duplicate) | 422 |
| 19 | Submit MR — empty items guard | 422 |
| 20 | Submit MR — FOR UPDATE lock: concurrent submits produce exactly one SUBMITTED | 1 success, 1 422 |
| 21 | Submit MR — outbox event procurement.material_request.submitted scoped to mrId | present |
| 22 | Submit MR — audit log material_request.submitted | present |
| 23 | Cancel MR — DRAFT → CANCELLED | 200 |
| 24 | Cancel MR — SUBMITTED → CANCELLED | 200 |
| 25 | Cancel MR — already CANCELLED (invalid) | 422 |
| 26 | Cancel MR — outbox event procurement.material_request.cancelled | present |
| 27 | Cancel MR — other project's MR | 404 |
| 28 | List MRs — bulk query uses single DB call (inArray) not N+1 | 200 |
| 29 | Create MR — privileged fields (status=APPROVED, approvedAt) in body | ignored |
| 30 | Tenant isolation — Org B user cannot submit Org A's MR | 403/404 |

**File path:** `apps/server/tests/integration/material_request.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

### T.5 — `quote.test.ts`

**STATUS:** NOT STARTED
**Priority:** P1
**Route count:** 7
**Estimated test cases:** ~45

**Routes to cover:**
```
POST   /api/v1/organizations/:orgId/projects/:projectId/quotes
GET    /api/v1/organizations/:orgId/projects/:projectId/quotes
GET    /api/v1/organizations/:orgId/projects/:projectId/quotes/:quoteId
PATCH  /api/v1/organizations/:orgId/projects/:projectId/quotes/:quoteId
POST   /api/v1/organizations/:orgId/projects/:projectId/quotes/:quoteId/submit
POST   /api/v1/organizations/:orgId/projects/:projectId/quotes/:quoteId/accept
POST   /api/v1/organizations/:orgId/projects/:projectId/quotes/:quoteId/reject
```

**Source files to read before writing:**
- `apps/server/src/modules/project/quote/quote.routes.ts`
- `apps/server/src/modules/project/quote/quote.handler.ts`
- `apps/server/src/modules/project/quote/quote.service.ts`
- `packages/shared/src/modules/project/quote.schema.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | Create quote — valid payload, totals server-computed | 201, totalAmount = sum |
| 2 | Create quote — supplier from other org | 404/422 |
| 3 | Create quote — INACTIVE supplier | 422 |
| 4 | Create quote — empty items | 400 |
| 5 | Create quote — item unitPrice invalid decimal | 400 |
| 6 | Create quote — unauthenticated | 401 |
| 7 | List quotes — own project only | 200 |
| 8 | List quotes — status filter | 200 |
| 9 | List quotes — cursor pagination | 200 |
| 10 | List quotes — items populated via bulk inArray (no N+1) | 200 |
| 11 | Get quote — own project | 200, items array non-empty |
| 12 | Get quote — other project's quote | 404 |
| 13 | Update quote — DRAFT state | 200 |
| 14 | Update quote — ACCEPTED state | 422 |
| 15 | Submit quote — DRAFT → SUBMITTED | 200, submittedAt set |
| 16 | Submit quote — FOR UPDATE lock: concurrent submits | 1 success, 1 422 |
| 17 | Submit quote — outbox procurement.quote.submitted scoped to quoteId | present |
| 18 | Submit quote — duplicate submit | 422 |
| 19 | Accept quote — SUBMITTED → ACCEPTED | 200, acceptedAt set |
| 20 | Accept quote — already ACCEPTED (idempotent) | 200 |
| 21 | Accept quote — expired validUntil | 422 |
| 22 | Accept quote — at-most-one: second quote acceptance for same MR | 422 |
| 23 | Accept quote — FOR UPDATE lock: concurrent accepts | 1 success, 1 422 |
| 24 | Accept quote — outbox procurement.quote.accepted | present |
| 25 | Reject quote — SUBMITTED → REJECTED | 200 |
| 26 | Reject quote — DRAFT → REJECTED | 200 |
| 27 | Reject quote — ACCEPTED → REJECTED | 422 (terminal) |
| 28 | Reject quote — outbox procurement.quote.rejected | present |
| 29 | Privileged fields injected (status, acceptedAt, totalAmount) | ignored |
| 30 | Tenant isolation — Org B cannot accept Org A quote | 403/404 |
| 31 | Document number — quoteNumber format QT-YYYYMM-NNN | correct |

**File path:** `apps/server/tests/integration/quote.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

### T.6 — `purchase_order.test.ts`

**STATUS:** NOT STARTED
**Priority:** P1 — highest risk, most side effects
**Route count:** 8
**Estimated test cases:** ~55

**Routes to cover:**
```
POST   /api/v1/organizations/:orgId/projects/:projectId/purchase-orders
GET    /api/v1/organizations/:orgId/projects/:projectId/purchase-orders
GET    /api/v1/organizations/:orgId/projects/:projectId/purchase-orders/:poId
PATCH  /api/v1/organizations/:orgId/projects/:projectId/purchase-orders/:poId
POST   /api/v1/organizations/:orgId/projects/:projectId/purchase-orders/:poId/submit
POST   /api/v1/organizations/:orgId/projects/:projectId/purchase-orders/:poId/approve
POST   /api/v1/organizations/:orgId/projects/:projectId/purchase-orders/:poId/send
POST   /api/v1/organizations/:orgId/projects/:projectId/purchase-orders/:poId/cancel
```

**Source files to read before writing:**
- `apps/server/src/modules/project/purchase-order/purchase-order.routes.ts`
- `apps/server/src/modules/project/purchase-order/purchase-order.handler.ts`
- `apps/server/src/modules/project/purchase-order/purchase-order.service.ts`
- `apps/server/src/modules/project/committed-cost/committed-cost.service.ts`
- `packages/shared/src/modules/project/purchase-order.schema.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | Create PO — valid, totals server-computed | 201, poNumber=PO-YYYYMM-NNN |
| 2 | Create PO — supplier from other org | 404/422 |
| 3 | Create PO — empty items | 400 |
| 4 | Create PO — item quantity=0 | 400 |
| 5 | Create PO — unauthenticated | 401 |
| 6 | List POs — own project only | 200 |
| 7 | List POs — cursor pagination | 200, nextCursor |
| 8 | List POs — items populated via bulk inArray | 200 |
| 9 | Get PO — own project | 200 |
| 10 | Get PO — other project's PO | 404 |
| 11 | Update PO — DRAFT valid | 200 |
| 12 | Update PO — APPROVED state | 422 |
| 13 | Submit PO — DRAFT → PENDING_APPROVAL | 200 |
| 14 | Submit PO — concurrent submits (FOR UPDATE) | 1 success, 1 422 |
| 15 | Submit PO — duplicate submit | 422 |
| 16 | Approve PO — PENDING_APPROVAL → APPROVED | 200 |
| 17 | Approve PO — idempotent: already APPROVED | 200 |
| 18 | Approve PO — concurrent approvals (FOR UPDATE) | 1 success, 1 idempotent |
| 19 | Approve PO — outbox procurement.committed_cost.created | present, scoped to poId |
| 20 | Approve PO — CommittedCost record created with correct amount | DB verified |
| 21 | Approve PO — duplicate approve (idempotent unique constraint) | 200, single CC record |
| 22 | Approve PO — outbox procurement.approval.approved emitted | present |
| 23 | Send PO — APPROVED → SENT | 200 |
| 24 | Send PO — not APPROVED | 422 |
| 25 | Cancel PO — DRAFT → CANCELLED | 200 |
| 26 | Cancel PO — APPROVED → CANCELLED | 200 |
| 27 | Cancel PO — CANCELLED → CANCELLED | 422 (already terminal) |
| 28 | Cancel PO — outbox procurement.committed_cost.cancelled | present, CC status=CANCELLED |
| 29 | Cancel PO — CommittedCost record status changed to CANCELLED | DB verified |
| 30 | Cancel PO — outbox audit committed_cost.cancelled | present |
| 31 | Optimistic locking on approve — stale version guard | 409 |
| 32 | Tenant isolation — Org B cannot approve Org A PO | 403/404 |
| 33 | Privileged fields injected (status, approvedBy, totalAmount) | ignored |
| 34 | PO with sourceQuoteId — items derived from quote | 201, items match |
| 35 | Document number uniqueness — two POs get different numbers | distinct numbers |

**File path:** `apps/server/tests/integration/purchase_order.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

### T.7 — `procurement_approval.test.ts`

**STATUS:** NOT STARTED
**Priority:** P2
**Route count:** 6
**Estimated test cases:** ~35

**Routes to cover:**
```
POST   /api/v1/organizations/:orgId/projects/:projectId/procurement-approvals
GET    /api/v1/organizations/:orgId/projects/:projectId/procurement-approvals
GET    /api/v1/organizations/:orgId/projects/:projectId/procurement-approvals/:approvalId
POST   /api/v1/organizations/:orgId/projects/:projectId/procurement-approvals/:approvalId/approve
POST   /api/v1/organizations/:orgId/projects/:projectId/procurement-approvals/:approvalId/reject
POST   /api/v1/organizations/:orgId/projects/:projectId/procurement-approvals/:approvalId/cancel
```

**Source files to read before writing:**
- `apps/server/src/modules/project/procurement-approval/procurement-approval.routes.ts`
- `apps/server/src/modules/project/procurement-approval/procurement-approval.handler.ts`
- `apps/server/src/modules/project/procurement-approval/procurement-approval.service.ts`
- `packages/shared/src/modules/project/procurement-approval.schema.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | Create approval — MR resource type | 201 |
| 2 | Create approval — Quote resource type | 201 |
| 3 | Create approval — PO resource type | 201 |
| 4 | Create approval — duplicate PENDING same resource | 409 |
| 5 | Create approval — resourceId from other org | 422 |
| 6 | Create approval — invalid resourceType | 400 |
| 7 | Create approval — unauthenticated | 401 |
| 8 | List approvals — own project | 200 |
| 9 | List approvals — status filter | 200 |
| 10 | List approvals — cursor pagination | 200 |
| 11 | Get approval — own project | 200 |
| 12 | Get approval — other project's approval | 404 |
| 13 | Approve approval — PENDING → APPROVED | 200 |
| 14 | Approve approval — idempotent: already APPROVED | 200 |
| 15 | Approve approval — resource transitions (MR → APPROVED state) | DB verified |
| 16 | Approve approval — outbox procurement.approval.approved | present, scoped |
| 17 | Reject approval — PENDING → REJECTED | 200 |
| 18 | Reject approval — resource transitions (MR → REJECTED state) | DB verified |
| 19 | Reject approval — already REJECTED | 422 |
| 20 | Reject approval — outbox procurement.approval.rejected | present |
| 21 | Cancel approval — PENDING → CANCELLED | 200 |
| 22 | Cancel approval — outbox procurement.approval.cancelled | present |
| 23 | Cancel approval — already CANCELLED | 422 |
| 24 | FOR UPDATE lock: concurrent approvals on same resource | 1 success, 1 idempotent |
| 25 | Tenant isolation — Org B cannot approve Org A approval | 403/404 |
| 26 | Audit log — procurement_approval.approved scoped | present |

**File path:** `apps/server/tests/integration/procurement_approval.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

## Tier 4 — Delivery & Receipt

### T.8 — `delivery.test.ts`

**STATUS:** NOT STARTED
**Priority:** P2
**Route count:** 4
**Estimated test cases:** ~28

**Routes to cover:**
```
POST   /api/v1/organizations/:orgId/projects/:projectId/deliveries
GET    /api/v1/organizations/:orgId/projects/:projectId/deliveries
GET    /api/v1/organizations/:orgId/projects/:projectId/deliveries/:deliveryId
PATCH  /api/v1/organizations/:orgId/projects/:projectId/deliveries/:deliveryId
```

**Source files to read before writing:**
- `apps/server/src/modules/project/delivery/delivery.routes.ts`
- `apps/server/src/modules/project/delivery/delivery.handler.ts`
- `apps/server/src/modules/project/delivery/delivery.service.ts`
- `packages/shared/src/modules/project/delivery.schema.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | Create delivery — valid, tied to SENT PO | 201, deliveryNumber=DL-YYYYMM-NNN |
| 2 | Create delivery — quantity exceeds PO item quantity | 422 |
| 3 | Create delivery — POItemId from other org's PO | 422/404 |
| 4 | Create delivery — empty items | 400 |
| 5 | Create delivery — unauthenticated | 401 |
| 6 | List deliveries — own project | 200 |
| 7 | List deliveries — cursor pagination | 200 |
| 8 | List deliveries — items populated (no N+1) | 200, items array populated |
| 9 | List deliveries — other project absent by explicit ID | absent |
| 10 | Get delivery — own project | 200 |
| 11 | Get delivery — other project's deliveryId | 404 |
| 12 | Update delivery — mark as DELIVERED, performance event fired | 200 |
| 13 | Update delivery — DELIVERED → DELIVERED (idempotent, no duplicate event) | 200 |
| 14 | Update delivery — CANCELLED → DELIVERED | 422 |
| 15 | Update delivery — late delivery (actualDate > scheduledDate) → DELIVERY_LATE event | DB verified |
| 16 | Update delivery — on-time delivery → DELIVERY_ON_TIME event | DB verified |
| 17 | Outbox — procurement.delivery.delivered scoped to deliveryId | present |
| 18 | Tenant isolation — Org B cannot update Org A delivery | 403/404 |
| 19 | Audit log — delivery.created and delivery.updated scoped | present |

**File path:** `apps/server/tests/integration/delivery.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

### T.9 — `receipt.test.ts`

**STATUS:** NOT STARTED
**Priority:** P1 — inventory side effects make this high risk
**Route count:** 5
**Estimated test cases:** ~40

**Routes to cover:**
```
POST   /api/v1/organizations/:orgId/projects/:projectId/receipts
GET    /api/v1/organizations/:orgId/projects/:projectId/receipts
GET    /api/v1/organizations/:orgId/projects/:projectId/receipts/:receiptId
POST   /api/v1/organizations/:orgId/projects/:projectId/receipts/:receiptId/post
POST   /api/v1/organizations/:orgId/projects/:projectId/receipts/:receiptId/void
```

**Source files to read before writing:**
- `apps/server/src/modules/project/delivery/delivery.routes.ts` (receipts registered here)
- `apps/server/src/modules/project/delivery/delivery.handler.ts`
- `apps/server/src/modules/project/delivery/delivery.service.ts`
- `apps/server/src/modules/project/inventory/inventory.service.ts`
- `packages/shared/src/modules/project/delivery.schema.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | Create receipt — valid items | 201, receiptNumber=RC-YYYYMM-NNN |
| 2 | Create receipt — quantityAccepted + quantityRejected > quantityDelivered | 422 |
| 3 | Create receipt — empty items | 400 |
| 4 | Create receipt — POItemId from other org | 422 |
| 5 | Create receipt — unauthenticated | 401 |
| 6 | List receipts — own project | 200 |
| 7 | List receipts — cursor pagination | 200 |
| 8 | List receipts — items populated (no N+1) | 200 |
| 9 | List receipts — other project absent by ID | absent |
| 10 | Get receipt — own project | 200 |
| 11 | Get receipt — other project's receiptId | 404 |
| 12 | Post receipt — DRAFT → POSTED | 200 |
| 13 | Post receipt — already POSTED | 422 |
| 14 | Post receipt — inventory balance incremented by quantityAccepted | DB balance verified |
| 15 | Post receipt — concurrent posts on same PO (FOR UPDATE) | 1 success, 1 422 |
| 16 | Post receipt — outbox procurement.receipt.posted scoped | present |
| 17 | Post receipt — rejection > 0 fires performance RECEIPT_REJECTION event | DB verified |
| 18 | Post receipt — audit log receipt.posted | present |
| 19 | Void receipt — POSTED → VOIDED | 200 |
| 20 | Void receipt — DRAFT (not POSTED) | 422 |
| 21 | Void receipt — inventory balance reversed | DB balance = pre-post value |
| 22 | Void receipt — outbox procurement.receipt.voided scoped | present |
| 23 | Void receipt — concurrent void + post | 1 success, 1 422 |
| 24 | Double-void receipt | 422 |
| 25 | Audit log — receipt.voided scoped | present |
| 26 | Tenant isolation — Org B cannot void Org A receipt | 403/404 |
| 27 | Transaction rollback — if inventory insert fails, receipt status unchanged | DRAFT |

**File path:** `apps/server/tests/integration/receipt.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

## Tier 5 — Financial & Operational

### T.10 — `committed_cost.test.ts`

**STATUS:** NOT STARTED
**Priority:** P2
**Route count:** 2
**Estimated test cases:** ~15

**Routes to cover:**
```
GET    /api/v1/organizations/:orgId/projects/:projectId/committed-costs
GET    /api/v1/organizations/:orgId/projects/:projectId/committed-costs/:committedCostId
```

**Source files to read before writing:**
- `apps/server/src/modules/project/committed-cost/committed-cost.routes.ts`
- `apps/server/src/modules/project/committed-cost/committed-cost.handler.ts`
- `apps/server/src/modules/project/committed-cost/committed-cost.service.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | List committed costs — ACTIVE after PO approve | 200, one ACTIVE CC |
| 2 | List committed costs — CANCELLED after PO cancel | 200, status=CANCELLED |
| 3 | List committed costs — status filter ACTIVE | 200, only ACTIVE |
| 4 | List committed costs — cursor pagination | 200, nextCursor |
| 5 | List committed costs — own project only | 200 |
| 6 | List committed costs — other project absent by explicit ID | absent |
| 7 | Get committed cost — own project | 200, correct amount |
| 8 | Get committed cost — other project's ID | 404 |
| 9 | Get committed cost — unauthenticated | 401 |
| 10 | Get committed cost — amount matches PO totalAmount | exact match |
| 11 | No committed cost before PO approval | list is empty |
| 12 | Tenant isolation | 403/404 |

**File path:** `apps/server/tests/integration/committed_cost.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

### T.11 — `inventory.test.ts`

**STATUS:** NOT STARTED
**Priority:** P1 — ledger correctness is business-critical
**Route count:** 5
**Estimated test cases:** ~35

**Routes to cover:**
```
GET    /api/v1/organizations/:orgId/projects/:projectId/inventory
GET    /api/v1/organizations/:orgId/projects/:projectId/inventory/:materialId/balance
GET    /api/v1/organizations/:orgId/projects/:projectId/inventory/:materialId/transactions
POST   /api/v1/organizations/:orgId/projects/:projectId/inventory/adjust
POST   /api/v1/organizations/:orgId/projects/:projectId/inventory/transfer
```

**Source files to read before writing:**
- `apps/server/src/modules/project/inventory/inventory.routes.ts`
- `apps/server/src/modules/project/inventory/inventory.handler.ts`
- `apps/server/src/modules/project/inventory/inventory.service.ts`
- `packages/shared/src/modules/project/inventory.schema.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | List inventory — empty before any transactions | 200, empty |
| 2 | List inventory — after adjustment IN | 200, balance > 0 |
| 3 | Get balance — correct after adjust IN | balance = quantity |
| 4 | Get balance — correct after adjust OUT | balance decremented |
| 5 | Get balance — correct after receipt post | balance = quantityAccepted |
| 6 | Get balance — correct after receipt void | balance restored |
| 7 | Get balance — organizationId enforced (G.6 fix verified) | only own org data |
| 8 | Get balance — other org's materialId + projectId | 0 or 404 (isolation) |
| 9 | List transactions — scoped to materialId + projectId | 200 |
| 10 | List transactions — organizationId enforced | only own org transactions |
| 11 | List transactions — other org's materialId | empty (tenant isolation) |
| 12 | Adjust IN — valid | 201 |
| 13 | Adjust OUT — valid, balance sufficient | 201 |
| 14 | Adjust OUT — quantity=0 | 400 |
| 15 | Adjust IN — missing direction | 400 |
| 16 | Adjust IN — missing reason | 400 |
| 17 | Adjust IN — materialId from other org | 422/404 |
| 18 | Adjust IN — unauthenticated | 401 |
| 19 | Transfer — valid fromLocation → toLocation | 201, balance preserved |
| 20 | Transfer — fromLocation same as toLocation | 400/422 |
| 21 | Transfer — quantity=0 | 400 |
| 22 | Transfer — materialId from other org | 422 |
| 23 | Concurrent adjustments — final balance is sum of both | DB verified |
| 24 | Decimal precision — quantity=10.999 accepted | 201, exact precision |
| 25 | Audit log — inventory.adjusted scoped | present |
| 26 | Tenant isolation — Org B cannot adjust Org A inventory | 403/404 |

**File path:** `apps/server/tests/integration/inventory.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

### T.12 — `performance.test.ts`

**STATUS:** NOT STARTED
**Priority:** P2
**Route count:** 2
**Estimated test cases:** ~20

**Routes to cover:**
```
GET    /api/v1/organizations/:orgId/projects/:projectId/performance/suppliers/:supplierId
GET    /api/v1/organizations/:orgId/projects/:projectId/performance/subcontractors/:subcontractorId
```

**Source files to read before writing:**
- `apps/server/src/modules/project/performance/performance.routes.ts`
- `apps/server/src/modules/project/performance/performance.handler.ts`
- `apps/server/src/modules/project/performance/performance.service.ts`
- `packages/shared/src/modules/project/performance.schema.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | Get supplier performance — after DELIVERY_ON_TIME event | 200, item in data |
| 2 | Get supplier performance — after DELIVERY_LATE event | 200, DELIVERY_LATE in data |
| 3 | Get supplier performance — after RECEIPT_REJECTION event | 200, event present |
| 4 | Get supplier performance — empty (no events yet) | 200, data=[] |
| 5 | Get supplier performance — cursor pagination (limit=1) yields nextCursor | 200, nextCursor set |
| 6 | Get supplier performance — limit > 100 clamped to 100 | 200 |
| 7 | Get supplier performance — invalid cursor (ignored gracefully) | 200 |
| 8 | Get supplier performance — other org's supplier | 200, data=[] (isolated) |
| 9 | Get supplier performance — unauthenticated | 401 |
| 10 | Get supplier performance — no project:view permission | 403 |
| 11 | Get subcontractor performance — after event | 200 |
| 12 | Get subcontractor performance — empty | 200, data=[] |
| 13 | Get subcontractor performance — cursor pagination | 200 |
| 14 | Get subcontractor performance — other org's subcontractor | 200, data=[] |
| 15 | Response shape — items + nextCursor keys present | verified |
| 16 | Cursor is base64 JSON with occurredAt + id | decodable |

**File path:** `apps/server/tests/integration/performance.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

### T.13 — `audit.test.ts`

**STATUS:** NOT STARTED
**Priority:** P2
**Route count:** 1
**Estimated test cases:** ~12

**Routes to cover:**
```
GET    /api/v1/organizations/:orgId/audit-logs
```

**Source files to read before writing:**
- `apps/server/src/modules/audit/audit.routes.ts`
- `apps/server/src/modules/audit/audit.handler.ts`
- `apps/server/src/modules/audit/audit.service.ts`

**Scenario matrix:**

| # | Scenario | Expected |
|---|---|---|
| 1 | List audit logs — own org | 200, array |
| 2 | List audit logs — scoped to orgId (no cross-org leakage) | other org logs absent |
| 3 | List audit logs — limit=5 | 200, ≤5 results |
| 4 | List audit logs — offset pagination | 200, different page |
| 5 | List audit logs — limit > 100 clamped | 400 or clamped to 100 |
| 6 | List audit logs — limit=0 | 400 |
| 7 | List audit logs — offset negative | 400 |
| 8 | List audit logs — limit non-numeric | 400 |
| 9 | List audit logs — unauthenticated | 401 |
| 10 | List audit logs — member without permission | 403 |
| 11 | Audit log — contains event from this test's supplier.created action | present, scoped |
| 12 | No sensitive data in response (no passwordHash, tokens) | verified |

**File path:** `apps/server/tests/integration/audit.test.ts`

**Tests written:** _[fill when DONE]_
**Changes made:** _[record here when DONE]_

---

## Execution Order

```
T.0  → T.0b  (infra + fixtures, must be DONE first)
T.1  → T.2   (catalog, independent)
T.3          (partner, independent)
T.4  → T.5  → T.6  (procurement chain, write in order — each depends on prev entities)
T.7          (approvals, needs MR + Quote + PO)
T.8  → T.9  (delivery chain, needs PO in SENT state)
T.10         (needs PO in APPROVED state → committed cost auto-created)
T.11         (needs receipt posted to have non-zero balances)
T.12         (needs delivery + receipt posted to have events)
T.13         (needs at least T.1 done to have audit events to assert on)
```

---

## Completion Gate

All tasks must reach DONE before the integration test pass is considered complete.

| Task | File | Routes | Status |
|------|------|--------|--------|
| T.0  | vitest.config.ts + observability patch | — | NOT STARTED |
| T.0b | fixtures.ts | — | NOT STARTED |
| T.1  | supplier.test.ts | 6 | NOT STARTED |
| T.2  | material.test.ts | 4 | NOT STARTED |
| T.3  | subcontractor.test.ts | 8 | NOT STARTED |
| T.4  | material_request.test.ts | 6 | NOT STARTED |
| T.5  | quote.test.ts | 7 | NOT STARTED |
| T.6  | purchase_order.test.ts | 8 | NOT STARTED |
| T.7  | procurement_approval.test.ts | 6 | NOT STARTED |
| T.8  | delivery.test.ts | 4 | NOT STARTED |
| T.9  | receipt.test.ts | 5 | NOT STARTED |
| T.10 | committed_cost.test.ts | 2 | NOT STARTED |
| T.11 | inventory.test.ts | 5 | NOT STARTED |
| T.12 | performance.test.ts | 2 | NOT STARTED |
| T.13 | audit.test.ts | 1 | NOT STARTED |
| **Total** | | **64 routes** | **0 / 15 DONE** |

**Final verification:**
- [ ] `pnpm --filter server test` exits 0 (all ~433 new test cases pass)
- [ ] No unscoped aggregate assertions in any new test file
- [ ] Every test uses real `buildApp()` + `app.inject()`
- [ ] Test spans visible in SigNoz under service `siteflow-server-test`
- [ ] No `for/await` loops over entity IDs in any test assertion
- [ ] Every list endpoint test checks that other tenant's resource is ABSENT by explicit ID
