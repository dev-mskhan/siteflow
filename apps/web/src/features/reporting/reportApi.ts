/**
 * reportApi — Live integration for reporting endpoints.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * All reports are read-only GET endpoints with 5-minute cache.
 */
import { baseApi } from '../../services/baseApi';
import type {
  PortfolioReportDTO,
  HealthReportDTO,
  ScheduleReportDTO,
  CostReportDTO,
  ProcurementReportDTO,
  SubcontractorReportDTO,
  ExecutiveSummaryDTO,
} from '../../types/reportTypes';

interface OrgArgs {
  orgId: string;
}

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export function transformHealthReport(raw: any): HealthReportDTO {
  const d = raw?.data ?? raw ?? {};
  if (d.taskStats && d.scheduleHealth) return d;
  const inner = d.data ?? d;

  const totalTasks = inner.tasks?.totalTasks ?? inner.schedule?.totalTasks ?? 0;
  const completedTasks = inner.tasks?.completedTasks ?? inner.schedule?.completedTasks ?? 0;
  const inProgress = Math.max(0, totalTasks - completedTasks);

  const openIssues = inner.issues?.openIssues ?? 0;
  const openRFIs = inner.rfis?.openRfis ?? 0;
  const overdueRFIs = inner.rfis?.overdueRfis ?? 0;

  const scheduleHealth: HealthReportDTO['scheduleHealth'] =
    inner.scheduleHealth ??
    (inner.schedule?.completionRate >= 0.8
      ? 'GREEN'
      : inner.schedule?.completionRate >= 0.5
      ? 'AMBER'
      : totalTasks === 0
      ? 'GREEN'
      : 'AMBER');
  const budgetHealth: HealthReportDTO['budgetHealth'] = inner.budgetHealth ?? 'GREEN';

  return {
    generatedAt: d.asOf ?? d.generatedAt ?? new Date().toISOString(),
    scheduleHealth,
    budgetHealth,
    taskStats: {
      total: totalTasks,
      completed: completedTasks,
      inProgress,
      overdue: 0,
      notStarted: 0,
      blocked: 0,
    },
    openIssues,
    openRFIs,
    criticalRFIs: overdueRFIs,
    openSafetyEvents: inner.openSafetyEvents ?? 0,
  };
}

export function transformScheduleReport(raw: any): ScheduleReportDTO {
  const d = raw?.data ?? raw ?? {};
  if (d.baselineComparison && d.taskStats) return d;
  const inner = d.data ?? d;
  const summary = inner.summary ?? {};
  const total = summary.totalTasks ?? 0;
  const completed = summary.completedTasks ?? 0;
  const inProgress = Math.max(0, total - completed);

  return {
    generatedAt: d.asOf ?? d.generatedAt ?? new Date().toISOString(),
    baselineComparison: inner.baselineComparison ?? {
      baselineId: null,
      baselineName: null,
      plannedStartDate: null,
      plannedEndDate: null,
      currentStartDate: null,
      currentEndDate: null,
      startVarianceDays: null,
      endVarianceDays: null,
    },
    schedulePerformanceIndex:
      inner.schedulePerformanceIndex ??
      (summary.completionRate != null ? Number(summary.completionRate.toFixed(2)) : 1.0),
    taskStats: {
      total,
      completed,
      inProgress,
      overdue: 0,
      notStarted: 0,
      blocked: 0,
    },
    milestones: inner.milestones ?? [],
  };
}

export function transformCostReport(raw: any): CostReportDTO {
  const d = raw?.data ?? raw ?? {};
  if (Array.isArray(d.currencyBreakdown)) return d;
  const inner = d.data ?? d;
  const cost = inner.cost ?? {};
  const breakdown: any[] = cost.currencyBreakdown ?? [];
  const currencyBreakdown = breakdown.map((c) => ({
    currencyCode: c.currencyCode ?? 'USD',
    originalBudget: c.originalBudget ?? '0.00',
    approvedBudgetChanges: c.approvedBudgetChanges ?? '0.00',
    revisedBudget: c.revisedBudget ?? c.originalBudget ?? '0.00',
    committed: c.committed ?? '0.00',
    postedActual: c.postedActual ?? '0.00',
    forecast: c.forecast ?? null,
    variance: c.variance ?? null,
  }));

  return {
    generatedAt: d.asOf ?? d.generatedAt ?? new Date().toISOString(),
    currencyBreakdown,
    costPerformanceIndex: inner.costPerformanceIndex ?? 1.0,
  };
}

