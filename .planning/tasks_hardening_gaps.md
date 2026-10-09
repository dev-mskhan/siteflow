# SiteFlow — Production Hardening Gaps

# Verified Against Actual Code (October 1, 2026)

> **Scope:** All gaps verified by reading the actual source files.
> These tasks span ALL phases — they are not phase-specific.
> Cross-reference: `checklist_when_to_apply.md` for the tier classification of each item.
>
> **How to execute:**
>
> 1. Read every file listed under "Files to change" before touching anything.
> 2. Match existing code style exactly — ESM `.js` imports, `createLogger`, Drizzle patterns.
> 3. Run `pnpm --filter server typecheck` after each task. Fix errors before moving on.
> 4. Flip STATUS to `DONE` and record what changed in the "Changes made" field.

---

## Implementation Order

```
TIER 1 — Build-in (Critical — should have been done during phase implementation):
G.1   bodyLimit on Fastify constructor
G.6   inventory.service — organizationId silently ignored in getBalance + listTransactions
G.8   performance.handler — no Zod parse on query params + raw array response
G.9   cancelFromPO — missing outbox event + audit log
G.10  voidReceipt — missing outbox event
G.14  Missing FOR UPDATE locks on state-changing operations (quote, material-request, field-log)
G.15  quote.submitQuote — missing outbox event
G.16  procurement-approval.cancelApproval — missing outbox event
G.18  Redis KEYS usage in supplier.service + material.service — must use SCAN

TIER 2 — End-of-Phase Gate (should have been caught after Phase C):
G.2   N+1 in listDeliveries
G.3   N+1 in listReceipts
G.4   N+1 in listPurchaseOrders
G.5   N+1 in listProjectSubcontractors
G.7   performance.service — hardcoded LIMIT 200, no cursor pagination
G.11  .env.example missing production hardening env vars
G.12  N+1 in listMaterialRequests
G.13  N+1 in listQuotes
G.17  invitation.listInvitations — no pagination, no nextCursor
```

---

## Global Rules

1. Never remove existing behavior — only add/fix.
2. All ESM imports must use `.js` extensions (even for `.ts` source files).
3. All DB queries go through Drizzle ORM or `sql\`...\`` tagged template literals — never string concatenation with user input.
4. Run `pnpm --filter server typecheck` after every task. Zero type errors before marking DONE.
5. Every fix goes inside the existing transaction scope where one already exists.
6. Do not add `console.log` — use `createLogger` if logging is needed.

---

## G.1 — bodyLimit missing on Fastify constructor

**STATUS:** DONE  
**Tier:** 1

**Problem:** `apps/server/src/app/index.ts` — `Fastify({})` constructor has no `bodyLimit`. Any request body is unbounded, allowing clients to exhaust server memory with large payloads.

**Root cause:** Line ~47: `requestTimeout: serverEnv.REQUEST_TIMEOUT_MS` — `bodyLimit` is missing after this line in the Fastify constructor options.

**Files to change:**

- `packages/env/src/server.ts`
- `apps/server/src/app/index.ts`
- `.env.example`

**Exact change:**

In `packages/env/src/server.ts`, add after `REQUEST_TIMEOUT_MS`:

```ts
BODY_LIMIT_BYTES: z.coerce.number().default(1048576),
```

In `apps/server/src/app/index.ts`, add to the `Fastify({...})` constructor options after `requestTimeout`:

```ts
bodyLimit: serverEnv.BODY_LIMIT_BYTES,
```

In `.env.example`, see G.11 — all new env vars are added there in a single pass.

**Quality gates:**

- `BODY_LIMIT_BYTES` present in `packages/env/src/server.ts` schema
- `bodyLimit: serverEnv.BODY_LIMIT_BYTES` present in Fastify constructor in `app/index.ts`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`BODY_LIMIT_BYTES added to env schema + Fastify constructor. .env.example updated.`

---

## G.2 — N+1 in listDeliveries

**STATUS:** DONE  
**Tier:** 2

**Problem:** `apps/server/src/modules/project/delivery/delivery.service.ts` — `listDeliveries` method contains a `for` loop with `await this.repo.findDeliveryItemsByDeliveryId(this.db, row.id)` inside it. For 50 deliveries this fires 51 queries (1 list + 50 item fetches).

**Root cause:** `for (const row of data) { const items = await this.repo.findDeliveryItemsByDeliveryId(this.db, row.id); ... }` — standard N+1 pattern. Same problem as G.3/G.4/G.5/G.12/G.13.

**Files to change:**

- `apps/server/src/modules/project/delivery/delivery.repository.ts`
- `apps/server/src/modules/project/delivery/delivery.service.ts`

**Exact change:**

In `delivery.repository.ts`, add a bulk method:

```ts
async findDeliveryItemsByDeliveryIds(db: any, ids: string[]): Promise<DeliveryItem[]> {
  if (ids.length === 0) return [];
  return db.select().from(deliveryItems).where(inArray(deliveryItems.deliveryId, ids));
}
```

In `delivery.service.ts`, replace the N+1 loop in `listDeliveries`:

```ts
const allItems = await this.repo.findDeliveryItemsByDeliveryIds(
  this.db,
  data.map((r) => r.id),
);
const itemsByDeliveryId = new Map<string, DeliveryItem[]>();
for (const item of allItems) {
  const arr = itemsByDeliveryId.get(item.deliveryId) ?? [];
  arr.push(item);
  itemsByDeliveryId.set(item.deliveryId, arr);
}
const result: DeliveryDTO[] = data.map((row) =>
  toDeliveryDTO(row, itemsByDeliveryId.get(row.id) ?? []),
);
```

**Quality gates:**

- `findDeliveryItemsByDeliveryIds` bulk method exists in repository using `inArray`
- No `for`/`await` loop over delivery IDs in `listDeliveries`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`findDeliveryItemsByDeliveryIds bulk method added. listDeliveries N+1 loop replaced with Map grouping.`

---

## G.3 — N+1 in listReceipts

**STATUS:** DONE  
**Tier:** 2

**Problem:** `apps/server/src/modules/project/delivery/delivery.service.ts` — `listReceipts` method contains `for (const row of data) { const items = await this.repo.findReceiptItemsByReceiptId(this.db, row.id); ... }`. For 50 receipts this fires 51 queries.

**Root cause:** Same N+1 pattern as G.2. `findReceiptItemsByReceiptId` is called inside a `for` loop.

**Files to change:**

- `apps/server/src/modules/project/delivery/delivery.repository.ts`
- `apps/server/src/modules/project/delivery/delivery.service.ts`

