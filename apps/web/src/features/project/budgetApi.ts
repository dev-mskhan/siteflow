/**
 * budgetApi — Full budget lifecycle (DRAFT → PENDING_APPROVAL → APPROVED → CLOSED).
 *
 * Budget state machine (from budget.service.ts):
 *   DRAFT → submit → PENDING_APPROVAL → approve → APPROVED → close → CLOSED
 *   APPROVED can be revised (creates new revision, resets to DRAFT)
 *
 * CRITICAL: version IS present on ProjectBudgetDTO (unlike ProjectDTO).
 *           Every state transition PATCH/POST requires expectedVersion in body.
 *           Actor separation is enforced: approver ≠ submitter (server-side).
 *
 * MOCK PHASE: queryFn returns MOCK_BUDGETS fixture data.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import type { ProjectBudgetDTO, ProjectBudgetSummaryDTO, ProjectBudgetLineDTO } from './projectTypes';
import { MOCK_BUDGETS, MOCK_BUDGET_SUMMARIES } from '../../mocks/project.fixtures';

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

function sumLines(lines: ProjectBudgetLineDTO[]): string {
  return lines.reduce((sum, l) => (parseFloat(sum) + parseFloat(l.amount)).toFixed(2), '0.00');
}

export const budgetApi = createApi({
  reducerPath: 'budgetApi',
  baseQuery: async () => ({ data: undefined as unknown }),
  tagTypes: ['Budget'],
  endpoints: (b) => ({

    // REAL: query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/budgets`
    listBudgets: b.query<ListBudgetsResponse, Args>({
      queryFn: ({ projectId }) => {
        const budget = MOCK_BUDGETS[projectId];
        return { data: { budgets: budget ? [budget] : [], nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Budget', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, budgetId }) => `.../budgets/${budgetId}`
    getBudget: b.query<SingleBudgetResponse, BudgetArgs>({
      queryFn: ({ projectId, budgetId }) => {
        const budget = MOCK_BUDGETS[projectId];
        if (!budget || budget.id !== budgetId) return { error: { status: 404, error: 'Not found' } };
        return { data: { budget } };
      },
      providesTags: (_r, _e, { budgetId }) => [{ type: 'Budget', id: budgetId }],
    }),

    // REAL: query: ({ orgId, projectId, budgetId }) => `.../budgets/${budgetId}/summary`
    getBudgetSummary: b.query<SummaryResponse, BudgetArgs>({
      queryFn: ({ projectId }) => ({
        data: { summary: MOCK_BUDGET_SUMMARIES[projectId] ?? { currencyCode: 'PKR', original: '0.00', approvedChanges: '0.00', revised: '0.00', approvedRevisionNumber: null } },
      }),
      providesTags: (_r, _e, { budgetId }) => [{ type: 'Budget', id: `${budgetId}:summary` }],
    }),

    // REAL: query: ({ orgId, projectId, body }) => ({ url: `.../budgets`, method: 'POST', body })
    createBudget: b.mutation<SingleBudgetResponse, Args & { body: CreateBudgetBody }>({
      queryFn: ({ projectId, orgId, body }) => {
        const lines: ProjectBudgetLineDTO[] = body.lines.map((l, i) => ({
          id: `bl_${Date.now()}_${i}`,
          lineNumber: i + 1,
          costCodeId: l.costCodeId,
          phaseId: l.phaseId ?? null,
          description: l.description ?? null,
          amount: parseFloat(l.amount).toFixed(2),
        }));
        const budget: ProjectBudgetDTO = {
          id: `bud_${Date.now()}`,
          organizationId: orgId,
          projectId,
          currencyCode: body.currencyCode,
          status: 'DRAFT',
          version: 1,
          currentRevisionNumber: 1,
          createdBy: 'usr_01',
          submittedBy: null, submittedAt: null,
          approvedBy: null, approvedAt: null, closedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          revision: { id: `rev_${Date.now()}`, revisionNumber: 1, status: 'DRAFT', createdBy: 'usr_01', submittedBy: null, submittedAt: null, approvedBy: null, approvedAt: null },
          lines,
          total: sumLines(lines),
        };
        MOCK_BUDGETS[projectId] = budget;
        return { data: { budget } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Budget', id: projectId }],
    }),

    // REAL: query: ({ orgId, projectId, budgetId, body }) => ({ url: `.../budgets/${budgetId}`, method: 'PATCH', body })
    updateBudget: b.mutation<SingleBudgetResponse, BudgetArgs & { body: UpdateBudgetBody }>({
      queryFn: ({ projectId, budgetId, body }) => {
        const budget = MOCK_BUDGETS[projectId];
        if (!budget || budget.id !== budgetId) return { error: { status: 404, error: 'Not found' } };
        const lines: ProjectBudgetLineDTO[] = body.lines.map((l, i) => ({
          id: `bl_${Date.now()}_${i}`,
          lineNumber: i + 1,
          costCodeId: l.costCodeId,
          phaseId: l.phaseId ?? null,
          description: l.description ?? null,
          amount: parseFloat(l.amount).toFixed(2),
        }));
        const updated: ProjectBudgetDTO = {
          ...budget,
          version: budget.version + 1,
          lines,
          total: sumLines(lines),
          updatedAt: new Date().toISOString(),
        };
        MOCK_BUDGETS[projectId] = updated;
        return { data: { budget: updated } };
      },
      invalidatesTags: (_r, _e, { projectId, budgetId }) => [
        { type: 'Budget', id: projectId },
        { type: 'Budget', id: budgetId },
      ],
    }),

    // submit, approve, close — all POST with { expectedVersion }
    // REAL: query: ({ orgId, projectId, budgetId, expectedVersion }) =>
    //   ({ url: `.../budgets/${budgetId}/submit`, method: 'POST', body: { expectedVersion } })
    submitBudget: b.mutation<SingleBudgetResponse, BudgetArgs & { expectedVersion: number }>({
      queryFn: ({ projectId, budgetId }) => {
        const budget = MOCK_BUDGETS[projectId];
        if (!budget) return { error: { status: 404, error: 'Not found' } };
        const updated = { ...budget, status: 'PENDING_APPROVAL' as const, submittedBy: 'usr_01', submittedAt: new Date().toISOString(), version: budget.version + 1, revision: { ...budget.revision, status: 'PENDING_APPROVAL' as const, submittedBy: 'usr_01', submittedAt: new Date().toISOString() } };
        MOCK_BUDGETS[projectId] = updated;
        return { data: { budget: updated } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Budget', id: projectId }],
    }),

    // REAL: query: same pattern with /approve
    approveBudget: b.mutation<SingleBudgetResponse, BudgetArgs & { expectedVersion: number }>({
      queryFn: ({ projectId }) => {
        const budget = MOCK_BUDGETS[projectId];
        if (!budget) return { error: { status: 404, error: 'Not found' } };
        const updated = { ...budget, status: 'APPROVED' as const, approvedBy: 'usr_02', approvedAt: new Date().toISOString(), version: budget.version + 1, revision: { ...budget.revision, status: 'APPROVED' as const, approvedBy: 'usr_02', approvedAt: new Date().toISOString() } };
        MOCK_BUDGETS[projectId] = updated;
        return { data: { budget: updated } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Budget', id: projectId }],
    }),

    // REAL: query: same pattern with /close
    closeBudget: b.mutation<SingleBudgetResponse, BudgetArgs & { expectedVersion: number }>({
      queryFn: ({ projectId }) => {
        const budget = MOCK_BUDGETS[projectId];
        if (!budget) return { error: { status: 404, error: 'Not found' } };
        const updated = { ...budget, status: 'CLOSED' as const, closedAt: new Date().toISOString(), version: budget.version + 1 };
        MOCK_BUDGETS[projectId] = updated;
        return { data: { budget: updated } };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Budget', id: projectId }],
    }),

  }),
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
