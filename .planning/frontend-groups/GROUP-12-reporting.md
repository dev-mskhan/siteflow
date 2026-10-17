# Group 12 — Reporting

**Status:** Not started  
**Priority:** 🟡 Medium — read-only management views  
**Depends on:** All previous groups (reporting aggregates data from all modules)

---

## Backend Source Files

| File | Purpose |
|------|---------|
| `apps/server/src/modules/reporting/report.routes.ts` | All report routes + permission requirements |
| `apps/server/src/modules/reporting/report.handlers.ts` | Handlers for all 7 report types |
| `apps/server/src/modules/reporting/docs/report.api.schemas.ts` | Full response schema docs |

---

## HTTP Routes

### Org-level (no project)
```
GET    /:orgId/reports/portfolio                              preHandler: authenticate + organizationContext
  No additional permissions beyond org membership
```

### Project-level (all require project:read + specific capability)
```
GET    /:orgId/projects/:projectId/reports/health             permissions: project.task.read, project.issue.read, project.rfi.read
GET    /:orgId/projects/:projectId/reports/schedule           permissions: project.task.read, project.baseline.read
GET    /:orgId/projects/:projectId/reports/cost               permissions: project.financial_summary.read
GET    /:orgId/projects/:projectId/reports/procurement        permissions: project.material_request.read, project.purchase_order.read, project.delivery.read, project.receipt.read, project.inventory.read
GET    /:orgId/projects/:projectId/reports/subcontractor      permissions: project.subcontractor.read, project.task.read, project.purchase_order.read
GET    /:orgId/projects/:projectId/reports/executive-summary  permissions: project.task.read + project.issue.read + project.rfi.read + project.baseline.read + project.financial_summary.read + project.material_request.read + project.purchase_order.read + project.delivery.read + project.receipt.read + project.inventory.read
```

All project-level also require `project:read` base permission via `projectContext` middleware.

---

## Report Response Shapes (from `report.api.schemas.ts`)

### Portfolio Report (`GET /:orgId/reports/portfolio`)
Aggregated across all org projects:
```
{
  generatedAt: ISO datetime,
  projects: Array<{
    id, name, projectNumber, status,
    plannedStartDate?, plannedEndDate?,
    scheduleHealth: 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN',
    budgetHealth: 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN',
    overallHealth: 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN',
    taskStats: { total, completed, inProgress, blocked, overdue },
    openIssues: number,
    openRFIs: number,
  }>
}
```

### Health Report (`GET .../reports/health`)
```
{
  generatedAt: ISO datetime,
  scheduleHealth: 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN',
  budgetHealth: 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN',
  taskStats: { total, notStarted, inProgress, blocked, completed, cancelled, overdue },
  openIssues: number,
  openRFIs: number,
  criticalRFIs: number,
  openSafetyEvents: number,
}
```

### Schedule Report (`GET .../reports/schedule`)
```
{
  generatedAt: ISO datetime,
  baselineComparison: {
    baselineId?, baselineName?,
    plannedStartDate?, plannedEndDate?,
    currentStartDate?, currentEndDate?,
    startVarianceDays?: number,
    endVarianceDays?: number,
  },
  schedulePerformanceIndex?: number,  // SPI = earned / planned
  taskStats: { total, completed, inProgress, notStarted, overdue, criticalPath },
  milestones: Array<{ id, name, plannedDate?, currentDate?, status, varianceDays? }>,
}
```

### Cost Report (`GET .../reports/cost`)
Delegates to `financial-summary` service:
```
{
  generatedAt: ISO datetime,
  currencyBreakdown: Array<{
    currencyCode,
    originalBudget, approvedBudgetChanges, revisedBudget,
    committed, postedActual, forecast?, variance?,
  }>,
  costPerformanceIndex?: number,  // CPI = earned / actual
}
```

### Procurement Report (`GET .../reports/procurement`)
```
{
  generatedAt: ISO datetime,
  materialRequests: { total, draft, submitted, approved, ordered, fulfilled, cancelled },
  purchaseOrders: { total, draft, pendingApproval, approved, sent, received, cancelled, totalCommittedAmount: string },
  deliveries: { total, scheduled, delivered, cancelled },
  receipts: { total, draft, posted, voided },
  inventoryItemCount: number,
}
```

