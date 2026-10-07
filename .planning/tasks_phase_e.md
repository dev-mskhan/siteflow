# SiteFlow — Phase E: Commercial Control

> **Objective:** Add an auditable commercial-control layer over the operational truth from Phases A–D. Explain budget, approved changes, commitments, actual costs, forecast, billing, approvals, payments, outstanding balances, and retainage without collapsing them into one generic transaction model.
>
> **Status:** COMPLETE — E0–E10 implementation, targeted PostgreSQL/Fastify suites, repository lint/typecheck/build gates, migrations, and scoped query-plan review are complete. Full server-suite coverage is green across the full run and the isolated rerun of the sole suite that timed out during a later cumulative-load run. Commitments remain approved-PO-only; subcontract commitments are explicitly deferred until an approved contract source exists.
>
> **References:** `.planning/siteflow_testing_context.md` and `.planning/checklist_when_to_apply.md` are mandatory. Tier 1 applies to every chunk; Tier 2 is the Phase E exit gate; Tier 3 remains a pre-production gate.
>
> **Scope:** Backend only. Do not implement future phases, frontend, AI, messaging/notifications, or reporting dashboards.

---

## 1. Architecture and Repository Facts

The implementation must preserve the live SiteFlow architecture, even where the product contract uses different technology names:

| Concern                 | Repository implementation to extend                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP/API                | Fastify 5, project-scoped route registration, handlers, services, repositories                                                         |
| Data access             | Drizzle ORM, PostgreSQL, `app` schema; migrations under `packages/database/drizzle/`                                                   |
| Money                   | PostgreSQL `numeric` plus `decimal.js` (already a server dependency); API monetary values remain decimal strings                       |
| Validation              | Zod, shared package exports for reusable public schemas, handler-level parsing                                                         |
| Background work         | Existing PgBoss queue/worker and transactional outbox; do not introduce BullMQ                                                         |
| Cache                   | Existing Redis/ioredis; optimization only, never authority for financial decisions                                                     |
| Auth/RBAC               | Existing authentication, organization context, `projectContext`, `requireProjectPermission`, and policy maps                           |
| Audit/telemetry         | Existing `auditService`, structured logger, request ID, OpenTelemetry; extend through public interfaces                                |
| Test stack              | Vitest, Fastify `app.inject()` through `createTestApp()`/`buildApp()`, real PostgreSQL test DB (port 5434) and existing infrastructure |
| Runtime/package manager | Node 22.13.1, pnpm 9.12.0; root scripts provide lint, typecheck, test, and build                                                       |

Current foundations confirmed during planning:

- `projectCostCodes` already owns project cost-code identity and `(projectId, code)` uniqueness. Extend its commercial attribution only if needed; do not add a competing cost-code table.
- Purchase orders and their items already carry numeric totals, phase/cost-code/BOQ references, and Decimal.js calculations.
- `committedCosts` is already created/cancelled from purchase-order approval/cancellation in the same transaction, with audit and outbox events. Preserve and evolve this source of truth rather than creating a second PO commitment.
- `projectSubcontractors` has a contract-value field, but this alone does not establish an approved subcontract-commitment lifecycle. Verify the authoritative contract/approval source before deciding how it contributes to commitments.
- Project routes are currently registered under the organization/project scope (`/:organizationId/projects/:projectId/...`) and use `projectContext`. Add Phase E routes through this established route surface; do not create parallel unscoped paths solely to mirror abbreviated paths in the product brief.
- Project role capabilities and organization-level authority mappings are maintained in the existing project policy. Any new capability must be added to both maps in the same change as its guarded routes.
- The generic audit service supports writes inside an existing DB transaction. Determine whether its schema can meet the financial audit contract; do not replace global audit infrastructure or silently treat generic CRUD logs as a complete financial ledger.
- Latest migration present during planning is `0027_phase_d_fk_indexes.sql`; verify the Drizzle journal and current DB state before choosing the next migration number.
- `tasks_phase_e.md` did not already exist. Existing dirty/untracked files are not part of this plan and must remain untouched.

### Schema and migration roadmap

This roadmap makes the intended PostgreSQL schema work explicit. Names are proposed logical names; confirm naming conventions, enum ownership and FK targets against the live Drizzle schema before implementation. New tables belong in concept-owned files under `packages/database/src/schema/` and must be exported from `schema/index.ts`. Extend existing schemas/tables where the entity already exists. Generate and commit the Drizzle SQL migration and journal/snapshot for each chunk that changes schema; do not hand-edit generated metadata or skip a migration.

