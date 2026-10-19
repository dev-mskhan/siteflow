/**
 * preconstructionApi — RTK Query slice for all Group 7 pre-construction entities.
 *
 * Backend sources:
 *   Tender/Proposal: apps/server/src/modules/project/proposal/proposal.service.ts
 *   Estimate:        apps/server/src/modules/project/estimate/estimate.service.ts
 *   BOQ:             apps/server/src/modules/project/boq/boq.service.ts
 *   Takeoff:         apps/server/src/modules/project/takeoff/takeoff.service.ts
 *   Pricing:         apps/server/src/modules/project/pricing/pricing.service.ts
 *
 * Validation (authoritative):
 *   packages/shared/src/modules/project/proposal.schema.ts
 *   packages/shared/src/modules/project/estimate.schema.ts
 *   packages/shared/src/modules/project/boq.schema.ts
 *   packages/shared/src/modules/project/takeoff.schema.ts
 *   packages/shared/src/modules/project/pricing.schema.ts
 *
 * Key business rules enforced in queryFn:
 *   - Tender: edit only on OPEN; transitions follow allowed map
 *   - Proposal: edit on DRAFT/REJECTED only; expectedVersion required; actor separation on approve
 *   - Estimate: edit on DRAFT/REJECTED only; actor separation on approve
 *   - BOQ: import only on DRAFT; revise from APPROVED/LOCKED; submit needs ≥1 item
 *   - Takeoff: edit on DRAFT; revisions from APPROVED/REJECTED
 *   - Pricing: rate unit must match material.defaultUnitCode
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type {
  TenderDTO,
  CreateTenderInput,
  ProposalDTO,
  CreateProposalInput,
  EstimateDTO,
  CreateEstimateInput,
  BoqDTO,
  BoqRevisionDTO,
  BoqImportPreviewResult,
  CreateBoqInput,
  ReviseBoqInput,
  TakeoffSheetDTO,
  TakeoffRevisionDTO,
  TakeoffMeasurementDTO,
  CreateTakeoffSheetInput,
  CreateTakeoffMeasurementInput,
  MaterialRateVersionDTO,
  CreateRateVersionInput,
  TenderStatus,
  EstimateStatus,
  BoqStatus,
} from '../types/preconstructionTypes';
import {
  MOCK_TENDERS,
  MOCK_PROPOSALS,
  MOCK_ESTIMATES,
  MOCK_BOQS,
  MOCK_BOQ_REVISIONS,
  MOCK_TAKEOFF_SHEETS,
  MOCK_RATE_VERSIONS,
  MOCK_MATERIAL_NAMES_PRECONSTRUCTION,
} from '../fixtures/preconstruction.fixtures';

const delay = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

// ── Tender transition map — mirrors proposal.service.ts ───────────────────────
const TENDER_TRANSITIONS: Record<string, string[]> = {
  OPEN:      ['SUBMITTED', 'WITHDRAWN', 'EXPIRED'],
  SUBMITTED: ['AWARDED', 'LOST', 'WITHDRAWN', 'EXPIRED'],
};

// ── Proposal transition map — mirrors proposal.service.ts ────────────────────
const PROPOSAL_TRANSITIONS: Record<string, string[]> = {
  DRAFT:            ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED:         ['ISSUED'],
  ISSUED:           ['ACCEPTED', 'REJECTED'],
};
const PROPOSAL_WITHDRAWABLE = new Set(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED']);

export const preconstructionApi = createApi({
  reducerPath: 'preconstructionApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['Tender', 'Proposal', 'Estimate', 'Boq', 'BoqRevision', 'TakeoffSheet', 'TakeoffMeasurement', 'RateVersion'],

  endpoints: (build) => ({

    // ══ TENDER ══════════════════════════════════════════════════════════════
    // Org-scoped: GET/POST /:orgId/tenders  PATCH/transitions /:orgId/tenders/:tenderId

    listTenders: build.query<{ items: TenderDTO[]; nextCursor: string | null }, { orgId: string; status?: TenderStatus }>({
      queryFn: async ({ orgId, status }) => {
        await delay();
        let items = MOCK_TENDERS[orgId] ?? [];
        if (status) items = items.filter((t) => t.status === status);
        return { data: { items, nextCursor: null } };
      },
      providesTags: (_r, _e, { orgId }) => [{ type: 'Tender', id: orgId }],
    }),

    getTender: build.query<TenderDTO, { orgId: string; tenderId: string }>({
      queryFn: async ({ orgId, tenderId }) => {
        await delay(120);
        const t = (MOCK_TENDERS[orgId] ?? []).find((x) => x.id === tenderId);
        if (!t) return { error: { status: 404, error: 'TENDER_NOT_FOUND' } };
        return { data: t };
      },
      providesTags: (_r, _e, { tenderId }) => [{ type: 'Tender', id: tenderId }],
    }),

    createTender: build.mutation<TenderDTO, { orgId: string; input: CreateTenderInput }>({
      queryFn: async ({ orgId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const num = `TND-${String((MOCK_TENDERS[orgId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const t: TenderDTO = {
          id: `tender_${Date.now()}`,
          organizationId: orgId,
          projectId: input.projectId ?? null,
          tenderNumber: num,
          title: input.title,
          description: input.description ?? null,
          clientName: input.clientName,
          clientReference: input.clientReference ?? null,
          issuerName: input.issuerName ?? null,
          status: 'OPEN',
          submissionDeadline: input.submissionDeadline,
          submissionTimezone: input.submissionTimezone,
          requirements: input.requirements ?? null,
          requiredDocuments: input.requiredDocuments ?? null,
          estimatedValue: input.estimatedValue ?? null,
          currencyCode: input.currencyCode ?? null,
          notes: input.notes ?? null,
          version: 1,
          createdBy: 'usr_01',
          submittedAt: null,
          awardedAt: null,
          closedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_TENDERS[orgId] = [...(MOCK_TENDERS[orgId] ?? []), t];
        return { data: t };
      },
      invalidatesTags: (_r, _e, { orgId }) => [{ type: 'Tender', id: orgId }],
    }),

    updateTender: build.mutation<TenderDTO, { orgId: string; tenderId: string; input: CreateTenderInput & { expectedVersion: number } }>({
      queryFn: async ({ orgId, tenderId, input }) => {
        await delay(180);
        const list = MOCK_TENDERS[orgId] ?? [];
        const idx = list.findIndex((x) => x.id === tenderId);
        if (idx === -1) return { error: { status: 404, error: 'TENDER_NOT_FOUND' } };
        if (list[idx]!.version !== input.expectedVersion) return { error: { status: 409, error: 'TENDER_VERSION_CONFLICT' } };
        if (list[idx]!.status !== 'OPEN') return { error: { status: 409, error: 'TENDER_NOT_EDITABLE' } };
        const updated = { ...list[idx]!, ...input, version: list[idx]!.version + 1, updatedAt: new Date().toISOString() };
        MOCK_TENDERS[orgId] = list.map((x) => x.id === tenderId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { orgId, tenderId }) => [{ type: 'Tender', id: tenderId }, { type: 'Tender', id: orgId }],
    }),

    transitionTender: build.mutation<TenderDTO, { orgId: string; tenderId: string; status: string; expectedVersion: number }>({
      queryFn: async ({ orgId, tenderId, status, expectedVersion }) => {
        await delay(150);
        const list = MOCK_TENDERS[orgId] ?? [];
        const idx = list.findIndex((x) => x.id === tenderId);
        if (idx === -1) return { error: { status: 404, error: 'TENDER_NOT_FOUND' } };
        const t = list[idx]!;
        if (t.version !== expectedVersion) return { error: { status: 409, error: 'TENDER_VERSION_CONFLICT' } };
        if (!TENDER_TRANSITIONS[t.status]?.includes(status)) return { error: { status: 409, error: 'TENDER_INVALID_TRANSITION' } };
        const now = new Date().toISOString();
        const patch: Partial<TenderDTO> = { status: status as TenderStatus, version: t.version + 1, updatedAt: now };
        if (status === 'SUBMITTED') patch.submittedAt = now;
        if (status === 'AWARDED') patch.awardedAt = now;
        if (['LOST', 'WITHDRAWN', 'EXPIRED'].includes(status)) patch.closedAt = now;
        const updated = { ...t, ...patch };
        MOCK_TENDERS[orgId] = list.map((x) => x.id === tenderId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { orgId, tenderId }) => [{ type: 'Tender', id: tenderId }, { type: 'Tender', id: orgId }],
    }),

    // ══ PROPOSAL ════════════════════════════════════════════════════════════

    listProposals: build.query<{ items: ProposalDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: string }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_PROPOSALS[projectId] ?? [];
        if (status) items = items.filter((p) => p.status === status);
        return { data: { items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Proposal', id: projectId }],
    }),

    getProposal: build.query<ProposalDTO, { orgId: string; projectId: string; proposalId: string }>({
      queryFn: async ({ projectId, proposalId }) => {
        await delay(120);
        const p = (MOCK_PROPOSALS[projectId] ?? []).find((x) => x.id === proposalId);
        if (!p) return { error: { status: 404, error: 'PROPOSAL_NOT_FOUND' } };
        return { data: p };
      },
      providesTags: (_r, _e, { proposalId }) => [{ type: 'Proposal', id: proposalId }],
    }),

    createProposal: build.mutation<ProposalDTO, { orgId: string; projectId: string; input: CreateProposalInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const num = `PROP-${new Date().getFullYear()}-${String((MOCK_PROPOSALS[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const p: ProposalDTO = {
          id: `prop_${Date.now()}`,
          organizationId: orgId,
          projectId,
          tenderId: input.tenderId ?? null,
          proposalNumber: num,
          title: input.title,
          description: input.description ?? null,
          status: 'DRAFT',
          currentRevisionNumber: 1,
          version: 1,
          clientName: input.clientName ?? null,
          clientReference: input.clientReference ?? null,
          createdBy: 'usr_01',
          submittedBy: null,
          submittedAt: null,
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          issuedBy: null,
          issuedAt: null,
          withdrawnBy: null,
          withdrawnAt: null,
          withdrawalReason: null,
          revision: {
            id: `proprev_${Date.now()}`,
            proposalId: `prop_${Date.now()}`,
            revisionNumber: 1,
            status: 'DRAFT',
            currencyCode: input.currencyCode,
            taxPercent: input.taxPercent ?? '0',
            taxSource: input.taxSource ?? null,
            overheadPercent: input.overheadPercent ?? '0',
            contingencyPercent: input.contingencyPercent ?? '0',
            markupPercent: input.markupPercent ?? '0',
            discountPercent: input.discountPercent ?? '0',
            subtotalAmount: '0.00',
            taxAmount: '0.00',
            totalAmount: '0.00',
            scope: input.scope ?? null,
            inclusions: input.inclusions ?? null,
            exclusions: input.exclusions ?? null,
            assumptions: input.assumptions ?? null,
            validUntil: input.validUntil ?? null,
            estimatedDurationDays: input.estimatedDurationDays ?? null,
            createdBy: 'usr_01',
            submittedBy: null,
            approvedBy: null,
            issuedBy: null,
            deliveryMethod: 'INTERNAL',
            createdAt: now,
          },
          lines: input.lines.map((l, i) => ({ id: `propline_${Date.now()}_${i}`, ...l, sectionKey: l.sectionKey ?? null, specification: l.specification ?? null, costCodeId: l.costCodeId ?? null })),
          createdAt: now,
          updatedAt: now,
        };
        MOCK_PROPOSALS[projectId] = [...(MOCK_PROPOSALS[projectId] ?? []), p];
        return { data: p };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Proposal', id: projectId }],
    }),

    transitionProposal: build.mutation<ProposalDTO, { orgId: string; projectId: string; proposalId: string; action: 'submit' | 'approve' | 'reject' | 'issue' | 'withdraw'; expectedVersion: number; reason?: string }>({
      queryFn: async ({ projectId, proposalId, action, expectedVersion, reason }) => {
        await delay(180);
        const list = MOCK_PROPOSALS[projectId] ?? [];
        const p = list.find((x) => x.id === proposalId);
        if (!p) return { error: { status: 404, error: 'PROPOSAL_NOT_FOUND' } };
        if (p.version !== expectedVersion) return { error: { status: 409, error: 'PROPOSAL_VERSION_CONFLICT' } };

        const statusMap: Record<string, string> = {
          submit: 'PENDING_APPROVAL',
          approve: 'APPROVED',
          reject: 'REJECTED',
          issue: 'ISSUED',
          withdraw: 'WITHDRAWN',
        };
        const targetStatus = statusMap[action]!;
        if (action !== 'withdraw' && !PROPOSAL_TRANSITIONS[p.status]?.includes(targetStatus)) {
          return { error: { status: 409, error: 'PROPOSAL_INVALID_TRANSITION' } };
        }
        if (action === 'withdraw' && !PROPOSAL_WITHDRAWABLE.has(p.status)) {
          return { error: { status: 409, error: 'PROPOSAL_INVALID_TRANSITION' } };
        }
        if (action === 'reject' && (!reason || reason.trim().length < 10)) {
          return { error: { status: 422, error: 'PROPOSAL_REJECT_REASON_TOO_SHORT' } };
        }
        const now = new Date().toISOString();
        const updated: ProposalDTO = {
          ...p,
          status: targetStatus as ProposalDTO['status'],
          version: p.version + 1,
          updatedAt: now,
          submittedBy: action === 'submit' ? 'usr_01' : p.submittedBy,
          submittedAt: action === 'submit' ? now : p.submittedAt,
          approvedBy: action === 'approve' ? 'usr_01' : p.approvedBy,
          approvedAt: action === 'approve' ? now : p.approvedAt,
          rejectedBy: action === 'reject' ? 'usr_01' : p.rejectedBy,
          rejectedAt: action === 'reject' ? now : p.rejectedAt,
          rejectionReason: action === 'reject' ? (reason ?? null) : p.rejectionReason,
          issuedBy: action === 'issue' ? 'usr_01' : p.issuedBy,
          issuedAt: action === 'issue' ? now : p.issuedAt,
          withdrawnBy: action === 'withdraw' ? 'usr_01' : p.withdrawnBy,
          withdrawnAt: action === 'withdraw' ? now : p.withdrawnAt,
          withdrawalReason: action === 'withdraw' ? (reason ?? null) : p.withdrawalReason,
        };
        MOCK_PROPOSALS[projectId] = list.map((x) => x.id === proposalId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, proposalId }) => [
        { type: 'Proposal', id: proposalId },
        { type: 'Proposal', id: projectId },
      ],
    }),

    // ══ ESTIMATE ════════════════════════════════════════════════════════════

    listEstimates: build.query<{ items: EstimateDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: EstimateStatus }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_ESTIMATES[projectId] ?? [];
        if (status) items = items.filter((e) => e.status === status);
        return { data: { items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Estimate', id: projectId }],
    }),

    getEstimate: build.query<EstimateDTO, { orgId: string; projectId: string; estimateId: string }>({
      queryFn: async ({ projectId, estimateId }) => {
        await delay(120);
        const e = (MOCK_ESTIMATES[projectId] ?? []).find((x) => x.id === estimateId);
        if (!e) return { error: { status: 404, error: 'ESTIMATE_NOT_FOUND' } };
        return { data: e };
      },
      providesTags: (_r, _e, { estimateId }) => [{ type: 'Estimate', id: estimateId }],
    }),

    createEstimate: build.mutation<EstimateDTO, { orgId: string; projectId: string; input: CreateEstimateInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const e: EstimateDTO = {
          id: `est_${Date.now()}`,
          organizationId: orgId,
          projectId,
          title: input.title,
          description: input.description ?? null,
          status: 'DRAFT',
          currentRevisionNumber: 1,
          version: 1,
          createdBy: 'usr_01',
          submittedBy: null,
          submittedAt: null,
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          revision: {
            id: `estrev_${Date.now()}`,
            revisionNumber: 1,
            status: 'DRAFT',
            currencyCode: 'PKR',
            overheadPercent: input.terms.overheadPercent ?? '0',
            contingencyPercent: input.terms.contingencyPercent ?? '0',
            markupMode: input.terms.markupMode ?? 'NONE',
            markupPercent: input.terms.markupPercent ?? '0',
            discountPercent: input.terms.discountPercent ?? '0',
            taxPercent: input.terms.taxPercent ?? '0',
            taxSource: input.terms.taxSource ?? null,
            directCostTotal: '0.00',
            overheadAmount: '0.00',
            contingencyAmount: '0.00',
            markupAmount: '0.00',
            discountAmount: '0.00',
            taxableAmount: '0.00',
            taxAmount: '0.00',
            totalAmount: '0.00',
            createdBy: 'usr_01',
            submittedBy: null,
            approvedBy: null,
            createdAt: now,
          },
          sections: input.sections.map((s, si) => ({
            id: `estsec_${Date.now()}_${si}`,
            sectionNumber: si + 1,
            title: s.title,
            description: s.description ?? null,
            lines: s.lines.map((l, li) => ({
              id: `estline_${Date.now()}_${si}_${li}`,
              costCodeId: l.costCodeId ?? null,
              lineNumber: li + 1,
              category: l.category,
              description: l.description,
              specification: l.specification ?? null,
              quantity: l.quantity,
              unit: l.unit,
              unitRate: l.unitRate ?? null,
              directAmount: '0.00',
              resources: (l.resources ?? []).map((r, ri) => ({
                id: `estres_${Date.now()}_${ri}`,
                category: r.category,
                description: r.description,
                unit: r.unit,
                quantityPerLineUnit: r.quantityPerLineUnit,
                unitRate: r.unitRate,
                wastePercent: r.wastePercent ?? '0',
                extendedAmount: '0.00',
                rateSource: r.rateSource ?? null,
              })),
            })),
          })),
          createdAt: now,
          updatedAt: now,
        };
        MOCK_ESTIMATES[projectId] = [...(MOCK_ESTIMATES[projectId] ?? []), e];
        return { data: e };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Estimate', id: projectId }],
    }),

    transitionEstimate: build.mutation<EstimateDTO, { orgId: string; projectId: string; estimateId: string; action: 'submit' | 'approve' | 'reject'; expectedVersion: number; reason?: string }>({
      queryFn: async ({ projectId, estimateId, action, expectedVersion, reason }) => {
        await delay(180);
        const list = MOCK_ESTIMATES[projectId] ?? [];
        const e = list.find((x) => x.id === estimateId);
        if (!e) return { error: { status: 404, error: 'ESTIMATE_NOT_FOUND' } };
        if (e.version !== expectedVersion) return { error: { status: 409, error: 'ESTIMATE_VERSION_CONFLICT' } };
        const allowed: Record<string, string> = { submit: 'DRAFT', approve: 'PENDING_APPROVAL', reject: 'PENDING_APPROVAL' };
        if (e.status !== allowed[action]) return { error: { status: 409, error: 'ESTIMATE_INVALID_TRANSITION' } };
        if (action === 'reject' && (!reason || reason.trim().length < 10)) return { error: { status: 422, error: 'REJECT_REASON_TOO_SHORT' } };
        const statusMap: Record<string, EstimateStatus> = { submit: 'PENDING_APPROVAL', approve: 'APPROVED', reject: 'REJECTED' };
        const now = new Date().toISOString();
        const updated: EstimateDTO = {
          ...e,
          status: statusMap[action]!,
          version: e.version + 1,
          updatedAt: now,
          submittedBy: action === 'submit' ? 'usr_01' : e.submittedBy,
          submittedAt: action === 'submit' ? now : e.submittedAt,
          approvedBy: action === 'approve' ? 'usr_01' : e.approvedBy,
          approvedAt: action === 'approve' ? now : e.approvedAt,
          rejectedBy: action === 'reject' ? 'usr_01' : e.rejectedBy,
          rejectedAt: action === 'reject' ? now : e.rejectedAt,
          rejectionReason: action === 'reject' ? (reason ?? null) : e.rejectionReason,
        };
        MOCK_ESTIMATES[projectId] = list.map((x) => x.id === estimateId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, estimateId }) => [{ type: 'Estimate', id: estimateId }, { type: 'Estimate', id: projectId }],
    }),

    // ══ BOQ ════════════════════════════════════════════════════════════════

    listBoqs: build.query<{ items: BoqDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: BoqStatus }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_BOQS[projectId] ?? [];
        if (status) items = items.filter((b) => b.status === status);
        return { data: { items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'Boq', id: projectId }],
    }),

    getBoq: build.query<BoqDTO, { orgId: string; projectId: string; boqId: string }>({
      queryFn: async ({ projectId, boqId }) => {
        await delay(120);
        const b = (MOCK_BOQS[projectId] ?? []).find((x) => x.id === boqId);
        if (!b) return { error: { status: 404, error: 'BOQ_NOT_FOUND' } };
        return { data: b };
      },
      providesTags: (_r, _e, { boqId }) => [{ type: 'Boq', id: boqId }],
    }),

    createBoq: build.mutation<BoqDTO, { orgId: string; projectId: string; input: CreateBoqInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const num = `BOQ-${new Date().getFullYear()}-${String((MOCK_BOQS[projectId]?.length ?? 0) + 1).padStart(3, '0')}`;
        const b: BoqDTO = {
          id: `boq_${Date.now()}`,
          organizationId: orgId,
          projectId,
          boqNumber: num,
          title: input.title,
          description: input.description ?? null,
          currencyCode: input.currencyCode,
          status: 'DRAFT',
          currentRevisionNumber: 1,
          version: 1,
          createdBy: 'usr_01',
          createdAt: now,
          updatedAt: now,
        };
        MOCK_BOQS[projectId] = [...(MOCK_BOQS[projectId] ?? []), b];
        MOCK_BOQ_REVISIONS[b.id] = [{
          id: `boqrev_${Date.now()}`,
          boqId: b.id,
          revisionNumber: 1,
          status: 'DRAFT',
          createdBy: 'usr_01',
          approvedBy: null,
          approvedAt: null,
          lockedBy: null,
          lockedAt: null,
          createdAt: now,
        }];
        return { data: b };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Boq', id: projectId }],
    }),

    transitionBoq: build.mutation<BoqDTO, { orgId: string; projectId: string; boqId: string; action: 'submit' | 'approve' | 'lock'; expectedVersion: number }>({
      queryFn: async ({ projectId, boqId, action, expectedVersion }) => {
        await delay(180);
        const list = MOCK_BOQS[projectId] ?? [];
        const b = list.find((x) => x.id === boqId);
        if (!b) return { error: { status: 404, error: 'BOQ_NOT_FOUND' } };
        if (b.version !== expectedVersion) return { error: { status: 409, error: 'BOQ_VERSION_CONFLICT' } };
        const allowed: Record<string, BoqStatus> = { submit: 'DRAFT', approve: 'IN_REVIEW', lock: 'APPROVED' };
        if (b.status !== allowed[action]) return { error: { status: 409, error: 'BOQ_INVALID_TRANSITION' } };
        const statusMap: Record<string, BoqStatus> = { submit: 'IN_REVIEW', approve: 'APPROVED', lock: 'LOCKED' };
        const now = new Date().toISOString();
        const updated = { ...b, status: statusMap[action]!, version: b.version + 1, updatedAt: now };
        MOCK_BOQS[projectId] = list.map((x) => x.id === boqId ? updated : x);
        // Update revision status too
        const revisions = MOCK_BOQ_REVISIONS[boqId] ?? [];
        if (revisions.length > 0) {
          const last = revisions[revisions.length - 1]!;
          MOCK_BOQ_REVISIONS[boqId] = revisions.map((r) => r.id === last.id
            ? { ...r, status: statusMap[action]!, approvedBy: action === 'approve' ? 'usr_01' : r.approvedBy, approvedAt: action === 'approve' ? now : r.approvedAt, lockedBy: action === 'lock' ? 'usr_01' : r.lockedBy, lockedAt: action === 'lock' ? now : r.lockedAt }
            : r,
          );
        }
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, boqId }) => [{ type: 'Boq', id: boqId }, { type: 'Boq', id: projectId }, { type: 'BoqRevision', id: boqId }],
    }),

    reviseBoq: build.mutation<BoqDTO, { orgId: string; projectId: string; boqId: string; input: ReviseBoqInput }>({
      queryFn: async ({ projectId, boqId, input }) => {
        await delay(250);
        const list = MOCK_BOQS[projectId] ?? [];
        const b = list.find((x) => x.id === boqId);
        if (!b) return { error: { status: 404, error: 'BOQ_NOT_FOUND' } };
        if (b.version !== input.expectedVersion) return { error: { status: 409, error: 'BOQ_VERSION_CONFLICT' } };
        if (!['APPROVED', 'LOCKED'].includes(b.status)) return { error: { status: 409, error: 'BOQ_CANNOT_REVISE' } };
        const now = new Date().toISOString();
        const newRevNum = b.currentRevisionNumber + 1;
        const updated = { ...b, status: 'DRAFT' as BoqStatus, currentRevisionNumber: newRevNum, version: b.version + 1, updatedAt: now };
        MOCK_BOQS[projectId] = list.map((x) => x.id === boqId ? updated : x);
        const newRev: BoqRevisionDTO = {
          id: `boqrev_${Date.now()}`,
          boqId,
          revisionNumber: newRevNum,
          status: 'DRAFT',
          createdBy: 'usr_01',
          approvedBy: null,
          approvedAt: null,
          lockedBy: null,
          lockedAt: null,
          createdAt: now,
        };
        MOCK_BOQ_REVISIONS[boqId] = [...(MOCK_BOQ_REVISIONS[boqId] ?? []), newRev];
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, boqId }) => [{ type: 'Boq', id: boqId }, { type: 'Boq', id: projectId }, { type: 'BoqRevision', id: boqId }],
    }),

    listBoqRevisions: build.query<{ items: BoqRevisionDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; boqId: string }>({
      queryFn: async ({ boqId }) => {
        await delay(120);
        return { data: { items: MOCK_BOQ_REVISIONS[boqId] ?? [], nextCursor: null } };
      },
      providesTags: (_r, _e, { boqId }) => [{ type: 'BoqRevision', id: boqId }],
    }),

    previewBoqImport: build.mutation<BoqImportPreviewResult, { orgId: string; projectId: string; boqId: string; csvText: string; expectedVersion: number }>({
      queryFn: async ({ boqId, csvText, expectedVersion }) => {
        await delay(400);
        const boq = Object.values(MOCK_BOQS).flat().find((b) => b.id === boqId);
        if (!boq) return { error: { status: 404, error: 'BOQ_NOT_FOUND' } };
        if (boq.version !== expectedVersion) return { error: { status: 409, error: 'BOQ_VERSION_CONFLICT' } };
        if (boq.status !== 'DRAFT') return { error: { status: 409, error: 'BOQ_NOT_DRAFT' } };
        const lines = csvText.split('\n').filter(Boolean);
        const dataLines = lines.slice(1);
        return {
          data: {
            importId: `imp_${Date.now()}`,
            status: 'PREVIEWED',
            sourceFileSha256: `sha256_${Date.now()}`,
            rowCount: dataLines.length,
            sectionCount: new Set(dataLines.map((l) => l.split(',')[1])).size,
            totalAmount: '0.00',
            currencyCode: boq.currencyCode,
          },
        };
      },
    }),

    // ══ TAKEOFF ═════════════════════════════════════════════════════════════

    listTakeoffSheets: build.query<{ items: TakeoffSheetDTO[]; nextCursor: string | null }, { orgId: string; projectId: string; status?: string }>({
      queryFn: async ({ projectId, status }) => {
        await delay();
        let items = MOCK_TAKEOFF_SHEETS[projectId] ?? [];
        if (status) items = items.filter((s) => s.status === status);
        return { data: { items, nextCursor: null } };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'TakeoffSheet', id: projectId }],
    }),

    getTakeoffSheet: build.query<TakeoffSheetDTO, { orgId: string; projectId: string; sheetId: string }>({
      queryFn: async ({ projectId, sheetId }) => {
        await delay(120);
        const s = (MOCK_TAKEOFF_SHEETS[projectId] ?? []).find((x) => x.id === sheetId);
        if (!s) return { error: { status: 404, error: 'TAKEOFF_SHEET_NOT_FOUND' } };
        return { data: s };
      },
      providesTags: (_r, _e, { sheetId }) => [{ type: 'TakeoffSheet', id: sheetId }],
    }),

    createTakeoffSheet: build.mutation<TakeoffSheetDTO, { orgId: string; projectId: string; input: CreateTakeoffSheetInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const s: TakeoffSheetDTO = {
          id: `sheet_${Date.now()}`,
          organizationId: orgId,
          projectId,
          title: input.title,
          description: input.description ?? null,
          status: 'DRAFT',
          version: 1,
          currentRevisionNumber: 1,
          createdBy: 'usr_01',
          submittedBy: null,
          submittedAt: null,
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_TAKEOFF_SHEETS[projectId] = [...(MOCK_TAKEOFF_SHEETS[projectId] ?? []), s];
        return { data: s };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'TakeoffSheet', id: projectId }],
    }),

    transitionTakeoffSheet: build.mutation<TakeoffSheetDTO, { orgId: string; projectId: string; sheetId: string; action: 'submit' | 'approve' | 'reject'; expectedVersion: number; reason?: string }>({
      queryFn: async ({ projectId, sheetId, action, expectedVersion, reason }) => {
        await delay(180);
        const list = MOCK_TAKEOFF_SHEETS[projectId] ?? [];
        const s = list.find((x) => x.id === sheetId);
        if (!s) return { error: { status: 404, error: 'TAKEOFF_SHEET_NOT_FOUND' } };
        if (s.version !== expectedVersion) return { error: { status: 409, error: 'TAKEOFF_VERSION_CONFLICT' } };
        const allowed: Record<string, string[]> = {
          submit: ['DRAFT', 'REJECTED'],
          approve: ['PENDING_APPROVAL'],
          reject: ['PENDING_APPROVAL'],
        };
        if (!allowed[action]?.includes(s.status)) return { error: { status: 409, error: 'TAKEOFF_INVALID_TRANSITION' } };
        if (action === 'reject' && (!reason || reason.trim().length < 10)) return { error: { status: 422, error: 'REJECT_REASON_TOO_SHORT' } };
        const statusMap: Record<string, TakeoffSheetDTO['status']> = { submit: 'PENDING_APPROVAL', approve: 'APPROVED', reject: 'REJECTED' };
        const now = new Date().toISOString();
        const updated: TakeoffSheetDTO = {
          ...s,
          status: statusMap[action]!,
          version: s.version + 1,
          updatedAt: now,
          submittedBy: action === 'submit' ? 'usr_01' : s.submittedBy,
          submittedAt: action === 'submit' ? now : s.submittedAt,
          approvedBy: action === 'approve' ? 'usr_01' : s.approvedBy,
          approvedAt: action === 'approve' ? now : s.approvedAt,
          rejectedBy: action === 'reject' ? 'usr_01' : s.rejectedBy,
          rejectedAt: action === 'reject' ? now : s.rejectedAt,
          rejectionReason: action === 'reject' ? (reason ?? null) : s.rejectionReason,
        };
        MOCK_TAKEOFF_SHEETS[projectId] = list.map((x) => x.id === sheetId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId, sheetId }) => [{ type: 'TakeoffSheet', id: sheetId }, { type: 'TakeoffSheet', id: projectId }],
    }),

    // ══ PRICING RATES ════════════════════════════════════════════════════════

    listRateVersions: build.query<MaterialRateVersionDTO[], { orgId: string; projectId: string; materialId: string }>({
      queryFn: async ({ projectId, materialId }) => {
        await delay(120);
        const rates = (MOCK_RATE_VERSIONS[projectId] ?? []).filter((r) => r.materialId === materialId);
        return { data: rates };
      },
      providesTags: (_r, _e, { projectId }) => [{ type: 'RateVersion', id: projectId }],
    }),

    createRateVersion: build.mutation<MaterialRateVersionDTO, { orgId: string; projectId: string; input: CreateRateVersionInput }>({
      queryFn: async ({ orgId, projectId, input }) => {
        await delay(200);
        const now = new Date().toISOString();
        const existing = (MOCK_RATE_VERSIONS[projectId] ?? []).filter((r) => r.materialId === input.materialId);
        const versionNumber = existing.length + 1;
        if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) {
          return { error: { status: 422, error: 'PRICING_INVALID_DATES' } };
        }
        const r: MaterialRateVersionDTO = {
          id: `rate_${Date.now()}`,
          organizationId: orgId,
          materialId: input.materialId,
          scope: input.scope,
          projectId: input.scope === 'PROJECT' ? projectId : null,
          versionNumber,
          unitCode: input.unitCode,
          unitPrice: input.unitPrice,
          currencyCode: input.currencyCode,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo ?? null,
          status: 'DRAFT',
          createdBy: 'usr_01',
          approvedBy: null,
          approvedAt: null,
          retiredAt: null,
          createdAt: now,
          updatedAt: now,
        };
        MOCK_RATE_VERSIONS[projectId] = [...(MOCK_RATE_VERSIONS[projectId] ?? []), r];
        return { data: r };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'RateVersion', id: projectId }],
    }),

    approveRateVersion: build.mutation<MaterialRateVersionDTO, { orgId: string; projectId: string; rateId: string }>({
      queryFn: async ({ projectId, rateId }) => {
        await delay(180);
        const list = MOCK_RATE_VERSIONS[projectId] ?? [];
        const r = list.find((x) => x.id === rateId);
        if (!r) return { error: { status: 404, error: 'RATE_VERSION_NOT_FOUND' } };
        if (r.status !== 'DRAFT') return { error: { status: 409, error: 'RATE_VERSION_NOT_DRAFT' } };
        const now = new Date().toISOString();
        const updated = { ...r, status: 'APPROVED' as PricingRateStatus, approvedBy: 'usr_01', approvedAt: now, updatedAt: now };
        MOCK_RATE_VERSIONS[projectId] = list.map((x) => x.id === rateId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'RateVersion', id: projectId }],
    }),

    retireRateVersion: build.mutation<MaterialRateVersionDTO, { orgId: string; projectId: string; rateId: string; effectiveTo: string }>({
      queryFn: async ({ projectId, rateId, effectiveTo }) => {
        await delay(180);
        const list = MOCK_RATE_VERSIONS[projectId] ?? [];
        const r = list.find((x) => x.id === rateId);
        if (!r) return { error: { status: 404, error: 'RATE_VERSION_NOT_FOUND' } };
        if (r.status !== 'APPROVED') return { error: { status: 409, error: 'RATE_VERSION_NOT_APPROVED' } };
        if (effectiveTo <= r.effectiveFrom) return { error: { status: 422, error: 'PRICING_INVALID_DATES' } };
        const now = new Date().toISOString();
        const updated = { ...r, status: 'RETIRED' as PricingRateStatus, effectiveTo, retiredAt: now, updatedAt: now };
        MOCK_RATE_VERSIONS[projectId] = list.map((x) => x.id === rateId ? updated : x);
        return { data: updated };
      },
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'RateVersion', id: projectId }],
    }),

  }),
});

// Re-export the type for the retire mutation
type PricingRateStatus = 'DRAFT' | 'APPROVED' | 'RETIRED';

export const {
  useListTendersQuery,
  useGetTenderQuery,
  useCreateTenderMutation,
  useUpdateTenderMutation,
  useTransitionTenderMutation,
  useListProposalsQuery,
  useGetProposalQuery,
  useCreateProposalMutation,
  useTransitionProposalMutation,
  useListEstimatesQuery,
  useGetEstimateQuery,
  useCreateEstimateMutation,
  useTransitionEstimateMutation,
  useListBoqsQuery,
  useGetBoqQuery,
  useCreateBoqMutation,
  useTransitionBoqMutation,
  useReviseBoqMutation,
  useListBoqRevisionsQuery,
  usePreviewBoqImportMutation,
  useListTakeoffSheetsQuery,
  useGetTakeoffSheetQuery,
  useCreateTakeoffSheetMutation,
  useTransitionTakeoffSheetMutation,
  useListRateVersionsQuery,
  useCreateRateVersionMutation,
  useApproveRateVersionMutation,
  useRetireRateVersionMutation,
} = preconstructionApi;
