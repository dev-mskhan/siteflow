/**
 * subcontractorApi — LIVE integration for project subcontractor management.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Backend routes: apps/server/src/modules/project/subcontractor/
 * Note: Only PROJECT-scoped routes exist (no org-level subcontractor master data).
 */
import { baseApi } from '../../services/baseApi';
import type {
  ProjectSubcontractorDTO,
  SubcontractorContactDTO,
  SubcontractorTaskAssignmentDTO,
  AssignSubcontractorToProjectInput,
  UpdateProjectSubcontractorInput,
  CreateContactInput,
  UpdateContactInput,
  AssignTaskInput,
} from '../../types/subcontractorTypes';

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export const subcontractorApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Project Subcontractors ─────────────────────────────────────────────

    listProjectSubcontractors: build.query<ProjectSubcontractorDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) =>
        `/organizations/${orgId}/projects/${projectId}/subcontractors`,
      transformResponse: (raw: { data: ProjectSubcontractorDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Subcontractor', id: projectId }],
    }),

    getProjectSubcontractor: build.query<
      ProjectSubcontractorDTO,
      OrgProjectArgs & { subcontractorId: string }
    >({
      query: ({ orgId, projectId, subcontractorId }) =>
        `/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}`,
      transformResponse: (raw: { data: ProjectSubcontractorDTO }) => raw.data,
      providesTags: (_r, _e, { subcontractorId }) => [
        { type: 'Subcontractor', id: subcontractorId },
      ],
    }),

    assignSubcontractorToProject: build.mutation<
      ProjectSubcontractorDTO,
      OrgProjectArgs & { input: AssignSubcontractorToProjectInput }
    >({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/subcontractors`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: ProjectSubcontractorDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Subcontractor', id: projectId }],
    }),

    updateProjectSubcontractor: build.mutation<
      ProjectSubcontractorDTO,
      OrgProjectArgs & { subcontractorId: string; input: UpdateProjectSubcontractorInput }
    >({
      query: ({ orgId, projectId, subcontractorId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: ProjectSubcontractorDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId, subcontractorId }) => [
        { type: 'Subcontractor', id: projectId },
        { type: 'Subcontractor', id: subcontractorId },
      ],
    }),

    // ── Subcontractor Contacts ─────────────────────────────────────────────

    createSubcontractorContact: build.mutation<
      SubcontractorContactDTO,
      OrgProjectArgs & { subcontractorId: string; input: CreateContactInput }
    >({
      query: ({ orgId, projectId, subcontractorId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/contacts`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: SubcontractorContactDTO }) => raw.data,
      invalidatesTags: (_r, _e, { subcontractorId }) => [
        { type: 'SubcontractorContact', id: subcontractorId },
      ],
    }),

    updateSubcontractorContact: build.mutation<
      SubcontractorContactDTO,
      OrgProjectArgs & { subcontractorId: string; contactId: string; input: UpdateContactInput }
    >({
      query: ({ orgId, projectId, subcontractorId, contactId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/contacts/${contactId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: SubcontractorContactDTO }) => raw.data,
      invalidatesTags: (_r, _e, { subcontractorId, contactId }) => [
        { type: 'SubcontractorContact', id: subcontractorId },
        { type: 'SubcontractorContact', id: contactId },
      ],
    }),

    // ── Task Assignments ───────────────────────────────────────────────────

    assignTaskToSubcontractor: build.mutation<
      SubcontractorTaskAssignmentDTO,
      OrgProjectArgs & { subcontractorId: string; input: AssignTaskInput }
    >({
      query: ({ orgId, projectId, subcontractorId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/task-assignments`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: SubcontractorTaskAssignmentDTO }) => raw.data,
      invalidatesTags: (_r, _e, { subcontractorId }) => [
        { type: 'SubcontractorContract', id: subcontractorId },
      ],
    }),

    removeTaskFromSubcontractor: build.mutation<
      void,
      OrgProjectArgs & { subcontractorId: string; taskId: string }
    >({
      query: ({ orgId, projectId, subcontractorId, taskId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/task-assignments/${taskId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { subcontractorId }) => [
        { type: 'SubcontractorContract', id: subcontractorId },
      ],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListProjectSubcontractorsQuery,
  useGetProjectSubcontractorQuery,
  useAssignSubcontractorToProjectMutation,
  useUpdateProjectSubcontractorMutation,
  useCreateSubcontractorContactMutation,
  useUpdateSubcontractorContactMutation,
  useAssignTaskToSubcontractorMutation,
  useRemoveTaskFromSubcontractorMutation,
} = subcontractorApi;
