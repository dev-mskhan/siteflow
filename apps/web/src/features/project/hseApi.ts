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
  CreateCorrectiveActionInput,
  CreateSafetyMeetingInput,
  ExpiringItemDTO,
  QualityInspectionResult,
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
      transformResponse: (raw: { data: { data: SafetyEventDTO[]; nextCursor: string | null } }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'SafetyEvent', id: projectId }],
    }),

    createSafetyEvent: build.mutation<SafetyEventDTO, OrgProjectArgs & { input: CreateSafetyEventInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/safety-events`,
        method: 'POST',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: SafetyEventDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'SafetyEvent', id: projectId }],
    }),

    getSafetyEvent: build.query<SafetyEventDTO, OrgProjectArgs & { eventId: string }>({
      query: ({ orgId, projectId, eventId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/safety-events/${eventId}`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { event: SafetyEventDTO } }) => raw.data.event,
      providesTags: (_r, _e, { eventId }) => [{ type: 'SafetyEvent', id: eventId }],
    }),

    updateSafetyEvent: build.mutation<SafetyEventDTO, OrgProjectArgs & { eventId: string; input: Partial<CreateSafetyEventInput> }>({
      query: ({ orgId, projectId, eventId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/safety-events/${eventId}`,
        method: 'PATCH',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { event: SafetyEventDTO } }) => raw.data.event,
      invalidatesTags: (_r, _e, { eventId, projectId }) => [
        { type: 'SafetyEvent', id: eventId },
        { type: 'SafetyEvent', id: projectId },
      ],
    }),

    investigateSafetyEvent: build.mutation<SafetyEventDTO, OrgProjectArgs & { eventId: string; rootCause?: string; immediateAction?: string }>({
      query: ({ orgId, projectId, eventId, rootCause, immediateAction }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/safety-events/${eventId}/investigate`,
        method: 'POST',
        body: { rootCause, immediateAction },
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { event: SafetyEventDTO } }) => raw.data.event,
      invalidatesTags: (_r, _e, { eventId, projectId }) => [
        { type: 'SafetyEvent', id: eventId },
        { type: 'SafetyEvent', id: projectId },
      ],
    }),

    closeSafetyEvent: build.mutation<SafetyEventDTO, OrgProjectArgs & { eventId: string; notes: string }>({
      query: ({ orgId, projectId, eventId, notes }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/safety-events/${eventId}/close`,
        method: 'POST',
        body: { notes },
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { event: SafetyEventDTO } }) => raw.data.event,
      invalidatesTags: (_r, _e, { eventId, projectId }) => [
        { type: 'SafetyEvent', id: eventId },
        { type: 'SafetyEvent', id: projectId },
      ],
    }),

    createSafetyCorrectiveAction: build.mutation<CorrectiveActionDTO, OrgProjectArgs & { eventId: string; input: { title: string; description?: string; assignedTo?: string; dueDate?: string; notes?: string } }>({
      query: ({ orgId, projectId, eventId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/safety-events/${eventId}/corrective-actions`,
        method: 'POST',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { action: CorrectiveActionDTO } }) => raw.data.action,
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: 'CorrectiveAction', id: projectId },
        { type: 'SafetyEvent', id: projectId },
      ],
    }),

    // ── Safety Meetings ────────────────────────────────────────────────────

    listSafetyMeetings: build.query<{ data: SafetyMeetingDTO[]; nextCursor: string | null }, OrgProjectArgs>({
      query: ({ orgId, projectId }) =>
        `/organizations/${orgId}/projects/${projectId}/safety-meetings`,
      transformResponse: (raw: { data: { data: SafetyMeetingDTO[]; nextCursor: string | null } }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'SafetyMeeting', id: projectId }],
    }),

    // ── Quality Inspections ────────────────────────────────────────────────

    listQualityInspections: build.query<{ data: QualityInspectionDTO[]; nextCursor: string | null }, OrgProjectArgs>({
      query: ({ orgId, projectId }) =>
        `/organizations/${orgId}/projects/${projectId}/quality-inspections`,
      transformResponse: (raw: { data: { data: QualityInspectionDTO[]; nextCursor: string | null } }) => raw.data,
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
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { inspection: QualityInspectionDTO } }) => raw.data.inspection,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'QualityInspection', id: projectId }],
    }),

    getQualityInspection: build.query<QualityInspectionDTO, OrgProjectArgs & { inspectionId: string }>({
      query: ({ orgId, projectId, inspectionId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-inspections/${inspectionId}`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { inspection: QualityInspectionDTO } }) => raw.data.inspection,
      providesTags: (_r, _e, { inspectionId }) => [{ type: 'QualityInspection', id: inspectionId }],
    }),

    updateQualityInspection: build.mutation<QualityInspectionDTO, OrgProjectArgs & { inspectionId: string; input: Partial<CreateQualityInspectionInput> }>({
      query: ({ orgId, projectId, inspectionId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-inspections/${inspectionId}`,
        method: 'PATCH',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { inspection: QualityInspectionDTO } }) => raw.data.inspection,
      invalidatesTags: (_r, _e, { inspectionId, projectId }) => [
        { type: 'QualityInspection', id: inspectionId },
        { type: 'QualityInspection', id: projectId },
      ],
    }),

    startQualityInspection: build.mutation<QualityInspectionDTO, OrgProjectArgs & { inspectionId: string }>({
      query: ({ orgId, projectId, inspectionId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-inspections/${inspectionId}/start`,
        method: 'POST',
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { inspection: QualityInspectionDTO } }) => raw.data.inspection,
      invalidatesTags: (_r, _e, { inspectionId, projectId }) => [
        { type: 'QualityInspection', id: inspectionId },
        { type: 'QualityInspection', id: projectId },
      ],
    }),

    completeQualityInspection: build.mutation<QualityInspectionDTO, OrgProjectArgs & { inspectionId: string; result: 'PASS' | 'PASS_WITH_CONDITIONS' | 'FAIL'; findings?: string; performedDate: string }>({
      query: ({ orgId, projectId, inspectionId, result, findings, performedDate }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-inspections/${inspectionId}/complete`,
        method: 'POST',
        body: { result, findings, performedDate },
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { inspection: QualityInspectionDTO } }) => raw.data.inspection,
      invalidatesTags: (_r, _e, { inspectionId, projectId }) => [
        { type: 'QualityInspection', id: inspectionId },
        { type: 'QualityInspection', id: projectId },
      ],
    }),

    // ── Quality Deficiencies ───────────────────────────────────────────────

    listQualityDeficiencies: build.query<{ data: QualityDeficiencyDTO[]; nextCursor: string | null }, OrgProjectArgs>({
      query: ({ orgId, projectId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-deficiencies`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { data: QualityDeficiencyDTO[]; nextCursor: string | null } }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'QualityDeficiency', id: projectId }],
    }),

    createQualityDeficiency: build.mutation<QualityDeficiencyDTO, OrgProjectArgs & { input: { title: string; description?: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; inspectionId?: string; responsibleMemberId?: string; dueDate?: string; location?: string; notes?: string } }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-deficiencies`,
        method: 'POST',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { deficiency: QualityDeficiencyDTO } }) => raw.data.deficiency,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'QualityDeficiency', id: projectId }],
    }),

    getQualityDeficiency: build.query<QualityDeficiencyDTO, OrgProjectArgs & { deficiencyId: string }>({
      query: ({ orgId, projectId, deficiencyId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-deficiencies/${deficiencyId}`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { deficiency: QualityDeficiencyDTO } }) => raw.data.deficiency,
      providesTags: (_r, _e, { deficiencyId }) => [{ type: 'QualityDeficiency', id: deficiencyId }],
    }),

    updateQualityDeficiency: build.mutation<QualityDeficiencyDTO, OrgProjectArgs & { deficiencyId: string; input: Partial<{ title: string; description?: string; severity: string; responsibleMemberId?: string; dueDate?: string; location?: string; notes?: string }> }>({
      query: ({ orgId, projectId, deficiencyId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-deficiencies/${deficiencyId}`,
        method: 'PATCH',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { deficiency: QualityDeficiencyDTO } }) => raw.data.deficiency,
      invalidatesTags: (_r, _e, { deficiencyId, projectId }) => [
        { type: 'QualityDeficiency', id: deficiencyId },
        { type: 'QualityDeficiency', id: projectId },
      ],
    }),

    resolveQualityDeficiency: build.mutation<QualityDeficiencyDTO, OrgProjectArgs & { deficiencyId: string }>({
      query: ({ orgId, projectId, deficiencyId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-deficiencies/${deficiencyId}/resolve`,
        method: 'POST',
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { deficiency: QualityDeficiencyDTO } }) => raw.data.deficiency,
      invalidatesTags: (_r, _e, { deficiencyId, projectId }) => [
        { type: 'QualityDeficiency', id: deficiencyId },
        { type: 'QualityDeficiency', id: projectId },
      ],
    }),

    closeQualityDeficiency: build.mutation<QualityDeficiencyDTO, OrgProjectArgs & { deficiencyId: string }>({
      query: ({ orgId, projectId, deficiencyId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-deficiencies/${deficiencyId}/close`,
        method: 'POST',
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { deficiency: QualityDeficiencyDTO } }) => raw.data.deficiency,
      invalidatesTags: (_r, _e, { deficiencyId, projectId }) => [
        { type: 'QualityDeficiency', id: deficiencyId },
        { type: 'QualityDeficiency', id: projectId },
      ],
    }),

    // ── Corrective Actions ─────────────────────────────────────────────────

    listCorrectiveActions: build.query<{ data: CorrectiveActionDTO[]; nextCursor: string | null }, OrgProjectArgs>({
      query: ({ orgId, projectId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/corrective-actions`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { data: CorrectiveActionDTO[]; nextCursor: string | null } }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'CorrectiveAction', id: projectId }],
    }),

    getCorrectiveAction: build.query<CorrectiveActionDTO, OrgProjectArgs & { actionId: string }>({
      query: ({ orgId, projectId, actionId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/corrective-actions/${actionId}`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { action: CorrectiveActionDTO } }) => raw.data.action,
      providesTags: (_r, _e, { actionId }) => [{ type: 'CorrectiveAction', id: actionId }],
    }),

    completeCorrectiveAction: build.mutation<CorrectiveActionDTO, OrgProjectArgs & { actionId: string }>({
      query: ({ orgId, projectId, actionId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/corrective-actions/${actionId}/complete`,
        method: 'POST',
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { action: CorrectiveActionDTO } }) => raw.data.action,
      invalidatesTags: (_r, _e, { actionId, projectId }) => [
        { type: 'CorrectiveAction', id: actionId },
        { type: 'CorrectiveAction', id: projectId },
      ],
    }),

    verifyCorrectiveAction: build.mutation<CorrectiveActionDTO, OrgProjectArgs & { actionId: string; notes?: string }>({
      query: ({ orgId, projectId, actionId, notes }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/corrective-actions/${actionId}/verify`,
        method: 'POST',
        body: { notes },
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { action: CorrectiveActionDTO } }) => raw.data.action,
      invalidatesTags: (_r, _e, { actionId, projectId }) => [
        { type: 'CorrectiveAction', id: actionId },
        { type: 'CorrectiveAction', id: projectId },
      ],
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
      transformResponse: (raw: { data: { data: PermitDTO[]; nextCursor: string | null } }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Permit', id: projectId }],
    }),

    createPermit: build.mutation<PermitDTO, OrgProjectArgs & { input: CreatePermitInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/permits`,
        method: 'POST',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { permit: PermitDTO } }) => raw.data.permit,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Permit', id: projectId }],
    }),

    getPermit: build.query<PermitDTO, OrgProjectArgs & { permitId: string }>({
      query: ({ orgId, projectId, permitId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/permits/${permitId}`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { permit: PermitDTO } }) => raw.data.permit,
      providesTags: (_r, _e, { permitId }) => [{ type: 'Permit', id: permitId }],
    }),

    updatePermit: build.mutation<PermitDTO, OrgProjectArgs & { permitId: string; input: Partial<CreatePermitInput> }>({
      query: ({ orgId, projectId, permitId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/permits/${permitId}`,
        method: 'PATCH',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { permit: PermitDTO } }) => raw.data.permit,
      invalidatesTags: (_r, _e, { permitId, projectId }) => [
        { type: 'Permit', id: permitId },
        { type: 'Permit', id: projectId },
      ],
    }),

    transitionPermit: build.mutation<PermitDTO, OrgProjectArgs & { permitId: string; status: PermitStatus }>({
      query: ({ orgId, projectId, permitId, status }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/permits/${permitId}/transition`,
        method: 'POST',
        body: { status },
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { permit: PermitDTO } }) => raw.data.permit,
      invalidatesTags: (_r, _e, { permitId, projectId }) => [
        { type: 'Permit', id: permitId },
        { type: 'Permit', id: projectId },
      ],
    }),

    deletePermit: build.mutation<void, OrgProjectArgs & { permitId: string }>({
      query: ({ orgId, projectId, permitId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/permits/${permitId}`,
        method: 'DELETE',
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      invalidatesTags: (_r, _e, { permitId, projectId }) => [
        { type: 'Permit', id: permitId },
        { type: 'Permit', id: projectId },
      ],
    }),

    // ── Compliance Records ─────────────────────────────────────────────────

    listComplianceRecords: build.query<{ data: ComplianceRecordDTO[]; nextCursor: string | null }, OrgProjectArgs>({
      query: ({ orgId, projectId }) =>
        `/organizations/${orgId}/projects/${projectId}/compliance-records`,
      transformResponse: (raw: { data: { data: ComplianceRecordDTO[]; nextCursor: string | null } }) => raw.data,
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
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { record: ComplianceRecordDTO } }) => raw.data.record,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceRecord', id: projectId }],
    }),

    getComplianceRecord: build.query<ComplianceRecordDTO, OrgProjectArgs & { recordId: string }>({
      query: ({ orgId, projectId, recordId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/compliance-records/${recordId}`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { record: ComplianceRecordDTO } }) => raw.data.record,
      providesTags: (_r, _e, { recordId }) => [{ type: 'ComplianceRecord', id: recordId }],
    }),

    updateComplianceRecord: build.mutation<ComplianceRecordDTO, OrgProjectArgs & { recordId: string; input: Partial<CreateComplianceRecordInput> }>({
      query: ({ orgId, projectId, recordId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/compliance-records/${recordId}`,
        method: 'PATCH',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { record: ComplianceRecordDTO } }) => raw.data.record,
      invalidatesTags: (_r, _e, { recordId, projectId }) => [
        { type: 'ComplianceRecord', id: recordId },
        { type: 'ComplianceRecord', id: projectId },
      ],
    }),

    verifyComplianceRecord: build.mutation<ComplianceRecordDTO, OrgProjectArgs & { recordId: string; verificationRef: string }>({
      query: ({ orgId, projectId, recordId, verificationRef }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/compliance-records/${recordId}/verify`,
        method: 'POST',
        body: { verificationRef },
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { record: ComplianceRecordDTO } }) => raw.data.record,
      invalidatesTags: (_r, _e, { recordId, projectId }) => [
        { type: 'ComplianceRecord', id: recordId },
        { type: 'ComplianceRecord', id: projectId },
      ],
    }),

    deleteComplianceRecord: build.mutation<void, OrgProjectArgs & { recordId: string }>({
      query: ({ orgId, projectId, recordId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/compliance-records/${recordId}`,
        method: 'DELETE',
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      invalidatesTags: (_r, _e, { recordId, projectId }) => [
        { type: 'ComplianceRecord', id: recordId },
        { type: 'ComplianceRecord', id: projectId },
      ],
    }),

    // ── Compliance Inspections ─────────────────────────────────────────────

    listComplianceInspections: build.query<{ data: ComplianceInspectionDTO[]; nextCursor: string | null }, OrgProjectArgs>({
      query: ({ orgId, projectId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/compliance-inspections`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { data: ComplianceInspectionDTO[]; nextCursor: string | null } }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceInspection', id: projectId }],
    }),

    createComplianceInspection: build.mutation<ComplianceInspectionDTO, OrgProjectArgs & { input: { permitId?: string; inspectionType: string; scheduledDate?: string; inspectorName?: string; responsibleMemberId?: string; notes?: string } }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/compliance-inspections`,
        method: 'POST',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { inspection: ComplianceInspectionDTO } }) => raw.data.inspection,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceInspection', id: projectId }],
    }),

    getComplianceInspection: build.query<ComplianceInspectionDTO, OrgProjectArgs & { inspectionId: string }>({
      query: ({ orgId, projectId, inspectionId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/compliance-inspections/${inspectionId}`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { inspection: ComplianceInspectionDTO } }) => raw.data.inspection,
      providesTags: (_r, _e, { inspectionId }) => [{ type: 'ComplianceInspection', id: inspectionId }],
    }),

    updateComplianceInspection: build.mutation<ComplianceInspectionDTO, OrgProjectArgs & { inspectionId: string; input: Partial<{ inspectionType: string; scheduledDate?: string; inspectorName?: string; responsibleMemberId?: string; notes?: string }> }>({
      query: ({ orgId, projectId, inspectionId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/compliance-inspections/${inspectionId}`,
        method: 'PATCH',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { inspection: ComplianceInspectionDTO } }) => raw.data.inspection,
      invalidatesTags: (_r, _e, { inspectionId, projectId }) => [
        { type: 'ComplianceInspection', id: inspectionId },
        { type: 'ComplianceInspection', id: projectId },
      ],
    }),

    completeComplianceInspection: build.mutation<ComplianceInspectionDTO, OrgProjectArgs & { inspectionId: string; result: 'PASS' | 'PASS_WITH_CONDITIONS' | 'FAIL' | 'INCONCLUSIVE'; findings?: string; performedDate: string }>({
      query: ({ orgId, projectId, inspectionId, result, findings, performedDate }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/compliance-inspections/${inspectionId}/complete`,
        method: 'POST',
        body: { result, findings, performedDate },
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { inspection: ComplianceInspectionDTO } }) => raw.data.inspection,
      invalidatesTags: (_r, _e, { inspectionId, projectId }) => [
        { type: 'ComplianceInspection', id: inspectionId },
        { type: 'ComplianceInspection', id: projectId },
      ],
    }),

    deleteComplianceInspection: build.mutation<void, OrgProjectArgs & { inspectionId: string }>({
      query: ({ orgId, projectId, inspectionId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/compliance-inspections/${inspectionId}`,
        method: 'DELETE',
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      invalidatesTags: (_r, _e, { inspectionId, projectId }) => [
        { type: 'ComplianceInspection', id: inspectionId },
        { type: 'ComplianceInspection', id: projectId },
      ],
    }),

    // ── Generic lifecycle transitions (action dispatch used by pages) ──────

    transitionQualityInspection: build.mutation<
      QualityInspectionDTO,
      OrgProjectArgs & {
        inspectionId: string;
        action: 'start' | 'complete';
        result?: QualityInspectionResult;
        findings?: string;
        performedDate?: string;
      }
    >({
      query: ({ orgId, projectId, inspectionId, action, result, findings, performedDate }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-inspections/${inspectionId}/${action}`,
        method: 'POST',
        body: action === 'complete' ? { result, findings, performedDate } : {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { inspection: QualityInspectionDTO } }) => raw.data.inspection,
      invalidatesTags: (_r, _e, { inspectionId, projectId }) => [
        { type: 'QualityInspection', id: inspectionId },
        { type: 'QualityInspection', id: projectId },
      ],
    }),

    transitionQualityDeficiency: build.mutation<
      QualityDeficiencyDTO,
      OrgProjectArgs & { deficiencyId: string; action: 'resolve' | 'close' }
    >({
      query: ({ orgId, projectId, deficiencyId, action }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/quality-deficiencies/${deficiencyId}/${action}`,
        method: 'POST',
        body: {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { deficiency: QualityDeficiencyDTO } }) => raw.data.deficiency,
      invalidatesTags: (_r, _e, { deficiencyId, projectId }) => [
        { type: 'QualityDeficiency', id: deficiencyId },
        { type: 'QualityDeficiency', id: projectId },
      ],
    }),

    createCorrectiveAction: build.mutation<CorrectiveActionDTO, OrgProjectArgs & { input: CreateCorrectiveActionInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/corrective-actions`,
        method: 'POST',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { action: CorrectiveActionDTO } }) => raw.data.action,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'CorrectiveAction', id: projectId }],
    }),

    transitionCorrectiveAction: build.mutation<
      CorrectiveActionDTO,
      OrgProjectArgs & { actionId: string; action: 'complete' | 'verify'; notes?: string }
    >({
      query: ({ orgId, projectId, actionId, action, notes }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/corrective-actions/${actionId}/${action}`,
        method: 'POST',
        body: action === 'verify' ? { notes } : {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { action: CorrectiveActionDTO } }) => raw.data.action,
      invalidatesTags: (_r, _e, { actionId, projectId }) => [
        { type: 'CorrectiveAction', id: actionId },
        { type: 'CorrectiveAction', id: projectId },
      ],
    }),

    transitionSafetyEvent: build.mutation<
      SafetyEventDTO,
      OrgProjectArgs & { eventId: string; action: 'investigate' | 'close'; notes?: string }
    >({
      query: ({ orgId, projectId, eventId, action, notes }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/safety-events/${eventId}/${action}`,
        method: 'POST',
        body: action === 'close' ? { notes } : {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { event: SafetyEventDTO } }) => raw.data.event,
      invalidatesTags: (_r, _e, { eventId, projectId }) => [
        { type: 'SafetyEvent', id: eventId },
        { type: 'SafetyEvent', id: projectId },
      ],
    }),

    createSafetyMeeting: build.mutation<SafetyMeetingDTO, OrgProjectArgs & { input: CreateSafetyMeetingInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/safety-meetings`,
        method: 'POST',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { meeting: SafetyMeetingDTO } }) => raw.data.meeting,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'SafetyMeeting', id: projectId }],
    }),

    // ── Expiring items (documents, permits, compliance records) ────────────

    listExpiring: build.query<
      { items: ExpiringItemDTO[]; total: number },
      OrgProjectArgs & { days?: number; entityType?: ExpiringItemDTO['entityType'] }
    >({
      query: ({ orgId, projectId, days, entityType }) => {
        const params = new URLSearchParams();
        if (days !== undefined) params.set('days', String(days));
        if (entityType) params.set('entityType', entityType);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/expiring${query}`;
      },
      transformResponse: (raw: { data: { items: ExpiringItemDTO[]; total: number } }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceRecord', id: projectId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  // Safety Events
  useListSafetyEventsQuery,
  useCreateSafetyEventMutation,
  useGetSafetyEventQuery,
  useUpdateSafetyEventMutation,
  useInvestigateSafetyEventMutation,
  useCloseSafetyEventMutation,
  useCreateSafetyCorrectiveActionMutation,
  useTransitionSafetyEventMutation,
  // Safety Meetings
  useListSafetyMeetingsQuery,
  useCreateSafetyMeetingMutation,
  // Quality Inspections
  useListQualityInspectionsQuery,
  useCreateQualityInspectionMutation,
  useGetQualityInspectionQuery,
  useUpdateQualityInspectionMutation,
  useStartQualityInspectionMutation,
  useCompleteQualityInspectionMutation,
  useTransitionQualityInspectionMutation,
  // Quality Deficiencies
  useListQualityDeficienciesQuery,
  useCreateQualityDeficiencyMutation,
  useGetQualityDeficiencyQuery,
  useUpdateQualityDeficiencyMutation,
  useResolveQualityDeficiencyMutation,
  useCloseQualityDeficiencyMutation,
  useTransitionQualityDeficiencyMutation,
  // Corrective Actions
  useListCorrectiveActionsQuery,
  useGetCorrectiveActionQuery,
  useCompleteCorrectiveActionMutation,
  useVerifyCorrectiveActionMutation,
  useCreateCorrectiveActionMutation,
  useTransitionCorrectiveActionMutation,
  // Permits
  useListPermitsQuery,
  useCreatePermitMutation,
  useGetPermitQuery,
  useUpdatePermitMutation,
  useTransitionPermitMutation,
  useDeletePermitMutation,
  // Compliance Records
  useListComplianceRecordsQuery,
  useCreateComplianceRecordMutation,
  useGetComplianceRecordQuery,
  useUpdateComplianceRecordMutation,
  useVerifyComplianceRecordMutation,
  useDeleteComplianceRecordMutation,
  // Compliance Inspections
  useListComplianceInspectionsQuery,
  useCreateComplianceInspectionMutation,
  useGetComplianceInspectionQuery,
  useUpdateComplianceInspectionMutation,
  useCompleteComplianceInspectionMutation,
  useDeleteComplianceInspectionMutation,
  // Expiring
  useListExpiringQuery,
} = hseApi;
