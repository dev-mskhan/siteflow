# Group 8 — Commercial & Financial Chain

**Status:** Not started  
**Priority:** 🔴 Critical — core revenue operations  
**Depends on:** Group 1 (project/budget), Group 4 (purchase orders for commitments), Group 7 (BOQ/SOV for payment apps)

---

## Backend Source Files

| File | Purpose |
|------|---------|
| `apps/server/src/modules/project/change-order/change-order.routes.ts` | Change order full lifecycle |
| `apps/server/src/modules/project/change-order/change-order.handler.ts` | Handlers |
| `apps/server/src/modules/project/schedule-of-values/schedule-of-values.routes.ts` | SOV CRUD + lifecycle |
| `apps/server/src/modules/project/payment-application/payment-application.routes.ts` | PA lifecycle |
| `apps/server/src/modules/project/invoice-payment/invoice-payment.routes.ts` | Invoices + Payments full lifecycle |
| `apps/server/src/modules/project/retainage/retainage.routes.ts` | Hold + release retainage |
| `apps/server/src/modules/project/cost-transaction/cost-transaction.routes.ts` | Manual cost journal |
| `apps/server/src/modules/project/cost-transaction/cost-transaction.schemas.ts` | Zod schemas |
| `apps/server/src/modules/project/commercial-summary/commercial-summary.routes.ts` | Read-only commercial totals |
| `apps/server/src/modules/project/financial-summary/financial-summary.routes.ts` | Read-only financial panels + audit |

---

## HTTP Routes

### Change Orders
```
POST   /:orgId/projects/:projectId/change-orders                              permission: project.change_order.create
GET    /:orgId/projects/:projectId/change-orders                              permission: project.change_order.read
GET    /:orgId/projects/:projectId/change-orders/:changeOrderId               permission: project.change_order.read
PATCH  /:orgId/projects/:projectId/change-orders/:changeOrderId               permission: project.change_order.update
POST   /:orgId/projects/:projectId/change-orders/:changeOrderId/submit        permission: project.change_order.submit
POST   /:orgId/projects/:projectId/change-orders/:changeOrderId/approve       permission: project.change_order.approve
POST   /:orgId/projects/:projectId/change-orders/:changeOrderId/client-approve permission: project.change_order.client_approve
POST   /:orgId/projects/:projectId/change-orders/:changeOrderId/reject        permission: project.change_order.approve
POST   /:orgId/projects/:projectId/change-orders/:changeOrderId/effect        permission: project.change_order.effect
POST   /:orgId/projects/:projectId/change-orders/:changeOrderId/void          permission: project.change_order.void
```

### Schedule of Values
```
POST   /:orgId/projects/:projectId/schedule-of-values                                    permission: project.schedule_of_values.create
GET    /:orgId/projects/:projectId/schedule-of-values                                    permission: project.schedule_of_values.read
GET    /:orgId/projects/:projectId/schedule-of-values/:scheduleOfValuesId                permission: project.schedule_of_values.read
PATCH  /:orgId/projects/:projectId/schedule-of-values/:scheduleOfValuesId                permission: project.schedule_of_values.update
POST   /:orgId/projects/:projectId/schedule-of-values/:scheduleOfValuesId/submit         permission: project.schedule_of_values.submit
POST   /:orgId/projects/:projectId/schedule-of-values/:scheduleOfValuesId/approve        permission: project.schedule_of_values.approve
GET    /:orgId/projects/:projectId/schedule-of-values/:scheduleOfValuesId/progress       permission: project.schedule_of_values.read
```

### Payment Applications
```
POST   /:orgId/projects/:projectId/payment-applications                                      permission: project.payment_application.create
GET    /:orgId/projects/:projectId/payment-applications                                      permission: project.payment_application.read
GET    /:orgId/projects/:projectId/payment-applications/:paymentApplicationId                permission: project.payment_application.read
PATCH  /:orgId/projects/:projectId/payment-applications/:paymentApplicationId                permission: project.payment_application.update
POST   /:orgId/projects/:projectId/payment-applications/:paymentApplicationId/submit         permission: project.payment_application.submit
POST   /:orgId/projects/:projectId/payment-applications/:paymentApplicationId/under-review   permission: project.payment_application.review
POST   /:orgId/projects/:projectId/payment-applications/:paymentApplicationId/approve        permission: project.payment_application.approve
POST   /:orgId/projects/:projectId/payment-applications/:paymentApplicationId/reject         permission: project.payment_application.approve
POST   /:orgId/projects/:projectId/payment-applications/:paymentApplicationId/void           permission: project.payment_application.void
```