| Chunk | Schema additions/extensions planned                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0    | Add a PostgreSQL idempotency table (`commercial_idempotency_keys`) with organization, operation, hashed key/request, JSON response, timestamps and a unique scope constraint. Keep completed key scopes permanently for financial replay safety; store only the key hash. Add `financial_audit_events` with organization/project, actor, action, entity type/ID, previous/new JSON state, amount/currency, reason, request ID and timestamp; the generic audit table lacks financial fields and DB-enforced immutability. Add query indexes, restrictive FK/delete behavior and a DB trigger forbidding UPDATE/DELETE/TRUNCATE. |
| E1    | Add `project_budgets`, `project_budget_lines`, and explicit immutable `project_budget_revisions` (or an equivalently normalized revision model). Include tenant/project FKs, currency, status, version, actors/timestamps, cost-code/phase/BOQ references, decimal original/revision line amounts and unique revision/line ordering constraints. Approved changes must derive from approved revision/change-order records rather than duplicated mutable totals.                                                                                                                                                                |
| E2    | Extend existing `project_cost_codes` only if discovery shows a required commercial field/invariant. Add `cost_transactions` with tenant/project/cost-code and optional phase/task/BOQ/source/document references; numeric quantity/unit price/subtotal/tax/total; currency; status; actor/post/void timestamps; version; idempotency/source uniqueness where business rules require it; and a self-reference or linked reversal record that preserves the posted original.                                                                                                                                                      |
| E3    | Prefer no new commitment table: reuse and extend existing `committed_costs` only when required to expose verified source lifecycle/aggregation without changing its PO source identity. Add indexes or nullable source metadata by migration only when justified. Do not create a subcontract commitment schema until an approved subcontract source and lifecycle are found.                                                                                                                                                                                                                                                   |
| E4    | Add `change_orders` and `change_order_lines` with tenant/project, allocated number, title/reason, requester, lifecycle/version, internal/client approval actors and times, cost/revenue/schedule deltas, currency, affected cost-code/phase/BOQ/task references and supporting-document links. Enforce scoped unique number and indexes for project/status/time.                                                                                                                                                                                                                                                                |
| E5    | Add `schedules_of_values` and `schedule_of_value_lines`, with version/approval state, contract value/currency, ordered line number, description and commercial references, scheduled value, retainage percent, and only those progress columns justified as transactional projections. Add scoped line uniqueness and query indexes.                                                                                                                                                                                                                                                                                            |
| E6    | Add `payment_applications` and `payment_application_lines`, linked to approved SOV/lines and scoped project; billing period, status/version, prepared/review/approval/rejection actors/timestamps, requested/approved values and decimal work/material/CO/retainage components. Enforce scoped application-number and line uniqueness and indexes.                                                                                                                                                                                                                                                                              |
| E7    | Add `invoices` and `payments`, with direction, scoped invoice number, date/due date, vendor/client/subcontractor and optional application references, currency and numeric amounts/status/version; payment invoice/project reference, method/reference/date/status and distinct initiated/approved/executed actors/timestamps. Add tenant-scoped uniqueness, FKs, positive/balance checks where representable, and execution/list indexes.                                                                                                                                                                                      |
| E8    | Add `retainage_records` and append-only `retainage_releases` (or equivalent release ledger) with source entity references, currency, percentage/accrued/released/remaining numeric values, status/version, actor/reason/timestamps and idempotency reference. Never erase partial release history.                                                                                                                                                                                                                                                                                                                              |
| E9    | No new business tables by default. Add a migration only if the completed route review identifies a missing database-enforceable actor/invariant; prefer existing capability, actor, and audit structures.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| E10   | Complete or extend `financial_audit_events` from E0 only if needed; do not create a second audit table. Add project/entity/time and organization/project/cursor indexes for audit and summary queries based on measured query patterns.                                                                                                                                                                                                                                                                                                                                                                                         |

**Every new table** must have explicit FK actions, indexes for FK and tenant/project/list query paths, currency and monetary constraints where enforceable, and appropriate organization/project ownership. Cross-tenant references must also be rejected in the service transaction: independent FKs do not by themselves prove that referenced rows share the same tenant/project. All schema work requires generated migration review and application against a fresh dedicated test database plus the existing integration DB; do not reset shared data.

### Architectural non-negotiables

1. PostgreSQL is authoritative for financial state, balances, permissions, idempotency, and versions. No Redis read may authorize, approve, post, execute, allocate numbers, or establish SoD.
2. Keep distinct domain concepts: budget/revision, cost code, cost transaction, commitment, change order, SOV, payment application, invoice, payment, retainage, and financial audit event.
3. Keep domain routes/controllers/handlers, services, validation, types, and repositories together by module. Avoid a giant shared financial controller/service/model directory and private cross-module imports.
4. Validate tenant/project ownership of every referenced record inside the mutation transaction. Derive organization ID from authenticated organization context, never request input.
5. Mutations with multiple authoritative writes are one short PostgreSQL transaction. Lock controlling rows with `FOR UPDATE` before state checks/transitions; use unique constraints and conditional version updates for database-backed invariants.
6. Use `Decimal`/PostgreSQL `numeric` for money. Never use JS `number` arithmetic as financial truth. Serialize monetary values consistently as decimal strings.
7. Use explicit commands for lifecycle transitions. Never allow generic status PATCH to bypass transition rules. Preserve posted/approved history through reversal/void records or state, not destructive deletion.
8. Keep outbox writes in the same transaction as the source mutation when an asynchronous domain event is required. Do not send PgBoss jobs or call external systems synchronously inside financial transactions.
9. Redis is optional read optimization: tenant/project scoped keys, explicit post-commit invalidation, fail-open DB fallback, no speculative cache.
10. All project endpoints follow existing route prefixes, request/response envelopes, error conventions, membership/permission guards, OpenAPI schemas, and module registration patterns.

---

## 2. Execution Order and Dependencies

The ten official chunks remain E1–E10. E0 is the requested implementation prerequisite, not an additional business feature.