### Subcontractor Report (`GET .../reports/subcontractor`)
```
{
  generatedAt: ISO datetime,
  subcontractors: Array<{
    subcontractorId, displayName, trade?,
    assignedTaskCount: number,
    completedTaskCount: number,
    lateTaskCount: number,
    lateDeliveryCount: number,
    receiptRejectionCount: number,
    onTimeRate?: number,  // 0-1
  }>,
}
```

### Executive Summary (`GET .../reports/executive-summary`)
Combines health + schedule + cost + procurement sections into one payload.

---

## Frontend Pages to Build

### 12.1 `PortfolioReportPage` — `/org/:orgId/reports/portfolio`
- Org-level page (in AppLayout, outside project shell)
- Grid/table of projects: name | status | scheduleHealth | budgetHealth | overallHealth | taskStats | openIssues
- Health indicator: colored dot (GREEN/AMBER/RED)
- Click project → navigate to that project's executive summary
- Navigation: sidebar link "Portfolio" under org nav

### 12.2 `ProjectReportsShell` — `.../reports` (sub-nav)
A shell with tabs: Health | Schedule | Cost | Procurement | Subcontractors | Executive

### 12.3 `ProjectHealthReportPage` — `.../reports/health`
- KPI cards: taskStats donut, openIssues, openRFIs, criticalRFIs, openSafetyEvents
- Schedule health + budget health indicator chips

### 12.4 `ProjectScheduleReportPage` — `.../reports/schedule`
- Baseline comparison table: planned vs current dates, variance in days
- SPI metric card
- Task completion bar (notStarted/inProgress/completed/overdue)
- Milestones table with status and variance

### 12.5 `ProjectCostReportPage` — `.../reports/cost`
- Per-currency table: originalBudget | changes | revisedBudget | committed | actual | forecast | variance
- CPI metric card
- Variance column: green when positive, red when negative

### 12.6 `ProjectProcurementReportPage` — `.../reports/procurement`
- Summary cards: MR stats, PO stats, delivery stats, receipt stats, inventory count
- Total committed amount prominently displayed

### 12.7 `ProjectSubcontractorReportPage` — `.../reports/subcontractor`
- Table per subcontractor: name | tasks assigned/completed/late | deliveries late | rejections | on-time rate
- On-time rate shown as a progress bar

### 12.8 `ProjectExecutiveSummaryPage` — `.../reports/executive-summary`
- Dashboard combining all report sections in a single-page scrollable report
- Print-friendly layout (CSS print media query)

---

## Frontend Files to Create

```
apps/web/src/types/reportTypes.ts
apps/web/src/fixtures/reports.fixtures.ts
apps/web/src/api/reportApi.ts
apps/web/src/pages/PortfolioReportPage.tsx
apps/web/src/pages/reports/ProjectReportsShell.tsx
apps/web/src/pages/reports/ProjectHealthReportPage.tsx
apps/web/src/pages/reports/ProjectScheduleReportPage.tsx
apps/web/src/pages/reports/ProjectCostReportPage.tsx
apps/web/src/pages/reports/ProjectProcurementReportPage.tsx
apps/web/src/pages/reports/ProjectSubcontractorReportPage.tsx
apps/web/src/pages/reports/ProjectExecutiveSummaryPage.tsx
```

Router additions:
- Org-level: `{ path: 'reports/portfolio', element: <PortfolioReportPage /> }`
- Project-level: `{ path: 'reports', element: <ProjectReportsShell />, children: [...] }`

AppLayout nav addition: **Portfolio** (org-level)  
ProjectShell nav addition: **Reports** (project-level)

---

## Notes
- All report endpoints are **GET only** — pure read, no mutations, no RTK Query cache invalidation needed
- Use `refetchOnMountOrArgChange: 300` (5-min cache) — reports are expensive aggregations
- Reports are generated server-side on request; no stored snapshots
- For portfolio report, handle permission gracefully: user sees only projects they have `project:read` on
- Print view: wrap in `<div className="print:block">` and add `@media print` CSS for clean PDF export
