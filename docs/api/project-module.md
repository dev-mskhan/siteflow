# Project Module: Frontend API Integration Guide

Scope: all project-scoped endpoints under `/api/v1/organizations/:organizationId/projects/...`, defined in `apps/server/src/modules/project/project.routes.ts`. Status: summary depth. Endpoint inventory and permission strings are verified against route code. Field-level schemas are referenced by their Fastify schema name (`*SchemaDoc`) and must be read from `apps/server/src/modules/project/docs/` for exact types.

## 1. Scope

Projects and everything inside them: lifecycle, members, settings, phases, cost codes, tasks, calendar, dependencies, schedule, baselines, field logs, issues, subcontractors, material requests, quotes, procurement approvals, purchase orders, committed costs, deliveries, receipts, inventory, performance, plus the change-order, commercial-summary, and financial-summary sub-modules.

## 2. Integration Flow

1. Authenticate (`authenticate`), then organization context (`organizationContext`) resolves the `:organizationId` membership.
2. Project-scoped routes run `projectContext` before their permission check. The project must belong to the organization (tenant isolation).
3. Each route checks one permission with `requireProjectPermission(...)` (or `requirePermission(...)` for org-level create/list).
4. The handler runs business logic, then returns the response.

Sequence for a new project: `POST /projects` (creates in DRAFT), `POST .../activate` (DRAFT to ACTIVE), then phases, cost codes, tasks, and procurement flows.

## 3. Contract

Base path: `/api/v1/organizations/:organizationId/projects`

### Core project

| Method | Path | Permission | Schema doc |
|---|---|---|---|
| POST | `/` | `project:create` | createProjectSchemaDoc |
| GET | `/` | `project:read` | listProjectsSchemaDoc |
| GET | `/:projectId` | `project:read` | getProjectSchemaDoc |
| PATCH | `/:projectId` | `project:update` | updateProjectSchemaDoc |
| POST | `/:projectId/activate` | lifecycle guards | lifecycleSchemaDoc |
| POST | `/:projectId/hold` | lifecycle guards | lifecycleSchemaDoc |
| POST | `/:projectId/resume` | lifecycle guards | lifecycleSchemaDoc |
| POST | `/:projectId/complete` | lifecycle guards | lifecycleSchemaDoc |
| POST | `/:projectId/cancel` | lifecycle guards | lifecycleSchemaDoc |
| POST | `/:projectId/archive` | lifecycle guards | lifecycleSchemaDoc |

Lifecycle transitions: DRAFT to ACTIVE (activate), ACTIVE to ON_HOLD (hold), ON_HOLD to ACTIVE (resume), ACTIVE to COMPLETED (complete). Cancel and archive have their own terminal rules.

### Members, settings, phases, cost codes, audit

| Method | Path | Permission |
|---|---|---|
| GET / POST | `/:projectId/members` | `project:read` / `project:member:manage` |
| PATCH / DELETE | `/:projectId/members/:userId` | `project:member:manage` |
| GET / PATCH | `/:projectId/settings` | `project:read` / `project:settings:update` |
| GET / POST | `/:projectId/phases` | `project:read` / `project:phase:manage` |
| PATCH / DELETE | `/:projectId/phases/:phaseId` | `project:phase:manage` |
| POST | `/:projectId/phases/reorder` | `project:phase:manage` |
| GET / POST | `/:projectId/cost-codes` | `project:read` / `project:cost-code:manage` |
| PATCH / DELETE | `/:projectId/cost-codes/:codeId` | `project:cost-code:manage` |
| GET | `/:projectId/audit` | `project:audit:read` |

### Tasks, calendar, dependencies, schedule

| Method | Path | Permission |
|---|---|---|
| GET / POST | `/:projectId/tasks` | `project.task.read` / `project.task.create` |
| GET / PATCH / DELETE | `/:projectId/tasks/:taskId` | `project.task.read` / `project.task.update` / `project.task.delete` |
| POST | `/:projectId/tasks/:taskId/transition` | `project.task.update` |
| GET / PATCH | `/:projectId/calendar` | `project:read` / `project.calendar.manage` |
| POST | `/:projectId/calendar/exceptions` | `project.calendar.manage` |
| DELETE | `/:projectId/calendar/exceptions/:exceptionId` | `project.calendar.manage` |
| GET / POST | `/:projectId/dependencies` | `project.task.read` / `project.dependency.create` |
| DELETE | `/:projectId/dependencies/:dependencyId` | `project.dependency.delete` |
| POST | `/:projectId/schedule/recalculate` | `project.schedule.recalculate` |
| GET | `/:projectId/schedule/history` | `project:read` |
| GET | `/:projectId/schedule/metrics` | `project:read` |

### Baselines, field logs, issues

