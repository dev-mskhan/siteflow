/**
 * subcontractorApi — RTK Query slice for all Group 6 subcontractor & performance endpoints.
 *
 * Backend source:
 *   apps/server/src/modules/project/subcontractor/subcontractor.handler.ts
 *   apps/server/src/modules/project/subcontractor/subcontractor.service.ts
 *   apps/server/src/modules/project/performance/performance.handler.ts
 *   apps/server/src/modules/project/performance/performance.service.ts
 *
 * Schemas (authoritative):
 *   packages/shared/src/modules/project/subcontractor.schema.ts
 *
 * Routes registered in:
 *   apps/server/src/modules/project/project.routes.ts (subcontractor + performance sections)
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type {
  SubcontractorDTO,
  SubcontractorContactDTO,
  ProjectSubcontractorDTO,
  SubcontractorTaskAssignmentDTO,
  PartnerPerformanceEventDTO,
  CreateSubcontractorInput,
  UpdateSubcontractorInput,
  AssignSubcontractorToProjectInput,
  UpdateProjectSubcontractorInput,
  CreateContactInput,
  UpdateContactInput,
  AssignTaskInput,
} from '../types/subcontractorTypes';
import {
  MOCK_SUBCONTRACTORS,
  MOCK_SUBCONTRACTOR_CONTACTS,
  MOCK_PROJECT_SUBCONTRACTORS,
  MOCK_TASK_ASSIGNMENTS,
  MOCK_PERFORMANCE_EVENTS,
} from '../fixtures/subcontractor.fixtures';

const delay = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

export const subcontractorApi = createApi({
  reducerPath: 'subcontractorApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['Subcontractor', 'Contact', 'ProjectSub', 'TaskAssignment', 'Performance'],

  endpoints: (build) => ({

    // ── Org-level: list + create + update ─────────────────────────────────────
    // GET  /:orgId/subcontractors
    listSubcontractors: build.query<
      { data: SubcontractorDTO[]; nextCursor: string | null },
      { orgId: string; status?: string }
    >({
      queryFn: async ({ orgId, status }) => {
        await delay();
        let data = MOCK_SUBCONTRACTORS[orgId] ?? [];
        if (status) data = data.filter((s) => s.status === status);
        return { data: { data, nextCursor: null } };
      },
      providesTags: (_r, _e, { orgId }) => [{ type: 'Subcontractor', id: orgId }],
    }),

    // GET  /:orgId/subcontractors/:subcontractorId
    getSubcontractor: build.query<SubcontractorDTO, { orgId: string; subcontractorId: string }>({
      queryFn: async ({ orgId, subcontractorId }) => {
        await delay(120);
        const sub = (MOCK_SUBCONTRACTORS[orgId] ?? []).find((s) => s.id === subcontractorId);
        if (!sub) return { error: { status: 404, error: 'SUBCONTRACTOR_NOT_FOUND' } };
        return { data: sub };
      },
      providesTags: (_r, _e, { subcontractorId }) => [{ type: 'Subcontractor', id: subcontractorId }],
    }),

    // POST /:orgId/subcontractors
    createSubcontractor: build.mutation<
      SubcontractorDTO,
      { orgId: string; input: CreateSubcontractorInput }
    >({
      queryFn: async ({ orgId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const newSub: SubcontractorDTO = {
          id: `sub_${Date.now()}`,
          organizationId: orgId,
          legalName: input.legalName,
          displayName: input.displayName,
          trade: input.trade ?? null,
          registrationReference: input.registrationReference ?? null,
          taxReference: input.taxReference ?? null,
          status: 'ACTIVE',
          primaryEmail: input.primaryEmail ?? null,
          primaryPhone: input.primaryPhone ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_SUBCONTRACTORS[orgId] = [...(MOCK_SUBCONTRACTORS[orgId] ?? []), newSub];
        MOCK_SUBCONTRACTOR_CONTACTS[newSub.id] = [];
        return { data: newSub };
      },
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Subcontractor', id: orgId }],
    }),

    // PATCH /:orgId/subcontractors/:subcontractorId
    updateSubcontractor: build.mutation<
      SubcontractorDTO,
      { orgId: string; subcontractorId: string; input: UpdateSubcontractorInput }
    >({
      queryFn: async ({ orgId, subcontractorId, input }) => {
        await delay(180);
        const subs = MOCK_SUBCONTRACTORS[orgId] ?? [];
        const idx = subs.findIndex((s) => s.id === subcontractorId);
        if (idx === -1) return { error: { status: 404, error: 'SUBCONTRACTOR_NOT_FOUND' } };
        const updated = { ...subs[idx]!, ...input, updatedAt: new Date().toISOString() };
        MOCK_SUBCONTRACTORS[orgId] = subs.map((s) => s.id === subcontractorId ? updated : s);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { orgId, subcontractorId }) => [
        { type: 'Subcontractor', id: subcontractorId },
        { type: 'Subcontractor', id: orgId },
      ],
    }),

    // ── Contacts ──────────────────────────────────────────────────────────────
    // GET  contacts via getSubcontractor (contacts embedded in fixtures separately)
    listContacts: build.query<SubcontractorContactDTO[], { orgId: string; subcontractorId: string }>({
      queryFn: async ({ subcontractorId }) => {
        await delay(120);
        return { data: MOCK_SUBCONTRACTOR_CONTACTS[subcontractorId] ?? [] };
      },
      providesTags: (_r, _e, { subcontractorId }) => [{ type: 'Contact', id: subcontractorId }],
    }),

    // POST /:orgId/projects/:projectId/subcontractors/:subcontractorId/contacts
    createContact: build.mutation<
      SubcontractorContactDTO,
      { orgId: string; subcontractorId: string; input: CreateContactInput }
    >({
      queryFn: async ({ orgId, subcontractorId, input }) => {
        await delay(200);
        const existing = MOCK_SUBCONTRACTOR_CONTACTS[subcontractorId] ?? [];
        // Partial unique index: only one primary per subcontractor
        if (input.isPrimary) {
          const hasPrimary = existing.some((c) => c.isPrimary && c.isActive);
          if (hasPrimary) return { error: { status: 409, error: 'PRIMARY_CONTACT_ALREADY_EXISTS' } };
        }
        const now = new Date().toISOString();
        const newContact: SubcontractorContactDTO = {
          id: `con_${Date.now()}`,
          subcontractorId,
          organizationId: orgId,
          name: input.name,
          role: input.role ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          isPrimary: input.isPrimary ?? false,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_SUBCONTRACTOR_CONTACTS[subcontractorId] = [...existing, newContact];
        return { data: newContact };
      },
      invalidatesTags: (_r, _e, { subcontractorId }) => [{ type: 'Contact', id: subcontractorId }],
    }),

    // PATCH /:orgId/projects/:projectId/subcontractors/:subcontractorId/contacts/:contactId
    updateContact: build.mutation<
      SubcontractorContactDTO,
      { orgId: string; subcontractorId: string; contactId: string; input: UpdateContactInput }
    >({
      queryFn: async ({ subcontractorId, contactId, input }) => {
        await delay(180);
        const contacts = MOCK_SUBCONTRACTOR_CONTACTS[subcontractorId] ?? [];
        const idx = contacts.findIndex((c) => c.id === contactId);
        if (idx === -1) return { error: { status: 404, error: 'CONTACT_NOT_FOUND' } };
        // If setting isPrimary=true, unset existing primary first
        let updated = [...contacts];
        if (input.isPrimary === true && !contacts[idx]!.isPrimary) {
          updated = updated.map((c) => c.isPrimary ? { ...c, isPrimary: false } : c);
        }
        updated[idx] = { ...updated[idx]!, ...input, updatedAt: new Date().toISOString() };
        MOCK_SUBCONTRACTOR_CONTACTS[subcontractorId] = updated;
        return { data: updated[idx]! };
      },
      invalidatesTags: (_r, _e, { subcontractorId }) => [{ type: 'Contact', id: subcontractorId }],
    }),

    // ── Project assignment ────────────────────────────────────────────────────
    // GET  /:orgId/projects/:projectId/subcontractors
    listProjectSubcontractors: build.query<
      ProjectSubcontractorDTO[],
      { orgId: string; projectId: string }
    >({
      queryFn: async ({ projectId }) => {
        await delay();
        return { data: MOCK_PROJECT_SUBCONTRACTORS[projectId] ?? [] };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'ProjectSub', id: projectId }],
    }),

    // GET  /:orgId/projects/:projectId/subcontractors/:subcontractorId
    getProjectSubcontractor: build.query<
      ProjectSubcontractorDTO,
      { orgId: string; projectId: string; subcontractorId: string }
    >({
      queryFn: async ({ projectId, subcontractorId }) => {
        await delay(120);
        const ps = (MOCK_PROJECT_SUBCONTRACTORS[projectId] ?? []).find(
          (p) => p.subcontractorId === subcontractorId,
        );
        if (!ps) return { error: { status: 404, error: 'PROJECT_SUBCONTRACTOR_NOT_FOUND' } };
        return { data: ps };
      },
      providesTags: (_r, _e, { subcontractorId }) => [{ type: 'ProjectSub', id: subcontractorId }],
    }),

    // POST /:orgId/projects/:projectId/subcontractors
    assignSubcontractorToProject: build.mutation<
      ProjectSubcontractorDTO,
      { orgId: string; projectId: string; input: AssignSubcontractorToProjectInput }
    >({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const existing = MOCK_PROJECT_SUBCONTRACTORS[projectId] ?? [];
        // Check for duplicate
        if (existing.some((p) => p.subcontractorId === input.subcontractorId)) {
          return { error: { status: 409, error: 'SUBCONTRACTOR_ALREADY_ASSIGNED_TO_PROJECT' } };
        }
        // Validate sub is ACTIVE
        const sub = (MOCK_SUBCONTRACTORS[orgId] ?? []).find((s) => s.id === input.subcontractorId);
        if (!sub) return { error: { status: 404, error: 'SUBCONTRACTOR_NOT_FOUND' } };
        if (sub.status !== 'ACTIVE') return { error: { status: 422, error: 'SUBCONTRACTOR_INACTIVE' } };

        const now = new Date().toISOString();
        const newPS: ProjectSubcontractorDTO = {
          id: `ps_${Date.now()}`,
          organizationId: orgId,
          projectId,
          subcontractorId: input.subcontractorId,
          status: 'ACTIVE',
          scopeDescription: input.scopeDescription ?? null,
          contractValue: input.contractValue ?? null,
          currencyCode: input.currencyCode ?? null,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          subcontractor: sub,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_PROJECT_SUBCONTRACTORS[projectId] = [...existing, newPS];
        MOCK_TASK_ASSIGNMENTS[input.subcontractorId] = MOCK_TASK_ASSIGNMENTS[input.subcontractorId] ?? [];
        return { data: newPS };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ProjectSub', id: projectId }],
    }),

    // PATCH /:orgId/projects/:projectId/subcontractors/:subcontractorId
    updateProjectSubcontractor: build.mutation<
      ProjectSubcontractorDTO,
      {
        orgId: string;
        projectId: string;
        subcontractorId: string;
        input: UpdateProjectSubcontractorInput;
      }
    >({
      queryFn: async ({ projectId, subcontractorId, input }) => {
        await delay(180);
        const list = MOCK_PROJECT_SUBCONTRACTORS[projectId] ?? [];
        const idx = list.findIndex((p) => p.subcontractorId === subcontractorId);
        if (idx === -1) return { error: { status: 404, error: 'PROJECT_SUBCONTRACTOR_NOT_FOUND' } };
        const updated = { ...list[idx]!, ...input, updatedAt: new Date().toISOString() };
        MOCK_PROJECT_SUBCONTRACTORS[projectId] = list.map((p) =>
          p.subcontractorId === subcontractorId ? updated : p,
        );
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, subcontractorId }) => [
        { type: 'ProjectSub', id: projectId },
        { type: 'ProjectSub', id: subcontractorId },
      ],
    }),

    // ── Task assignments ──────────────────────────────────────────────────────
    // GET via listTaskAssignments (filtered by subcontractorId on client)
    listTaskAssignments: build.query<
      SubcontractorTaskAssignmentDTO[],
      { orgId: string; projectId: string; subcontractorId: string }
    >({
      queryFn: async ({ subcontractorId }) => {
        await delay(120);
        return { data: MOCK_TASK_ASSIGNMENTS[subcontractorId] ?? [] };
      },
      providesTags: (_r, _e, { subcontractorId }) => [
        { type: 'TaskAssignment', id: subcontractorId },
      ],
    }),

    // POST /:orgId/projects/:projectId/subcontractors/:subcontractorId/task-assignments
    assignTask: build.mutation<
      SubcontractorTaskAssignmentDTO,
      {
        orgId: string;
        projectId: string;
        subcontractorId: string;
        input: AssignTaskInput;
      }
    >({
      queryFn: async ({ orgId, projectId, subcontractorId, input }) => {
        await delay(200);
        const existing = MOCK_TASK_ASSIGNMENTS[subcontractorId] ?? [];
        if (existing.some((a) => a.taskId === input.taskId)) {
          return { error: { status: 409, error: 'TASK_ALREADY_ASSIGNED_TO_SUBCONTRACTOR' } };
        }
        const now = new Date().toISOString();
        const newAssignment: SubcontractorTaskAssignmentDTO = {
          id: `ta_${Date.now()}`,
          organizationId: orgId,
          projectId,
          subcontractorId,
          taskId: input.taskId,
          assignmentRole: input.assignmentRole ?? null,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_TASK_ASSIGNMENTS[subcontractorId] = [...existing, newAssignment];
        return { data: newAssignment };
      },
      invalidatesTags: (_r, _e, { subcontractorId }) => [
        { type: 'TaskAssignment', id: subcontractorId },
      ],
    }),

    // DELETE /:orgId/projects/:projectId/subcontractors/:subcontractorId/task-assignments/:taskId
    removeTaskAssignment: build.mutation<
      void,
      { orgId: string; projectId: string; subcontractorId: string; taskId: string }
    >({
      queryFn: async ({ subcontractorId, taskId }) => {
        await delay(150);
        const existing = MOCK_TASK_ASSIGNMENTS[subcontractorId] ?? [];
        if (!existing.some((a) => a.taskId === taskId)) {
          return { error: { status: 404, error: 'TASK_ASSIGNMENT_NOT_FOUND' } };
        }
        MOCK_TASK_ASSIGNMENTS[subcontractorId] = existing.filter((a) => a.taskId !== taskId);
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { subcontractorId }) => [
        { type: 'TaskAssignment', id: subcontractorId },
      ],
    }),

    // ── Performance ───────────────────────────────────────────────────────────
    // GET /:orgId/projects/:projectId/performance/subcontractors/:subcontractorId
    getSubcontractorPerformance: build.query<
      { data: PartnerPerformanceEventDTO[]; nextCursor: string | null },
      { orgId: string; projectId: string; subcontractorId: string }
    >({
      queryFn: async ({ subcontractorId }) => {
        await delay(150);
        return {
          data: {
            data: MOCK_PERFORMANCE_EVENTS[subcontractorId] ?? [],
            nextCursor: null,
          },
        };
      },
      providesTags: (_r, _e, { subcontractorId }) => [
        { type: 'Performance', id: `sub:${subcontractorId}` },
      ],
    }),

    // GET /:orgId/projects/:projectId/performance/suppliers/:supplierId
    getSupplierPerformance: build.query<
      { data: PartnerPerformanceEventDTO[]; nextCursor: string | null },
      { orgId: string; projectId: string; supplierId: string }
    >({
      queryFn: async ({ supplierId }) => {
        await delay(150);
        return {
          data: {
            data: MOCK_PERFORMANCE_EVENTS[supplierId] ?? [],
            nextCursor: null,
          },
        };
      },
      providesTags: (_r, _e, { supplierId }) => [
        { type: 'Performance', id: `sup:${supplierId}` },
      ],
    }),
  }),
});

export const {
  useListSubcontractorsQuery,
  useGetSubcontractorQuery,
  useCreateSubcontractorMutation,
  useUpdateSubcontractorMutation,
  useListContactsQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useListProjectSubcontractorsQuery,
  useGetProjectSubcontractorQuery,
  useAssignSubcontractorToProjectMutation,
  useUpdateProjectSubcontractorMutation,
  useListTaskAssignmentsQuery,
  useAssignTaskMutation,
  useRemoveTaskAssignmentMutation,
  useGetSubcontractorPerformanceQuery,
  useGetSupplierPerformanceQuery,
} = subcontractorApi;