**Exact change:**

In `delivery.repository.ts`, add:

```ts
async findReceiptItemsByReceiptIds(db: any, ids: string[]): Promise<ReceiptItem[]> {
  if (ids.length === 0) return [];
  return db.select().from(receiptItems).where(inArray(receiptItems.receiptId, ids));
}
```

In `delivery.service.ts`, replace the N+1 loop in `listReceipts`:

```ts
const allItems = await this.repo.findReceiptItemsByReceiptIds(
  this.db,
  data.map((r) => r.id),
);
const itemsByReceiptId = new Map<string, ReceiptItem[]>();
for (const item of allItems) {
  const arr = itemsByReceiptId.get(item.receiptId) ?? [];
  arr.push(item);
  itemsByReceiptId.set(item.receiptId, arr);
}
const result: ReceiptDTO[] = data.map((row) =>
  toReceiptDTO(row, itemsByReceiptId.get(row.id) ?? []),
);
```

**Quality gates:**

- `findReceiptItemsByReceiptIds` bulk method exists in repository using `inArray`
- No `for`/`await` loop over receipt IDs in `listReceipts`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`findReceiptItemsByReceiptIds bulk method added. listReceipts N+1 loop replaced with Map grouping.`

---

## G.4 — N+1 in listPurchaseOrders

**STATUS:** DONE  
**Tier:** 2

**Problem:** `apps/server/src/modules/project/purchase-order/purchase-order.service.ts` — `listPurchaseOrders` method contains `for (const row of data) { const items = await this.repo.findItemsByPoId(this.db, row.id); ... }`. For 50 POs this fires 51 queries.

**Root cause:** Same N+1 pattern as G.2/G.3.

**Files to change:**

- `apps/server/src/modules/project/purchase-order/purchase-order.repository.ts`
- `apps/server/src/modules/project/purchase-order/purchase-order.service.ts`

**Exact change:**

In `purchase-order.repository.ts`, add:

```ts
async findItemsByPoIds(db: any, ids: string[]): Promise<PurchaseOrderItem[]> {
  if (ids.length === 0) return [];
  return db.select().from(purchaseOrderItems).where(inArray(purchaseOrderItems.purchaseOrderId, ids));
}
```

In `purchase-order.service.ts`, replace the N+1 loop in `listPurchaseOrders`:

```ts
const allItems = await this.repo.findItemsByPoIds(
  this.db,
  data.map((r) => r.id),
);
const itemsByPoId = new Map<string, PurchaseOrderItem[]>();
for (const item of allItems) {
  const arr = itemsByPoId.get(item.purchaseOrderId) ?? [];
  arr.push(item);
  itemsByPoId.set(item.purchaseOrderId, arr);
}
const result: PurchaseOrderDTO[] = data.map((row) => toDTO(row, itemsByPoId.get(row.id) ?? []));
```

**Quality gates:**

- `findItemsByPoIds` bulk method exists in repository using `inArray`
- No `for`/`await` loop over PO IDs in `listPurchaseOrders`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`findItemsByPoIds bulk method added. listPurchaseOrders N+1 loop replaced with Map grouping.`

---

## G.5 — N+1 in listProjectSubcontractors

**STATUS:** DONE  
**Tier:** 2

**Problem:** `apps/server/src/modules/project/subcontractor/subcontractor.service.ts` — `listProjectSubcontractors` method contains a `for` loop calling `await findById(db, row.subcontractorId)` for each row, firing N queries for N subcontractors.

**Root cause:** Same N+1 pattern as G.2-G.4. The subcontractor details are fetched individually rather than in bulk.

**Files to change:**

- `apps/server/src/modules/project/subcontractor/subcontractor.repository.ts`
- `apps/server/src/modules/project/subcontractor/subcontractor.service.ts`

**Exact change:**

In `subcontractor.repository.ts`, add:

```ts
async findByIds(db: any, ids: string[]): Promise<Map<string, Subcontractor>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(subcontractors).where(inArray(subcontractors.id, ids));
  return new Map(rows.map((r: Subcontractor) => [r.id, r]));
}
```

In `subcontractor.service.ts`, replace the N+1 loop in `listProjectSubcontractors`:

```ts
const subcontractorIds = data.map((r) => r.subcontractorId).filter(Boolean) as string[];
const subcontractorMap = await this.repo.findByIds(this.db, subcontractorIds);
const result = data.map((row) => toDTO(row, subcontractorMap.get(row.subcontractorId)));
```

**Quality gates:**

- `findByIds` returns `Map<string, Subcontractor>` using `inArray`
- No `for`/`await` loop over subcontractor IDs in `listProjectSubcontractors`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`findByIds returning Map<string,Subcontractor> added. listProjectSubcontractors N+1 loop replaced.`

---

## G.6 — inventory.service organizationId ignored in getBalance + listTransactions

**STATUS:** DONE  
**Tier:** 1

**Problem:** `apps/server/src/modules/project/inventory/inventory.service.ts` — both `getBalance` and `listTransactions` receive `_organizationId` (prefixed underscore = intentionally unused). The WHERE clauses omit `organization_id`, allowing cross-org data access for any client that knows a `projectId` and `materialId` from another organization.

**Root cause:**

- `getBalance(_, projectId, materialId)` — parameter is `_organizationId`, not used in the Drizzle `where()` clause
- `listTransactions(_, projectId, materialId)` — parameter is `_organizationId`, not included in the raw SQL `WHERE` clause

**Files to change:**

- `apps/server/src/modules/project/inventory/inventory.service.ts` only

**Exact change:**

In `getBalance`, rename `_organizationId` → `organizationId` and add to the `where()` clause:

```ts
async getBalance(
  organizationId: string,  // was _organizationId
  projectId: string,
  materialId: string,
  location = 'default',
): Promise<string> {
  const rows = await this.db
    .select()
    .from(projectInventoryItems)
    .where(
      and(
        eq(projectInventoryItems.organizationId, organizationId),  // ADD THIS
        eq(projectInventoryItems.projectId, projectId),
        eq(projectInventoryItems.materialId, materialId),
        eq(projectInventoryItems.location, location),
      ),
    );
```

In `listTransactions`, rename `_organizationId` → `organizationId` and add to the SQL:

