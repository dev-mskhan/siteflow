# F.0 Repository and Contract Audit Baseline

**Phase:** 08-phase-f-reporting-and-downloads  
**Plan:** 08-01  
**Status:** Completed Baseline Audit  
**Date:** 2026-10-08  

---

## 1. Domain Event & Outbox Infrastructure Audit

### Existing Transaction & Outbox Flow
- **Outbox Service:** `apps/server/src/lib/outbox/outbox.service.ts`
- **Queue System:** `apps/server/src/lib/queue/queue.ts` & `apps/server/src/lib/queue/worker-factory.ts`
- **Worker Process:** `apps/server/src/worker.ts`
- **Transaction Atomicity:** Domain mutations and outbox records are inserted within Drizzle database transactions (`db.transaction(...)`).
- **PgBoss Queue Integration:** PgBoss manages queue jobs, background retry logic, and dead-letter queues.

### Event Envelope Contract
- **Versioned Envelope:** Standardized envelope with `id`, `name`, `version`, `occurredAt`, `organizationId`, optional `projectId`, `actor`, `entityType`, `entityId`, `correlationId`, `causationId`, and `payload`.
- **Tenant Scope:** Mandatory `organizationId` propagation across every event record and handler.

---

## 2. Event Vocabulary Mapping (20 Events)

| # | Event Name | Source Workflow / Entity | Implementation State |
|---|------------|-------------------------|---------------------|
| 1 | `TaskCompleted` | Project Task Execution | Verified |
| 2 | `TaskDelayed` | Schedule Execution / Baseline | Verified |
| 3 | `TaskDateChanged` | Task Date Update | Verified |
| 4 | `MaterialOrdered` | Procurement Purchase Order | Verified |
| 5 | `MaterialDelayed` | Material Order Tracking | Verified |
| 6 | `MaterialDelivered` | Inventory & Goods Received | Verified |
| 7 | `IssueCreated` | Site Issue Log | Verified |
| 8 | `IssueResolved` | Site Issue Log | Verified |
| 9 | `RfiCreated` | RFI / Technical Query | Verified |
| 10 | `RfiOverdue` | RFI Scheduled Job | Verified |
| 11 | `SubmittalSubmitted` | Technical Submittal | Verified |
| 12 | `SubmittalRejected` | Technical Submittal | Verified |
| 13 | `InspectionScheduled` | Field Quality Inspection | Verified |
| 14 | `InspectionFailed` | Field Quality Inspection | Verified |
| 15 | `ChangeOrderCreated` | Commercial Change Order | Verified |
| 16 | `ChangeOrderApproved` | Commercial Change Order | Verified |
| 17 | `PaymentApplicationSubmitted` | Schedule of Values / Payment | Verified |
| 18 | `PaymentOverdue` | Commercial Payment Job | Verified |
| 19 | `DocumentExpiring` | Document Management | Verified |
| 20 | `SafetyIncidentCreated` | Field Safety Log | Verified |

---

## 3. Realtime & Notification Channel Architecture

### Realtime Branch (D-02)
- **Transport Decision:** Fastify Server-Sent Events (SSE) native one-way transport.
- **Security:** Subscription and stream delivery re-verify `organizationId` and project membership for every event before push.

### Email Channel
- **Template Engine:** HTML/Text template rendering with safe variable escaping.
- **Provider Abstraction:** Replaceable SMTP / Nodemailer adapter.
- **Sanitization:** Strict prevention of credentials, tokens, or raw financial secrets in email bodies.

### Preferences & Hierarchy
- Preference Resolution: User settings → Project defaults → Organization defaults.
- Preference scope controls delivery channels (email, in-app, SSE) without suppressing domain event publishing to outbox/audit.

---

## 4. Reporting Metric Sources & Boundaries (F.11 – F.16)

| Report Family | Primary Source Module | Metric Definitions & Date Semantics |
|---------------|----------------------|-----------------------------------|
| **Project Executive Summary (F.11)** | `apps/server/src/modules/project/core` | Multi-perspective snapshot; transparent indicators with "as of" timestamp. |
| **Daily Site Activity (F.12)** | `apps/server/src/modules/project/schedule-execution` | Field logs, labor hours, weather, issues, safety incidents. Date-range filter. |
| **Commercial Financial (F.13)** | `apps/server/src/modules/commercial` | Budgets, change orders, commitments, actual costs. Distinct financial concepts. |
| **Schedule Variance & Progress (F.14)** | `apps/server/src/modules/project/schedule-metrics` | Total/completed tasks, critical path, schedule variance, milestone dates. |
| **Subcontractor Performance (F.15)** | `apps/server/src/modules/project/partners` | Partner allocations, purchase orders, task completions, inspection outcomes. |
| **Unified Portfolio API (F.16)** | Cross-module aggregation | Bounded cursor pagination, tenant-isolated multi-project aggregation. |

---

## 5. Export & Storage Lifecycle (D-01 & D-03)

- **Format (D-01):** CSV-only exports in Phase 8. PDF and XLSX rendering are deferred.
- **Artifact Retention (D-03):** 24 hours retention for generated MinIO CSV objects.
- **Signed Download URL (D-03):** 5-minute pre-signed URL validity. Re-verifies tenant authorization on issuance.
- **Queue & Workers:** Sync for small exports (<100ms); PgBoss background worker (`apps/server/src/worker.ts`) for async exports.

---

## 6. Test Tier Strategy

- **Tier 1 (Per-Chunk Build-In):** `pnpm --filter @siteflow/server test`, `typecheck`, `lint` after every plan execution.
- **Tier 2 (End-of-Phase Gate):** Complete integration test suite (`pnpm --filter @siteflow/server test`) covering multi-tenant isolation, RBAC, outbox idempotency, and CSV exports.
- **Tier 3 (Pre-Production Load Testing):** High-volume outbox queue performance and large CSV export benchmarks.

---

## 7. Audit Verification Confirmation

- Schedule metrics multi-tenant scope fix (`organization_id`, `project_id`) has been verified and committed (`f63e949`).
- All 20 event names mapped to source workflows without fabricated states.
- All report families backed by authoritative Drizzle database modules.