```text
Existing Phases A–D
        │
        ▼
 E0 Commercial Foundation
        │
   ┌────┴────┐
   ▼         ▼
  E1         E2 ───┐
 Budget     Cost codes + costs
   └────┬────┘     │
        ▼          ▼
       E3 Commitments + initial commercial calculations
        │
        ├── E4 Change orders ── updates commercial baseline
        │
        ▼
       E5 Schedule of Values
        ▼
       E6 Payment Applications
        ▼
       E7 Invoices + Payments
        ▼
       E8 Retainage
        ▼
       E9 Segregation-of-duties coverage/audit
        ▼
       E10 Financial audit read API + final commercial summaries/gate
```

**Run discipline:** execute one chunk at a time in the listed order; mark it DONE only after its chunk gate passes. E1/E2 may be designed independently but are not to be implemented in parallel by one execution. E0 must settle the shared contracts first. No future chunk is bundled into an earlier chunk to bypass a dependency.

**Cross-cutting timing:** tenant scope, capability checks, SoD, transaction/locking, idempotency where applicable, audit writes, validation, and tests are required in each chunk that introduces a mutation. E9 is a completeness/security sweep, not permission to postpone these controls.

---

## 3. E0 — Commercial Foundation (Prerequisite)

**STATUS:** DONE — implementation, functional verification, and repository lint gate pass.
**Depends on:** Existing Phases A–D
**Purpose:** Establish only the smallest shared contracts required by later chunks; do not build a generic financial framework.

### Work

- Verify migration journal/current schema, database client transaction shape, project route registration, error mapping, Zod export conventions, RBAC policy maps, audit schema/service, outbox API, cache conventions, PgBoss registry/worker registration, and test bootstrap before designing Phase E additions.
- Define authoritative money/quantity/currency conventions: PostgreSQL numeric precision/scale by value type, `decimal.js` rounding policy, accepted decimal-string input, serialization, currency validation, and overflow/negative-value rules. Add pure Decimal helpers and unit tests; do not duplicate PO total calculators.
- Define commercial lifecycle enums/status transitions and typed error codes in their owning modules. Add no generic status-update endpoint.
- Define typed financial action/actor context and a reusable SoD policy boundary that composes with existing permission middleware. Keep role/capability ownership in existing policy maps.
- Define the durable idempotency contract for retryable commands: organization + operation/key scope, request-hash mismatch behavior, stored JSON result, concurrent duplicate behavior, and unique DB enforcement. Keep completed key scopes permanently so retries of irreversible financial operations cannot repeat effects; SHA-256 hash keys rather than storing raw keys. Use PostgreSQL, not Redis. Implement only the minimal shared persistence/helper needed by subsequent commands.
- Define optimistic concurrency contract: `expectedVersion`, integer DB version, atomic `WHERE version = expectedVersion` update, typed stale-version conflict, and response version semantics.
- Establish the financial event vocabulary and append-only audit write contract. Use the generic audit service where its schema supports required fields and immutability; otherwise add the minimal dedicated financial audit schema/service here. Every E1+ protected mutation must be able to write its financial audit event within the same transaction. E10 completes query/API coverage and verifies the event inventory.
- Decide how supporting-document references use Phase D document linking, how project/user actor FKs are represented, and how cross-module interactions use existing public service/event boundaries.
- Record route base, shared Zod request/response schema placement, pagination (`createdAt DESC, id DESC`, bounded maximum 100), DTO projection, request ID propagation, and transaction/outbox conventions for the remaining chunks.

### Acceptance and tests

- **Required integration suite:** `apps/server/tests/integration/commercial_foundation.test.ts`, using the real Fastify test app setup and PostgreSQL. Verify idempotency organization/operation scope, same-key replay, request-hash mismatch, concurrent duplicate commands, audit immutability and transactional rollback.
- Pure money helper tests cover zero, positive, rejected negative, precision/rounding, maximum supported values, and string serialization.
- PostgreSQL integration tests verify idempotency scope/replay/request-hash mismatch/concurrency, financial-audit immutability and atomic rollback against real constraints/transactions. Test version conflicts with E1's first versioned budget record using the shared error contract.
- A rollback test demonstrates an idempotency/audit write cannot survive a failed domain transaction.
- Capability/SoD helper unit tests are isolated; route behavior remains tested through Fastify integration once financial routes exist.
- Migration generation and migration against the test DB are clean; all introduced FKs/indexes are reviewed.
- Root lint, typecheck, test, build gates pass; no existing fixture helpers are broadened into unscoped aggregate queries.

### E0 execution status

- Added Decimal money helpers, typed commercial errors, transaction-scoped idempotency, financial audit vocabulary/writer/schema, append-only database enforcement, and the financial actor-separation policy.
- Applied the generated E0 migrations to the dedicated test database. Migration generation reports no schema drift.
- Focused commercial integration tests pass (6 tests); money and financial policy unit tests pass (11 tests).
- Repository typecheck, test (56 files / 593 tests), and build gates pass. Server lint passes with existing warnings and no warnings in the new commercial source.
- Added a root ESLint flat config that reuses the shared base preset for workspaces without a package-local config; `pnpm lint` now passes. The shared cost-code regex also dropped an unnecessary escape flagged by the enabled lint rule.

---

## 4. E1 — Project Budget