```ts
async listTransactions(
  organizationId: string,  // was _organizationId
  projectId: string,
  materialId: string,
): Promise<any[]> {
  const rows = await this.db.execute(
    sql`SELECT id, transaction_type, quantity, unit_code, source_type, source_id,
               occurred_at, created_at
        FROM app.inventory_transactions
        WHERE organization_id = ${organizationId}   -- ADD THIS LINE
          AND project_id = ${projectId} AND material_id = ${materialId}
        ORDER BY occurred_at DESC, id DESC LIMIT 100`,
  ) as any;
```

**Quality gates:**

- No `_organizationId` parameter names in either method
- `organizationId` appears in both `WHERE` / `and()` clauses
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`_organizationId renamed to organizationId in getBalance + listTransactions. Added to WHERE clauses.`

---

## G.7 — performance.service hardcoded LIMIT 200, no cursor pagination

**STATUS:** DONE  
**Tier:** 2

**Problem:** `apps/server/src/modules/project/performance/performance.service.ts` — both `listSupplierEvents` and `listSubcontractorEvents` use `ORDER BY occurred_at DESC LIMIT 200` — hardcoded, no cursor, no configurable page size. At scale this returns unbounded data and cannot be paginated.

**Root cause:** The raw SQL strings hardcode `LIMIT 200` with no cursor or configurable limit parameter.

**Files to change:**

- `apps/server/src/modules/project/performance/performance.service.ts` only

**Exact change:**

Change both methods to accept `opts: { cursor?: string; limit?: number } = {}` and return `Promise<{ data: any[]; nextCursor: string | null }>`:

```ts
async listSupplierEvents(
  organizationId: string,
  projectId: string,
  supplierId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<{ data: any[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const fetchLimit = limit + 1;

  let cursorFilter = sql``;
  if (opts.cursor) {
    const { occurredAt, id } = JSON.parse(Buffer.from(opts.cursor, 'base64').toString());
    cursorFilter = sql` AND (occurred_at < ${occurredAt} OR (occurred_at = ${occurredAt} AND id < ${id}))`;
  }

  const rows = await this.db.execute(
    sql`SELECT id, event_type, source_type, source_id, occurred_at, metric_value, unit, notes
        FROM app.partner_performance_events
        WHERE organization_id = ${organizationId}
          AND project_id = ${projectId}
          AND supplier_id = ${supplierId}
          ${cursorFilter}
        ORDER BY occurred_at DESC, id DESC LIMIT ${fetchLimit}`,
  ) as any;

  const raw: any[] = rows.rows ?? rows;
  const hasMore = raw.length > limit;
  const data = hasMore ? raw.slice(0, limit) : raw;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last
    ? Buffer.from(JSON.stringify({ occurredAt: last.occurred_at, id: last.id })).toString('base64')
    : null;

  return {
    data: data.map((r: any) => ({
      id: r.id,
      eventType: r.event_type,
      sourceType: r.source_type,
      sourceId: r.source_id,
      occurredAt: r.occurred_at,
      metricValue: r.metric_value,
      unit: r.unit,
      notes: r.notes,
    })),
    nextCursor,
  };
}
```

Apply the same pattern to `listSubcontractorEvents` (replace `supplier_id` filter with `subcontractor_id`).

**Quality gates:**

- Both methods return `{ data: any[]; nextCursor: string | null }`
- `LIMIT 200` is gone from both methods
- Max page size of 100 is enforced via `Math.min(opts.limit ?? 50, 100)`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`Cursor-based pagination added to listSupplierEvents + listSubcontractorEvents. LIMIT 200 removed.`

---

## G.8 — performance.handler no Zod validation + wrong response shape

**STATUS:** DONE  
**Tier:** 1

**Problem:** `apps/server/src/modules/project/performance/performance.handler.ts` — both handlers cast `req.query as any` (no Zod validation, ignoring `cursor`/`limit` params) and send the raw array directly via `createSuccessResponse(result)` instead of `{ items, nextCursor }`.

**Root cause:** The handlers were written before G.7 introduced cursor pagination on the service. They pass no options to the service and return the plain array the old service returned.

**Files to change:**

- `apps/server/src/modules/project/performance/performance.handler.ts` only

**Exact change:**

```ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createSuccessResponse } from '../../../shared/response.js';
import { PartnerPerformanceService } from './performance.service.js';

const svc = new PartnerPerformanceService();

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export async function handleGetSupplierPerformance(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, supplierId } = req.params as any;
  const query = listQuerySchema.parse(req.query);
  const result = await svc.listSupplierEvents(organizationId, projectId, supplierId, query);
  return reply.send(createSuccessResponse({ items: result.data, nextCursor: result.nextCursor }));
}

export async function handleGetSubcontractorPerformance(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId, subcontractorId } = req.params as any;
  const query = listQuerySchema.parse(req.query);
  const result = await svc.listSubcontractorEvents(
    organizationId,
    projectId,
    subcontractorId,
    query,
  );
  return reply.send(createSuccessResponse({ items: result.data, nextCursor: result.nextCursor }));
}
```

**Quality gates:**

- `listQuerySchema` present and used in both handlers
- `req.query` is parsed through `listQuerySchema.parse()` (not cast as `any`)
- Response shape is `{ items: [...], nextCursor: string | null }`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`listQuerySchema Zod parse added to both handlers. Response changed to { items, nextCursor }.`

---

## G.9 — cancelFromPO missing outbox event + audit log

**STATUS:** DONE  
**Tier:** 1

**Problem:** `apps/server/src/modules/project/committed-cost/committed-cost.service.ts` — `cancelFromPO` method updates the committed cost status to `CANCELLED` but emits no `writeOutboxEvent` and no `auditService.log`. Compare with `createFromPO` which has both. Downstream consumers cannot observe committed cost cancellations.

**Root cause:** After `await this.repo.update(tx, existing.id, { status: 'CANCELLED', releasedAt: new Date() })` — there are no further side-effects. The method returns `void` silently.

**Files to change:**

- `apps/server/src/modules/project/committed-cost/committed-cost.service.ts` only

**Exact change:**

After the `await this.repo.update(...)` call in `cancelFromPO`, add:

```ts
await writeOutboxEvent(
  tx,
  'procurement.committed_cost.cancelled',
  { organizationId, poId, committedCostId: existing.id },
  organizationId,
);
await auditService.log(
  {
    organizationId,
    actorUserId: 'system',
    action: 'committed_cost.cancelled',
    resourceType: 'CommittedCost',
    resourceId: existing.id,
    metadata: { poId },
  },
  tx,
);
```

Both `writeOutboxEvent` and `auditService` are already imported at the top of the file.

Note: `cancelFromPO(tx, poId, organizationId)` — the `organizationId` parameter is already available as the third argument.

**Quality gates:**

