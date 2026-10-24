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
      }),
      transformResponse: (raw: { data: RFIDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'RFI', id: projectId }],
    }),

    submitRFI: build.mutation<RFIDTO, OrgProjectArgs & { rfiId: string; expectedVersion: number }>({
      query: ({ orgId, projectId, rfiId, expectedVersion }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/submit`,
        method: 'POST',
        body: { expectedVersion },
      }),
      transformResponse: (raw: { data: RFIDTO }) => raw.data,
      invalidatesTags: (_r, _e, { rfiId }) => [{ type: 'RFI', id: rfiId }],
    }),

    respondRFI: build.mutation<RFIDTO, OrgProjectArgs & { rfiId: string; input: RespondRFIInput }>({
      query: ({ orgId, projectId, rfiId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/respond`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: RFIDTO }) => raw.data,
      invalidatesTags: (_r, _e, { rfiId }) => [{ type: 'RFI', id: rfiId }],
    }),

    closeRFI: build.mutation<RFIDTO, OrgProjectArgs & { rfiId: string; expectedVersion: number }>({
      query: ({ orgId, projectId, rfiId, expectedVersion }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/rfis/${rfiId}/close`,
        method: 'POST',
        body: { expectedVersion },
      }),
      transformResponse: (raw: { data: RFIDTO }) => raw.data,
      invalidatesTags: (_r, _e, { rfiId }) => [{ type: 'RFI', id: rfiId }],
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
      }),
      transformResponse: (raw: { data: SubmittalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Submittal', id: projectId }],
    }),

    submitSubmittal: build.mutation<
      SubmittalDTO,
      OrgProjectArgs & { submittalId: string; expectedVersion: number }
    >({
      query: ({ orgId, projectId, submittalId, expectedVersion }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/submit`,
        method: 'POST',
        body: { expectedVersion },
      }),
      transformResponse: (raw: { data: SubmittalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { submittalId }) => [{ type: 'Submittal', id: submittalId }],
    }),

    reviewSubmittal: build.mutation<
      SubmittalDTO,
      OrgProjectArgs & { submittalId: string; input: ReviewSubmittalInput }
    >({
      query: ({ orgId, projectId, submittalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/review`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: SubmittalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { submittalId }) => [{ type: 'Submittal', id: submittalId }],
    }),

    // ── Submittal Revisions ────────────────────────────────────────────────

    listSubmittalRevisions: build.query<SubmittalRevisionDTO[], OrgProjectArgs & { submittalId: string }>({
      query: ({ orgId, projectId, submittalId }) =>
        `/organizations/${orgId}/projects/${projectId}/submittals/${submittalId}/revisions`,
      transformResponse: (raw: { data: SubmittalRevisionDTO[] }) => raw.data,
      providesTags: (_r, _e, { submittalId }) => [{ type: 'SubmittalRevision', id: submittalId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  useListRFIsQuery,
  useGetRFIQuery,
  useCreateRFIMutation,
  useSubmitRFIMutation,
  useRespondRFIMutation,
  useCloseRFIMutation,
  useListSubmittalsQuery,
  useGetSubmittalQuery,
  useCreateSubmittalMutation,
  useSubmitSubmittalMutation,
  useReviewSubmittalMutation,
  useListSubmittalRevisionsQuery,
} = rfiApi;