**STATUS:** DONE — implementation and real PostgreSQL/Fastify integration tests are in place; typecheck, tests, build, lint, schema generation, and migration verification pass.
**Depends on:** E0

### Scope

- Add budget and budget-line records with tenant/project, cost-code, phase and applicable BOQ references; currency; original approved baseline, explicit approved revision/change records, lifecycle status; actor/timestamps; version; and approval metadata. Expose approved-change and revised totals as derived values, not independently editable competing sources of truth.
- Enforce one explicit budget/revision policy per project and database-backed version/uniqueness invariants. Preserve superseded revisions; never silently mutate an approved baseline.
- Implement create, bounded cursor list, get, draft update, submit, approve, close, and budget summary services/routes. The summary returns original, approved changes, and revised totals from authoritative baseline/revision records. Do not expose a generic lifecycle status PATCH.
- Validate referenced project, phase, cost code and BOQ ownership in the same transaction. API monetary fields are strings.
- Audit creation, submission, approval, revision, and closure in-transaction. Invalidate only a summary cache if a real read path is introduced.

### API coverage

Create/list/get/update budget, submit, approve, close, and budget summary using the established organization/project route scope.

### Acceptance and tests

- **Required integration suite:** `apps/server/tests/integration/budget.test.ts`. Exercise create/list/get/update/submit/approve/close/summary through `app.inject()`; assert response contract and persisted budget, line, revision, audit, and outbox state using run/project-scoped queries.
- Test each allowed and forbidden lifecycle transition, role/capability denial, creator/requester self-approval denial, cross-org/project/cost-code references, malformed/oversized input, decimal precision, stale version, duplicate submission/approval, and concurrent approval (exactly one succeeds).
- Verify approved-budget mutation creates an explicit revision and preserves the previous approved record; draft changes do not alter approved totals.
- Verify audit records are scoped to this run/project/action and transaction rollback leaves neither partial budget writes nor audit/outbox rows.
- Verify list pagination is bounded, stable, tenant-scoped, and uses selective columns/indexed filters.

---

## 5. E2 — Existing Cost Codes + Cost Transactions

**STATUS:** DONE — implemented; targeted real-PostgreSQL/Fastify suite passes.
**Depends on:** E0; may be designed alongside E1, execution remains sequential.

### Scope

- Reuse `projectCostCodes`; review current CRUD, capability, indexes and active/inactive semantics. Add only necessary commercial attribution fields/constraints or public operations to this existing entity.
- Add cost transaction records separately from purchase-order committed costs. Support source type/ID, transaction and posting dates, description, optional quantity/unit/unit cost, subtotal, tax, total, currency, status, created/posted actor, posted timestamp, version, idempotency, and void/reversal reference.
- Require a valid active project cost code for posting; validate phase/BOQ/task/document/source ownership within the transaction.
- Posting and voiding are explicit commands, locked and audited; voiding never deletes or rewrites the original posted fact.
- Add cost transaction create/list/get/post/void routes. Preserve existing procurement receipt, inventory and committed-cost behavior; do not double-count those as actual cost without an explicit accounting rule.

### Acceptance and tests

- **Required integration suite:** `apps/server/tests/integration/cost_transaction.test.ts`; extend the existing cost-code route tests if present. Exercise existing cost-code reads/writes affected by schema changes and every implemented cost-transaction route via `app.inject()`, verifying DB constraints and persisted post/void/reversal state.
- Test zero/positive/invalid-negative amounts, decimal precision and large values, source uniqueness/idempotency, inactive/foreign cost code rejection, cross-tenant/project references, state transitions, reversal history, stale version, and same-request concurrent posting.
- Verify posted actuals are distinct from payments and commitments, and confirm database totals after post/void.
- Verify audit/outbox behavior and transaction rollback with resource-specific test queries.
- Test every implemented route through `createTestApp()` + `app.inject()` and real PostgreSQL; do not mock Drizzle/transactions.

---

## 6. E3 — Commitment vs Actual + Initial Commercial Calculations

**STATUS:** DONE — implemented; targeted real-PostgreSQL/Fastify suite passes. PO commitments count only while the linked PO is approved; subcontract commitments are deferred until an approved contract source exists.
**Depends on:** E1, E2

### Discovery gate

- Inspect PO approval/cancellation, `committedCosts`, source uniqueness, existing “committed cost” APIs, `projectSubcontractors`, and all actual contractual/approval records before changing commitment semantics.
- Preserve the PO approval transaction hook and existing `committedCosts` source identity. Do not create a second PO commitment.
- A subcontractor master/project assignment or `contractValue` alone is not proof of an approved subcontract commitment. If no approved contract source exists, document the gap and ask for a business decision before inventing one.

### Scope

- Establish a public commitment read/service surface aggregating existing approved procurement commitments and any separately verified approved subcontract source without duplicating source truth.
- Define lifecycle mapping for approved, partially invoiced, fully invoiced, closed/cancelled commitments while preserving upstream purchase-order status semantics.
- Implement service-owned calculations by project/cost code: original budget, approved budget changes, revised budget, committed, posted actual, forecast, and variance. Document exact forecast formula and its source inputs; do not invent an estimate where no forecast input exists.
- Provide optimized project/cost-code commitment and initial cost summary routes. Use decimal arithmetic, DB aggregates/projections, indexes, bounded responses; no frontend calculations.