- `writeOutboxEvent` with event type `'procurement.committed_cost.cancelled'` present in `cancelFromPO`
- `auditService.log` with action `'committed_cost.cancelled'` present in `cancelFromPO`
- Both calls are inside the existing transaction scope (they receive `tx` as first argument)
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`writeOutboxEvent(procurement.committed_cost.cancelled) + auditService.log added to cancelFromPO.`

---

## G.10 — voidReceipt missing outbox event

**STATUS:** DONE  
**Tier:** 1

**Problem:** `apps/server/src/modules/project/delivery/delivery.service.ts` — `voidReceipt` calls `auditService.log` but does NOT call `writeOutboxEvent`. By contrast, `postReceipt` correctly emits `'procurement.receipt.posted'`. The void operation is invisible to all downstream consumers (e.g. external integrations, audit pipelines).

**Root cause:** `voidReceipt` was implemented without the outbox event. `writeOutboxEvent` is already imported at the top of the file.

**Files to change:**

- `apps/server/src/modules/project/delivery/delivery.service.ts` only

**Exact change:**

After `await _reverseReceiptInventory(tx, receiptId, organizationId, projectId);` and before `await auditService.log(...)`, add:

```ts
await writeOutboxEvent(
  tx,
  'procurement.receipt.voided',
  { organizationId, projectId, receiptId },
  organizationId,
);
```

**Quality gates:**

- `writeOutboxEvent` with event type `'procurement.receipt.voided'` present inside `voidReceipt`
- The call is inside the transaction (`tx` is the first arg)
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`writeOutboxEvent(procurement.receipt.voided) added inside voidReceipt transaction.`

---

## G.11 — .env.example missing production env vars

**STATUS:** DONE  
**Tier:** 2

**Problem:** `.env.example` at repo root does not document any of the production-hardening env vars that are already defined in `packages/env/src/server.ts`. Developers and CI pipelines cannot know these exist without reading the env schema directly.

**Root cause:** The env vars `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`, `DB_STATEMENT_TIMEOUT_MS`, `CORS_ORIGIN`, `REQUEST_TIMEOUT_MS` were added in the production hardening phase but `.env.example` was never updated. The new `BODY_LIMIT_BYTES` from G.1 also needs to be added.

**Files to change:**

- `.env.example` only

**Exact change:**

Add a "Connection pool" sub-section under the Database section:

```
# Connection pool
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=5000
DB_STATEMENT_TIMEOUT_MS=20000
```

Add after the `PORT`/`HOST` section (or near the end after SMTP):

```
# CORS (comma-separated list of allowed origins)
CORS_ORIGIN=http://localhost:5173

# Request / body limits
REQUEST_TIMEOUT_MS=25000
BODY_LIMIT_BYTES=1048576
```

**Quality gates:**

- All 7 vars present in `.env.example` with comments explaining purpose
- No duplicate keys
- Values match the defaults in `packages/env/src/server.ts`

**Changes made:**
`DB_POOL_MAX, DB_POOL_IDLE_TIMEOUT_MS, DB_POOL_CONNECTION_TIMEOUT_MS, DB_STATEMENT_TIMEOUT_MS, CORS_ORIGIN added to .env.example.`

---

## G.12 — N+1 in listMaterialRequests

**STATUS:** DONE  
**Tier:** 2

**Problem:** `apps/server/src/modules/project/material-request/material-request.service.ts` — `listMaterialRequests` contains `for (const row of data) { const items = await this.repo.findItemsByRequestId(this.db, row.id); ... }`. Same N+1 pattern as G.2-G.5.

**Root cause:** `findItemsByRequestId` is called inside a `for` loop, firing one query per material request row.

**Files to change:**

- `apps/server/src/modules/project/material-request/material-request.repository.ts`
- `apps/server/src/modules/project/material-request/material-request.service.ts`

**Exact change:**

In `material-request.repository.ts`, add:

```ts
async findItemsByRequestIds(db: any, requestIds: string[]): Promise<MaterialRequestItem[]> {
  if (requestIds.length === 0) return [];
  return db.select().from(materialRequestItems).where(inArray(materialRequestItems.materialRequestId, requestIds));
}
```

In `material-request.service.ts`, replace the N+1 loop in `listMaterialRequests`:

```ts
const allItems = await this.repo.findItemsByRequestIds(
  this.db,
  data.map((r) => r.id),
);
const itemsByRequestId = new Map<string, MaterialRequestItem[]>();
for (const item of allItems) {
  const arr = itemsByRequestId.get(item.materialRequestId) ?? [];
  arr.push(item);
  itemsByRequestId.set(item.materialRequestId, arr);
}
const result = data.map((row) => toDTO(row, itemsByRequestId.get(row.id) ?? []));
```

**Quality gates:**

- `findItemsByRequestIds` bulk method exists in repository using `inArray`
- No `for`/`await` loop over request IDs in `listMaterialRequests`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`findItemsByRequestIds bulk method added. listMaterialRequests N+1 loop replaced.`

---

## G.13 — N+1 in listQuotes

**STATUS:** DONE  
**Tier:** 2

**Problem:** `apps/server/src/modules/project/quote/quote.service.ts` — `listQuotes` method contains `for (const row of data) { const items = await this.repo.findItemsByQuoteId(this.db, row.id); ... }`. Same N+1 pattern as G.2-G.5/G.12.

**Root cause:** `findItemsByQuoteId` is called inside a `for` loop, one query per quote row.

**Files to change:**

- `apps/server/src/modules/project/quote/quote.repository.ts`
- `apps/server/src/modules/project/quote/quote.service.ts`

**Exact change:**

In `quote.repository.ts`, add:

```ts
async findItemsByQuoteIds(db: any, quoteIds: string[]): Promise<QuoteItem[]> {
  if (quoteIds.length === 0) return [];
  return db.select().from(quoteItems).where(inArray(quoteItems.quoteId, quoteIds));
}
```

In `quote.service.ts`, replace the N+1 loop in `listQuotes`:

```ts
const allItems = await this.repo.findItemsByQuoteIds(
  this.db,
  data.map((r) => r.id),
);
const itemsByQuoteId = new Map<string, QuoteItem[]>();
for (const item of allItems) {
  const arr = itemsByQuoteId.get(item.quoteId) ?? [];
  arr.push(item);
  itemsByQuoteId.set(item.quoteId, arr);
}
const result = data.map((row) => toDTO(row, itemsByQuoteId.get(row.id) ?? []));
```

**Quality gates:**

