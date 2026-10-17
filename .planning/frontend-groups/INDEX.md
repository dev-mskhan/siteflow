# Frontend Groups — Master Index

Generated after deep audit of all server modules in:
- `apps/server/src/modules/project/` (42 sub-modules)
- `apps/server/src/modules/notification/`
- `apps/server/src/modules/reporting/`
- `apps/server/src/modules/ai/` (deferred)

## Already Built (Groups 1–4)

| Group | Status | Screens |
|-------|--------|---------|
| Group 1 — Auth, Onboarding, Org Shell | ✅ Done | Login, Register, Verify-email, Forgot/Reset password, Org dashboard, Members, Settings (general/profile/sequences/audit) |
| Group 2 — Project Core | ✅ Done | Projects list, Overview, Phases, Cost-codes, Budget, Team, Project Settings |
| Group 3 — Field Operations | ✅ Done | Field logs (list+detail+amendments), Issues (list+detail) |
| Group 4 — Procurement Chain | ✅ Done | Material requests, Quotes, Purchase orders, Approvals, Deliveries+Receipts, Committed costs, Inventory ledger |

## Remaining Groups

| Group | File | Priority | Screens | Key Backend |
|-------|------|----------|---------|-------------|
| **Group 5** | `GROUP-05-schedule-tasks.md` | 🔴 Critical | Tasks (WBS list+detail), Baselines, Calendar, Dependencies, Schedule metrics | `task.handler.ts`, `task.schemas.ts` (@siteflow/shared), `baseline.handler.ts`, `calendar.handler.ts`, `dependency.handler.ts` |
| **Group 6** | `GROUP-06-subcontractors.md` | 🔴 Critical | Project subcontractors (assign+contacts+task assignments), Supplier+sub performance | `subcontractor.handler.ts`, `performance.handler.ts` |
| **Group 7** | `GROUP-07-preconstruction.md` | 🟠 High | Tenders, Proposals, Takeoffs, Estimates, BOQ, Pricing rates | `proposal.routes.ts`, `takeoff.routes.ts`, `estimate.routes.ts`, `boq.routes.ts`, `pricing.routes.ts` |
| **Group 8** | `GROUP-08-commercial-financial.md` | 🔴 Critical | Change orders, SOV, Payment apps, Invoices, Payments, Retainage, Cost transactions, Commercial/Financial summaries | `change-order.routes.ts`, `payment-application.routes.ts`, `invoice-payment.routes.ts`, `retainage.routes.ts`, `cost-transaction.routes.ts` |
| **Group 9** | `GROUP-09-documents.md` | 🟠 High | Documents list+detail, S3 two-phase upload, version history | `document.routes.ts` |
| **Group 10** | `GROUP-10-hse-quality-compliance.md` | 🟡 Medium | Safety events+meetings, Quality inspections+deficiencies+corrective actions, Permits+compliance records+compliance inspections, Expiring items | `safety.routes.ts`, `quality.routes.ts`, `compliance.routes.ts` |
| **Group 11** | `GROUP-11-rfi-submittals.md` | 🟡 Medium | RFI list+detail, Submittal list+detail+revisions | `rfi.routes.ts`, `submittal.routes.ts` |
| **Group 12** | `GROUP-12-reporting.md` | 🟡 Medium | Portfolio report, Project health/schedule/cost/procurement/subcontractor/executive-summary | `report.routes.ts` |
| **Group 13** | `GROUP-13-notifications-realtime.md` | 🔴 Critical infrastructure | SSE hook, Notification bell, RTK Query invalidation map | `realtime.plugin.ts`, `notification.routes.ts` |
| **AI (deferred)** | *(later)* | 🔵 Deferred | AI runs list+detail, AI approvals | `agent-run.routes.ts`, `approval.routes.ts` |

## Total Remaining: 54 screens + 3 infrastructure components

## Build Order Recommendation

```
Group 13 (SSE/notifications)  ← infrastructure, do first
  ↓
Group 5 (Tasks/Schedule)      ← core project execution
  ↓
Group 6 (Subcontractors)      ← extends Group 5 task assignments
  ↓
Group 9 (Documents)           ← referenced by 10, 11 (document attachments)
  ↓
Group 11 (RFI/Submittals)     ← uses documents
  ↓
Group 8 (Commercial)          ← depends on Group 4 procurement data
  ↓
Group 7 (Pre-construction)    ← can run parallel with 8
  ↓
Group 10 (HSE/Quality/Compliance) ← uses documents, can run parallel
  ↓
Group 12 (Reporting)          ← reads from everything above
```

## Common Patterns Across All Groups

### Auth required for all app routes
All protected routes use `authenticate + organizationContext` preHandlers. The frontend `RequireAuth` guard handles this.

### Permission system
Server: `requireProjectPermission(capability)` checks `project_members.permissions JSONB` array.  
Frontend: `usePermission(key)` from `features/org/usePermission.ts` (via `hooks/usePermission.ts`).  
Update `lib/permissions.ts` `ROLE_PERMISSIONS` map for each new permission key added.

### Optimistic locking
Entities with `version` field: Tasks, Change Orders, SOV, Payment Applications, Invoices, Payments  
All mutations on these require `expectedVersion: int >= 1` in body.  
On 409 conflict: toast "Someone else modified this. Refresh and retry."

### Design system (STRICT — no deviations)
```
Background:  bg-[var(--paper)] / bg-[var(--surface-2)]
Borders:     border border-[var(--hairline-2)]   NO rounded-* NO shadow-*
Labels:      font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]
Text muted:  text-[var(--muted)]
Primary btn: bg-[var(--ink)] text-white hover:-translate-y-0.5
Secondary:   border border-[var(--hairline-2)] hover:bg-[var(--surface-2)]
Status badges: font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5
Skeleton:    h-{N} animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]
```

### mockBaseQuery
All new RTK Query createApi slices must import from `api/mockBaseQuery.ts`:
```ts
import { mockBaseQuery } from './mockBaseQuery';
```

### Error handling
Inline errors (409, 422, 400):
```tsx
{isInlineError(err) && <InlineAlert variant="error" message={getServerError(err)?.message ?? 'Error'} />}
```
Toast errors (429, 403, 500, network):
```ts
toastErr('Action failed', toastErrorMessage(err))
```

### Store registration
After creating each new `*Api.ts` slice, add to `apps/web/src/app/store.ts`:
```ts
// reducer
[newApi.reducerPath]: newApi.reducer,
// middleware
newApi.middleware,
```

### ProjectShell nav
Each new group that adds project-level tabs must update:
`apps/web/src/pages/app/project/ProjectShell.tsx`