export function transformProcurementReport(raw: any): ProcurementReportDTO {
  const d = raw?.data ?? raw ?? {};
  if (d.materialRequests?.total !== undefined) return d;
  const inner = d.data ?? d;

  const mr = inner.materialRequests ?? {};
  const po = inner.purchaseOrders ?? {};
  const del = inner.deliveries ?? {};
  const rec = inner.receipts ?? {};

  const mrTotal = Object.values(mr).reduce((a: number, b: any) => a + Number(b || 0), 0);
  const poTotal = Object.values(po).reduce((a: number, b: any) => a + Number(b || 0), 0);
  const delTotal = Object.values(del).reduce((a: number, b: any) => a + Number(b || 0), 0);
  const recTotal = Object.values(rec).reduce((a: number, b: any) => a + Number(b || 0), 0);

  return {
    generatedAt: d.asOf ?? d.generatedAt ?? new Date().toISOString(),
    materialRequests: {
      total: mrTotal,
      draft: mr.DRAFT ?? mr.draft ?? 0,
      submitted: mr.SUBMITTED ?? mr.submitted ?? 0,
      approved: mr.APPROVED ?? mr.approved ?? 0,
      ordered: mr.ORDERED ?? mr.ordered ?? 0,
      fulfilled: mr.FULFILLED ?? mr.fulfilled ?? 0,
      cancelled: mr.CANCELLED ?? mr.cancelled ?? 0,
    },
    purchaseOrders: {
      total: poTotal,
      draft: po.DRAFT ?? po.draft ?? 0,
      pendingApproval: po.PENDING_APPROVAL ?? po.pendingApproval ?? 0,
      approved: po.APPROVED ?? po.approved ?? 0,
      sent: po.SENT ?? po.sent ?? 0,
      received: po.RECEIVED ?? po.received ?? 0,
      cancelled: po.CANCELLED ?? po.cancelled ?? 0,
      totalCommittedAmount: '0.00',
    },
    deliveries: {
      total: delTotal,
      scheduled: del.SCHEDULED ?? del.scheduled ?? 0,
      delivered: del.DELIVERED ?? del.delivered ?? 0,
      cancelled: del.CANCELLED ?? del.cancelled ?? 0,
    },
    receipts: {
      total: recTotal,
      draft: rec.DRAFT ?? rec.draft ?? 0,
      posted: rec.POSTED ?? rec.posted ?? 0,
      voided: rec.VOIDED ?? rec.voided ?? 0,
    },
    inventoryItemCount: inner.inventoryItemCount ?? 0,
  };
}

export function transformSubcontractorReport(raw: any): SubcontractorReportDTO {
  const d = raw?.data ?? raw ?? {};
  if (Array.isArray(d.subcontractors)) return d;
  const inner = d.data ?? d;

  return {
    generatedAt: d.asOf ?? d.generatedAt ?? new Date().toISOString(),
    subcontractors: Array.isArray(inner.subcontractors) ? inner.subcontractors : [],
  };
}

export function transformExecutiveSummary(raw: any): ExecutiveSummaryDTO {
  const d = raw?.data ?? raw ?? {};
  const inner = d.data ?? d;

  const health = transformHealthReport(inner.health);
  const schedule = transformScheduleReport(inner.scheduleSummary);
  const cost = transformCostReport(inner.costSummary);
  const procurement = transformProcurementReport(inner.procurementSummary);

  return {
    generatedAt: d.asOf ?? d.generatedAt ?? new Date().toISOString(),
    health,
    schedule,
    cost,
    procurement,
  };
}

export const reportApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Portfolio-level Reports ────────────────────────────────────────────

    getPortfolioReport: build.query<PortfolioReportDTO, OrgArgs>({
      query: ({ orgId }) => `/organizations/${orgId}/reports/portfolio`,
      transformResponse: (raw: { data: PortfolioReportDTO }) => raw.data,
      keepUnusedDataFor: 300, // 5-minute cache
      providesTags: (_r, _e, { orgId }) => [{ type: 'Report', id: `portfolio-${orgId}` }],
    }),

    // ── Project-level Reports ──────────────────────────────────────────────

    getHealthReport: build.query<HealthReportDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/reports/health`,
      transformResponse: (raw: { data: any }) => transformHealthReport(raw.data),
      keepUnusedDataFor: 300,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Report', id: `health-${projectId}` }],
    }),

    getScheduleReport: build.query<ScheduleReportDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/reports/schedule`,
      transformResponse: (raw: { data: any }) => transformScheduleReport(raw.data),
      keepUnusedDataFor: 300,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Report', id: `schedule-${projectId}` }],
    }),

    getCostReport: build.query<CostReportDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/reports/cost`,
      transformResponse: (raw: { data: any }) => transformCostReport(raw.data),
      keepUnusedDataFor: 300,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Report', id: `cost-${projectId}` }],
    }),

    getProcurementReport: build.query<ProcurementReportDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/reports/procurement`,
      transformResponse: (raw: { data: any }) => transformProcurementReport(raw.data),
      keepUnusedDataFor: 300,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Report', id: `procurement-${projectId}` }],
    }),

    getSubcontractorReport: build.query<SubcontractorReportDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/reports/subcontractor`,
      transformResponse: (raw: { data: any }) => transformSubcontractorReport(raw.data),
      keepUnusedDataFor: 300,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Report', id: `subcontractor-${projectId}` }],
    }),

    getExecutiveSummary: build.query<ExecutiveSummaryDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/reports/executive-summary`,
      transformResponse: (raw: { data: any }) => transformExecutiveSummary(raw.data),
      keepUnusedDataFor: 300,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Report', id: `executive-${projectId}` }],
    }),

  }),
  overrideExisting: false,
});

export const {
  useGetPortfolioReportQuery,
  useGetHealthReportQuery,
  useGetScheduleReportQuery,
  useGetCostReportQuery,
  useGetProcurementReportQuery,
  useGetSubcontractorReportQuery,
  useGetExecutiveSummaryQuery,
} = reportApi;
