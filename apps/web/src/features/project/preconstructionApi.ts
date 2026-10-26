/**
 * preconstructionApi — Live integration for preconstruction modules.
 * LIVE INTEGRATION: Connected to real backend via baseApi.injectEndpoints.
 *
 * Modules: BOQ, Estimates, Proposals, Tenders, Takeoff
 */
import { baseApi } from '../../services/baseApi';
import type {
  TenderDTO,
  ProposalDTO,
  EstimateDTO,
  BoqDTO,
  TakeoffSheetDTO,
  MaterialRateVersionDTO,
  CreateTenderInput,
  UpdateTenderInput,
  TenderTransitionInput,
  AwardTenderInput,
  CreateProposalInput,
  UpdateProposalInput,
  ProposalTransitionInput,
  RejectProposalInput,
  IssueProposalInput,
  RecordClientResponseInput,
  ConvertProposalInput,
  CreateEstimateInput,
  UpdateEstimateInput,
  EstimateTransitionInput,
  RejectEstimateInput,
  EstimateComparisonResult,
  CreateBoqInput,
  ReviseBoqInput,
  BoqTransitionInput,
  BoqMapItemInput,
  BoqImportPreviewResult,
  BoqImportCommitInput,
  CreateTakeoffSheetInput,
  CreateRateVersionInput,
  ProposalRevisionDTO,
  BoqRevisionDTO,
} from '../../types/preconstructionTypes';

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export const preconstructionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Tenders ────────────────────────────────────────────────────────────

    listTenders: build.query<TenderDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/tenders`,
      transformResponse: (raw: { data: TenderDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Tender', id: projectId }],
    }),

    createTender: build.mutation<TenderDTO, OrgProjectArgs & { input: CreateTenderInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/tenders`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: TenderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Tender', id: projectId }],
    }),

    getTender: build.query<TenderDTO, { orgId: string; tenderId: string }>({
      query: ({ orgId, tenderId }) => ({
        url: `/organizations/${orgId}/tenders/${tenderId}`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: TenderDTO }) => raw.data,
      providesTags: (_r, _e, { tenderId }) => [{ type: 'Tender', id: tenderId }],
    }),

    updateTender: build.mutation<TenderDTO, { orgId: string; tenderId: string; input: UpdateTenderInput }>({
      query: ({ orgId, tenderId, input }) => ({
        url: `/organizations/${orgId}/tenders/${tenderId}`,
        method: 'PATCH',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: TenderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { tenderId }) => [
        { type: 'Tender', id: tenderId },
        { type: 'Tender', id: 'LIST' },
      ],
    }),

    submitTender: build.mutation<TenderDTO, { orgId: string; tenderId: string; input: TenderTransitionInput }>({
      query: ({ orgId, tenderId, input }) => ({
        url: `/organizations/${orgId}/tenders/${tenderId}/submit`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: TenderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { tenderId }) => [
        { type: 'Tender', id: tenderId },
        { type: 'Tender', id: 'LIST' },
      ],
    }),

    awardTender: build.mutation<TenderDTO, { orgId: string; tenderId: string; input: AwardTenderInput }>({
      query: ({ orgId, tenderId, input }) => ({
        url: `/organizations/${orgId}/tenders/${tenderId}/award`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: TenderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { tenderId }) => [
        { type: 'Tender', id: tenderId },
        { type: 'Tender', id: 'LIST' },
        { type: 'Project', id: 'LIST' },
      ],
    }),

    lostTender: build.mutation<TenderDTO, { orgId: string; tenderId: string; input: TenderTransitionInput }>({
      query: ({ orgId, tenderId, input }) => ({
        url: `/organizations/${orgId}/tenders/${tenderId}/lost`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: TenderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { tenderId }) => [
        { type: 'Tender', id: tenderId },
        { type: 'Tender', id: 'LIST' },
      ],
    }),

    withdrawTender: build.mutation<TenderDTO, { orgId: string; tenderId: string; input: TenderTransitionInput }>({
      query: ({ orgId, tenderId, input }) => ({
        url: `/organizations/${orgId}/tenders/${tenderId}/withdraw`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: TenderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { tenderId }) => [
        { type: 'Tender', id: tenderId },
        { type: 'Tender', id: 'LIST' },
      ],
    }),

    // ── Proposals ──────────────────────────────────────────────────────────

    listProposals: build.query<ProposalDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/proposals`,
      transformResponse: (raw: { data: ProposalDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Proposal', id: projectId }],
    }),

    createProposal: build.mutation<ProposalDTO, OrgProjectArgs & { input: CreateProposalInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ProposalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Proposal', id: projectId }],
    }),

    getProposal: build.query<ProposalDTO, OrgProjectArgs & { proposalId: string }>({
      query: ({ orgId, projectId, proposalId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ProposalDTO }) => raw.data,
      providesTags: (_r, _e, { proposalId }) => [{ type: 'Proposal', id: proposalId }],
    }),

    updateProposal: build.mutation<ProposalDTO, OrgProjectArgs & { proposalId: string; input: UpdateProposalInput }>({
      query: ({ orgId, projectId, proposalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}`,
        method: 'PATCH',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ProposalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { proposalId }) => [
        { type: 'Proposal', id: proposalId },
        { type: 'Proposal', id: 'LIST' },
      ],
    }),

    submitProposal: build.mutation<ProposalDTO, OrgProjectArgs & { proposalId: string; input: ProposalTransitionInput }>({
      query: ({ orgId, projectId, proposalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/submit`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ProposalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { proposalId }) => [
        { type: 'Proposal', id: proposalId },
        { type: 'Proposal', id: 'LIST' },
      ],
    }),

    approveProposal: build.mutation<ProposalDTO, OrgProjectArgs & { proposalId: string; input: ProposalTransitionInput }>({
      query: ({ orgId, projectId, proposalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/approve`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ProposalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { proposalId }) => [
        { type: 'Proposal', id: proposalId },
        { type: 'Proposal', id: 'LIST' },
      ],
    }),

    rejectProposal: build.mutation<ProposalDTO, OrgProjectArgs & { proposalId: string; input: RejectProposalInput }>({
      query: ({ orgId, projectId, proposalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/reject`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ProposalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { proposalId }) => [
        { type: 'Proposal', id: proposalId },
        { type: 'Proposal', id: 'LIST' },
      ],
    }),

    issueProposal: build.mutation<ProposalDTO, OrgProjectArgs & { proposalId: string; input: IssueProposalInput }>({
      query: ({ orgId, projectId, proposalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/issue`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ProposalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { proposalId }) => [
        { type: 'Proposal', id: proposalId },
        { type: 'Proposal', id: 'LIST' },
      ],
    }),

    recordClientResponse: build.mutation<ProposalDTO, OrgProjectArgs & { proposalId: string; input: RecordClientResponseInput }>({
      query: ({ orgId, projectId, proposalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/respond`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ProposalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { proposalId }) => [
        { type: 'Proposal', id: proposalId },
        { type: 'Proposal', id: 'LIST' },
      ],
    }),

    withdrawProposal: build.mutation<ProposalDTO, OrgProjectArgs & { proposalId: string; input: RejectProposalInput }>({
      query: ({ orgId, projectId, proposalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/withdraw`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ProposalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { proposalId }) => [
        { type: 'Proposal', id: proposalId },
        { type: 'Proposal', id: 'LIST' },
      ],
    }),

    listProposalRevisions: build.query<ProposalRevisionDTO[], OrgProjectArgs & { proposalId: string }>({
      query: ({ orgId, projectId, proposalId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/revisions`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ProposalRevisionDTO[] }) => raw.data,
      providesTags: (_r, _e, { proposalId }) => [{ type: 'Proposal', id: `${proposalId}_REVISIONS` }],
    }),

    getProposalRevision: build.query<ProposalRevisionDTO, OrgProjectArgs & { proposalId: string; revisionId: string }>({
      query: ({ orgId, projectId, proposalId, revisionId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/revisions/${revisionId}`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: ProposalRevisionDTO }) => raw.data,
      providesTags: (_r, _e, { proposalId, revisionId }) => [
        { type: 'Proposal', id: `${proposalId}_REV_${revisionId}` },
      ],
    }),

    convertProposal: build.mutation<{ projectId?: string; changeOrderId?: string }, OrgProjectArgs & { proposalId: string; input: ConvertProposalInput }>({
      query: ({ orgId, projectId, proposalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/convert`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { projectId?: string; changeOrderId?: string } }) => raw.data,
      invalidatesTags: (_r, _e, { proposalId }) => [
        { type: 'Proposal', id: proposalId },
        { type: 'Project', id: 'LIST' },
        { type: 'ChangeOrder', id: 'LIST' },
      ],
    }),

    // ── Estimates ──────────────────────────────────────────────────────────

    listEstimates: build.query<EstimateDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/estimates`,
      transformResponse: (raw: { data: EstimateDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Estimate', id: projectId }],
    }),

    createEstimate: build.mutation<EstimateDTO, OrgProjectArgs & { input: CreateEstimateInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/estimates`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: EstimateDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Estimate', id: projectId }],
    }),

    getEstimate: build.query<EstimateDTO, OrgProjectArgs & { estimateId: string }>({
      query: ({ orgId, projectId, estimateId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/estimates/${estimateId}`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: EstimateDTO }) => raw.data,
      providesTags: (_r, _e, { estimateId }) => [{ type: 'Estimate', id: estimateId }],
    }),

    updateEstimate: build.mutation<EstimateDTO, OrgProjectArgs & { estimateId: string; input: UpdateEstimateInput }>({
      query: ({ orgId, projectId, estimateId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/estimates/${estimateId}`,
        method: 'PATCH',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: EstimateDTO }) => raw.data,
      invalidatesTags: (_r, _e, { estimateId }) => [
        { type: 'Estimate', id: estimateId },
        { type: 'Estimate', id: 'LIST' },
      ],
    }),

    submitEstimate: build.mutation<EstimateDTO, OrgProjectArgs & { estimateId: string; input: EstimateTransitionInput }>({
      query: ({ orgId, projectId, estimateId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/estimates/${estimateId}/submit`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: EstimateDTO }) => raw.data,
      invalidatesTags: (_r, _e, { estimateId }) => [
        { type: 'Estimate', id: estimateId },
        { type: 'Estimate', id: 'LIST' },
      ],
    }),

    approveEstimate: build.mutation<EstimateDTO, OrgProjectArgs & { estimateId: string; input: EstimateTransitionInput }>({
      query: ({ orgId, projectId, estimateId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/estimates/${estimateId}/approve`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: EstimateDTO }) => raw.data,
      invalidatesTags: (_r, _e, { estimateId }) => [
        { type: 'Estimate', id: estimateId },
        { type: 'Estimate', id: 'LIST' },
        { type: 'Budget', id: 'CURRENT' },
      ],
    }),

    rejectEstimate: build.mutation<EstimateDTO, OrgProjectArgs & { estimateId: string; input: RejectEstimateInput }>({
      query: ({ orgId, projectId, estimateId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/estimates/${estimateId}/reject`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: EstimateDTO }) => raw.data,
      invalidatesTags: (_r, _e, { estimateId }) => [
        { type: 'Estimate', id: estimateId },
        { type: 'Estimate', id: 'LIST' },
      ],
    }),

    compareEstimate: build.query<EstimateComparisonResult, OrgProjectArgs & { estimateId: string }>({
      query: ({ orgId, projectId, estimateId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/estimates/${estimateId}/compare`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: EstimateComparisonResult }) => raw.data,
      providesTags: (_r, _e, { estimateId }) => [{ type: 'Estimate', id: `${estimateId}_COMPARE` }],
    }),

    // ── BOQ (Bill of Quantities) ───────────────────────────────────────────

    listBoqs: build.query<BoqDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/boq`,
      transformResponse: (raw: { data: BoqDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'BOQ', id: projectId }],
    }),

    createBoq: build.mutation<BoqDTO, OrgProjectArgs & { input: CreateBoqInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: BoqDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'BOQ', id: projectId }],
    }),

    getBoq: build.query<BoqDTO, OrgProjectArgs & { boqId: string }>({
      query: ({ orgId, projectId, boqId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: BoqDTO }) => raw.data,
      providesTags: (_r, _e, { boqId }) => [{ type: 'BOQ', id: boqId }],
    }),

    reviseBoq: build.mutation<BoqDTO, OrgProjectArgs & { boqId: string; input: ReviseBoqInput }>({
      query: ({ orgId, projectId, boqId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/revisions`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: BoqDTO }) => raw.data,
      invalidatesTags: (_r, _e, { boqId }) => [
        { type: 'BOQ', id: boqId },
        { type: 'BOQ', id: 'LIST' },
      ],
    }),

    submitBoq: build.mutation<BoqDTO, OrgProjectArgs & { boqId: string; input: BoqTransitionInput }>({
      query: ({ orgId, projectId, boqId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/submit`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: BoqDTO }) => raw.data,
      invalidatesTags: (_r, _e, { boqId }) => [
        { type: 'BOQ', id: boqId },
        { type: 'BOQ', id: 'LIST' },
      ],
    }),

    approveBoq: build.mutation<BoqDTO, OrgProjectArgs & { boqId: string; input: BoqTransitionInput }>({
      query: ({ orgId, projectId, boqId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/approve`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: BoqDTO }) => raw.data,
      invalidatesTags: (_r, _e, { boqId }) => [
        { type: 'BOQ', id: boqId },
        { type: 'BOQ', id: 'LIST' },
      ],
    }),

    lockBoq: build.mutation<BoqDTO, OrgProjectArgs & { boqId: string; input: BoqTransitionInput }>({
      query: ({ orgId, projectId, boqId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/lock`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: BoqDTO }) => raw.data,
      invalidatesTags: (_r, _e, { boqId }) => [
        { type: 'BOQ', id: boqId },
        { type: 'BOQ', id: 'LIST' },
      ],
    }),

    listBoqRevisions: build.query<BoqRevisionDTO[], OrgProjectArgs & { boqId: string }>({
      query: ({ orgId, projectId, boqId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/revisions`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: BoqRevisionDTO[] }) => raw.data,
      providesTags: (_r, _e, { boqId }) => [{ type: 'BOQ', id: `${boqId}_REVISIONS` }],
    }),

    getBoqRevision: build.query<BoqRevisionDTO, OrgProjectArgs & { boqId: string; revisionId: string }>({
      query: ({ orgId, projectId, boqId, revisionId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/revisions/${revisionId}`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: BoqRevisionDTO }) => raw.data,
      providesTags: (_r, _e, { boqId, revisionId }) => [
        { type: 'BOQ', id: `${boqId}_REV_${revisionId}` },
      ],
    }),

    previewBoqImport: build.mutation<BoqImportPreviewResult, OrgProjectArgs & { boqId: string; file: File }>({
      query: ({ orgId, projectId, boqId, file }) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/imports/preview`,
          method: 'POST',
          body: formData,
          headers: {
            'X-Idempotency-Key': crypto.randomUUID(),
          },
        };
      },
      transformResponse: (raw: { data: BoqImportPreviewResult }) => raw.data,
    }),

    commitBoqImport: build.mutation<BoqDTO, OrgProjectArgs & { boqId: string; input: BoqImportCommitInput }>({
      query: ({ orgId, projectId, boqId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/imports/commit`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: BoqDTO }) => raw.data,
      invalidatesTags: (_r, _e, { boqId }) => [
        { type: 'BOQ', id: boqId },
        { type: 'BOQ', id: 'LIST' },
      ],
    }),

    mapBoqItem: build.mutation<BoqDTO, OrgProjectArgs & { boqId: string; itemId: string; input: BoqMapItemInput }>({
      query: ({ orgId, projectId, boqId, itemId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/items/${itemId}/mapping`,
        method: 'PUT',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: BoqDTO }) => raw.data,
      invalidatesTags: (_r, _e, { boqId }) => [
        { type: 'BOQ', id: boqId },
      ],
    }),

    exportBoqCsv: build.query<Blob, OrgProjectArgs & { boqId: string }>({
      query: ({ orgId, projectId, boqId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/export`,
        method: 'GET',
        responseHandler: (response) => response.blob(),
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
    }),

    // ── Takeoff ────────────────────────────────────────────────────────────

    listTakeoffSheets: build.query<TakeoffSheetDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/takeoff`,
      transformResponse: (raw: { data: TakeoffSheetDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Takeoff', id: projectId }],
    }),

    createTakeoffSheet: build.mutation<TakeoffSheetDTO, OrgProjectArgs & { input: CreateTakeoffSheetInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/takeoff`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: TakeoffSheetDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Takeoff', id: projectId }],
    }),

    // ── Pricing / Material Rates ───────────────────────────────────────────

    listMaterialRates: build.query<MaterialRateVersionDTO[], OrgProjectArgs & { materialId: string }>({
      query: ({ orgId, projectId, materialId }) =>
        `/organizations/${orgId}/projects/${projectId}/pricing/${materialId}/versions`,
      transformResponse: (raw: { data: MaterialRateVersionDTO[] }) => raw.data,
      providesTags: (_r, _e, { materialId }) => [{ type: 'MaterialRate', id: materialId }],
    }),

    createMaterialRate: build.mutation<MaterialRateVersionDTO, OrgProjectArgs & { materialId: string; input: CreateRateVersionInput }>({
      query: ({ orgId, projectId, materialId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/pricing/${materialId}/versions`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: MaterialRateVersionDTO }) => raw.data,
      invalidatesTags: (_r, _e, { materialId }) => [{ type: 'MaterialRate', id: materialId }],
    }),

  }),
  overrideExisting: false,
});

export const {
  // Tenders
  useListTendersQuery,
  useCreateTenderMutation,
  useGetTenderQuery,
  useUpdateTenderMutation,
  useSubmitTenderMutation,
  useAwardTenderMutation,
  useLostTenderMutation,
  useWithdrawTenderMutation,
  // Proposals
  useListProposalsQuery,
  useCreateProposalMutation,
  useGetProposalQuery,
  useUpdateProposalMutation,
  useSubmitProposalMutation,
  useApproveProposalMutation,
  useRejectProposalMutation,
  useIssueProposalMutation,
  useRecordClientResponseMutation,
  useWithdrawProposalMutation,
  useListProposalRevisionsQuery,
  useGetProposalRevisionQuery,
  useConvertProposalMutation,
  // Estimates
  useListEstimatesQuery,
  useCreateEstimateMutation,
  useGetEstimateQuery,
  useUpdateEstimateMutation,
  useSubmitEstimateMutation,
  useApproveEstimateMutation,
  useRejectEstimateMutation,
  useCompareEstimateQuery,
  // BOQ
  useListBoqsQuery,
  useCreateBoqMutation,
  useGetBoqQuery,
  useReviseBoqMutation,
  useSubmitBoqMutation,
  useApproveBoqMutation,
  useLockBoqMutation,
  useListBoqRevisionsQuery,
  useGetBoqRevisionQuery,
  usePreviewBoqImportMutation,
  useCommitBoqImportMutation,
  useMapBoqItemMutation,
  useExportBoqCsvQuery,
  // Takeoff
  useListTakeoffSheetsQuery,
  useCreateTakeoffSheetMutation,
  // Pricing
  useListMaterialRatesQuery,
  useCreateMaterialRateMutation,
} = preconstructionApi;
