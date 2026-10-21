/**
 * budgetApi — Full budget lifecycle (DRAFT → PENDING_APPROVAL → APPROVED → CLOSED).
 * LIVE INTEGRATION: uses baseApi.injectEndpoints with real HTTP endpoints.
 *
 * Server: apps/server/src/modules/project/budget/budget.routes.ts
 *   GET    /organizations/:orgId/projects/:projectId/budgets
 *   GET    /organizations/:orgId/projects/:projectId/budgets/:budgetId
 *   GET    /organizations/:orgId/projects/:projectId/budgets/:budgetId/summary
 *   POST   /organizations/:orgId/projects/:projectId/budgets
 *   PATCH  /organizations/:orgId/projects/:projectId/budgets/:budgetId (expectedVersion in body)
 *   POST   /organizations/:orgId/projects/:projectId/budgets/:budgetId/submit  (expectedVersion in body)
 *   POST   /organizations/:orgId/projects/:projectId/budgets/:budgetId/approve (expectedVersion in body)
 *   POST   /organizations/:orgId/projects/:projectId/budgets/:budgetId/close   (expectedVersion in body)
 *
 * CRITICAL: version IS present on ProjectBudgetDTO. Every transition requires
 * expectedVersion in body. Actor separation enforced server-side (approver ≠ submitter).
 */
import { baseApi } from '../../services/baseApi';
import type { ProjectBudgetDTO, ProjectBudgetSummaryDTO } from './projectTypes';

interface Args { orgId: string; projectId: string }
interface BudgetArgs extends Args { budgetId: string }

interface ListBudgetsResponse { budgets: ProjectBudgetDTO[]; nextCursor: null }
interface SingleBudgetResponse { budget: ProjectBudgetDTO }
interface SummaryResponse { summary: ProjectBudgetSummaryDTO }

export interface CreateBudgetBody {
  currencyCode: string;
  lines: Array<{ costCodeId: string; phaseId?: string; description?: string; amount: string }>;
}

export interface UpdateBudgetBody {
  expectedVersion: number;
  lines: Array<{ costCodeId: string; phaseId?: string; description?: string; amount: string }>;
}

export const budgetApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    listBudgets: build.query<ListBudgetsResponse, Args>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/budgets`,
      transformResponse: (raw: { data: ListBudgetsResponse }) => raw.data,
      providesTags: (_result, _error, { projectId }) => [{ type: 'Budget' as const, id: projectId }],
    }),

    getBudget: build.query<SingleBudgetResponse, BudgetArgs>({
      query: ({ orgId, projectId, budgetId }) =>
        `/organizations/${orgId}/projects/${projectId}/budgets/${budgetId}`,
      transformResponse: (raw: { data: SingleBudgetResponse }) => raw.data,
      providesTags: (_result, _error, { budgetId }) => [{ type: 'Budget' as const, id: budgetId }],
    }),

    getBudgetSummary: build.query<SummaryResponse, BudgetArgs>({
      query: ({ orgId, projectId, budgetId }) =>
        `/organizations/${orgId}/projects/${projectId}/budgets/${budgetId}/summary`,
      transformResponse: (raw: { data: SummaryResponse }) => raw.data,
      providesTags: (_result, _error, { budgetId }) => [{ type: 'Budget' as const, id: `${budgetId}:summary` }],
    }),

    createBudget: build.mutation<SingleBudgetResponse, Args & { body: CreateBudgetBody }>({
      query: ({ orgId, projectId, body }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/budgets`,
        method: 'POST',
        body,
      }),
      transformResponse: (raw: { data: SingleBudgetResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Budget' as const, id: projectId }],
    }),

    updateBudget: build.mutation<SingleBudgetResponse, BudgetArgs & { body: UpdateBudgetBody }>({
      query: ({ orgId, projectId, budgetId, body }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/budgets/${budgetId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: { data: SingleBudgetResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId, budgetId }) => [
        { type: 'Budget' as const, id: projectId },
        { type: 'Budget' as const, id: budgetId },
      ],
    }),

    submitBudget: build.mutation<SingleBudgetResponse, BudgetArgs & { expectedVersion: number }>({
      query: ({ orgId, projectId, budgetId, expectedVersion }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/budgets/${budgetId}/submit`,
        method: 'POST',
        body: { expectedVersion },
      }),
      transformResponse: (raw: { data: SingleBudgetResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Budget' as const, id: projectId }],
    }),

    approveBudget: build.mutation<SingleBudgetResponse, BudgetArgs & { expectedVersion: number }>({
      query: ({ orgId, projectId, budgetId, expectedVersion }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/budgets/${budgetId}/approve`,
        method: 'POST',
        body: { expectedVersion },
      }),
      transformResponse: (raw: { data: SingleBudgetResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Budget' as const, id: projectId }],
    }),

    closeBudget: build.mutation<SingleBudgetResponse, BudgetArgs & { expectedVersion: number }>({
      query: ({ orgId, projectId, budgetId, expectedVersion }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/budgets/${budgetId}/close`,
        method: 'POST',
        body: { expectedVersion },
      }),
      transformResponse: (raw: { data: SingleBudgetResponse }) => raw.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Budget' as const, id: projectId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListBudgetsQuery,
  useGetBudgetQuery,
  useGetBudgetSummaryQuery,
  useCreateBudgetMutation,
  useUpdateBudgetMutation,
  useSubmitBudgetMutation,
  useApproveBudgetMutation,
  useCloseBudgetMutation,
} = budgetApi;