### Invoices
```
POST   /:orgId/projects/:projectId/invoices                            permission: project.invoice.create
GET    /:orgId/projects/:projectId/invoices                            permission: project.invoice.read
GET    /:orgId/projects/:projectId/invoices/:invoiceId                 permission: project.invoice.read
PATCH  /:orgId/projects/:projectId/invoices/:invoiceId                 permission: project.invoice.update
POST   /:orgId/projects/:projectId/invoices/:invoiceId/submit          permission: project.invoice.submit
POST   /:orgId/projects/:projectId/invoices/:invoiceId/approve         permission: project.invoice.approve
POST   /:orgId/projects/:projectId/invoices/:invoiceId/reject          permission: project.invoice.reject
POST   /:orgId/projects/:projectId/invoices/:invoiceId/void            permission: project.invoice.void
```

### Payments (nested under invoice)
```
POST   /:orgId/projects/:projectId/invoices/:invoiceId/payments        permission: project.payment.create
GET    /:orgId/projects/:projectId/payments                            permission: project.payment.read
GET    /:orgId/projects/:projectId/payments/:paymentId                 permission: project.payment.read
POST   /:orgId/projects/:projectId/payments/:paymentId/submit          permission: project.payment.submit
POST   /:orgId/projects/:projectId/payments/:paymentId/approve         permission: project.payment.approve
POST   /:orgId/projects/:projectId/payments/:paymentId/reject          permission: project.payment.reject
POST   /:orgId/projects/:projectId/payments/:paymentId/execute         permission: project.payment.execute  (idempotency-key header required)
POST   /:orgId/projects/:projectId/payments/:paymentId/void            permission: project.payment.void
```

### Retainage
```
GET    /:orgId/projects/:projectId/retainage                                                                        permission: project.retainage.read
POST   /:orgId/projects/:projectId/payment-applications/:paymentApplicationId/retainage/hold   permission: project.retainage.hold  (idempotency-key required)
GET    /:orgId/projects/:projectId/retainage/:retainageId/releases                             permission: project.retainage.read
POST   /:orgId/projects/:projectId/retainage/:retainageId/release                              permission: project.retainage.release (idempotency-key required)
```

### Cost Transactions
```
POST   /:orgId/projects/:projectId/cost-transactions                         permission: project.cost_transaction.create
GET    /:orgId/projects/:projectId/cost-transactions                         permission: project.cost_transaction.read
GET    /:orgId/projects/:projectId/cost-transactions/:transactionId          permission: project.cost_transaction.read
POST   /:orgId/projects/:projectId/cost-transactions/:transactionId/post     permission: project.cost_transaction.post
POST   /:orgId/projects/:projectId/cost-transactions/:transactionId/void     permission: project.cost_transaction.void
```

### Commercial & Financial Summaries (read-only)
```
GET    /:orgId/projects/:projectId/commercial-summary                        permission: project.budget.read
GET    /:orgId/projects/:projectId/cost-codes/:costCodeId/commercial-summary permission: project.budget.read
GET    /:orgId/projects/:projectId/financial-summary                         permission: project.financial_summary.read
GET    /:orgId/projects/:projectId/cost-summary                              permission: project.financial_summary.read
GET    /:orgId/projects/:projectId/commitment-summary                        permission: project.financial_summary.read
GET    /:orgId/projects/:projectId/billing-summary                           permission: project.financial_summary.read
GET    /:orgId/projects/:projectId/cash-summary                              permission: project.financial_summary.read
GET    /:orgId/projects/:projectId/financial-audit                           permission: project.financial_audit.read  (cursor paginated)
GET    /:orgId/projects/:projectId/change-orders/:changeOrderId/audit        permission: project.financial_audit.read
```

---

## Key Validation Notes

### Change Order transitions
- All lifecycle POSTs require `{ expectedVersion: int >= 1 }` in body
- `reject` requires `{ expectedVersion, reason: string min:1 max:500 }`
- `effect` applies approved CO to project budget — irreversible
- `void` only allowed before `effect`

### Payment Application transitions
- `submit`, `under-review`, `void` require `{ expectedVersion }`
- `approve` body is open (may include partial approval amounts)
- `reject` requires `{ expectedVersion, reason }`

### Invoice / Payment transitions
- All require `{ expectedVersion }`
- `execute` (payment) additionally requires `idempotency-key` header (prevents double execution)
- `reject` requires `{ expectedVersion, reason }`

### Retainage
- `hold` and `release` require `idempotency-key` header
- `release` requires `{ expectedVersion, amount: decimal pattern, reason: string min:1 max:500 }`

### Cost Transaction (from `cost-transaction.schemas.ts`)
- `create`: costCodeId*, amount* (decimal), currencyCode*, description*, transactionDate* (YYYY-MM-DD), reference? string
- `post`/`void`: simple POST with no body (or expectedVersion)