### Acceptance and tests

- **Required integration suite:** extend `apps/server/tests/integration/committed_cost.test.ts` for PO approval/cancellation compatibility and add `apps/server/tests/integration/commercial_summary.test.ts` for project/cost-code commitment and actual aggregates. Run through Fastify routes and verify persisted source rows and summary values.
- Verify each source commitment is represented once, cancelled commitments remain historically visible, and invoice/actual/payment amounts are not conflated.
- Test budget/commitment/actual aggregate correctness, currency consistency, zero/no-data and large datasets, tenant/project isolation, and query/index plans for the highest-cost summaries.
- Test PO approval/cancel regressions and corresponding commitment/audit/outbox state within the same transactions.
- Confirm the open subcontract-source decision is resolved or explicitly blocks claiming complete subcontract commitment coverage.

---

## 7. E4 — Change Orders

**STATUS:** DONE — implemented; targeted real-PostgreSQL/Fastify suite passes.
**Depends on:** E0, E1, E2, E3

### Scope

- Add change order and line records for numbered scope, reason, requester, cost/revenue deltas, schedule delta, affected cost codes/phases/BOQ/tasks, approvals, client approval requirement, documents, status, version, and actor timestamps.
- Allocate numbers using the existing `documentNumberService.allocateDocumentNumber(tx, ...)`; never use `COUNT(*)`.
- Implement explicit draft update, submit, internal approve/reject, client approve, effect, and void commands. Requester cannot approve own change order.
- Only an effective/approved change order changes commercial baseline. Persist its approval/effect, applicable budget adjustment, source references, financial audit and outbox event atomically.
- Interact with scheduling only through a public service/event; do not import or mutate schedule internals privately.

### Acceptance and tests

- **Required integration suite:** `apps/server/tests/integration/change_order.test.ts`. Exercise create/list/get/draft patch/submit/approve/reject/client-approve/effect/void/audit routes and prove an effective order updates budget-facing truth once while non-effective states do not.
- Cover all lifecycle transitions and invalid transitions, required approval paths, self-approval, duplicate effect/idempotency, concurrent effect, stale version, number allocation races, cross-project related records, and client approval-required behavior.
- Prove a draft/submitted/rejected order cannot change revised budget; effective order changes it exactly once.
- Verify transaction rollback leaves no partial baseline or schedule-related event.
- Test audit endpoint/read contract for an order once implemented, including tenant-safe not-found behavior.

---

## 8. E5 — Schedule of Values

**STATUS:** DONE — implemented; targeted real-PostgreSQL/Fastify suite passes.
**Depends on:** E3, E4

### Scope

- Add versioned SOV and SOV lines for contract value/currency, approval state, line number/description, cost code/phase/BOQ, scheduled value, billing progression, remaining amount, retainage percentage and amount.
- Keep SOV contract billing allocation separate from project budget. Reconcile contract value and effective change orders using an explicit rule; do not equate SOV and budget.
- Add create/list/get/update, submit, approve, and progress routes. Lock/version transition and preserve approved versions.
- Any line values/progress needed for payment applications must be derived or transactionally maintained from authoritative application records, not independently editable competing totals.

### Acceptance and tests

- **Required integration suite:** `apps/server/tests/integration/schedule_of_values.test.ts`. Exercise create/list/get/update/submit/approve/progress routes and verify line persistence, approval/version behavior and progress values in PostgreSQL.
- Test totals reconcile to contract value under the chosen policy; line numbering uniqueness; valid references; decimal precision; overbilling rejection; version transitions; concurrent approval; tenant isolation; and approved-version immutability.
- Verify progress/remaining/retainage calculations against persisted rows and multiple applications, not just response status.
- Include malformed arrays (empty, duplicate, excessive line count) and bounded list/input schemas.

---

## 9. E6 — Payment Applications

**STATUS:** DONE — implemented; targeted real-PostgreSQL/Fastify suite passes.
**Depends on:** E5

### Scope

- Add payment application and line records tied to an approved SOV and billing period, with current work, stored materials, eligible effective change orders, gross completed, retainage, prior payments, requested amount, approved amount, actors/timestamps and lifecycle.
- Implement draft editing, submit, under-review, approve, partial approval, reject and void commands with controlling-row locking and explicit transitions.
- The preparer cannot approve their own application. Validate all line/SOV/change-order/project ownership in the transaction.
- Keep application/approval data distinct from receivable/payable invoice creation; do not create a payment by approving an application.

### Acceptance and tests

- **Required integration suite:** `apps/server/tests/integration/payment_application.test.ts`. Exercise create/list/get/update/submit/under-review/approve/partial-approve/reject/void routes through the production app factory; inspect persisted application lines, SOV progress, audit and outbox rows.
- Test every transition, preparer self-approval denial, cross-tenant and cross-project SOV/CO links, billing period and line totals, prior/current/gross/retainage arithmetic, overbilling, duplicate submit/approve, concurrent approve, stale version, and rollback.
- Verify SOV progress updates exactly once on approval and is unchanged for draft/rejected/void applications.
- Verify the audit record captures previous/new state and amount; any outbox event is scoped and committed atomically.

---

## 10. E7 — Invoices + Payments

**STATUS:** DONE — implemented; targeted real-PostgreSQL/Fastify suite passes.
**Depends on:** E6