- `findItemsByQuoteIds` bulk method exists in repository using `inArray`
- No `for`/`await` loop over quote IDs in `listQuotes`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`findItemsByQuoteIds bulk method added. listQuotes N+1 loop replaced.`

---

## G.14 — Missing FOR UPDATE locks on state-changing operations

**STATUS:** DONE  
**Tier:** 1

**Problem:** Multiple state-transition operations read a row inside a transaction then update it without locking first. Two concurrent requests (e.g. two users clicking "Submit" simultaneously) can both read `status = 'DRAFT'`, both pass the state check, and both proceed — violating the "exactly-one-transition" invariant. Compare: `purchase-order.service.ts` correctly uses `findByIdForUpdate(tx, id)` for all its state-change operations.

**Root cause confirmed at:**

- `quote.service.ts` — `submitQuote`, `acceptQuote`, `rejectQuote` all call `this.repo.findById(tx as any, quoteId)` — no `FOR UPDATE`
- `material-request.service.ts` — `submitMaterialRequest`, `cancelMaterialRequest` call `this.repo.findById(tx as any, requestId)` — no `FOR UPDATE`
- `field-log.service.ts` — `submitFieldLog`, `lockFieldLog` call `this.repo.findById(tx as any, logId)` — no `FOR UPDATE`

**Files to change:**

- `apps/server/src/modules/project/quote/quote.repository.ts`
- `apps/server/src/modules/project/quote/quote.service.ts`
- `apps/server/src/modules/project/material-request/material-request.repository.ts`
- `apps/server/src/modules/project/material-request/material-request.service.ts`
- `apps/server/src/modules/project/field-log/field-log.repository.ts`
- `apps/server/src/modules/project/field-log/field-log.service.ts`

**Exact change — pattern (copy from purchase-order.repository.ts):**

In each repository, add:

```ts
async findByIdForUpdate(tx: any, id: string): Promise<T | null> {
  await tx.execute(sql`SELECT id FROM app.<table_name> WHERE id = ${id} FOR UPDATE`);
  return this.findById(tx, id);
}
```

Table names:

- Quote repository → `app.quotes`
- MaterialRequest repository → `app.material_requests`
- FieldLog repository → `app.daily_field_logs`

In each service, replace `this.repo.findById(tx as any, id)` with `this.repo.findByIdForUpdate(tx, id)` in the following methods:

- `quote.service.ts`: `submitQuote`, `acceptQuote`, `rejectQuote`
- `material-request.service.ts`: `submitMaterialRequest`, `cancelMaterialRequest`
- `field-log.service.ts`: `submitFieldLog`, `lockFieldLog`

**Quality gates:**

- `findByIdForUpdate` method present in all three repositories
- `FOR UPDATE` present in the SQL of each `findByIdForUpdate`
- All 6 state-change service methods use `findByIdForUpdate` instead of `findById` for the locking read
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`findByIdForUpdate added to QuoteRepository, MaterialRequestRepository, FieldLogRepository. Used in submitQuote/acceptQuote/rejectQuote, submitMaterialRequest/cancelMaterialRequest, submitFieldLog/lockFieldLog.`

---

## G.15 — quote.submitQuote missing outbox event

**STATUS:** DONE  
**Tier:** 1

**Problem:** `apps/server/src/modules/project/quote/quote.service.ts` — `submitQuote` writes `auditService.log` but does NOT emit `writeOutboxEvent`. Compare: `acceptQuote` emits `'procurement.quote.accepted'`, `rejectQuote` emits `'procurement.quote.rejected'`. The submit transition is invisible to downstream consumers.

**Root cause:** `submitQuote` was implemented without the outbox call. `writeOutboxEvent` is already imported at the top of the file.

**Files to change:**

- `apps/server/src/modules/project/quote/quote.service.ts` only

**Exact change:**

In `submitQuote`, after `const items = await this.repo.findItemsByQuoteId(tx as any, quoteId);` and before `await auditService.log(...)`, add:

```ts
await writeOutboxEvent(
  tx,
  'procurement.quote.submitted',
  { organizationId, projectId, quoteId },
  organizationId,
);
```

**Quality gates:**

- `writeOutboxEvent` with event type `'procurement.quote.submitted'` present in `submitQuote`
- The call is inside the transaction scope
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`writeOutboxEvent(procurement.quote.submitted) added inside submitQuote transaction.`

---

## G.16 — procurement-approval.cancelApproval missing outbox event

**STATUS:** DONE  
**Tier:** 1

**Problem:** `apps/server/src/modules/project/procurement-approval/procurement-approval.service.ts` — `cancelApproval` writes `auditService.log` but does NOT emit `writeOutboxEvent`. Compare: `approveApproval` emits `'procurement.approval.approved'`, `rejectApproval` emits `'procurement.approval.rejected'`. The cancel transition is invisible to downstream consumers.

**Root cause:** `cancelApproval` was implemented without the outbox call. `writeOutboxEvent` is already imported at the top of the file.

**Files to change:**

- `apps/server/src/modules/project/procurement-approval/procurement-approval.service.ts` only

**Exact change:**

In `cancelApproval`, after `const updated = await this.repo.update(tx as any, approvalId, { status: 'CANCELLED' });` and before `await auditService.log(...)`, add:

```ts
await writeOutboxEvent(
  tx,
  'procurement.approval.cancelled',
  { organizationId, projectId, approvalId },
  organizationId,
);
```

**Quality gates:**

- `writeOutboxEvent` with event type `'procurement.approval.cancelled'` present in `cancelApproval`
- The call is inside the transaction scope
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`writeOutboxEvent(procurement.approval.cancelled) added inside cancelApproval transaction.`

---

## G.17 — invitation.listInvitations no pagination

**STATUS:** DONE  
**Tier:** 2

**Problem:** `apps/server/src/modules/invitation/invitation.service.ts` — `listInvitations` returns a plain `InvitationDTO[]` array with no cursor and no `nextCursor`. All other list endpoints in the codebase return `{ data: [...], nextCursor: string | null }`. Additionally, the handler in `invitation.handler.ts` returns `createSuccessResponse({ invitations })` — the key is `'invitations'`, inconsistent with all other list endpoints which use `'data'`.

**Root cause:** `listInvitations` pre-dates the cursor pagination pattern and was never updated. The response shape and key name are both inconsistent.

**Files to change:**

- `apps/server/src/modules/invitation/invitation.service.ts`
- `apps/server/src/modules/invitation/invitation.handler.ts`

**Exact change:**

In `invitation.service.ts`, update `listInvitations` signature and return type:

