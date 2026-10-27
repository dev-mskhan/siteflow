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
  BoqItemDTO,
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
  ProposalClientEventDTO,
} from '../../types/preconstructionTypes';

const TENDER_TRANSITION_PATH: Record<string, string> = {
  SUBMITTED: 'submit',
  AWARDED: 'award',
  LOST: 'lost',
  WITHDRAWN: 'withdraw',
};

interface OrgProjectArgs {
  orgId: string;
  projectId: string;
}

export const preconstructionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({

    // ── Tenders ────────────────────────────────────────────────────────────

    listTenders: build.query<TenderDTO[], { orgId: string; status?: string }>({
      query: ({ orgId, status }) => ({
        url: `/organizations/${orgId}/tenders`,
        params: status ? { status } : undefined,
      }),
      transformResponse: (raw: { data: { items: TenderDTO[]; nextCursor: string | null } }) => raw.data,
      providesTags: [{ type: 'Tender', id: 'LIST' }],
    }),

    createTender: build.mutation<TenderDTO, { orgId: string; input: CreateTenderInput }>({
      query: ({ orgId, input }) => ({
        url: `/organizations/${orgId}/tenders`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { tender: TenderDTO } }) => raw.data.tender,
      invalidatesTags: [{ type: 'Tender', id: 'LIST' }],
    }),

    getTender: build.query<TenderDTO, { orgId: string; tenderId: string }>({
      query: ({ orgId, tenderId }) => ({
        url: `/organizations/${orgId}/tenders/${tenderId}`,
        method: 'GET',
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { tender: TenderDTO } }) => raw.data.tender,
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
      transformResponse: (raw: { data: { tender: TenderDTO } }) => raw.data.tender,
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
      transformResponse: (raw: { data: { tender: TenderDTO } }) => raw.data.tender,
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
      transformResponse: (raw: { data: { tender: TenderDTO } }) => raw.data.tender,
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
      transformResponse: (raw: { data: { tender: TenderDTO } }) => raw.data.tender,
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
      transformResponse: (raw: { data: { tender: TenderDTO } }) => raw.data.tender,
      invalidatesTags: (_r, _e, { tenderId }) => [
        { type: 'Tender', id: tenderId },
        { type: 'Tender', id: 'LIST' },
      ],
    }),

    transitionTender: build.mutation<
      TenderDTO,
      { orgId: string; tenderId: string; status: string; expectedVersion: number }
    >({
      query: ({ orgId, tenderId, status, expectedVersion }) => ({
        url: `/organizations/${orgId}/tenders/${tenderId}/${TENDER_TRANSITION_PATH[status]}`,
        method: 'POST',
        body: { expectedVersion },
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { tender: TenderDTO } }) => raw.data.tender,
      invalidatesTags: (_r, _e, { tenderId, status }) => [
        { type: 'Tender', id: tenderId },
        { type: 'Tender', id: 'LIST' },
        ...(status === 'AWARDED' ? [{ type: 'Project' as const, id: 'LIST' }] : []),
      ],
    }),

    // ── Proposals ──────────────────────────────────────────────────────────

    listProposals: build.query<ProposalDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/proposals`,
      transformResponse: (raw: { data: { items: ProposalDTO[]; nextCursor?: string | null } }) => raw.data,
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
      transformResponse: (raw: { data: { proposal: ProposalDTO } }) => raw.data.proposal,
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
      transformResponse: (raw: { data: { proposal: ProposalDTO } }) => raw.data.proposal,
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
      transformResponse: (raw: { data: { proposal: ProposalDTO } }) => raw.data.proposal,
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
      transformResponse: (raw: { data: { proposal: ProposalDTO } }) => raw.data.proposal,
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
      transformResponse: (raw: { data: { proposal: ProposalDTO } }) => raw.data.proposal,
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
      transformResponse: (raw: { data: { proposal: ProposalDTO } }) => raw.data.proposal,
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
      transformResponse: (raw: { data: { proposal: ProposalDTO } }) => raw.data.proposal,
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
      transformResponse: (raw: { data: { proposal: ProposalDTO } }) => raw.data.proposal,
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
      transformResponse: (raw: { data: { proposal: ProposalDTO } }) => raw.data.proposal,
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
      transformResponse: (raw: { data: { items: ProposalRevisionDTO[]; nextCursor?: string | null } }) => raw.data,
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
      transformResponse: (raw: { data: { revision: ProposalRevisionDTO } }) => raw.data.revision,
      providesTags: (_r, _e, { proposalId, revisionId }) => [
        { type: 'Proposal', id: `${proposalId}_REV_${revisionId}` },
      ],
    }),

    convertProposal: build.mutation<{ conversion: { id: string; status: string; linkedProjectId: string | null }; alreadyConverted: boolean }, OrgProjectArgs & { proposalId: string; input: ConvertProposalInput }>({
      query: ({ orgId, projectId, proposalId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/convert`,
        method: 'POST',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { conversion: { id: string; status: string; linkedProjectId: string | null }; alreadyConverted: boolean } }) => raw.data,
      invalidatesTags: (_r, _e, { proposalId }) => [
        { type: 'Proposal', id: proposalId },
        { type: 'Project', id: 'LIST' },
        { type: 'ChangeOrder', id: 'LIST' },
      ],
    }),

    // ── Estimates ──────────────────────────────────────────────────────────

    listEstimates: build.query<EstimateDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/estimates`,
      transformResponse: (raw: { data: { items: EstimateDTO[]; nextCursor?: string | null } }) => raw.data,
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
      transformResponse: (raw: { data: { estimate: EstimateDTO } }) => raw.data.estimate,
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
      transformResponse: (raw: { data: { estimate: EstimateDTO } }) => raw.data.estimate,
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
      transformResponse: (raw: { data: { estimate: EstimateDTO } }) => raw.data.estimate,
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
      transformResponse: (raw: { data: { estimate: EstimateDTO } }) => raw.data.estimate,
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
      transformResponse: (raw: { data: { estimate: EstimateDTO } }) => raw.data.estimate,
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
      transformResponse: (raw: { data: { estimate: EstimateDTO } }) => raw.data.estimate,
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
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/boqs`,
      transformResponse: (raw: { data: { items: BoqDTO[]; nextCursor?: string | null } }) => raw.data,
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
      transformResponse: (raw: { data: { boq: BoqDTO } }) => raw.data.boq,
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
      transformResponse: (raw: { data: { boq: BoqDTO } }) => raw.data.boq,
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
      transformResponse: (raw: { data: { boq: BoqDTO } }) => raw.data.boq,
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
      transformResponse: (raw: { data: { boq: BoqDTO } }) => raw.data.boq,
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
      transformResponse: (raw: { data: { boq: BoqDTO } }) => raw.data.boq,
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
      transformResponse: (raw: { data: { boq: BoqDTO } }) => raw.data.boq,
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
      transformResponse: (raw: { data: { items: BoqRevisionDTO[]; nextCursor?: string | null } }) => raw.data,
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
      transformResponse: (raw: { data: { revision: BoqRevisionDTO } }) => raw.data.revision,
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
      transformResponse: (raw: { data: { preview: BoqImportPreviewResult } }) => raw.data.preview,
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
      transformResponse: (raw: { data: { boq: BoqDTO } }) => raw.data.boq,
      invalidatesTags: (_r, _e, { boqId }) => [
        { type: 'BOQ', id: boqId },
        { type: 'BOQ', id: 'LIST' },
      ],
    }),

    mapBoqItem: build.mutation<BoqItemDTO, OrgProjectArgs & { boqId: string; itemId: string; input: BoqMapItemInput }>({
      query: ({ orgId, projectId, boqId, itemId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/items/${itemId}/mapping`,
        method: 'PUT',
        body: input,
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { item: BoqItemDTO } }) => raw.data.item,
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

    listTakeoffSheets: build.query<{ items: TakeoffSheetDTO[]; nextCursor: string | null }, OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/takeoffs/sheets`,
      transformResponse: (raw: { data: { items: TakeoffSheetDTO[]; nextCursor: string | null } }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'Takeoff', id: projectId }],
    }),

    createTakeoffSheet: build.mutation<TakeoffSheetDTO, OrgProjectArgs & { input: CreateTakeoffSheetInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/takeoffs/sheets`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: { sheet: TakeoffSheetDTO } }) => raw.data.sheet,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Takeoff', id: projectId }],
    }),

    transitionTakeoffSheet: build.mutation<
      TakeoffSheetDTO,
      OrgProjectArgs & { sheetId: string; action: 'submit' | 'approve' | 'reject'; expectedVersion: number; reason?: string }
    >({
      query: ({ orgId, projectId, sheetId, action, expectedVersion, reason }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/takeoffs/sheets/${sheetId}/${action}`,
        method: 'POST',
        body: action === 'reject' ? { expectedVersion, reason } : { expectedVersion },
      }),
      transformResponse: (raw: { data: { sheet: TakeoffSheetDTO } }) => raw.data.sheet,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Takeoff', id: projectId }],
    }),

    // ── Generic transitions and client events ──────────────────────────────

    transitionEstimate: build.mutation<
      EstimateDTO,
      OrgProjectArgs & { estimateId: string; action: 'submit' | 'approve' | 'reject'; expectedVersion: number; reason?: string }
    >({
      query: ({ orgId, projectId, estimateId, action, expectedVersion, reason }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/estimates/${estimateId}/${action}`,
        method: 'POST',
        body: action === 'reject' ? { expectedVersion, reason } : { expectedVersion },
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { estimate: EstimateDTO } }) => raw.data.estimate,
      invalidatesTags: (_r, _e, { estimateId, action }) => [
        { type: 'Estimate', id: estimateId },
        { type: 'Estimate', id: 'LIST' },
        ...(action === 'approve' ? [{ type: 'Budget' as const, id: 'CURRENT' }] : []),
      ],
    }),

    transitionBoq: build.mutation<
      BoqDTO,
      OrgProjectArgs & { boqId: string; action: 'submit' | 'approve' | 'lock'; expectedVersion: number }
    >({
      query: ({ orgId, projectId, boqId, action, expectedVersion }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boqs/${boqId}/${action}`,
        method: 'POST',
        body: { expectedVersion },
        headers: {
          'X-Idempotency-Key': crypto.randomUUID(),
        },
      }),
      transformResponse: (raw: { data: { boq: BoqDTO } }) => raw.data.boq,
      invalidatesTags: (_r, _e, { boqId }) => [
        { type: 'BOQ', id: boqId },
        { type: 'BOQ', id: 'LIST' },
      ],
    }),

    transitionProposal: build.mutation<
      ProposalDTO,
      OrgProjectArgs & {
        proposalId: string;
        action: 'submit' | 'approve' | 'reject' | 'issue' | 'withdraw';
        expectedVersion: number;
        reason?: string;
        deliveryMethod?: 'INTERNAL' | 'EMAIL';
        deliveryNotes?: string;
      }
    >({
      query: ({ orgId, projectId, proposalId, action, expectedVersion, reason, deliveryMethod, deliveryNotes }) => {
        const body: Record<string, string | number> = { expectedVersion };
        if ((action === 'reject' || action === 'withdraw') && reason !== undefined) body.reason = reason;
        if (action === 'issue') {
          if (deliveryMethod) body.deliveryMethod = deliveryMethod;
          if (deliveryNotes) body.deliveryNotes = deliveryNotes;
        }
        return {
          url: `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/${action}`,
          method: 'POST',
          body,
          headers: {
            'X-Idempotency-Key': crypto.randomUUID(),
          },
        };
      },
      transformResponse: (raw: { data: { proposal: ProposalDTO } }) => raw.data.proposal,
      invalidatesTags: (_r, _e, { proposalId }) => [
        { type: 'Proposal', id: proposalId },
        { type: 'Proposal', id: 'LIST' },
      ],
    }),

    listClientEvents: build.query<{ events: ProposalClientEventDTO[] }, OrgProjectArgs & { proposalId: string }>({
      query: ({ orgId, projectId, proposalId }) =>
        `/organizations/${orgId}/projects/${projectId}/proposals/${proposalId}/client-events`,
      transformResponse: (raw: { data: { events: ProposalClientEventDTO[] } }) => raw.data,
      providesTags: (_r, _e, { proposalId }) => [{ type: 'Proposal', id: proposalId }],
    }),

    // ── Pricing / Material Rates ───────────────────────────────────────────

    listRateVersions: build.query<MaterialRateVersionDTO[], OrgProjectArgs & { materialId: string }>({
      query: ({ orgId, projectId, materialId }) =>
        `/organizations/${orgId}/projects/${projectId}/pricing/rates?materialId=${encodeURIComponent(materialId)}`,
      transformResponse: (raw: { data: { rateVersions: MaterialRateVersionDTO[] } }) => raw.data.rateVersions,
      providesTags: (_r, _e, { materialId }) => [{ type: 'MaterialRate', id: materialId }],
    }),

    createRateVersion: build.mutation<MaterialRateVersionDTO, OrgProjectArgs & { input: CreateRateVersionInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/pricing/rates`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: { rateVersion: MaterialRateVersionDTO } }) => raw.data.rateVersion,
      invalidatesTags: (r) => (r ? [{ type: 'MaterialRate', id: r.materialId }] : []),
    }),

    approveRateVersion: build.mutation<MaterialRateVersionDTO, OrgProjectArgs & { rateId: string }>({
      query: ({ orgId, projectId, rateId }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/pricing/rates/${rateId}/approve`,
        method: 'POST',
      }),
      transformResponse: (raw: { data: { rateVersion: MaterialRateVersionDTO } }) => raw.data.rateVersion,
      invalidatesTags: (r) => (r ? [{ type: 'MaterialRate', id: r.materialId }] : []),
    }),

    retireRateVersion: build.mutation<MaterialRateVersionDTO, OrgProjectArgs & { rateId: string; effectiveTo: string }>({
      query: ({ orgId, projectId, rateId, effectiveTo }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/pricing/rates/${rateId}/retire`,
        method: 'POST',
        body: { effectiveTo },
      }),
      transformResponse: (raw: { data: { rateVersion: MaterialRateVersionDTO } }) => raw.data.rateVersion,
      invalidatesTags: (r) => (r ? [{ type: 'MaterialRate', id: r.materialId }] : []),
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
  useTransitionTenderMutation,
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
  useTransitionTakeoffSheetMutation,
  // Generic transitions and client events
  useTransitionEstimateMutation,
  useTransitionBoqMutation,
  useTransitionProposalMutation,
  useListClientEventsQuery,
  // Pricing
  useListRateVersionsQuery,
  useCreateRateVersionMutation,
  useApproveRateVersionMutation,
  useRetireRateVersionMutation,
} = preconstructionApi;
