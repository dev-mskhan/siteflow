import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type { IssueDTO, CreateIssueInput, UpdateIssueInput, IssueStatus } from '../types/issueTypes';
import { MOCK_ISSUES } from '../fixtures/issue.fixtures';

const VALID_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'OPEN'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: [],
};

export const issueApi = createApi({
  reducerPath: 'issueApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['Issue'],
  endpoints: (build) => ({
    listIssues: build.query<{ data: IssueDTO[] }, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await new Promise((r) => setTimeout(r, 150));
        const issues = MOCK_ISSUES[projectId] || [];
        return { data: { data: issues } };
      },
      providesTags: (result, _error, { projectId }) => [
        { type: 'Issue', id: 'LIST' },
        { type: 'Issue', id: projectId },
      ],
    }),

    getIssue: build.query<IssueDTO, { orgId: string; projectId: string; issueId: string }>({
      queryFn: async ({ projectId, issueId }) => {
        await new Promise((r) => setTimeout(r, 120));
        const issue = MOCK_ISSUES[projectId]?.find((i) => i.id === issueId);
        if (!issue) return { error: { status: 404, error: 'ISSUE_NOT_FOUND' } };
        return { data: issue };
      },
      providesTags: (_result, _error, { issueId }) => [{ type: 'Issue', id: issueId }],
    }),

    createIssue: build.mutation<
      IssueDTO,
      { orgId: string; projectId: string; input: CreateIssueInput }
    >({
      queryFn: async ({ projectId, input }) => {
        await new Promise((r) => setTimeout(r, 200));
        const newIssue: IssueDTO = {
          id: `issue_${Date.now()}`,
          organizationId: 'org_01',
          projectId,
          title: input.title,
          description: input.description || null,
          status: 'OPEN',
          reportedImpactDays: input.reportedImpactDays ?? 0,
          approvedImpactDays: 0,
          assignedTo: input.assignedTo || null,
          createdAt: new Date().toISOString(),
        };
        MOCK_ISSUES[projectId] = [...(MOCK_ISSUES[projectId] || []), newIssue];
        return { data: newIssue };
      },
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Issue', id: projectId }],
    }),

    updateIssue: build.mutation<
      IssueDTO,
      { orgId: string; projectId: string; issueId: string; input: UpdateIssueInput }
    >({
      queryFn: async ({ projectId, issueId, input }) => {
        await new Promise((r) => setTimeout(r, 180));
        const issue = MOCK_ISSUES[projectId]?.find((i) => i.id === issueId);
        if (!issue) return { error: { status: 404, error: 'ISSUE_NOT_FOUND' } };
        const updated = { ...issue, ...input };
        MOCK_ISSUES[projectId] = MOCK_ISSUES[projectId].map((i) =>
          i.id === issueId ? updated : i
        );
        return { data: updated };
      },
      invalidatesTags: (_result, _error, { projectId, issueId }) => [
        { type: 'Issue', id: issueId },
        { type: 'Issue', id: projectId },
      ],
    }),

    transitionIssue: build.mutation<
      IssueDTO,
      { orgId: string; projectId: string; issueId: string; status: IssueStatus }
    >({
      queryFn: async ({ projectId, issueId, status }) => {
        await new Promise((r) => setTimeout(r, 150));
        const issue = MOCK_ISSUES[projectId]?.find((i) => i.id === issueId);
        if (!issue) return { error: { status: 404, error: 'ISSUE_NOT_FOUND' } };
        if (!VALID_TRANSITIONS[issue.status].includes(status)) {
          return { error: { status: 422, error: 'ISSUE_INVALID_TRANSITION' } };
        }
        const updated = { ...issue, status };
        MOCK_ISSUES[projectId] = MOCK_ISSUES[projectId].map((i) =>
          i.id === issueId ? updated : i
        );
        return { data: updated };
      },
      invalidatesTags: (_result, _error, { projectId, issueId }) => [
        { type: 'Issue', id: issueId },
        { type: 'Issue', id: projectId },
      ],
    }),
  }),
});

export const {
  useListIssuesQuery,
  useGetIssueQuery,
  useCreateIssueMutation,
  useUpdateIssueMutation,
  useTransitionIssueMutation,
} = issueApi;