### Commercial Summary Response Shape (from `commercial-summary.routes.ts`)
```
currencyBreakdown[]: {
  currencyCode, originalBudget, approvedBudgetChanges, revisedBudget,
  committed, postedActual, forecast?, variance?,
  approvedRevisionNumber?
}
forecastBasis?, forecastUnavailableReason, commitmentCoverage, subcontractCommitments, invoiceLifecycleCoverage
```

---

## State Machines

### Change Order
```
DRAFT → PENDING_APPROVAL (submit) → INTERNALLY_APPROVED (approve) → CLIENT_APPROVED (client-approve) → EFFECTED (effect)
Any non-EFFECTED → VOIDED (void)
Any non-void → REJECTED → DRAFT
```

### Payment Application
```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED → VOID
```

### Invoice
```
DRAFT → SUBMITTED → APPROVED | REJECTED → VOID
```

### Payment
```
DRAFT → SUBMITTED → APPROVED | REJECTED → EXECUTED → VOID
```

---

## Frontend Pages to Build

### 8.1 `ProjectChangeOrdersPage` — `.../change-orders`
- Table + status filter tabs + inline create form
- Per-row lifecycle actions: submit, approve, client-approve, reject, effect, void
- expectedVersion handling: store in RTK Query cache, send with mutations
- "Effect applied" toast with budget impact message

### 8.2 `ProjectScheduleOfValuesPage` — `.../schedule-of-values`
- List SOVs, create new, submit/approve lifecycle
- SOV detail: line items, progress view, billing percentages

### 8.3 `ProjectPaymentApplicationsPage` — `.../payment-applications`
- List + create + full lifecycle pipeline (submit→under-review→approve/reject→void)

### 8.4 `ProjectInvoicesPage` — `.../invoices`
- Invoice list + create + lifecycle (submit→approve/reject→void)
- Invoice detail includes linked payment list

### 8.5 `ProjectPaymentsPage` — `.../payments`
- Standalone list of all project payments
- Per-payment: status, linked invoice, amount, execute button (with idempotency-key generation)

### 8.6 `ProjectRetainagePage` — `.../retainage`
- Retainage held summary, release history, release button

### 8.7 `ProjectCostTransactionsPage` — `.../cost-transactions`
- Manual journal: create entry, list, post (commit to ledger), void

### 8.8 `ProjectCommercialSummaryPage` — `.../commercial-summary`
- Currency breakdown table: originalBudget | approvedChanges | revisedBudget | committed | actual | forecast | variance
- Per cost-code drill-down links

### 8.9 `ProjectFinancialSummaryPage` — `.../financial-summary`
- Tabbed: Cost | Commitments | Billing | Cash
- Financial audit log (paginated)

---

## Frontend Files to Create

```
apps/web/src/types/changeOrderTypes.ts
apps/web/src/types/sovTypes.ts
apps/web/src/types/paymentApplicationTypes.ts
apps/web/src/types/invoiceTypes.ts
apps/web/src/types/retainageTypes.ts
apps/web/src/types/costTransactionTypes.ts
apps/web/src/types/financialSummaryTypes.ts
apps/web/src/fixtures/commercial.fixtures.ts
apps/web/src/api/changeOrderApi.ts
apps/web/src/api/sovApi.ts
apps/web/src/api/paymentApplicationApi.ts
apps/web/src/api/invoiceApi.ts
apps/web/src/api/retainageApi.ts
apps/web/src/api/costTransactionApi.ts
apps/web/src/api/financialSummaryApi.ts
apps/web/src/pages/commercial/ProjectChangeOrdersPage.tsx
apps/web/src/pages/commercial/ProjectSOVPage.tsx
apps/web/src/pages/commercial/ProjectPaymentApplicationsPage.tsx
apps/web/src/pages/commercial/ProjectInvoicesPage.tsx
apps/web/src/pages/commercial/ProjectPaymentsPage.tsx
apps/web/src/pages/commercial/ProjectRetainagePage.tsx
apps/web/src/pages/commercial/ProjectCostTransactionsPage.tsx
apps/web/src/pages/commercial/ProjectCommercialSummaryPage.tsx
apps/web/src/pages/commercial/ProjectFinancialSummaryPage.tsx
apps/web/src/pages/commercial/CommercialShell.tsx
```

ProjectShell nav addition: **Commercial** (sub-shell with tabs)

---

## Critical Implementation Notes
- **idempotency-key** for payment execute + retainage: generate UUID on frontend, pass as header `idempotency-key: <uuid>`
- **expectedVersion** is essential for all lifecycle transitions — the RTK Query mutation must read it from the cached entity before calling
- The `effect` action on change orders is **irreversible** — show a confirmation dialog with impact summary before calling
- Financial summary endpoints are read-only aggregations — no mutations, no cache invalidation needed except on project-level changes
