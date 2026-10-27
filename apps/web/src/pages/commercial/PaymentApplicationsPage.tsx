/**
 * PaymentApplicationsPage — /org/:orgId/projects/:projectId/commercial/payment-applications
 *
 * State machine (payment-application.service.ts):
 *   DRAFT → SUBMITTED (submit) → UNDER_REVIEW (under-review) → APPROVED (approve) | REJECTED (reject)
 *   DRAFT | REJECTED → VOID (void)
 *   approve sends each line at its proposed currentWork and storedMaterials (full approval).
 *   reject: { expectedVersion, reason min:1 max:500 }
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Receipt } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListPaymentApplicationsQuery,
  useCreatePaymentApplicationMutation,
  useTransitionPaymentApplicationMutation,
  useLazyGetPaymentApplicationQuery,
} from '../../features/project/commercialApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { PaymentApplicationLineDTO, PaymentApplicationStatus } from '../../types/commercialTypes';

const STATUS_BADGE: Record<PaymentApplicationStatus, string> = {
  DRAFT:        'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  SUBMITTED:    'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  UNDER_REVIEW: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  APPROVED:     'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  PARTIALLY_APPROVED: 'border-[#bbf7d0] bg-[#f7fee7] text-[#3f6212]',
  REJECTED:     'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  VOID:         'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)] opacity-60',
};

const FILTERS = ['ALL', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const;

const toApprovalLines = (lines: PaymentApplicationLineDTO[]) =>
  lines.map((l) => ({
    scheduleOfValueLineId: l.scheduleOfValueLineId,
    approvedCurrentWork: l.currentWork,
    approvedStoredMaterials: l.storedMaterials,
  }));

interface ActionState {
  id: string; version: number;
  action: 'reject' | 'void' | 'approve';
}

export const PaymentApplicationsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const canCreate  = usePermission('project.payment_application.create');
  const canReview  = usePermission('project.payment_application.review');
  const canApprove = usePermission('project.payment_application.approve');
  const canVoid    = usePermission('project.payment_application.void');

  const [filter, setFilter] = useState<typeof FILTERS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Create form
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd]     = useState('');
  const [currency, setCurrency]       = useState('PKR');
  const [workCompleted, setWorkCompleted] = useState('');

  const { data, isLoading } = useListPaymentApplicationsQuery({ orgId: orgId!, projectId: projectId! });
  const [createPA, { isLoading: creating }] = useCreatePaymentApplicationMutation();
  const [transitionPA, { isLoading: transitioning }] = useTransitionPaymentApplicationMutation();
  const [loadPA] = useLazyGetPaymentApplicationQuery();

  const onCreate = async () => {
    if (!periodStart || !periodEnd) { toastErr('Period dates required', ''); return; }
    try {
      await createPA({
        orgId: orgId!, projectId: projectId!,
        input: { periodStart, periodEnd, currencyCode: currency.toUpperCase(), workCompletedThisPeriod: workCompleted || undefined },
      }).unwrap();
      toastOk('Payment application created', '');
      setShowCreate(false); setPeriodStart(''); setPeriodEnd(''); setWorkCompleted('');
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const doTransition = async (
    paId: string,
    action: 'submit' | 'under-review' | 'approve' | 'reject' | 'void',
    version: number,
    opts?: { reason?: string; lines?: ReturnType<typeof toApprovalLines> },
  ) => {
    try {
      await transitionPA({
        orgId: orgId!, projectId: projectId!, paId, action, expectedVersion: version,
        reason: opts?.reason,
        lines: opts?.lines,
      }).unwrap();
      toastOk(`Payment application ${action.replace('-', ' ')}d`, '');
      setActionState(null); setActionReason('');
    } catch (err) { toastErr('Action failed', toastErrorMessage(err as never)); }
  };

  const doApprove = async (paId: string) => {
    try {
      const pa = await loadPA({ orgId: orgId!, projectId: projectId!, paId }).unwrap();
      if (pa.lines.length === 0) { toastErr('Payment application has no lines to approve', ''); return; }
      await doTransition(paId, 'approve', pa.version, { lines: toApprovalLines(pa.lines) });
    } catch (err) { toastErr('Action failed', toastErrorMessage(err as never)); }
  };

  const pas = data?.items ?? [];
  const rows = filter === 'ALL' ? pas : pas.filter((p) => p.status === filter);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Payment applications</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{pas.length} total</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> New application
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New payment application</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Period start *</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Period end *</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Currency</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Work completed this period</label>
              <input value={workCompleted} onChange={(e) => setWorkCompleted(e.target.value)} placeholder="0.00" className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Inline action panel */}
      {actionState && (
        <div className={cn('mb-4 p-4 border space-y-3', actionState.action === 'approve' ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#fecaca] bg-[#fef2f2]')}>
          <p className={cn('font-mono text-[9px] uppercase tracking-[0.14em]', actionState.action === 'approve' ? 'text-[#166534]' : 'text-[#991b1b]')}>
            {actionState.action === 'approve' ? 'Approve payment application' : `${actionState.action.charAt(0).toUpperCase() + actionState.action.slice(1)} payment application`}
          </p>
          {actionState.action === 'approve' && (
            <p className="text-sm text-[#166534]">Every line is approved at its proposed current work and stored materials.</p>
          )}
          {actionState.action === 'reject' && (
            <input type="text" value={actionReason} onChange={(e) => setActionReason(e.target.value)}
              placeholder="Reason (required)" maxLength={500}
              className="w-full border border-[#fecaca] bg-white px-3 py-2 text-sm" />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (actionState.action === 'approve') doApprove(actionState.id);
                else if (actionState.action === 'reject') doTransition(actionState.id, 'reject', actionState.version, { reason: actionReason });
                else doTransition(actionState.id, 'void', actionState.version);
              }}
              disabled={transitioning || (actionState.action === 'reject' && !actionReason.trim())}
              className={cn('font-mono text-[9px] uppercase text-white px-4 py-1.5 disabled:opacity-50',
                actionState.action === 'approve' ? 'bg-[#166534] hover:bg-[#14532d]' : 'bg-[#991b1b] hover:bg-[#7f1d1d]')}>
              {transitioning ? 'Processing…' : `Confirm ${actionState.action}`}
            </button>
            <button type="button" onClick={() => { setActionState(null); setActionReason(''); }}
              className={cn('text-sm', actionState.action === 'approve' ? 'text-[#166534]' : 'text-[#991b1b]')}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex border-b border-[var(--hairline-2)] mb-6 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 whitespace-nowrap transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[110px_100px_100px_110px_110px_110px_200px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Number', 'Status', 'Period', 'Net due', 'Approved', 'Retainage', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>
        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <Receipt className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No payment applications yet.</p>
          </div>
        ) : rows.map((pa) => (
          <div key={pa.id} className="grid grid-cols-[110px_100px_100px_110px_110px_110px_200px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
            <p className="font-mono text-[10px] text-[var(--muted)]">{pa.applicationNumber}</p>
            <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[pa.status]}`}>
              {pa.status.replace('_', ' ')}
            </span>
            <p className="font-mono text-[10px] text-[var(--muted)]">{pa.periodStart.slice(5)}→{pa.periodEnd.slice(5)}</p>
            <p className="font-mono text-[10px]">{parseFloat(pa.netAmountDue).toLocaleString()}</p>
            <p className="font-mono text-[10px]">{pa.approvedAmount ? parseFloat(pa.approvedAmount).toLocaleString() : '—'}</p>
            <p className="font-mono text-[10px]">{parseFloat(pa.retainageAmount).toLocaleString()}</p>
            <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
              {pa.status === 'DRAFT' && (
                <button onClick={() => doTransition(pa.id, 'submit', pa.version)} disabled={transitioning}
                  className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-50">Submit</button>
              )}
              {pa.status === 'SUBMITTED' && canReview && (
                <button onClick={() => doTransition(pa.id, 'under-review', pa.version)} disabled={transitioning}
                  className="font-mono text-[8px] uppercase border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-1.5 py-0.5 hover:bg-[#fef3c7] disabled:opacity-50">Review</button>
              )}
              {pa.status === 'UNDER_REVIEW' && canApprove && (
                <>
                  <button onClick={() => { setActionState({ id: pa.id, version: pa.version, action: 'approve' }); }}
                    className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7]">Approve</button>
                  <button onClick={() => { setActionState({ id: pa.id, version: pa.version, action: 'reject' }); setActionReason(''); }}
                    className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[#991b1b] px-1.5 py-0.5 hover:bg-[#fef2f2]">Reject</button>
                </>
              )}
              {['DRAFT', 'REJECTED'].includes(pa.status) && canVoid && (
                <button onClick={() => setActionState({ id: pa.id, version: pa.version, action: 'void' })}
                  className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[var(--muted)] px-1.5 py-0.5 hover:bg-[var(--surface-2)]">Void</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
