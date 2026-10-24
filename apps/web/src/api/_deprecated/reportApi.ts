/**
 * reportApi — Group 12: read-only reporting endpoints.
 * All GET only. Uses 5-minute cache (keepUnusedDataFor: 300).
 * Backend: apps/server/src/modules/reporting/report.routes.ts
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type {
  PortfolioReportDTO, HealthReportDTO, ScheduleReportDTO,
  CostReportDTO, ProcurementReportDTO, SubcontractorReportDTO, ExecutiveSummaryDTO,
} from '../types/reportTypes';

const delay = (ms = 200) => new Promise<void>((r) => setTimeout(r, ms));

export const reportApi = createApi({
  reducerPath: 'reportApi',
  baseQuery: mockBaseQuery,
  keepUnusedDataFor: 300,
  tagTypes: ['Report'],
  endpoints: (build) => ({

    getPortfolioReport: build.query<PortfolioReportDTO, { orgId: string }>({
      queryFn: async () => {
        await delay();
        return {
          data: {
            generatedAt: new Date().toISOString(),
            projects: [
              { id: 'proj_01', name: 'Industrial Warehouse — Port Qasim', projectNumber: 'PRJ-2024-001', status: 'ACTIVE', plannedStartDate: '2024-01-15', plannedEndDate: '2025-03-31', scheduleHealth: 'AMBER', budgetHealth: 'GREEN', overallHealth: 'AMBER', taskStats: { total: 48, inProgress: 12, completed: 22, blocked: 2, overdue: 3 }, openIssues: 4, openRFIs: 2 },
              { id: 'proj_02', name: 'Office Complex — DHA Phase 6', projectNumber: 'PRJ-2024-002', status: 'ACTIVE', plannedStartDate: '2024-03-01', plannedEndDate: '2025-06-30', scheduleHealth: 'GREEN', budgetHealth: 'GREEN', overallHealth: 'GREEN', taskStats: { total: 32, inProgress: 8, completed: 10, blocked: 0, overdue: 0 }, openIssues: 1, openRFIs: 0 },
            ],
          },
        };
      },
      providesTags: ['Report'],
    }),

    getHealthReport: build.query<HealthReportDTO, { orgId: string; projectId: string }>({
      queryFn: async () => {
        await delay();
        return {
          data: {
            generatedAt: new Date().toISOString(),
            scheduleHealth: 'AMBER', budgetHealth: 'GREEN',
            taskStats: { total: 48, notStarted: 11, inProgress: 12, blocked: 2, completed: 22, cancelled: 1, overdue: 3 },
            openIssues: 4, openRFIs: 2, criticalRFIs: 0, openSafetyEvents: 1,
          },
        };
      },
      providesTags: ['Report'],
    }),

    getScheduleReport: build.query<ScheduleReportDTO, { orgId: string; projectId: string }>({
      queryFn: async () => {
        await delay();
        return {
          data: {
            generatedAt: new Date().toISOString(),
            baselineComparison: { baselineId: 'bl_01', baselineName: 'Approved Baseline v1', plannedStartDate: '2024-01-15', plannedEndDate: '2025-03-31', currentStartDate: '2024-01-15', currentEndDate: '2025-04-15', startVarianceDays: 0, endVarianceDays: 15 },
            schedulePerformanceIndex: 0.87,
            taskStats: { total: 48, completed: 22, inProgress: 12, notStarted: 11, overdue: 3, criticalPath: 5 },
            milestones: [
              { id: 'm_01', name: 'Foundation complete', plannedDate: '2024-03-31', currentDate: '2024-03-28', status: 'COMPLETED', varianceDays: -3 },
              { id: 'm_02', name: 'Superstructure Level 4', plannedDate: '2024-06-30', currentDate: '2024-07-14', status: 'IN_PROGRESS', varianceDays: 14 },
              { id: 'm_03', name: 'Topping out', plannedDate: '2024-10-31', currentDate: '2024-11-15', status: 'NOT_STARTED', varianceDays: 15 },
            ],
          },
        };
      },
      providesTags: ['Report'],
    }),

    getCostReport: build.query<CostReportDTO, { orgId: string; projectId: string }>({
      queryFn: async () => {
        await delay();
        return {
          data: {
            generatedAt: new Date().toISOString(),
            currencyBreakdown: [{
              currencyCode: 'PKR',
              originalBudget: '285000000.00', approvedBudgetChanges: '6500000.00', revisedBudget: '291500000.00',
              committed: '0.00', postedActual: '2661750.00', forecast: null, variance: null,
            }],
            costPerformanceIndex: 0.92,
          },
        };
      },
      providesTags: ['Report'],
    }),

    getProcurementReport: build.query<ProcurementReportDTO, { orgId: string; projectId: string }>({
      queryFn: async () => {
        await delay();
        return {
          data: {
            generatedAt: new Date().toISOString(),
            materialRequests: { total: 14, draft: 2, submitted: 3, approved: 5, ordered: 3, fulfilled: 1, cancelled: 0 },
            purchaseOrders: { total: 8, draft: 1, pendingApproval: 2, approved: 4, sent: 1, received: 0, cancelled: 0, totalCommittedAmount: '47250000.00' },
            deliveries: { total: 5, scheduled: 3, delivered: 2, cancelled: 0 },
            receipts: { total: 3, draft: 1, posted: 2, voided: 0 },
            inventoryItemCount: 12,
          },
        };
      },
      providesTags: ['Report'],
    }),

    getSubcontractorReport: build.query<SubcontractorReportDTO, { orgId: string; projectId: string }>({
      queryFn: async () => {
        await delay();
        return {
          data: {
            generatedAt: new Date().toISOString(),
            subcontractors: [
              { subcontractorId: 'sub_01', displayName: 'Steel Fabricators Ltd', trade: 'Structural Steel', assignedTaskCount: 8, completedTaskCount: 6, lateTaskCount: 1, lateDeliveryCount: 0, receiptRejectionCount: 0, onTimeRate: 0.875 },
              { subcontractorId: 'sub_02', displayName: 'Gulf Plumbing & MEP', trade: 'Plumbing', assignedTaskCount: 5, completedTaskCount: 2, lateTaskCount: 0, lateDeliveryCount: 1, receiptRejectionCount: 0, onTimeRate: 0.6 },
            ],
          },
        };
      },
      providesTags: ['Report'],
    }),

    getExecutiveSummaryReport: build.query<ExecutiveSummaryDTO, { orgId: string; projectId: string }>({
      queryFn: async () => {
        await delay(300);
        return {
          data: {
            generatedAt: new Date().toISOString(),
            health: { scheduleHealth: 'AMBER', budgetHealth: 'GREEN', taskStats: { total: 48, notStarted: 11, inProgress: 12, blocked: 2, completed: 22, cancelled: 1, overdue: 3 }, openIssues: 4, openRFIs: 2, criticalRFIs: 0, openSafetyEvents: 1 },
            schedule: { baselineComparison: { baselineId: 'bl_01', baselineName: 'Approved Baseline v1', plannedStartDate: '2024-01-15', plannedEndDate: '2025-03-31', currentStartDate: '2024-01-15', currentEndDate: '2025-04-15', startVarianceDays: 0, endVarianceDays: 15 }, schedulePerformanceIndex: 0.87, taskStats: { total: 48, completed: 22, inProgress: 12, notStarted: 11, overdue: 3, criticalPath: 5 }, milestones: [] },
            cost: { currencyBreakdown: [{ currencyCode: 'PKR', originalBudget: '285000000.00', approvedBudgetChanges: '6500000.00', revisedBudget: '291500000.00', committed: '0.00', postedActual: '2661750.00', forecast: null, variance: null }], costPerformanceIndex: 0.92 },
            procurement: { materialRequests: { total: 14, draft: 2, submitted: 3, approved: 5, ordered: 3, fulfilled: 1, cancelled: 0 }, purchaseOrders: { total: 8, draft: 1, pendingApproval: 2, approved: 4, sent: 1, received: 0, cancelled: 0, totalCommittedAmount: '47250000.00' }, deliveries: { total: 5, scheduled: 3, delivered: 2, cancelled: 0 }, receipts: { total: 3, draft: 1, posted: 2, voided: 0 }, inventoryItemCount: 12 },
          },
        };
      },
      providesTags: ['Report'],
    }),
  }),
});

export const {
  useGetPortfolioReportQuery, useGetHealthReportQuery, useGetScheduleReportQuery,
  useGetCostReportQuery, useGetProcurementReportQuery, useGetSubcontractorReportQuery,
  useGetExecutiveSummaryReportQuery,
} = reportApi;
