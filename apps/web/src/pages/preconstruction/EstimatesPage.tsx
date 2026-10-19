/**
 * EstimatesPage — /org/:orgId/projects/:projectId/preconstruction/estimates
 *
 * Backend:
 *   GET  /:orgId/projects/:projectId/estimates                     permission: project.estimate.read
 *   POST /:orgId/projects/:projectId/estimates                     permission: project.estimate.create
 *   POST /:orgId/projects/:projectId/estimates/:id/submit          permission: project.estimate.submit
 *   POST /:orgId/projects/:projectId/estimates/:id/approve         permission: project.estimate.review
 *   POST /:orgId/projects/:projectId/estimates/:id/reject          permission: project.estimate.review
 *
 * State machine (estimate.service.ts):
 *   DRAFT → PENDING_APPROVAL → APPROVED | REJECTED
 *   REJECTED → edit → DRAFT → re-submit
 *   expectedVersion required on all transitions
 *   Actor separation: approver ≠ creator ≠ submitter (assertFinancialActorSeparation)
 *   reject reason: min:10 max:500
 *
 * Validation: packages/shared/src/modules/project/estimate.schema.ts
 *   title: min:1 max:160
 *   sections: min:1 max:50; lines per section: min:1 max:500 total across all sections
 *   terms.taxPercent > 0 → taxSource required
 *   markupMode TARGET_MARGIN → markupPercent < 100
 *   unitRate XOR resources (not both)
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Calculator } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListEstimatesQuery,
  useCreateEstimateMutation,
  useTransitionEstimateMutation,
} from '../../api/preconstructionApi';
import { usePermission } from '../../hooks/usePermission';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import {
  getServerError,
  isInlineError,
  isToastError,
  toastErrorMessage,
} from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { EstimateStatus } from '../../types/preconstructionTypes';

const STATUS_BADGE: Record<EstimateStatus, string> = {
  DRAFT:            'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  PENDING_APPROVAL: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  APPROVED:         'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  REJECTED:         'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
};

const FILTER_OPTIONS = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const;

export const EstimatesPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const navigate = useNavigate();
  const canCreate = usePermission('project.estimate.create');
  const canReview = usePermission('project.estimate.review');
  const { success: toastOk, error: toastErr } = useToast();

  const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [rejectingId, setRejectingId] = useState<{ id: string; version: number } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Create form state
  const [title, setTitle]     = useState('');
  const [overhead, setOverhead]   = useState('10');
  const [contingency, setContingency] = useState('5');
  const [markup, setMarkup]   = useState('12');
  const [tax, setTax]         = useState('17');
  const [taxSource, setTaxSource] = useState('Sales Tax on Services');

  const { data, isLoading } = useListEstimatesQuery({ orgId: orgId!, projectId: projectId! });
  const [createEstimate, { isLoading: creating, error: createErr }] = useCreateEstimateMutation();
  const [transitionEstimate, { isLoading: transitioning }] = useTransitionEstimateMutation();

  const onCreate = async () => {
    if (!title.trim()) { toastErr('Title required', ''); return; }
    try {
      const result = await createEstimate({
        orgId: orgId!, projectId: projectId!,
        input: {
          title: title.trim(),
          terms: {
            overheadPercent: overhead,
            contingencyPercent: contingency,
            markupMode: 'MARKUP',
            markupPercent: markup,
            taxPercent: tax,
            taxSource: parseFloat(tax) > 0 ? taxSource : undefined,
          },
          sections: [{
            title: 'Section 1',
            lines: [{
              category: 'MATERIAL',
              description: 'TBC',
              quantity: '1',
              unit: 'LS',
              unitRate: '0',
            }],
          }],
        },
      }).unwrap();
      toastOk('Estimate created', '');
      setShowCreate(false);
      setTitle('');
      navigate(`/org/${orgId}/projects/${projectId}/preconstruction/estimates/${result.id}`);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const onSubmit = async (estimateId: string, version: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await transitionEstimate({ orgId: orgId!, projectId: projectId!, estimateId, action: 'submit', expectedVersion: version }).unwrap();
      toastOk('Submitted for approval', '');
    } catch (err) { toastErr('Submit failed', toastErrorMessage(err as never)); }
  };

  const onApprove = async (estimateId: string, version: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await transitionEstimate({ orgId: orgId!, projectId: projectId!, estimateId, action: 'approve', expectedVersion: version }).unwrap();
      toastOk('Estimate approved', '');
    } catch (err) { toastErr('Approve failed', toastErrorMessage(err as never)); }
  };

  const onReject = async () => {
    if (!rejectingId || rejectReason.trim().length < 10) { toastErr('Reason too short', 'Min 10 characters.'); return; }
    try {
      await transitionEstimate({ orgId: orgId!, projectId: projectId!, estimateId: rejectingId.id, action: 'reject', expectedVersion: rejectingId.version, reason: rejectReason }).unwrap();
      toastOk('Estimate rejected', '');
      setRejectingId(null); setRejectReason('');
    } catch (err) { toastErr('Reject failed', toastErrorMessage(err as never)); }
  };

  const estimates = data?.items ?? [];
  const rows = filter === 'ALL' ? estimates : estimates.filter((e) => e.status === filter);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Estimates</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{estimates.length} estimate{estimates.length !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> New estimate
          </button>
        )}
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New estimate</p>
          {isInlineError(createErr) && <InlineAlert variant="error" message={getServerError(createErr)?.message ?? 'Error'} />}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-4">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className={inputCls()} />
            </div>
            {[
              { label: 'Overhead %',    value: overhead,     set: setOverhead },
              { label: 'Contingency %', value: contingency,  set: setContingency },
              { label: 'Markup %',      value: markup,       set: setMarkup },
              { label: 'Tax %',         value: tax,          set: setTax },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">{label}</label>
                <input type="text" value={value} onChange={(e) => set(e.target.value)} className={inputCls()} />
              </div>
            ))}
            {parseFloat(tax) > 0 && (
              <div className="sm:col-span-4">
                <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Tax source *</label>
                <input value={taxSource} onChange={(e) => setTaxSource(e.target.value)} maxLength={500} className={inputCls()} />
              </div>
            )}
          </div>
          <p className="font-mono text-[9px] text-[var(--muted)]">
            An initial section and placeholder line will be created. Edit sections and lines on the estimate detail page.
          </p>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
              {creating ? 'Creating…' : 'Create estimate'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        {FILTER_OPTIONS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Reject inline form */}
      {rejectingId && (
        <div className="mb-4 border border-[#fecaca] bg-[#fef2f2] p-4 flex items-center gap-3">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (min 10 characters)"
            maxLength={500}
            className="flex-1 border border-[#fecaca] bg-white px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[#991b1b]"
          />
          <button onClick={onReject} disabled={transitioning}
            className="font-mono text-[9px] uppercase border border-[#991b1b] bg-[#991b1b] text-white px-3 py-2 hover:bg-[#7f1d1d] disabled:opacity-50">
            Confirm reject
          </button>
          <button type="button" onClick={() => setRejectingId(null)} className="text-sm text-[#991b1b]">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[2fr_100px_50px_120px_120px_180px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Title', 'Status', 'Rev.', 'Direct cost', 'Total', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <Calculator className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No estimates yet.</p>
          </div>
        ) : (
          rows.map((est) => (
            <div key={est.id}
              onClick={() => navigate(`/org/${orgId}/projects/${projectId}/preconstruction/estimates/${est.id}`)}
              className="grid grid-cols-[2fr_100px_50px_120px_120px_180px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{est.title}</p>
                {est.rejectionReason && (
                  <p className="font-mono text-[9px] text-[#991b1b] truncate">Rejected: {est.rejectionReason}</p>
                )}
              </div>
              <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[est.status]}`}>
                {est.status.replace('_', ' ')}
              </span>
              <p className="font-mono text-[10px] text-[var(--muted)]">{est.currentRevisionNumber}</p>
              <p className="font-mono text-[10px]">{est.revision?.directCostTotal ? parseFloat(est.revision.directCostTotal).toLocaleString() : '—'}</p>
              <p className="font-mono text-[10px] font-medium">{est.revision?.totalAmount ? parseFloat(est.revision.totalAmount).toLocaleString() : '—'}</p>

              <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                {est.status === 'DRAFT' && (
                  <button onClick={(e) => onSubmit(est.id, est.version, e)} disabled={transitioning}
                    className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-2 py-1 hover:bg-[var(--surface-2)] disabled:opacity-50">
                    Submit
                  </button>
                )}
                {est.status === 'PENDING_APPROVAL' && canReview && (
                  <>
                    <button onClick={(e) => onApprove(est.id, est.version, e)} disabled={transitioning}
                      className="font-mono text-[9px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-2 py-1 hover:bg-[#dcfce7] disabled:opacity-50">
                      Approve
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setRejectingId({ id: est.id, version: est.version }); setRejectReason(''); }}
                      className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-2 py-1 text-[#991b1b] hover:bg-[#fef2f2]">
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
