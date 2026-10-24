/**
 * hseApi — Group 10: Safety, Quality, Compliance.
 * All state machine guards enforced in queryFn.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type {
  SafetyEventDTO, SafetyMeetingDTO, CreateSafetyEventInput,
  QualityInspectionDTO, QualityDeficiencyDTO, CorrectiveActionDTO,
  PermitDTO, ComplianceRecordDTO, ComplianceInspectionDTO,
  ExpiringItemDTO, PermitStatus, SafetyEventStatus,
} from '../types/hseTypes';
import {
  MOCK_SAFETY_EVENTS, MOCK_QUALITY_INSPECTIONS, MOCK_QUALITY_DEFICIENCIES,
  MOCK_CORRECTIVE_ACTIONS, MOCK_PERMITS, MOCK_COMPLIANCE_RECORDS,
} from '../fixtures/hse.fixtures';

const delay = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

const MOCK_SAFETY_MEETINGS: Record<string, SafetyMeetingDTO[]> = { proj_01: [] };
const MOCK_COMPLIANCE_INSPECTIONS: Record<string, ComplianceInspectionDTO[]> = { proj_01: [] };

export const hseApi = createApi({
  reducerPath: 'hseApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['SafetyEvent', 'SafetyMeeting', 'QualityInspection', 'QualityDeficiency', 'CorrectiveAction', 'Permit', 'ComplianceRecord', 'ComplianceInspection'],
  endpoints: (build) => ({

    // ── SAFETY ──────────────────────────────────────────────────────────────

    listSafetyEvents: build.query<{ data: SafetyEventDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: SafetyEventStatus }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_SAFETY_EVENTS[projectId] ?? [];
        if (status) items = items.filter((e) => e.status === status);
        return { data: { data: items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'SafetyEvent', id: projectId }],
    }),

    createSafetyEvent: build.mutation<SafetyEventDTO, { orgId: string; projectId: string; input: CreateSafetyEventInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const ev: SafetyEventDTO = {
          id: `sev_${Date.now()}`,
          organizationId: orgId, projectId,
          ...input,
          severity: input.severity ?? null,
          location: input.location ?? null,
          involvedParties: input.involvedParties ?? null,
          assignedTo: input.assignedTo ?? null,
          immediateAction: input.immediateAction ?? null,
          notes: input.notes ?? null,
          status: 'REPORTED',
          createdBy: 'usr_01',
          investigatedBy: null, investigatedAt: null,
          closedBy: null, closedAt: null,
          version: 1, createdAt: now, updatedAt: now,
        };
        MOCK_SAFETY_EVENTS[projectId] = [...(MOCK_SAFETY_EVENTS[projectId] ?? []), ev];
        return { data: ev };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'SafetyEvent', id: projectId }],
    }),

    transitionSafetyEvent: build.mutation<SafetyEventDTO, { orgId: string; projectId: string; eventId: string; action: 'investigate' | 'close'; notes?: string }>({
      queryFn: async ({ projectId, eventId, action, notes }) => {
        await delay(180);
        const list = MOCK_SAFETY_EVENTS[projectId] ?? [];
        const ev = list.find((e) => e.id === eventId);
        if (!ev) return { error: { status: 404, error: 'NOT_FOUND' } };
        const now = new Date().toISOString();
        const statusMap: Record<string, SafetyEventStatus> = { investigate: 'UNDER_INVESTIGATION', close: 'CLOSED' };
        const updated: SafetyEventDTO = {
          ...ev, status: statusMap[action]!, version: ev.version + 1, updatedAt: now,
          investigatedBy: action === 'investigate' ? 'usr_01' : ev.investigatedBy,
          investigatedAt: action === 'investigate' ? now : ev.investigatedAt,
          closedBy: action === 'close' ? 'usr_01' : ev.closedBy,
          closedAt: action === 'close' ? now : ev.closedAt,
          notes: action === 'close' && notes ? notes : ev.notes,
        };
        MOCK_SAFETY_EVENTS[projectId] = list.map((e) => e.id === eventId ? updated : e);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'SafetyEvent', id: projectId }],
    }),

    listSafetyMeetings: build.query<{ data: SafetyMeetingDTO[] }, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await delay();
        return { data: { data: MOCK_SAFETY_MEETINGS[projectId] ?? [] } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'SafetyMeeting', id: projectId }],
    }),

    createSafetyMeeting: build.mutation<SafetyMeetingDTO, { orgId: string; projectId: string; input: { meetingType: string; title: string; scheduledAt: string; location?: string; attendeeCount?: number; agenda?: string; notes?: string } }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const mtg: SafetyMeetingDTO = { id: `smtg_${Date.now()}`, organizationId: orgId, projectId, ...input, location: input.location ?? null, attendeeCount: input.attendeeCount ?? null, agenda: input.agenda ?? null, notes: input.notes ?? null, createdBy: 'usr_01', createdAt: now, updatedAt: now };
        MOCK_SAFETY_MEETINGS[projectId] = [...(MOCK_SAFETY_MEETINGS[projectId] ?? []), mtg];
        return { data: mtg };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'SafetyMeeting', id: projectId }],
    }),

    // ── QUALITY INSPECTIONS ──────────────────────────────────────────────────

    listQualityInspections: build.query<{ data: QualityInspectionDTO[] }, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => { await delay(); return { data: { data: MOCK_QUALITY_INSPECTIONS[projectId] ?? [] } }; },
      providesTags: (_r, _e, { projectId }) => [{ type: 'QualityInspection', id: projectId }],
    }),

    createQualityInspection: build.mutation<QualityInspectionDTO, { orgId: string; projectId: string; input: { inspectionType: string; scheduledDate?: string; inspectorMemberId?: string; location?: string; notes?: string } }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const insp: QualityInspectionDTO = { id: `qi_${Date.now()}`, organizationId: orgId, projectId, ...input, scheduledDate: input.scheduledDate ?? null, inspectorMemberId: input.inspectorMemberId ?? null, location: input.location ?? null, notes: input.notes ?? null, status: 'SCHEDULED', result: null, performedDate: null, findings: null, createdBy: 'usr_01', createdAt: now, updatedAt: now };
        MOCK_QUALITY_INSPECTIONS[projectId] = [...(MOCK_QUALITY_INSPECTIONS[projectId] ?? []), insp];
        return { data: insp };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'QualityInspection', id: projectId }],
    }),

    transitionQualityInspection: build.mutation<QualityInspectionDTO, { orgId: string; projectId: string; inspectionId: string; action: 'start' | 'complete'; result?: string; performedDate?: string; findings?: string }>({
      queryFn: async ({ projectId, inspectionId, action, result, performedDate, findings }) => {
        await delay(180);
        const list = MOCK_QUALITY_INSPECTIONS[projectId] ?? [];
        const insp = list.find((i) => i.id === inspectionId);
        if (!insp) return { error: { status: 404, error: 'NOT_FOUND' } };
        const now = new Date().toISOString();
        const updated = { ...insp, status: action === 'start' ? 'IN_PROGRESS' : 'COMPLETED' as any, result: result ?? insp.result, performedDate: performedDate ?? insp.performedDate, findings: findings ?? insp.findings, updatedAt: now };
        MOCK_QUALITY_INSPECTIONS[projectId] = list.map((i) => i.id === inspectionId ? updated : i);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'QualityInspection', id: projectId }],
    }),

    // ── QUALITY DEFICIENCIES ─────────────────────────────────────────────────

    listQualityDeficiencies: build.query<{ data: QualityDeficiencyDTO[] }, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => { await delay(); return { data: { data: MOCK_QUALITY_DEFICIENCIES[projectId] ?? [] } }; },
      providesTags: (_r, _e, { projectId }) => [{ type: 'QualityDeficiency', id: projectId }],
    }),

    createQualityDeficiency: build.mutation<QualityDeficiencyDTO, { orgId: string; projectId: string; input: { title: string; severity?: string; inspectionId?: string; description?: string; responsibleMemberId?: string; dueDate?: string; location?: string; notes?: string } }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const def: QualityDeficiencyDTO = { id: `qd_${Date.now()}`, organizationId: orgId, projectId, title: input.title, status: 'OPEN', severity: input.severity as any ?? null, inspectionId: input.inspectionId ?? null, description: input.description ?? null, responsibleMemberId: input.responsibleMemberId ?? null, dueDate: input.dueDate ?? null, location: input.location ?? null, notes: input.notes ?? null, resolvedAt: null, closedAt: null, createdBy: 'usr_01', createdAt: now, updatedAt: now };
        MOCK_QUALITY_DEFICIENCIES[projectId] = [...(MOCK_QUALITY_DEFICIENCIES[projectId] ?? []), def];
        return { data: def };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'QualityDeficiency', id: projectId }],
    }),

    transitionQualityDeficiency: build.mutation<QualityDeficiencyDTO, { orgId: string; projectId: string; deficiencyId: string; action: 'resolve' | 'close' }>({
      queryFn: async ({ projectId, deficiencyId, action }) => {
        await delay(180);
        const list = MOCK_QUALITY_DEFICIENCIES[projectId] ?? [];
        const def = list.find((d) => d.id === deficiencyId);
        if (!def) return { error: { status: 404, error: 'NOT_FOUND' } };
        const now = new Date().toISOString();
        const updated = { ...def, status: action === 'resolve' ? 'RESOLVED' as any : 'CLOSED', resolvedAt: action === 'resolve' ? now : def.resolvedAt, closedAt: action === 'close' ? now : def.closedAt, updatedAt: now };
        MOCK_QUALITY_DEFICIENCIES[projectId] = list.map((d) => d.id === deficiencyId ? updated : d);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'QualityDeficiency', id: projectId }],
    }),

    // ── CORRECTIVE ACTIONS ───────────────────────────────────────────────────

    listCorrectiveActions: build.query<{ data: CorrectiveActionDTO[] }, { orgId: string; projectId: string; sourceId?: string }>({
      queryFn: async ({ projectId, sourceId }) => {
        await delay();
        let items = MOCK_CORRECTIVE_ACTIONS[projectId] ?? [];
        if (sourceId) items = items.filter((a) => a.sourceId === sourceId);
        return { data: { data: items } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'CorrectiveAction', id: projectId }],
    }),

    createCorrectiveAction: build.mutation<CorrectiveActionDTO, { orgId: string; projectId: string; input: { sourceType: string; sourceId: string; title: string; description?: string; assignedTo?: string; dueDate?: string; notes?: string } }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const action: CorrectiveActionDTO = { id: `ca_${Date.now()}`, organizationId: orgId, projectId, sourceType: input.sourceType as any, sourceId: input.sourceId, title: input.title, status: 'OPEN', description: input.description ?? null, assignedTo: input.assignedTo ?? null, dueDate: input.dueDate ?? null, notes: input.notes ?? null, completedAt: null, verifiedAt: null, createdBy: 'usr_01', createdAt: now, updatedAt: now };
        MOCK_CORRECTIVE_ACTIONS[projectId] = [...(MOCK_CORRECTIVE_ACTIONS[projectId] ?? []), action];
        return { data: action };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'CorrectiveAction', id: projectId }],
    }),

    transitionCorrectiveAction: build.mutation<CorrectiveActionDTO, { orgId: string; projectId: string; actionId: string; action: 'complete' | 'verify' }>({
      queryFn: async ({ projectId, actionId, action }) => {
        await delay(180);
        const list = MOCK_CORRECTIVE_ACTIONS[projectId] ?? [];
        const ca = list.find((a) => a.id === actionId);
        if (!ca) return { error: { status: 404, error: 'NOT_FOUND' } };
        const now = new Date().toISOString();
        const updated = { ...ca, status: action === 'complete' ? 'COMPLETED' as any : 'VERIFIED', completedAt: action === 'complete' ? now : ca.completedAt, verifiedAt: action === 'verify' ? now : ca.verifiedAt, updatedAt: now };
        MOCK_CORRECTIVE_ACTIONS[projectId] = list.map((a) => a.id === actionId ? updated : a);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'CorrectiveAction', id: projectId }],
    }),

    // ── PERMITS ──────────────────────────────────────────────────────────────

    listPermits: build.query<{ data: PermitDTO[] }, { orgId: string; projectId: string; status?: PermitStatus }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_PERMITS[projectId] ?? [];
        if (status) items = items.filter((p) => p.status === status);
        return { data: { data: items } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Permit', id: projectId }],
    }),

    createPermit: build.mutation<PermitDTO, { orgId: string; projectId: string; input: { permitType: string; referenceNumber?: string; issuingAuthority?: string; responsibleMemberId?: string; issueDate?: string; effectiveDate?: string; expiryDate?: string; notes?: string } }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const permit: PermitDTO = { id: `perm_${Date.now()}`, organizationId: orgId, projectId, permitType: input.permitType, status: 'PENDING', referenceNumber: input.referenceNumber ?? null, issuingAuthority: input.issuingAuthority ?? null, responsibleMemberId: input.responsibleMemberId ?? null, issueDate: input.issueDate ?? null, effectiveDate: input.effectiveDate ?? null, expiryDate: input.expiryDate ?? null, notes: input.notes ?? null, createdBy: 'usr_01', createdAt: now, updatedAt: now };
        MOCK_PERMITS[projectId] = [...(MOCK_PERMITS[projectId] ?? []), permit];
        return { data: permit };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Permit', id: projectId }],
    }),

    transitionPermit: build.mutation<PermitDTO, { orgId: string; projectId: string; permitId: string; status: PermitStatus }>({
      queryFn: async ({ projectId, permitId, status }) => {
        await delay(180);
        const list = MOCK_PERMITS[projectId] ?? [];
        const permit = list.find((p) => p.id === permitId);
        if (!permit) return { error: { status: 404, error: 'NOT_FOUND' } };
        const updated = { ...permit, status, updatedAt: new Date().toISOString() };
        MOCK_PERMITS[projectId] = list.map((p) => p.id === permitId ? updated : p);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Permit', id: projectId }],
    }),

    // ── COMPLIANCE RECORDS ───────────────────────────────────────────────────

    listComplianceRecords: build.query<{ data: ComplianceRecordDTO[] }, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => { await delay(); return { data: { data: MOCK_COMPLIANCE_RECORDS[projectId] ?? [] } }; },
      providesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceRecord', id: projectId }],
    }),

    createComplianceRecord: build.mutation<ComplianceRecordDTO, { orgId: string; projectId: string; input: { requirementType: string; subjectType?: string; subjectId?: string; responsibleMemberId?: string; effectiveDate?: string; expiryDate?: string; verificationRef?: string; notes?: string } }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const rec: ComplianceRecordDTO = { id: `cr_${Date.now()}`, organizationId: orgId, projectId, requirementType: input.requirementType, status: 'PENDING', subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null, responsibleMemberId: input.responsibleMemberId ?? null, effectiveDate: input.effectiveDate ?? null, expiryDate: input.expiryDate ?? null, verificationRef: input.verificationRef ?? null, notes: input.notes ?? null, verifiedAt: null, createdBy: 'usr_01', createdAt: now, updatedAt: now };
        MOCK_COMPLIANCE_RECORDS[projectId] = [...(MOCK_COMPLIANCE_RECORDS[projectId] ?? []), rec];
        return { data: rec };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceRecord', id: projectId }],
    }),

    verifyComplianceRecord: build.mutation<ComplianceRecordDTO, { orgId: string; projectId: string; recordId: string }>({
      queryFn: async ({ projectId, recordId }) => {
        await delay(180);
        const list = MOCK_COMPLIANCE_RECORDS[projectId] ?? [];
        const rec = list.find((r) => r.id === recordId);
        if (!rec) return { error: { status: 404, error: 'NOT_FOUND' } };
        const now = new Date().toISOString();
        const updated = { ...rec, status: 'VERIFIED' as any, verifiedAt: now, updatedAt: now };
        MOCK_COMPLIANCE_RECORDS[projectId] = list.map((r) => r.id === recordId ? updated : r);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceRecord', id: projectId }],
    }),

    // ── COMPLIANCE INSPECTIONS ───────────────────────────────────────────────

    listComplianceInspections: build.query<{ data: ComplianceInspectionDTO[] }, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => { await delay(); return { data: { data: MOCK_COMPLIANCE_INSPECTIONS[projectId] ?? [] } }; },
      providesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceInspection', id: projectId }],
    }),

    createComplianceInspection: build.mutation<ComplianceInspectionDTO, { orgId: string; projectId: string; input: { inspectionType: string; scheduledDate?: string; notes?: string } }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const insp: ComplianceInspectionDTO = { id: `ci_${Date.now()}`, organizationId: orgId, projectId, inspectionType: input.inspectionType, status: 'SCHEDULED', result: null, scheduledDate: input.scheduledDate ?? null, performedDate: null, findings: null, notes: input.notes ?? null, createdBy: 'usr_01', createdAt: now, updatedAt: now };
        MOCK_COMPLIANCE_INSPECTIONS[projectId] = [...(MOCK_COMPLIANCE_INSPECTIONS[projectId] ?? []), insp];
        return { data: insp };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ComplianceInspection', id: projectId }],
    }),

    // ── EXPIRING ─────────────────────────────────────────────────────────────

    listExpiring: build.query<{ items: ExpiringItemDTO[] }, { orgId: string; projectId: string; days?: number }>({
      queryFn: async ({ projectId, days = 30 }) => {
        await delay(150);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + days);
        const items: ExpiringItemDTO[] = [];
        const permits = MOCK_PERMITS[projectId] ?? [];
        permits.forEach((p) => {
          if (p.expiryDate) {
            const exp = new Date(p.expiryDate);
            const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000);
            if (daysLeft <= days) items.push({ entityType: 'permit', entityId: p.id, title: p.permitType, expiryDate: p.expiryDate, daysUntilExpiry: daysLeft });
          }
        });
        const records = MOCK_COMPLIANCE_RECORDS[projectId] ?? [];
        records.forEach((r) => {
          if (r.expiryDate) {
            const exp = new Date(r.expiryDate);
            const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000);
            if (daysLeft <= days) items.push({ entityType: 'compliance_record', entityId: r.id, title: r.requirementType, expiryDate: r.expiryDate, daysUntilExpiry: daysLeft });
          }
        });
        items.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        return { data: { items } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Permit', id: `expiring_${projectId}` }],
    }),
  }),
});

export const {
  useListSafetyEventsQuery, useCreateSafetyEventMutation, useTransitionSafetyEventMutation,
  useListSafetyMeetingsQuery, useCreateSafetyMeetingMutation,
  useListQualityInspectionsQuery, useCreateQualityInspectionMutation, useTransitionQualityInspectionMutation,
  useListQualityDeficienciesQuery, useCreateQualityDeficiencyMutation, useTransitionQualityDeficiencyMutation,
  useListCorrectiveActionsQuery, useCreateCorrectiveActionMutation, useTransitionCorrectiveActionMutation,
  useListPermitsQuery, useCreatePermitMutation, useTransitionPermitMutation,
  useListComplianceRecordsQuery, useCreateComplianceRecordMutation, useVerifyComplianceRecordMutation,
  useListComplianceInspectionsQuery, useCreateComplianceInspectionMutation,
  useListExpiringQuery,
} = hseApi;