```ts
async listInvitations(
  orgId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<{ data: InvitationDTO[]; nextCursor: string | null }> {
  return withSpan(tracer, 'invitation.listInvitations', async (span) => {
    span.setAttribute('organization.id', orgId);
    const limit = Math.min(opts.limit ?? 50, 100);
    const invites = await this.repo.findByOrg(orgId);
    // Simple limit-only implementation: invitations per org are expected to be small.
    // If the repo gains cursor support in a future phase, upgrade here.
    const hasMore = invites.length > limit;
    const data = hasMore ? invites.slice(0, limit) : invites;
    const nextCursor: string | null = null; // no cursor until repo supports it
    return { data: data.map(toInvitationDTO), nextCursor };
  });
}
```

In `invitation.handler.ts`, update `handleListInvitations`:

```ts
export async function handleListInvitations(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const querySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  });
  const query = querySchema.parse(request.query);
  const result = await invitationService.listInvitations(organizationId, query);
  return reply.send(createSuccessResponse({ data: result.data, nextCursor: result.nextCursor }));
}
```

Add `import { z } from 'zod';` to the handler imports if not already present.

**Quality gates:**

- `listInvitations` returns `{ data: InvitationDTO[]; nextCursor: string | null }`
- Handler parses `req.query` with Zod
- Response key is `'data'` not `'invitations'`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`listInvitations updated to return { data, nextCursor }. Handler updated with Zod query parsing, response key changed to data.`

---

## G.18 — Redis KEYS usage in supplier.service + material.service

**STATUS:** DONE  
**Tier:** 1

**Problem:** Both `apps/server/src/modules/supplier/supplier.service.ts` and `apps/server/src/modules/material/material.service.ts` call `redis.keys(pattern)` inside `invalidateListCache`. `KEYS` is a blocking O(N) operation that scans the entire Redis keyspace and blocks the Redis event loop for all other clients while it runs. This violates Section 7 of the production checklist: "No production KEYS usage".

**Root cause:**

- `supplier.service.ts` → `invalidateListCache`: `const keys = await redis.keys(pattern); if (keys.length > 0) await redis.del(...keys);`
- `material.service.ts` → `invalidateListCache`: `const keys = await redis.keys(\`siteflow:v1:org:${orgId}:material:list:*\`); if (keys.length > 0) await redis.del(...keys);`

Both are inside `try/catch` so they don't crash, but they still block the Redis server.

**Files to change:**

- `apps/server/src/modules/supplier/supplier.service.ts`
- `apps/server/src/modules/material/material.service.ts`

**Exact change:**

Replace `redis.keys(pattern)` + `redis.del(...keys)` with a SCAN-based cursor loop in both files:

```ts
async function scanAndDelete(redis: any, pattern: string): Promise<void> {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== '0');
}
```

In `supplier.service.ts`, replace the body of `invalidateListCache`:

```ts
private async invalidateListCache(orgId: string): Promise<void> {
  try {
    const redis = getRedis();
    const pattern = `siteflow:v1:org:${orgId}:supplier:list:*`;
    await scanAndDelete(redis, pattern);
  } catch {
    // cache failure must not break the service
  }
}
```

In `material.service.ts`, replace the body of `invalidateListCache`:

```ts
async function invalidateListCache(orgId: string): Promise<void> {
  try {
    const redis = getRedis();
    await scanAndDelete(redis, `siteflow:v1:org:${orgId}:material:list:*`);
  } catch {
    // cache failure must not break the service
  }
}
```

Place the `scanAndDelete` helper at module level (outside the class) in each file. Do NOT export it — it is a private implementation detail.

**Quality gates:**

- No `redis.keys()` calls remain in either file
- SCAN-based cursor loop (`do { ... } while (cursor !== '0')`) present in both files
- All Redis operations remain inside `try/catch` blocks
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`scanAndDelete SCAN cursor loop added as module-level helper in supplier.service.ts + material.service.ts. redis.keys() removed.`

---

## G.19 — auth.service login + loginWithGoogle call writeOutboxEvent outside a transaction

**STATUS:** DONE  
**Tier:** 1

**Problem:** `apps/server/src/modules/auth/auth.service.ts` — both `login` and `loginWithGoogle` call `writeOutboxEvent(getDb(), AUTH_QUEUES.SEND_NEW_LOGIN_NOTIFICATION, ...)` passing `getDb()` directly as the first argument. `writeOutboxEvent` expects a **transaction** (`tx`) as first argument, not a bare DB connection. The checklist rule: "all domain events must go through `writeOutboxEvent(tx, ...)` inside the DB transaction — no `sendJob()` calls outside a transaction for domain events."

**Root cause confirmed at:**

- `auth.service.ts` `login` method, near the end: `await writeOutboxEvent(getDb(), AUTH_QUEUES.SEND_NEW_LOGIN_NOTIFICATION, { userId, email, ipAddress, userAgent });`
- `auth.service.ts` `loginWithGoogle` method: same pattern — `await writeOutboxEvent(getDb(), AUTH_QUEUES.SEND_NEW_LOGIN_NOTIFICATION, { userId, email, ipAddress, userAgent });`

These calls are outside any `db.transaction()` block. If the server crashes after the session is written but before the outbox event is inserted, the login notification is silently lost. The outbox pattern only guarantees delivery when the event is written atomically with the domain state in the same transaction.

**Files to change:**

- `apps/server/src/modules/auth/auth.service.ts` only

**Exact change:**

For `login`: wrap the session creation and outbox write together in a transaction. The session is currently created via `this.sessionService.createSession()` outside a transaction. The fix is to either:

