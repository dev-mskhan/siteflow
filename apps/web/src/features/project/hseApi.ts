/**
 * hseApi — Live integration for HSE (Health, Safety, Environment) and Quality modules.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Modules: Safety Events, Quality Inspections, Permits, Compliance
 */
import { baseApi } from '../../services/baseApi';
import type {
  SafetyEventDTO,
  SafetyMeetingDTO,
  QualityInspectionDTO,
  QualityDeficiencyDTO,
  CorrectiveActionDTO,
  PermitDTO,
  ComplianceRecordDTO,
  ComplianceInspectionDTO,
  CreateSafetyEventInput,
  CreateQualityInspectionInput,
  CreatePermitInput,
  CreateComplianceRecordInput,
  SafetyEventStatus,
  PermitStatus,
} from '../../types/hseTypes';

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export const hseApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Safety Events ──────────────────────────────────────────────────────

    listSafetyEvents: build.query<
      { data: SafetyEventDTO[]; nextCursor: string | null },
      OrgProjectArgs & { status?: SafetyEventStatus; cursor?: string }
    >({
      query: ({ orgId, projectId, status, cursor }) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (cursor) params.set('cursor', cursor);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/safety-events${query}`;
      },
      transformResponse: (raw: { data: SafetyEventDTO[]; meta: { nextCursor: string | null } }) => ({
        data: raw.data,
        nextCursor: raw.meta.nextCursor,
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'SafetyEvent', id: projectId }],
    }),

    createSafetyEvent: build.mutation<SafetyEventDTO, OrgProjectArgs & { input: CreateSafetyEventInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/safety-events`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: SafetyEventDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'SafetyEvent', id: projectId }],
    }),

    // ── Safety Meetings ────────────────────────────────────────────────────

    listSafetyMeetings: build.query<SafetyMeetingDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) =>
        `/organizations/${orgId}/projects/${projectId}/safety-meetings`,
      transformResponse: (raw: { data: SafetyMeetingDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'SafetyMeeting', id: projectId }],
    }),

    // ── Quality Inspections ────────────────────────────────────────────────

    listQualityInspections: build.query<QualityInspectionDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) =>
        `/organizations/${orgId}/projects/${projectId}/quality-inspections`,
      transformResponse: (raw: { data: QualityInspectionDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'QualityInspection', id: projectId }],
    }),

    createQualityInspection: build.mutation<
      QualityInspectionDTO,
      OrgProjectArgs & { input: CreateQualityInspectionInput }
    >({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-inspections`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: QualityInspectionDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'QualityInspection', id: projectId }],
    }),

    // ── Quality Deficiencies ───────────────────────────────────────────────

    listQualityDeficiencies: build.query<QualityDeficiencyDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) =>
        `/organizations/${orgId}/projects/${projectId}/quality-deficiencies`,
      transformResponse: (raw: { data: QualityDeficiencyDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'QualityDeficiency', id: projectId }],
    }),

    // ── Corrective Actions ─────────────────────────────────────────────────

    listCorrectiveActions: build.query<CorrectiveActionDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) =>
        `/organizations/${orgId}/projects/${projectId}/corrective-actions`,
      transformResponse: (raw: { data: CorrectiveActionDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'CorrectiveAction', id: projectId }],
    }),

    // ── Permits ────────────────────────────────────────────────────────────

    listPermits: build.query<
      { data: PermitDTO[]; nextCursor: string | null },
      OrgProjectArgs & { status?: PermitStatus; cursor?: string }
    >({
      query: ({ orgId, projectId, status, cursor }) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (cursor) params.set('cursor', cursor);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/permits${query}`;
      },
      transformResponse: (raw: { data: PermitDTO[]; meta: { nextCursor: string | null } }) => ({
        data: raw.data,
        nextCursor: raw.meta.nextCursor,
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'Permit', id: projectId }],
    }),

    createPermit: build.mutation<PermitDTO, OrgProjectArgs & { input: CreatePermitInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/permits`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: PermitDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Permit', id: projectId }],
    }),

    // ── Compliance Records ─────────────────────────────────────────────────

    listComplianceRecords: build.query<ComplianceRecordDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) =>
        `/organizations/${orgId}/projects/${projectId}/compliance-records`,
      transformResponse: (raw: { data: ComplianceRecordDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceRecord', id: projectId }],
    }),

    createComplianceRecord: build.mutation<
      ComplianceRecordDTO,
      OrgProjectArgs & { input: CreateComplianceRecordInput }
    >({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/compliance-records`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: ComplianceRecordDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceRecord', id: projectId }],
    }),

    // ── Compliance Inspections ─────────────────────────────────────────────

    listComplianceInspections: build.query<ComplianceInspectionDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) =>
        `/organizations/${orgId}/projects/${projectId}/compliance-inspections`,
      transformResponse: (raw: { data: ComplianceInspectionDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceInspection', id: projectId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListSafetyEventsQuery,
  useCreateSafetyEventMutation,
  useListSafetyMeetingsQuery,
  useListQualityInspectionsQuery,
  useCreateQualityInspectionMutation,
  useListQualityDeficienciesQuery,
  useListCorrectiveActionsQuery,
  useListPermitsQuery,
  useCreatePermitMutation,
  useListComplianceRecordsQuery,
  useCreateComplianceRecordMutation,
  useListComplianceInspectionsQuery,
} = hseApi;
