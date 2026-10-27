/**
 * subcontractorApi — LIVE integration for subcontractor management.
 *
 * Backend routes: apps/server/src/modules/project/subcontractor/
 * Org-level directory (/organizations/:orgId/subcontractors) and project-scoped assignments.
 */
import { baseApi } from '../../services/baseApi';
import type {
  SubcontractorDTO,
  CreateSubcontractorInput,
  UpdateSubcontractorInput,
  PartnerPerformanceEventDTO,
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

    // ── Org-level directory ────────────────────────────────────────────────

    listSubcontractors: build.query<
      { data: SubcontractorDTO[]; nextCursor: string | null },
      { orgId: string; status?: string; cursor?: string; limit?: number }
    >({
      query: ({ orgId, ...params }) => ({
        url: `/organizations/${orgId}/subcontractors`,
        params,
      }),
      transformResponse: (raw: { data: SubcontractorDTO[]; meta?: { nextCursor?: string | null } }) => ({
        data: raw.data,
        nextCursor: raw.meta?.nextCursor ?? null,
      }),
      providesTags: [{ type: 'Subcontractor', id: 'LIST' }],
    }),

    getSubcontractor: build.query<SubcontractorDTO, { orgId: string; subcontractorId: string }>({
      query: ({ orgId, subcontractorId }) => `/organizations/${orgId}/subcontractors/${subcontractorId}`,
      transformResponse: (raw: { data: SubcontractorDTO }) => raw.data,
      providesTags: (_r, _e, { subcontractorId }) => [{ type: 'Subcontractor', id: subcontractorId }],
    }),

    createSubcontractor: build.mutation<
      SubcontractorDTO,
      { orgId: string; input: CreateSubcontractorInput }
    >({
      query: ({ orgId, input }) => ({
        url: `/organizations/${orgId}/subcontractors`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: SubcontractorDTO }) => raw.data,
      invalidatesTags: [{ type: 'Subcontractor', id: 'LIST' }],
    }),

    updateSubcontractor: build.mutation<
      SubcontractorDTO,
      { orgId: string; subcontractorId: string; input: UpdateSubcontractorInput }
    >({
      query: ({ orgId, subcontractorId, input }) => ({
        url: `/organizations/${orgId}/subcontractors/${subcontractorId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: SubcontractorDTO }) => raw.data,
      invalidatesTags: (_r, _e, { subcontractorId }) => [
        { type: 'Subcontractor', id: 'LIST' },
        { type: 'Subcontractor', id: subcontractorId },
      ],
    }),

    listContacts: build.query<SubcontractorContactDTO[], { orgId: string; subcontractorId: string }>({
      query: ({ orgId, subcontractorId }) =>
        `/organizations/${orgId}/subcontractors/${subcontractorId}/contacts`,
      transformResponse: (raw: { data: SubcontractorContactDTO[] }) => raw.data,
      providesTags: (_r, _e, { subcontractorId }) => [
        { type: 'SubcontractorContact', id: subcontractorId },
      ],
    }),

    createContact: build.mutation<
      SubcontractorContactDTO,
      { orgId: string; subcontractorId: string; input: CreateContactInput }
    >({
      query: ({ orgId, subcontractorId, input }) => ({
        url: `/organizations/${orgId}/subcontractors/${subcontractorId}/contacts`,
        method: 'POST',
        body: input,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: SubcontractorContactDTO }) => raw.data,
      invalidatesTags: (_r, _e, { subcontractorId }) => [
        { type: 'SubcontractorContact', id: subcontractorId },
      ],
    }),

    updateContact: build.mutation<
      SubcontractorContactDTO,
      { orgId: string; subcontractorId: string; contactId: string; input: UpdateContactInput }
    >({
      query: ({ orgId, subcontractorId, contactId, input }) => ({
        url: `/organizations/${orgId}/subcontractors/${subcontractorId}/contacts/${contactId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (raw: { data: SubcontractorContactDTO }) => raw.data,
      invalidatesTags: (_r, _e, { subcontractorId }) => [
        { type: 'SubcontractorContact', id: subcontractorId },
      ],
    }),

    // ── Project task assignments + performance ─────────────────────────────

    listTaskAssignments: build.query<
      SubcontractorTaskAssignmentDTO[],
      OrgProjectArgs & { subcontractorId: string }
    >({
      query: ({ orgId, projectId, subcontractorId }) =>
        `/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/task-assignments`,
      transformResponse: (raw: { data: SubcontractorTaskAssignmentDTO[] }) => raw.data,
      providesTags: (_r, _e, { subcontractorId }) => [
        { type: 'SubcontractorContract', id: subcontractorId },
      ],
    }),

    getSubcontractorPerformance: build.query<
      { data: PartnerPerformanceEventDTO[]; nextCursor: string | null },
      OrgProjectArgs & { subcontractorId: string }
    >({
      query: ({ orgId, projectId, subcontractorId }) =>
        `/organizations/${orgId}/projects/${projectId}/performance/subcontractors/${subcontractorId}`,
      transformResponse: (raw: {
        data: { items: PartnerPerformanceEventDTO[]; nextCursor: string | null };
      }) => ({ data: raw.data.items, nextCursor: raw.data.nextCursor }),
    }),

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
  useListSubcontractorsQuery,
  useGetSubcontractorQuery,
  useCreateSubcontractorMutation,
  useUpdateSubcontractorMutation,
  useListContactsQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useListTaskAssignmentsQuery,
  useGetSubcontractorPerformanceQuery,
  useListProjectSubcontractorsQuery,
  useGetProjectSubcontractorQuery,
  useAssignSubcontractorToProjectMutation,
  useUpdateProjectSubcontractorMutation,
  useCreateSubcontractorContactMutation,
  useUpdateSubcontractorContactMutation,
  useAssignTaskToSubcontractorMutation,
  useRemoveTaskFromSubcontractorMutation,
} = subcontractorApi;