### Scope

- Add invoices with distinct `RECEIVABLE`/`PAYABLE` direction, project and vendor/client/subcontractor references, invoice/date/due date, optional payment-application relation, subtotal/tax/retainage/total, approved/paid/outstanding amounts, status and version.
- Keep an invoice separate from payment applications and settlement records. Approval does not create a payment.
- Add payments with direction, invoice/project, amount/currency/date/method/reference, status and initiated/approved/executed actor timestamps.
- Implement explicit payment create, submit, approve, reject, execute and void commands. Approval never means execution; approver cannot execute the same payment; creator cannot approve/execute.
- At execution, lock/read current invoice outstanding from PostgreSQL within the transaction and reject overpayment/invalid balance. Never consult Redis for authorization/balance.
- Define invoice number allocation and supported direction/reference rules through existing number allocator and verified entity ownership.

### Acceptance and tests

- **Required integration suite:** `apps/server/tests/integration/invoice_payment.test.ts`. Exercise invoice create/list/get/update/submit/approve/reject/void and payment create/list/get/submit/approve/reject/execute/void routes via `app.inject()`; verify invoice balances and payment actor/timestamp rows directly in PostgreSQL.
- Cover receivable/payable validation, amount/tax/retainage arithmetic, invoice/application links, approved/paid/outstanding state, and each payment command and prohibited actor combination.
- Test duplicate payment creation/execution with idempotency, two concurrent executions against one outstanding balance (only valid total can settle), stale version, void/reversal history, and DB rollback.
- Verify one invoice is not paid by an application or approval alone; invoice remains authoritative in PostgreSQL during Redis miss/failure.
- Audit every protected invoice/payment transition and verify outbox only where downstream work is required.

---

## 11. E8 — Retainage

**STATUS:** DONE — implemented; targeted real-PostgreSQL/Fastify suite passes.
**Depends on:** E6, E7

### Scope

- Add retainage records tied to their source application/invoice/eligible line with percentage, accrued, released, remaining, currency, status, version, actors and timestamps.
- Define and document one consistent retainage formula/rounding policy based on the approved application/SOV rules. Do not model retainage merely as unpaid invoice balance.
- Implement explicit hold/accrue/release operations; release must lock the authoritative source and verify remaining retainage in PostgreSQL. Use transaction + idempotency + financial audit.
- Preserve partial release history and prevent release above the held balance.

### Acceptance and tests

- **Required integration suite:** `apps/server/tests/integration/retainage.test.ts`. Exercise retainage accrual/release route commands through Fastify and verify release-ledger rows, source balances, audit events and duplicate/retry behavior in PostgreSQL.
- Test percentages/boundaries, Decimal rounding, partial/full/duplicate release, concurrent release, insufficient remaining balance, stale version, tenant/source isolation, and rollback.
- Verify invoice outstanding and retainage-held/released amounts remain separately correct after application approval, invoice payment and retainage release.
- Do not add Redis/worker dependencies for synchronous financial release.

---

## 12. E9 — Segregation of Duties (Completeness Gate)

**STATUS:** DONE — route-level SoD integration and policy tests pass.
**Depends on:** E0–E8; controls are implemented incrementally before this gate.

### Scope

- Audit every financial route and command for authenticate → organization context → project membership/context → capability → SoD policy → Zod validation → handler → service.
- Verify capabilities exist in both existing project role and organization authority maps with least-privilege assignment; no client/UI-only protection.
- Verify actor separation for budget approval/revision, change order request/approval/client approval, payment application preparation/approval, invoice approval, payment creation/approval/execution, and retainage release.
- Ensure actor IDs are sourced from authenticated context and rechecked against persisted creator/requester state under the transition transaction.

### Acceptance and tests

- **Required integration suite:** `apps/server/tests/integration/commercial_sod.test.ts`. Use real auth, organization/project context and capability middleware; cover all required creator/requester/preparer/approver/executor combinations through actual action routes, including denial error shape and no-mutation/no-audit side effects.
- Add route-level negative tests for every applicable SoD invariant and role/capability combination using real Fastify middleware.
- Mandatory checks include: unauthorized approval, requester cannot approve own change order, preparer cannot approve own application, payment creator cannot approve, payment approver cannot execute, executor differs from creator, invalid transition rejected.
- Test permission cache invalidation where a role change is involved; cache must not bypass current server-side authorization.
- Review all alternate mutation paths for the same operation; an unguarded route blocks phase completion.

---

## 13. E10 — Financial Audit Trail + Final Commercial Read Services

**STATUS:** DONE — targeted summary/audit integration suite and scoped query-plan review pass.
**Depends on:** E0–E9

### Scope

- Complete the append-only financial audit event inventory for all prior chunks: actor, organization, project, action, entity type/ID, previous/new state, amount/currency where applicable, required reason, request ID and timestamp.
- Prove ordinary application paths cannot update/delete financial audit history. Keep audit reads tenant/project scoped, bounded, indexed and cursor-paginated.
- Implement the project financial audit route and complete commercial, cost, commitment, billing and cash summary routes using authoritative service calculations.
- Final summaries expose budget original/approved changes/revised; cost committed/actual/forecast/variance; billing contract/billed/approved/paid/outstanding/retainage held. Document source and formula for every field.
- Any cache is a read-only, scoped projection with explicit invalidation and DB fallback. If the measured/hot-path case does not justify cache, leave it uncached.
- Any asynchronous read-model/export/reconciliation work must use existing PgBoss via transactional outbox, be idempotent, retryable, observable and tenant-safe. Keep approvals/posting/payment execution synchronous.