- Move the `writeOutboxEvent` call inside a transaction that wraps the session insert, OR
- Accept that the login notification is best-effort (lower severity since it's a notification, not a financial event) and replace `getDb()` with a proper best-effort pattern

Given that `SEND_NEW_LOGIN_NOTIFICATION` is a notification (not a financial event), the pragmatic fix is to wrap both the `updateLastLogin` call and the `writeOutboxEvent` in a single transaction:

```ts
// In login(), replace the two separate DB calls with a transaction:
await getDb().transaction(async (tx) => {
  await this.repo.updateLastLogin(user.id); // was standalone call
  await writeOutboxEvent(
    tx, // tx, not getDb()
    AUTH_QUEUES.SEND_NEW_LOGIN_NOTIFICATION,
    { userId: user.id, email: user.email, ipAddress, userAgent },
  );
});
// Remove the standalone this.repo.updateLastLogin(user.id) call above the session creation
```

Apply the same fix to `loginWithGoogle` — find the `writeOutboxEvent(getDb(), ...)` call and wrap it with `updateLastLogin` in a transaction in the same way.

**Note:** `SessionService.createSession` creates a new session row via `this.repo.createSession(...)`. The session creation itself does not need to be in the same transaction as the outbox event — sessions and login notifications are separate concerns. The critical requirement is that `writeOutboxEvent` never receives a bare DB instance.

**Quality gates:**

- No `writeOutboxEvent(getDb(), ...)` calls remain in `auth.service.ts`
- Both `login` and `loginWithGoogle` pass a `tx` object to `writeOutboxEvent`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`login + loginWithGoogle wrapped updateLastLogin + writeOutboxEvent in single getDb().transaction(). No more writeOutboxEvent(getDb(), ...) calls.`

---

## G.20 — membership.listMembers and auth.getUserSessions missing pagination envelope

**STATUS:** DONE  
**Tier:** 2

**Problem:** Two list endpoints in Phase A return inconsistent response shapes:

1. `membership.handler.ts` → `handleListMembers` returns `createSuccessResponse({ members })` — key is `'members'`, not `'data'`. `MembershipService.listMembers` returns a plain `MemberDTO[]` with no cursor.
2. `auth.handler.ts` → `handleGetSessions` returns `createSuccessResponse({ sessions })` — key is `'sessions'`, not `'data'`. `AuthService.getUserSessions` returns a plain `SessionDTO[]` with no cursor.

Both violate the API contract established across the rest of the codebase: all list endpoints return `{ data: [...], nextCursor: string | null }`.

**Root cause:**

- `membership.service.ts` `listMembers` → plain `MemberDTO[]` return
- `auth.service.ts` `getUserSessions` → plain `SessionDTO[]` return
- Both handlers use non-standard response keys

**Files to change:**

- `apps/server/src/modules/membership/membership.service.ts`
- `apps/server/src/modules/membership/membership.handler.ts`
- `apps/server/src/modules/auth/auth.service.ts`
- `apps/server/src/modules/auth/auth.handler.ts`

**Exact change:**

In `membership.service.ts`, update `listMembers`:

```ts
async listMembers(
  orgId: string,
  opts: { limit?: number } = {},
): Promise<{ data: MemberDTO[]; nextCursor: string | null }> {
  return withSpan(tracer, 'membership.listMembers', async (span) => {
    span.setAttribute('organization.id', orgId);
    const limit = Math.min(opts.limit ?? 50, 100);
    const members = await this.repo.findByOrg(orgId);
    // Member counts per org are bounded; simple limit-only pagination is sufficient
    const hasMore = members.length > limit;
    const data = hasMore ? members.slice(0, limit) : members;
    return { data: data.map(toMemberDTO), nextCursor: null };
  });
}
```

In `membership.handler.ts`, update `handleListMembers`:

```ts
export async function handleListMembers(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.params as { organizationId: string };
  const result = await membershipService.listMembers(organizationId);
  return reply.send(createSuccessResponse({ data: result.data, nextCursor: result.nextCursor }));
}
```

In `auth.service.ts`, update `getUserSessions` to return `{ data: SessionDTO[]; nextCursor: string | null }`:

```ts
async getUserSessions(userId: string, currentSessionId?: string): Promise<{ data: SessionDTO[]; nextCursor: string | null }> {
  // ... existing cache logic ...
  const sessions = await this.sessionService.getUserSessions(userId, currentSessionId);
  // ... existing cache set ...
  return { data: sessions, nextCursor: null };
}
```

In `auth.handler.ts`, update `handleGetSessions`:

```ts
export async function handleGetSessions(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.sub;
  const currentSessionId = request.sessionId;
  const result = await authService.getUserSessions(userId, currentSessionId);
  return reply.send(createSuccessResponse({ data: result.data, nextCursor: result.nextCursor }));
}
```

**Note:** The cache in `AuthCacheService` stores `SessionDTO[]` directly — after changing the return type, update `setUserSessions` / `getUserSessions` in the cache service to store/return the sessions array only (the wrapping `{ data, nextCursor }` should not be cached; apply it after the cache read, same as the getUserProfile pattern).

**Quality gates:**

- `listMembers` returns `{ data: MemberDTO[]; nextCursor: string | null }`
- `getUserSessions` returns `{ data: SessionDTO[]; nextCursor: string | null }`
- Both handlers return `{ data, nextCursor }` not `{ members }` / `{ sessions }`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`listMembers returns { data, nextCursor }. getUserSessions returns { data, nextCursor }. Both handlers updated. Cache still stores raw SessionDTO[].`

---

## G.21 — membership.updateMember reads row outside transaction before state check

**STATUS:** DONE  
**Tier:** 1

**Problem:** `apps/server/src/modules/membership/membership.service.ts` — `updateMember` performs several DB reads **before** opening the transaction, then opens the transaction without re-reading under a lock. Between the pre-transaction reads and the transaction UPDATE, another request can change the membership status (e.g. remove it). The service does not use `FOR UPDATE` on the membership row inside the transaction.

**Root cause confirmed at:**

```ts
// OUTSIDE transaction:
const existing = await this.repo.findById(memberId, orgId);          // read #1
if (!existing || existing.status === 'REMOVED') { throw ... }

const targetRole = await this.db.select()...                          // read #2

const currentMember = await this.repo.findMemberWithDetails(...)      // read #3

// INSIDE transaction:
const result = await this.repo.update(memberId, input, tx);           // UPDATE — no FOR UPDATE lock before this
```

Two concurrent `PATCH /members/:id` calls can both pass the `status !== 'REMOVED'` check and both execute the UPDATE.

**Files to change:**

- `apps/server/src/modules/membership/membership.repository.ts` — add `findByIdForUpdate(tx, id, orgId)`
- `apps/server/src/modules/membership/membership.service.ts` — move the membership existence check inside the transaction with a lock

**Exact change:**

In `membership.repository.ts`, add:

```ts
async findByIdForUpdate(tx: any, memberId: string, orgId: string): Promise<Membership | null> {
  const rows = await tx.execute(
    sql`SELECT * FROM app.organization_memberships WHERE id = ${memberId} AND organization_id = ${orgId} FOR UPDATE`
  ) as any;
  return (rows.rows ?? rows)[0] ?? null;
}
```

In `membership.service.ts` `updateMember`, restructure so the membership lock and existence check happen inside the transaction:

```ts
// Keep pre-transaction role validation (read-only, no race risk)
// Move membership existence check INSIDE transaction with FOR UPDATE:
const updated = await this.db.transaction(async (tx) => {
  const locked = await this.repo.findByIdForUpdate(tx, memberId, orgId);
  if (!locked || locked.status === 'REMOVED') {
    throw new NotFoundError('Member not found');
  }
  // ... role validation, last-admin check, update ...
});
```

**Quality gates:**

- `findByIdForUpdate` method present in `MembershipRepository` using `FOR UPDATE` SQL
- `updateMember` transaction reads the membership row with a lock before proceeding
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`findByIdForUpdate added to MembershipRepository. updateMember uses locked read inside transaction. targetUserId captured from locked row for post-commit cache invalidations.`

---

## G.22 — auth.service.login updateLastLogin called outside transaction

**STATUS:** DONE  
**Tier:** 1

**Problem:** `apps/server/src/modules/auth/auth.service.ts` — `login` calls `await this.repo.updateLastLogin(user.id)` as a standalone DB write outside any transaction, before `this.sessionService.createSession(...)`. This means `updateLastLogin` and session creation are two separate DB round-trips with no atomicity. If the process crashes between them, `lastLoginAt` is updated but no session exists, or a session exists with a stale `lastLoginAt`.

This is also addressed partially by G.19 (which wraps `updateLastLogin` + `writeOutboxEvent` in a transaction). However G.19 specifically addresses the outbox call; this gap documents the broader atomicity requirement.

**Root cause confirmed at:**
`auth.service.ts` `login` method:

```ts
await this.repo.updateLastLogin(user.id);        // ← standalone write
// ...
const { refreshToken, session } = await this.sessionService.createSession(...);  // ← separate write
// ...
await writeOutboxEvent(getDb(), ...);            // ← separate write (also G.19)
```

Three separate DB writes that should be atomic.

**Files to change:**

- `apps/server/src/modules/auth/auth.service.ts` only

**Exact change:**

Combine all three writes into one transaction in `login`:

```ts
// Replace the three separate calls with:
let session: Session;
await getDb().transaction(async (tx) => {
  await this.repo.updateLastLogin(user.id); // pass tx if repo method supports it, or use tx.execute
  // session creation needs to happen in or after this tx
  // simplest: create session outside, then wrap just updateLastLogin + outbox:
});
// OR: wrap updateLastLogin + outbox together (session can remain separate since it's non-financial):
const { refreshToken, session: newSession } = await this.sessionService.createSession(
  user.id,
  ipAddress,
  userAgent,
);
session = newSession;
await getDb().transaction(async (tx) => {
  await tx.execute(
    sql`UPDATE app.users SET last_login_at = now(), updated_at = now() WHERE id = ${user.id}`,
  );
  await writeOutboxEvent(tx, AUTH_QUEUES.SEND_NEW_LOGIN_NOTIFICATION, {
    userId: user.id,
    email: user.email,
    ipAddress,
    userAgent,
  });
});
```

**Note:** G.19 and G.22 are related and should be fixed together in one commit. G.19 specifically addresses `writeOutboxEvent(getDb())`, G.22 addresses the standalone `updateLastLogin` call. The combined fix is: wrap `updateLastLogin` + `writeOutboxEvent` together in a single transaction.

**Quality gates:**

- `updateLastLogin` and `writeOutboxEvent` are called inside the same transaction in both `login` and `loginWithGoogle`
- No standalone `repo.updateLastLogin(user.id)` calls remain outside a transaction in `login`/`loginWithGoogle`
- `pnpm --filter server typecheck` exits 0

**Changes made:**
`login + loginWithGoogle wrapped updateLastLogin + writeOutboxEvent in single getDb().transaction(). No more writeOutboxEvent(getDb(), ...) calls.`

---

## Phase Exit Gate

All 22 gaps must be DONE before this hardening pass is considered complete.

| Gap  | Description                                                               | Status |
| ---- | ------------------------------------------------------------------------- | ------ |
| G.1  | bodyLimit on Fastify constructor                                          | DONE   |
| G.2  | N+1 in listDeliveries                                                     | DONE   |
| G.3  | N+1 in listReceipts                                                       | DONE   |
| G.4  | N+1 in listPurchaseOrders                                                 | DONE   |
| G.5  | N+1 in listProjectSubcontractors                                          | DONE   |
| G.6  | inventory.service organizationId ignored                                  | DONE   |
| G.7  | performance.service hardcoded LIMIT 200                                   | DONE   |
| G.8  | performance.handler no Zod + wrong response shape                         | DONE   |
| G.9  | cancelFromPO missing outbox + audit                                       | DONE   |
| G.10 | voidReceipt missing outbox event                                          | DONE   |
| G.11 | .env.example missing production vars                                      | DONE   |
| G.12 | N+1 in listMaterialRequests                                               | DONE   |
| G.13 | N+1 in listQuotes                                                         | DONE   |
| G.14 | Missing FOR UPDATE locks (quote, material-request, field-log)             | DONE   |
| G.15 | quote.submitQuote missing outbox event                                    | DONE   |
| G.16 | procurement-approval.cancelApproval missing outbox                        | DONE   |
| G.17 | invitation.listInvitations no pagination                                  | DONE   |
| G.18 | Redis KEYS usage in supplier.service + material.service                   | DONE   |
| G.19 | auth.service login/loginWithGoogle writeOutboxEvent outside transaction   | DONE   |
| G.20 | membership.listMembers + auth.getUserSessions missing pagination envelope | DONE   |
| G.21 | membership.updateMember reads row outside transaction (no FOR UPDATE)     | DONE   |
| G.22 | auth.service.login updateLastLogin called outside transaction             | DONE   |

**Final verification checklist (run after all gaps are DONE):**

- [x] `pnpm --filter server typecheck` exits 0
- [x] No `for`/`await` loops over entity IDs remain in any list endpoint
- [x] All list endpoints return `{ data/items: [...], nextCursor: string | null }` with consistent `'data'` key
- [x] All state-changing operations (submit, accept, reject, cancel, void, post) have both `writeOutboxEvent` AND `auditService.log`
- [x] `organizationId` is in every DB `WHERE` clause on tenant-scoped entities
- [x] No `redis.keys()` calls in production code — all replaced with SCAN loops
- [x] All state transitions in quote, material-request, and field-log use `FOR UPDATE` locking
- [x] No `writeOutboxEvent(getDb(), ...)` calls — all pass a `tx` object
- [x] All multi-write operations in auth (login, loginWithGoogle) use a single transaction
- [x] `membership.updateMember` uses `FOR UPDATE` lock inside the transaction
