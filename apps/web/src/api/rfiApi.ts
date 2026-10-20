/**
 * rfiApi — Group 11: RFIs + Submittals.
 * State machines:
 *   RFI: DRAFT → OPEN(submit) → UNDER_REVIEW → ANSWERED(respond) → CLOSED(close). cancel anytime.
 *   Submittal: DRAFT → SUBMITTED(submit) → UNDER_REVIEW → APPROVED|REJECTED|REVISE_AND_RESUBMIT(review)
 *              → SUBMITTED again (resubmit) → CLOSED(close). close anytime.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type {
  RFIDTO, CreateRFIInput, RespondRFIInput, RFIStatus,
  SubmittalDTO, SubmittalRevisionDTO, CreateSubmittalInput, ReviewSubmittalInput, SubmittalStatus,
} from '../types/rfiTypes';
import { MOCK_RFIS, MOCK_SUBMITTALS, MOCK_SUBMITTAL_REVISIONS } from '../fixtures/hse.fixtures';

const delay = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

const RFI_SUBMIT_FROM: RFIStatus[] = ['DRAFT'];
const RFI_RESPOND_FROM: RFIStatus[] = ['OPEN', 'UNDER_REVIEW'];
const RFI_CLOSE_FROM: RFIStatus[] = ['ANSWERED'];
const RFI_CANCEL_ALLOWED: RFIStatus[] = ['DRAFT', 'OPEN', 'UNDER_REVIEW', 'ANSWERED'];

export const rfiApi = createApi({
  reducerPath: 'rfiApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['RFI', 'Submittal', 'SubmittalRevision'],
  endpoints: (build) => ({

    // ── RFIs ────────────────────────────────────────────────────────────────

    listRFIs: build.query<{ data: RFIDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: RFIStatus }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_RFIS[projectId] ?? [];
        if (status) items = items.filter((r) => r.status === status);
        return { data: { data: items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'RFI', id: projectId }],
    }),

    getRFI: build.query<RFIDTO, { orgId: string; projectId: string; rfiId: string }>({
      queryFn: async ({ projectId, rfiId }) => {
        await delay(120);
        const rfi = (MOCK_RFIS[projectId] ?? []).find((r) => r.id === rfiId);
        if (!rfi) return { error: { status: 404, error: 'RFI_NOT_FOUND' } };
        return { data: rfi };
      },
      providesTags: (_r, _e, { rfiId }) => [{ type: 'RFI', id: rfiId }],
    }),

    createRFI: build.mutation<RFIDTO, { orgId: string; projectId: string; input: CreateRFIInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const num = `RFI-${new Date().getFullYear()}-${String((MOCK_RFIS[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const rfi: RFIDTO = {
          id: `rfi_${Date.now()}`, organizationId: orgId, projectId, rfiNumber: num,
          title: input.title, question: input.question, response: null, status: 'DRAFT',
          priority: input.priority ?? 'NORMAL', discipline: input.discipline ?? null,
          recipientName: input.recipientName ?? null, dueDate: input.dueDate ?? null,
          scheduleImpactDays: input.scheduleImpactDays ?? null, costImpact: input.costImpact ?? null,
          linkedTaskId: input.linkedTaskId ?? null, notes: input.notes ?? null,
          createdBy: 'usr_01', submittedAt: null, respondedAt: null, closedAt: null, cancelledAt: null,
          version: 1, createdAt: now, updatedAt: now,
        };
        MOCK_RFIS[projectId] = [...(MOCK_RFIS[projectId] ?? []), rfi];
        return { data: rfi };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'RFI', id: projectId }],
    }),

    updateRFI: build.mutation<RFIDTO, { orgId: string; projectId: string; rfiId: string; input: Partial<CreateRFIInput> }>({
      queryFn: async ({ projectId, rfiId, input }) => {
        await delay(180);
        const list = MOCK_RFIS[projectId] ?? [];
        const rfi = list.find((r) => r.id === rfiId);
        if (!rfi) return { error: { status: 404, error: 'RFI_NOT_FOUND' } };
        if (rfi.status !== 'DRAFT') return { error: { status: 409, error: 'RFI_NOT_DRAFT' } };
        const updated = { ...rfi, ...input, updatedAt: new Date().toISOString() };
        MOCK_RFIS[projectId] = list.map((r) => r.id === rfiId ? updated : r);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, rfiId }) => [{ type: 'RFI', id: rfiId }, { type: 'RFI', id: projectId }],
    }),

    transitionRFI: build.mutation<RFIDTO, { orgId: string; projectId: string; rfiId: string; action: 'submit' | 'respond' | 'close' | 'cancel'; respondInput?: RespondRFIInput }>({
      queryFn: async ({ projectId, rfiId, action, respondInput }) => {
        await delay(180);
        const list = MOCK_RFIS[projectId] ?? [];
        const rfi = list.find((r) => r.id === rfiId);
        if (!rfi) return { error: { status: 404, error: 'RFI_NOT_FOUND' } };
        const allowed: Record<string, RFIStatus[]> = { submit: RFI_SUBMIT_FROM, respond: RFI_RESPOND_FROM, close: RFI_CLOSE_FROM, cancel: RFI_CANCEL_ALLOWED };
        if (!allowed[action]?.includes(rfi.status)) return { error: { status: 409, error: 'RFI_INVALID_TRANSITION' } };
        const statusMap: Record<string, RFIStatus> = { submit: 'OPEN', respond: 'ANSWERED', close: 'CLOSED', cancel: 'CANCELLED' };
        const now = new Date().toISOString();
        const updated: RFIDTO = {
          ...rfi, status: statusMap[action]!, version: rfi.version + 1, updatedAt: now,
          submittedAt: action === 'submit' ? now : rfi.submittedAt,
          response: action === 'respond' ? (respondInput?.response ?? null) : rfi.response,
          scheduleImpactDays: action === 'respond' ? (respondInput?.scheduleImpactDays ?? rfi.scheduleImpactDays) : rfi.scheduleImpactDays,
          costImpact: action === 'respond' ? (respondInput?.costImpact ?? rfi.costImpact) : rfi.costImpact,
          respondedAt: action === 'respond' ? now : rfi.respondedAt,
          closedAt: action === 'close' ? now : rfi.closedAt,
          cancelledAt: action === 'cancel' ? now : rfi.cancelledAt,
        };
        MOCK_RFIS[projectId] = list.map((r) => r.id === rfiId ? updated : r);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, rfiId }) => [{ type: 'RFI', id: rfiId }, { type: 'RFI', id: projectId }],
    }),

    // ── SUBMITTALS ───────────────────────────────────────────────────────────

    listSubmittals: build.query<{ data: SubmittalDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: SubmittalStatus }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_SUBMITTALS[projectId] ?? [];
        if (status) items = items.filter((s) => s.status === status);
        return { data: { data: items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Submittal', id: projectId }],
    }),

    getSubmittal: build.query<SubmittalDTO, { orgId: string; projectId: string; submittalId: string }>({
      queryFn: async ({ projectId, submittalId }) => {
        await delay(120);
        const sub = (MOCK_SUBMITTALS[projectId] ?? []).find((s) => s.id === submittalId);
        if (!sub) return { error: { status: 404, error: 'SUBMITTAL_NOT_FOUND' } };
        return { data: sub };
      },
      providesTags: (_r, _e, { submittalId }) => [{ type: 'Submittal', id: submittalId }],
    }),

    createSubmittal: build.mutation<SubmittalDTO, { orgId: string; projectId: string; input: CreateSubmittalInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const num = `SUB-${new Date().getFullYear()}-${String((MOCK_SUBMITTALS[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const sub: SubmittalDTO = {
          id: `sub_${Date.now()}`, organizationId: orgId, projectId, submittalNumber: num,
          title: input.title, status: 'DRAFT', revisionNumber: 0,
          specReference: input.specReference ?? null, discipline: input.discipline ?? null,
          responsibleMemberId: input.responsibleMemberId ?? null, reviewerMemberId: input.reviewerMemberId ?? null,
          dueDate: input.dueDate ?? null, notes: input.notes ?? null,
          reviewResponse: null, reviewNotes: null, submittedAt: null, reviewedAt: null, closedAt: null,
          version: 1, createdBy: 'usr_01', createdAt: now, updatedAt: now,
        };
        MOCK_SUBMITTALS[projectId] = [...(MOCK_SUBMITTALS[projectId] ?? []), sub];
        MOCK_SUBMITTAL_REVISIONS[sub.id] = [];
        return { data: sub };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Submittal', id: projectId }],
    }),

    transitionSubmittal: build.mutation<SubmittalDTO, {
      orgId: string; projectId: string; submittalId: string;
      action: 'submit' | 'review' | 'resubmit' | 'close';
      reviewInput?: ReviewSubmittalInput;
    }>({
      queryFn: async ({ projectId, submittalId, action, reviewInput }) => {
        await delay(200);
        const list = MOCK_SUBMITTALS[projectId] ?? [];
        const sub = list.find((s) => s.id === submittalId);
        if (!sub) return { error: { status: 404, error: 'SUBMITTAL_NOT_FOUND' } };
        const now = new Date().toISOString();

        const statusMap: Record<string, SubmittalStatus> = {
          submit: 'SUBMITTED', resubmit: 'SUBMITTED',
          review: reviewInput?.response === 'APPROVED' ? 'APPROVED'
            : reviewInput?.response === 'REJECTED' ? 'REJECTED'
            : 'REVISE_AND_RESUBMIT',
          close: 'CLOSED',
        };
        const newRevision = action === 'resubmit' ? sub.revisionNumber + 1 : sub.revisionNumber;

        // Create revision record on submit/resubmit
        if (action === 'submit' || action === 'resubmit') {
          const rev: SubmittalRevisionDTO = {
            id: `subrev_${Date.now()}`, submittalId: sub.id, revisionNumber: newRevision,
            submittedAt: now, reviewResponse: null, reviewNotes: null, reviewedAt: null, createdAt: now,
          };
          MOCK_SUBMITTAL_REVISIONS[sub.id] = [...(MOCK_SUBMITTAL_REVISIONS[sub.id] ?? []), rev];
        }
        // Update latest revision with review
        if (action === 'review') {
          const revs = MOCK_SUBMITTAL_REVISIONS[sub.id] ?? [];
          if (revs.length > 0) {
            const last = revs[revs.length - 1]!;
            MOCK_SUBMITTAL_REVISIONS[sub.id] = revs.map((r) =>
              r.id === last.id ? { ...r, reviewResponse: reviewInput?.response ?? null, reviewNotes: reviewInput?.responseNotes ?? null, reviewedAt: now } : r,
            );
          }
        }

        const updated: SubmittalDTO = {
          ...sub, status: statusMap[action]!, revisionNumber: newRevision, version: sub.version + 1, updatedAt: now,
          submittedAt: action === 'submit' || action === 'resubmit' ? now : sub.submittedAt,
          reviewResponse: action === 'review' ? (reviewInput?.response ?? null) : sub.reviewResponse,
          reviewNotes: action === 'review' ? (reviewInput?.responseNotes ?? null) : sub.reviewNotes,
          reviewedAt: action === 'review' ? now : sub.reviewedAt,
          closedAt: action === 'close' ? now : sub.closedAt,
        };
        MOCK_SUBMITTALS[projectId] = list.map((s) => s.id === submittalId ? updated : s);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, submittalId }) => [
        { type: 'Submittal', id: submittalId }, { type: 'Submittal', id: projectId },
        { type: 'SubmittalRevision', id: submittalId },
      ],
    }),

    listSubmittalRevisions: build.query<{ revisions: SubmittalRevisionDTO[] }, { orgId: string; projectId: string; submittalId: string }>({
      queryFn: async ({ submittalId }) => {
        await delay(120);
        return { data: { revisions: MOCK_SUBMITTAL_REVISIONS[submittalId] ?? [] } };
      },
      providesTags: (_r, _e, { submittalId }) => [{ type: 'SubmittalRevision', id: submittalId }],
    }),
  }),
});

export const {
  useListRFIsQuery, useGetRFIQuery, useCreateRFIMutation, useUpdateRFIMutation, useTransitionRFIMutation,
  useListSubmittalsQuery, useGetSubmittalQuery, useCreateSubmittalMutation, useTransitionSubmittalMutation,
  useListSubmittalRevisionsQuery,
} = rfiApi;
