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
      transformResponse: (raw: { data: HealthReportDTO }) => raw.data,
      keepUnusedDataFor: 300,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Report', id: `health-${projectId}` }],
    }),

    getScheduleReport: build.query<ScheduleReportDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/reports/schedule`,
      transformResponse: (raw: { data: ScheduleReportDTO }) => raw.data,
      keepUnusedDataFor: 300,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Report', id: `schedule-${projectId}` }],
    }),

    getCostReport: build.query<CostReportDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/reports/cost`,
      transformResponse: (raw: { data: CostReportDTO }) => raw.data,
      keepUnusedDataFor: 300,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Report', id: `cost-${projectId}` }],
    }),

    getProcurementReport: build.query<ProcurementReportDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/reports/procurement`,
      transformResponse: (raw: { data: ProcurementReportDTO }) => raw.data,
      keepUnusedDataFor: 300,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Report', id: `procurement-${projectId}` }],
    }),

    getSubcontractorReport: build.query<SubcontractorReportDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/reports/subcontractor`,
      transformResponse: (raw: { data: SubcontractorReportDTO }) => raw.data,
      keepUnusedDataFor: 300,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Report', id: `subcontractor-${projectId}` }],
    }),

    getExecutiveSummary: build.query<ExecutiveSummaryDTO, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/reports/executive-summary`,
      transformResponse: (raw: { data: ExecutiveSummaryDTO }) => raw.data,
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