| Method | Path | Permission |
|---|---|---|
| GET / POST | `/:projectId/baselines` | `project.baseline.read` / `project.baseline.create` |
| GET / DELETE | `/:projectId/baselines/:baselineId` | `project.baseline.read` / `project.baseline.delete` |
| POST | `/:projectId/baselines/:baselineId/activate` | `project.baseline.activate` |
| GET | `/:projectId/baselines/:baselineId/compare` | `project.baseline.read` |
| GET / POST | `/:projectId/field-logs` | `project.field-log.read` / `project.field-log.create` |
| GET / PATCH | `/:projectId/field-logs/:logId` | `project.field-log.read` / `project.field-log.update` |
| POST | `/:projectId/field-logs/:logId/submit` | `project.field-log.submit` |
| POST | `/:projectId/field-logs/:logId/lock` | `project.field-log.lock` |
| GET / POST | `/:projectId/field-logs/:logId/amendments` | `project.field-log.read` / `project.field-log.lock` |
| GET | `/:projectId/field-logs/:logId/amendments/:amendmentId` | `project.field-log.read` |
| GET / POST | `/:projectId/issues` | `project.issue.read` / `project.issue.create` |
| GET / PATCH | `/:projectId/issues/:issueId` | `project.issue.read` / `project.issue.update` |
| POST | `/:projectId/issues/:issueId/transition` | `project.issue.transition` |

### Subcontractors and performance

| Method | Path | Permission |
|---|---|---|
| GET / POST | `/:projectId/subcontractors` | `project.subcontractor.read` / `project.subcontractor.create` |
| GET / PATCH / DELETE | `/:projectId/subcontractors/:subcontractorId` | read / update / update |
| POST | `/:projectId/subcontractors/:subcontractorId/contacts` | `project.subcontractor.update` |
| PATCH | `/:projectId/subcontractors/:subcontractorId/contacts/:contactId` | `project.subcontractor.update` |
| POST / DELETE | `/:projectId/subcontractors/:subcontractorId/task-assignments[/:taskId]` | `project.subcontractor.assign` |
| GET | `/:projectId/performance/suppliers/:supplierId` | `project.performance.read` |
| GET | `/:projectId/performance/subcontractors/:subcontractorId` | `project.performance.read` |

### Procurement chain

Each step has its own permission. Read the list in order.

| Area | Endpoints | Permissions |
|---|---|---|
| Material requests | list/create/get/update, `/submit`, `/cancel` | `project.material_request.*` |
| Quotes | list/create/get/update, `/submit`, `/accept`, `/reject` | `project.quote.*` |
| Procurement approvals | list/create/get, `/approve`, `/reject`, `/cancel` | `project.procurement_approval.*` |
| Purchase orders | list/create/get/update, `/submit`, `/approve`, `/send`, `/cancel` | `project.purchase_order.*` |
| Committed costs | list, get | `project.committed_cost.read` |
| Deliveries | list/create/get/update | `project.delivery.*` |
| Receipts | list/create/get, `/post`, `/void` | `project.receipt.*` |
| Inventory | list, get balance, list transactions, `/adjustments`, `/transfers` | `project.inventory.read` / `project.inventory.adjust` |

Change orders (`/change-orders`): create, read, update, `/submit`, `/approve`, `/client-approve`, `/effect`, `/void` under `project.change_order.*`.

Commercial summary: `project.budget.read`.
Financial summary: cost-summary, commitment-summary, billing-summary under the project financial-summary routes.
Retainage: `POST .../payment-applications/:paymentApplicationId/retainage/hold`.

Schema detail for each endpoint lives in the `*SchemaDoc` definitions under `apps/server/src/modules/project/docs/`.

## 4. Business Rules

- Project creation is gated by billing. `assertCanCreateProject` needs an ACTIVE subscription or trial, otherwise `NO_ENTITLEMENT`.
- Restricted billing state blocks project updates. `ACCESS_RESTRICTED` is returned before `NO_ENTITLEMENT`, and this check runs in `assertCanModifyProject` (10-19).
- Lifecycle transitions are server-enforced. The frontend should only offer transitions that are valid for the current status.
- Procurement chain order: material request, quote, approval, purchase order, delivery, receipt. Receipts post inventory and are voidable only through the void endpoint.
- Field logs follow draft, submitted, locked. Locked logs change only through amendments.

## 5. Frontend Guidance

- After any mutation, refetch the affected project resource and its list (for example, activate then refetch `GET /projects/:projectId`).
- Hide or disable actions whose permission the user lacks. The server remains the authority and returns 403 on violation.
- On `NO_ENTITLEMENT` or `ACCESS_RESTRICTED`, show a billing prompt and do not retry automatically.
- On 404 for a project, show "not found" and do not leak whether the project exists in another organization.
- Keep `organizationId` and `projectId` from the route when calling child endpoints. Do not infer them from response bodies.

## 6. Files Changed

- `apps/server/src/modules/project/project.routes.ts` (route inventory source)
- `apps/server/src/modules/project/docs/*.schemas.ts` (schema docs, referenced)
- `apps/server/src/modules/billing/entitlement.service.ts` (gates)

## 7. Verification

- Route list and permission strings: verified by reading `project.routes.ts` (grep of `preHandler` and route paths).
- Integration tests covering project creation and billing gates: `apps/server/tests/integration/project_core.test.ts` 25/25 passing (commit `aaa791f`).
- Not verified in this pass: individual field-level schemas, exact error envelope per endpoint, and response examples. Treat those as unverified until checked against the `*SchemaDoc` files.

## 8. Known Gaps

- Field-level request and response types are not inlined here. Read the `*SchemaDoc` files.
- Error codes beyond `NO_ENTITLEMENT` and `ACCESS_RESTRICTED` are not enumerated.
- Some sub-modules (change-order, commercial-summary, financial-summary, retainage) were listed from route paths only; their handlers were not read.

## 9. Compatibility Impact

No breaking changes in this pass. Documentation only.
