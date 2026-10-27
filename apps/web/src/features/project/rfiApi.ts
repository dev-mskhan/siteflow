/**
 * rfiApi — Live integration for RFIs and Submittals.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * State machines:
 *   RFI: DRAFT → OPEN (submit) → UNDER_REVIEW → ANSWERED (respond) → CLOSED
 *   Submittal: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED/REVISE_AND_RESUBMIT
 */
import { baseApi } from '../../services/baseApi';
import type {
  RFIDTO,
  SubmittalDTO,
  SubmittalRevisionDTO,
  CreateRFIInput,
  RespondRFIInput,
  CreateSubmittalInput,
  ReviewSubmittalInput,
  RFIStatus,
  SubmittalStatus,
} from '../../types/rfiTypes';

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export type RFITransitionAction = 'submit' | 'respond' | 'close' | 'cancel';
export type SubmittalTransitionAction = 'submit' | 'review' | 'resubmit' | 'close';

export const rfiApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── RFIs ───────────────────────────────────────────────────────────────

    listRFIs: build.query<
      { data: RFIDTO[]; nextCursor: string | null },
      OrgProjectArgs & { status?: RFIStatus; cursor?: string }
    >({
      query: ({ orgId, projectId, status, cursor }) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (cursor) params.set('cursor', cursor);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/rfis${query}`;
      },
      transformResponse: (raw: { data: RFIDTO[]; meta: { nextCursor: string | null } }) => ({
        data: raw.data,
        nextCursor: raw.meta.nextCursor,
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'RFI', id: projectId }],
    }),

    getRFI: build.query<RFIDTO, OrgProjectArgs & { rfiId: string }>({
      query: ({ orgId, projectId, rfiId }) =>
        `/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}`,
      transformResponse: (raw: { data: RFIDTO }) => raw.data,
      providesTags: (_r, _e, { rfiId }) => [{ type: 'RFI', id: rfiId }],
    }),

    createRFI: build.mutation<RFIDTO, OrgProjectArgs & { input: CreateRFIInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/rfis`,
        method: 'POST',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { rfi: RFIDTO } }) => raw.data.rfi,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'RFI', id: projectId }],
    }),

    updateRFI: build.mutation<RFIDTO, OrgProjectArgs & { rfiId: string; input: Partial<CreateRFIInput> }>({
      query: ({ orgId, projectId, rfiId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}`,
        method: 'PATCH',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { rfi: RFIDTO } }) => raw.data.rfi,
      invalidatesTags: (_r, _e, { rfiId, projectId }) => [
        { type: 'RFI', id: rfiId },
        { type: 'RFI', id: projectId },
      ],
    }),

    submitRFI: build.mutation<RFIDTO, OrgProjectArgs & { rfiId: string }>({
      query: ({ orgId, projectId, rfiId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/submit`,
        method: 'POST',
        body: {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { rfi: RFIDTO } }) => raw.data.rfi,
      invalidatesTags: (_r, _e, { rfiId, projectId }) => [
        { type: 'RFI', id: rfiId },
        { type: 'RFI', id: projectId },
      ],
    }),

    respondRFI: build.mutation<RFIDTO, OrgProjectArgs & { rfiId: string; input: RespondRFIInput }>({
      query: ({ orgId, projectId, rfiId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/respond`,
        method: 'POST',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { rfi: RFIDTO } }) => raw.data.rfi,
      invalidatesTags: (_r, _e, { rfiId, projectId }) => [
        { type: 'RFI', id: rfiId },
        { type: 'RFI', id: projectId },
      ],
    }),

    closeRFI: build.mutation<RFIDTO, OrgProjectArgs & { rfiId: string }>({
      query: ({ orgId, projectId, rfiId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/close`,
        method: 'POST',
        body: {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { rfi: RFIDTO } }) => raw.data.rfi,
      invalidatesTags: (_r, _e, { rfiId, projectId }) => [
        { type: 'RFI', id: rfiId },
        { type: 'RFI', id: projectId },
      ],
    }),

    cancelRFI: build.mutation<RFIDTO, OrgProjectArgs & { rfiId: string }>({
      query: ({ orgId, projectId, rfiId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/cancel`,
        method: 'POST',
        body: {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { rfi: RFIDTO } }) => raw.data.rfi,
      invalidatesTags: (_r, _e, { rfiId, projectId }) => [
        { type: 'RFI', id: rfiId },
        { type: 'RFI', id: projectId },
      ],
    }),

    attachRFIDocument: build.mutation<void, OrgProjectArgs & { rfiId: string; documentId: string }>({
      query: ({ orgId, projectId, rfiId, documentId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/documents`,
        method: 'POST',
        body: { documentId },
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      invalidatesTags: (_r, _e, { rfiId }) => [{ type: 'RFI', id: rfiId }],
    }),

    transitionRFI: build.mutation<RFIDTO, OrgProjectArgs & { rfiId: string; action: RFITransitionAction; respondInput?: RespondRFIInput }>({
      query: ({ orgId, projectId, rfiId, action, respondInput }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/${action}`,
        method: 'POST',
        body: action === 'respond' && respondInput ? respondInput : {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { rfi: RFIDTO } }) => raw.data.rfi,
      invalidatesTags: (_r, _e, { rfiId, projectId }) => [
        { type: 'RFI', id: rfiId },
        { type: 'RFI', id: projectId },
      ],
    }),

    // ── Submittals ─────────────────────────────────────────────────────────

    listSubmittals: build.query<
      { data: SubmittalDTO[]; nextCursor: string | null },
      OrgProjectArgs & { status?: SubmittalStatus; cursor?: string }
    >({
      query: ({ orgId, projectId, status, cursor }) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (cursor) params.set('cursor', cursor);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/organizations/${orgId}/projects/${projectId}/submittals${query}`;
      },
      transformResponse: (raw: { data: SubmittalDTO[]; meta: { nextCursor: string | null } }) => ({
        data: raw.data,
        nextCursor: raw.meta.nextCursor,
      }),
      providesTags: (_r, _e, { projectId }) => [{ type: 'Submittal', id: projectId }],
    }),

    getSubmittal: build.query<SubmittalDTO, OrgProjectArgs & { submittalId: string }>({
      query: ({ orgId, projectId, submittalId }) =>
        `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}`,
      transformResponse: (raw: { data: SubmittalDTO }) => raw.data,
      providesTags: (_r, _e, { submittalId }) => [{ type: 'Submittal', id: submittalId }],
    }),

    createSubmittal: build.mutation<SubmittalDTO, OrgProjectArgs & { input: CreateSubmittalInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals`,
        method: 'POST',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { submittal: SubmittalDTO } }) => raw.data.submittal,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Submittal', id: projectId }],
    }),

    updateSubmittal: build.mutation<SubmittalDTO, OrgProjectArgs & { submittalId: string; input: Partial<CreateSubmittalInput> }>({
      query: ({ orgId, projectId, submittalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}`,
        method: 'PATCH',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { submittal: SubmittalDTO } }) => raw.data.submittal,
      invalidatesTags: (_r, _e, { submittalId, projectId }) => [
        { type: 'Submittal', id: submittalId },
        { type: 'Submittal', id: projectId },
      ],
    }),

    submitSubmittal: build.mutation<SubmittalDTO, OrgProjectArgs & { submittalId: string }>({
      query: ({ orgId, projectId, submittalId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/submit`,
        method: 'POST',
        body: {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { submittal: SubmittalDTO } }) => raw.data.submittal,
      invalidatesTags: (_r, _e, { submittalId, projectId }) => [
        { type: 'Submittal', id: submittalId },
        { type: 'Submittal', id: projectId },
      ],
    }),

    reviewSubmittal: build.mutation<
      SubmittalDTO,
      OrgProjectArgs & { submittalId: string; input: ReviewSubmittalInput }
    >({
      query: ({ orgId, projectId, submittalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/review`,
        method: 'POST',
        body: input,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { submittal: SubmittalDTO } }) => raw.data.submittal,
      invalidatesTags: (_r, _e, { submittalId, projectId }) => [
        { type: 'Submittal', id: submittalId },
        { type: 'Submittal', id: projectId },
      ],
    }),

    resubmitSubmittal: build.mutation<SubmittalDTO, OrgProjectArgs & { submittalId: string }>({
      query: ({ orgId, projectId, submittalId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/resubmit`,
        method: 'POST',
        body: {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { submittal: SubmittalDTO } }) => raw.data.submittal,
      invalidatesTags: (_r, _e, { submittalId, projectId }) => [
        { type: 'Submittal', id: submittalId },
        { type: 'Submittal', id: projectId },
      ],
    }),

    closeSubmittal: build.mutation<SubmittalDTO, OrgProjectArgs & { submittalId: string }>({
      query: ({ orgId, projectId, submittalId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/close`,
        method: 'POST',
        body: {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { submittal: SubmittalDTO } }) => raw.data.submittal,
      invalidatesTags: (_r, _e, { submittalId, projectId }) => [
        { type: 'Submittal', id: submittalId },
        { type: 'Submittal', id: projectId },
      ],
    }),

    attachSubmittalDocument: build.mutation<void, OrgProjectArgs & { submittalId: string; documentId: string }>({
      query: ({ orgId, projectId, submittalId, documentId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/documents`,
        method: 'POST',
        body: { documentId },
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      invalidatesTags: (_r, _e, { submittalId }) => [{ type: 'Submittal', id: submittalId }],
    }),

    transitionSubmittal: build.mutation<
      SubmittalDTO,
      OrgProjectArgs & { submittalId: string; action: SubmittalTransitionAction; reviewInput?: ReviewSubmittalInput }
    >({
      query: ({ orgId, projectId, submittalId, action, reviewInput }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/${action}`,
        method: 'POST',
        body: action === 'review' && reviewInput ? reviewInput : {},
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { submittal: SubmittalDTO } }) => raw.data.submittal,
      invalidatesTags: (_r, _e, { submittalId, projectId }) => [
        { type: 'Submittal', id: submittalId },
        { type: 'Submittal', id: projectId },
      ],
    }),

    // ── Submittal Revisions ────────────────────────────────────────────────

    listSubmittalRevisions: build.query<SubmittalRevisionDTO[], OrgProjectArgs & { submittalId: string }>({
      query: ({ orgId, projectId, submittalId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/revisions`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { revisions: SubmittalRevisionDTO[] } }) => raw.data.revisions,
      providesTags: (_r, _e, { submittalId }) => [{ type: 'SubmittalRevision', id: submittalId }],
    }),

    getSubmittalRevision: build.query<SubmittalRevisionDTO, OrgProjectArgs & { submittalId: string; revisionId: string }>({
      query: ({ orgId, projectId, submittalId, revisionId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/revisions/${revisionId}`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      }),
      transformResponse: (raw: { data: { revision: SubmittalRevisionDTO } }) => raw.data.revision,
      providesTags: (_r, _e, { submittalId, revisionId }) => [
        { type: 'SubmittalRevision', id: `${submittalId}_${revisionId}` },
      ],
    }),

  }),
  overrideExisting: false,
});

export const {
  // RFIs
  useListRFIsQuery,
  useGetRFIQuery,
  useCreateRFIMutation,
  useUpdateRFIMutation,
  useSubmitRFIMutation,
  useRespondRFIMutation,
  useCloseRFIMutation,
  useCancelRFIMutation,
  useAttachRFIDocumentMutation,
  useTransitionRFIMutation,
  // Submittals
  useListSubmittalsQuery,
  useGetSubmittalQuery,
  useCreateSubmittalMutation,
  useUpdateSubmittalMutation,
  useSubmitSubmittalMutation,
  useReviewSubmittalMutation,
  useResubmitSubmittalMutation,
  useCloseSubmittalMutation,
  useAttachSubmittalDocumentMutation,
  useTransitionSubmittalMutation,
  // Submittal Revisions
  useListSubmittalRevisionsQuery,
  useGetSubmittalRevisionQuery,
} = rfiApi;
