/**
 * issueApi — Live integration for project issues and schedule impacts.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Backend: apps/server/src/modules/project/issue/*.handler.ts
 */
import { baseApi } from '../../services/baseApi';
import type { IssueDTO, CreateIssueInput, UpdateIssueInput, IssueStatus } from '../../types/issueTypes';

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export const issueApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    listIssues: build.query<{ data: IssueDTO[] }, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/issues`,
      transformResponse: (raw: { data: IssueDTO[] }) => ({ data: raw.data }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'Issue', id: projectId }],
    }),

    getIssue: build.query<IssueDTO, OrgProjectArgs & { issueId: string }>({
      query: ({ orgId, projectId, issueId }) =>
        `/organizations/${orgId}/projects/${projectId}/issues/${issueId}`,
      transformResponse: (raw: { data: IssueDTO }) => raw.data,
      providesTags: (_r, _e, { issueId }) => [{ type: 'Issue', id: issueId }],
    }),

    createIssue: build.mutation<IssueDTO, OrgProjectArgs & { input: CreateIssueInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/issues`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: IssueDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Issue', id: projectId }],
    }),

    updateIssue: build.mutation<IssueDTO, OrgProjectArgs & { issueId: string; input: UpdateIssueInput }>({
      query: ({ orgId, projectId, issueId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/issues/${issueId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: IssueDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId, issueId }) => [
        { type: 'Issue', id: issueId },
        { type: 'Issue', id: projectId },
      ],
    }),

    transitionIssue: build.mutation<IssueDTO, OrgProjectArgs & { issueId: string; status: IssueStatus }>({
      query: ({ orgId, projectId, issueId, status }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/issues/${issueId}/transition`,
        method: 'POST',
        body: { status },
      }),
      transformResponse: (raw: { data: IssueDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId, issueId }) => [
        { type: 'Issue', id: issueId },
        { type: 'Issue', id: projectId },
      ],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListIssuesQuery,
  useGetIssueQuery,
  useCreateIssueMutation,
  useUpdateIssueMutation,
  useTransitionIssueMutation,
} = issueApi;