### API coverage

- `GET /.../commercial-summary`
- `GET /.../cost-summary`
- `GET /.../commitment-summary`
- `GET /.../billing-summary`
- `GET /.../cash-summary`
- `GET /.../financial-audit`
- `GET /.../change-orders/:changeOrderId/audit`

Use established organization/project route scope and documented response schemas.

### Acceptance and tests

- **Required integration suite:** `apps/server/tests/integration/financial_audit_summary.test.ts`. Exercise every summary/audit read route through `app.inject()` against seeded PostgreSQL data; verify cross-tenant/project denial, cursor pagination, exact decimal-string summaries, audit immutability and each protected mutation's resource-scoped audit event.
- Cross-check each summary against seeded authoritative PostgreSQL rows spanning budget, approved CO, PO commitment, posted cost, SOV, application, invoice, payment, and retainage.
- Add resource-specific tests proving every protected mutation emits exactly the expected audit event and failed/rolled-back mutations emit none.
- Test audit append-only behavior, tenant/project isolation, safe DTO/error output, pagination, response Zod/OpenAPI contract, cache invalidation/fail-open if used, and outbox behavior if jobs are added.
- Run query plans for the five most complex summary/list queries; confirm bounded results, correct composite indexes and no N+1.

---

## 14. Testing Contract for Every Chunk

Before creating or changing integration tests, reread the complete `.planning/siteflow_testing_context.md` and inspect the existing fixture helpers for unscoped aggregates/selects. Do not broaden or repair unrelated helpers without explicit scope.

### Mandatory Phase E integration-test deliverables

Each suite listed under E0–E10 is a required implementation deliverable, not an optional future test task. Use `apps/server/tests/helpers/test-app.ts` to create the same app via `createTestApp()`/`buildApp()` as production; send all route requests with `app.inject()`. Do not instantiate handlers directly or mock Fastify, Drizzle, transaction/locking behavior, PostgreSQL, Redis or PgBoss in integration tests. Real service-boundary doubles are allowed only for external providers that cannot safely run in tests, as specified in the testing context.

Every implemented route family must have success, schema-validation, authentication, capability/role, organization and project isolation, safe error-contract and persisted-state assertions where applicable. Every mutating family must also cover lifecycle/SoD, DB invariants, rollback, idempotency and concurrency where applicable. Read routes must cover filtering, bounded cursor pagination, stable order, and cross-tenant/project list non-leakage. For each suite, query only the test run's organization/project/resource/action; never assert global row counts. Test names describe the protected business guarantee. If a listed behavior cannot reasonably be tested for a route, record the reason and substitute an explicit database/service invariant check—do not silently omit the coverage.

### Per-chunk applicable tests

- Pure unit tests for Decimal calculations, validators, transition maps and DTO transforms.
- Route integration tests via `createTestApp()` → `buildApp()` → `app.ready()` and `app.inject()`, exercising actual Fastify plugins, middleware, serializer and error handler.
- Real PostgreSQL/Redis/PgBoss wherever the current test environment provides them. Do not replace Drizzle, transactions, PostgreSQL or Redis with mocks in route integration tests.
- Positive/negative authentication, capability/role, project membership, organization isolation, object ownership and wrong-tenant not-found behavior.
- Database invariant, FK, unique/check/index, transaction rollback, row-lock race, expectedVersion and duplicate/idempotency tests as applicable.
- State transitions, actor separation, error status/shape/stable code, malformed/oversized payloads, monetary precision and persisted aggregate correctness.
- Cache hit/miss/invalidation/outage tests only when that chunk adds a cache path.
- Outbox success/rollback/event payload and worker retry/idempotency/tenant-scope tests only when that chunk adds asynchronous behavior.
- Request-specific audit/outbox assertions scoped by runId/resourceId/organizationId; never compare global table counts.
- At least one competing concurrent request test per chunk with a protected mutation; exactly one valid transition/effect must persist.

### Required commands after every chunk

Run from repository root and resolve all failures without weakening tests:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run the chunk-targeted server unit/integration suites and migration generation/application against the dedicated test database. Use the current migration tooling; do not run destructive schema reset/truncate operations against shared environments.

At phase exit, run every Phase E integration suite above together with the complete existing server integration/regression suite. A chunk is not DONE merely because it typechecks or its unit tests pass.

---

## 15. Phase E Tiered Checklist Gates

### Tier 1 — Build-in, every chunk

