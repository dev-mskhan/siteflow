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
  CreateProposalInput,
  CreateEstimateInput,
  CreateBoqInput,
  CreateTakeoffSheetInput,
  CreateRateVersionInput,
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
      }),
      transformResponse: (raw: { data: TenderDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Tender', id: projectId }],
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
      }),
      transformResponse: (raw: { data: ProposalDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Proposal', id: projectId }],
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
      }),
      transformResponse: (raw: { data: EstimateDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Estimate', id: projectId }],
    }),

    // ── BOQ (Bill of Quantities) ───────────────────────────────────────────

    listBoqs: build.query<BoqDTO[], OrgProjectArgs>({
      query: ({ orgId, projectId }) => `/organizations/${orgId}/projects/${projectId}/boq`,
      transformResponse: (raw: { data: BoqDTO[] }) => raw.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'BOQ', id: projectId }],
    }),

    createBoq: build.mutation<BoqDTO, OrgProjectArgs & { input: CreateBoqInput }>({
      query: ({ orgId, projectId, input }) => ({
        url: `/organizations/${orgId}/projects/${projectId}/boq`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (raw: { data: BoqDTO }) => raw.data,
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'BOQ', id: projectId }],
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
  useListTendersQuery,
  useCreateTenderMutation,
  useListProposalsQuery,
  useCreateProposalMutation,
  useListEstimatesQuery,
  useCreateEstimateMutation,
  useListBoqsQuery,
  useCreateBoqMutation,
  useListTakeoffSheetsQuery,
  useCreateTakeoffSheetMutation,
  useListMaterialRatesQuery,
  useCreateMaterialRateMutation,
} = preconstructionApi;