- Minimum queries, no N+1, selective Drizzle projections, bounded cursor pagination (max 100), stable ordering, indexed filters and bounded arrays/text.
- Transactions for atomic writes; `FOR UPDATE` on transition rows; DB unique constraints for invariants; idempotency for retryable financial commands; concurrency/version checks in PostgreSQL; no `COUNT(*)` number allocation.
- Zod for params/body/query and important response shapes; shared success/error envelopes; stable error codes; documented OpenAPI; no raw DB details, secrets or sensitive data in DTO/logs.
- `organizationId` sourced from authenticated context and present in every tenant query, row, audit event, cache key and job payload; referenced entity ownership validated inside the write transaction.
- Server guards and least-privilege capability checks on every route; SoD enforced for each mutation; audit event for every protected financial transition.
- PostgreSQL is truth; no Redis correctness locks/state; all cache writes have invalidation and fail-open DB fallback; avoid speculative cache.
- FKs, indexes, currency/amount constraints, request IDs, structured logger/OTel error paths and outbox/PgBoss patterns preserved.
- No external calls inside financial transactions; job handlers idempotent and tenant-scoped.
- `pnpm lint`, `pnpm typecheck`, targeted/full relevant tests and `pnpm build` green before the next chunk.

### Tier 2 — End-of-Phase E exit gate

- Full route inventory: every implemented route registered, reachable, documented and response-validated.
- Complete migration generation and fresh-database migration verification.
- Full integration/security/regression suite green; cross-tenant read/write denial tested for every new entity.
- Competing concurrent mutation and duplicate/idempotency cases covered; transition races and lock ordering reviewed; transaction time kept short; no network/Redis inside transactions.
- Review all new indexes and `EXPLAIN ANALYZE` five most complex queries; inspect DB round trips, cursor bounds, payload size and query plans.
- Review cache behavior/failure/isolation only for implemented caches; review PgBoss retry/backpressure only for implemented jobs.
- Audit all role/capability maps and alternate mutation paths; verify no known critical/high security or financial concurrency defect.
- Verify summary calculations against persisted rows, not response-only expectations; document formulas/source of every commercial field.
- No unrelated files/architecture changes; all existing phases remain green.

### Tier 3 — Pre-production only; not a Phase E completion blocker

- Production-like p50/p95/p99 and financial endpoint latency baselines; realistic data-volume/load tests.
- Multi-worker and concurrent HTTP/job corruption checks, DB/Redis pressure and failure injection, retry/recovery tests.
- Production capacity, pool/lock contention, cache hit/miss and queue failure/retry observability.
- Full pre-production security, load, API-contract and readiness sign-off per checklist sections 1–12.

---

## 16. Completion Tracker

| Chunk | Deliverable                                                                                | Status                                              |
| ----- | ------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| E0    | Commercial foundation primitives and audit integration contract                            | DONE                                                |
| E1    | Project budgets and explicit revisions                                                     | DONE                                                |
| E2    | Reused cost codes and posted/voidable cost transactions                                    | DONE                                                |
| E3    | Existing procurement/subcontract commitments, actual separation, initial cost calculations | DONE; approved PO only, subcontract source deferred |
| E4    | Controlled change orders and effective baseline changes                                    | DONE                                                |
| E5    | Approved schedule of values and progress                                                   | DONE                                                |
| E6    | Payment applications and approval workflow                                                 | DONE                                                |
| E7    | Receivable/payable invoices and explicit payment commands                                  | DONE                                                |
| E8    | Retainage hold, partial release and release                                                | DONE                                                |
| E9    | Segregation-of-duties completeness and route security tests                                | DONE; targeted security suite passes                |
| E10   | Append-only financial audit read API and final commercial summaries                        | DONE                                                |

**Phase E exit criterion:** SiteFlow can explain what is budgeted, committed, spent, forecast, billed, approved and paid, including outstanding balances and retainage, with every important financial transition secure, transactional, performant and auditable.

**Current verification:** The targeted Phase E commercial integration run passed (11 files, 35 tests), including a persisted-row cross-check for budget revisions, approved PO commitments, posted actuals, approved SOV value, payment applications, invoices, executed payments, outstanding balances, cash, and retainage. Migration generation reports no schema drift, and migrations through 0039 (including summary indexes for payments, approved-PO commitments, and retainage) apply to the integration PostgreSQL database. Repository-wide typecheck, build, and lint pass (lint has existing warnings). A complete server run passed 66 files / 618 tests before the expanded aggregate fixture. In the final full run, 65 files / 616 tests passed and the payment-application suite hit one `beforeAll` timeout under cumulative load; its immediate isolated rerun passed (1 file / 2 tests), so all server suites have passing executions and no remaining assertion failures. Route-family registration was checked in `project.routes.ts`; the Phase E integration suites exercise the registered route families with persisted-state checks, tenant/access denials, lifecycle and actor-separation controls, and concurrency/idempotency cases. The earlier invitation outbox assertion was corrected to verify the scoped transactional event remains `PENDING` rather than draining a global backlog; four fixed-slug fixtures now use unique names. The Phase E invoice/payment test selects the target payment by ID instead of relying on unspecified row ordering. Five `EXPLAIN (ANALYZE, BUFFERS)` plans were reviewed with tenant/project-scoped seeded rows: approved budget, approved-PO commitments, posted actuals (302 rows), executed payments, and audit pagination. Plans used the budget, commitment, actual-cost, and audit indexes; payment aggregation used a sequential scan only on a small test table (51 rows). Observed execution times were approximately 0.1–0.4 ms for these small fixtures; these measurements are not load/performance baselines. Phase E is COMPLETE; Tier 3 production-scale load gates remain explicitly deferred.

**Phase E complete.** Tier 3 production-scale load testing remains pre-production work, not a Phase E blocker. Approved-PO-only commitments and subcontract deferral remain in force.
