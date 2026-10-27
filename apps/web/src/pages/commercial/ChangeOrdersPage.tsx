/**
 * ChangeOrdersPage — /org/:orgId/projects/:projectId/commercial/change-orders
 *
 * State machine (change-order.service.ts):
 *   DRAFT → PENDING_APPROVAL (submit) → INTERNALLY_APPROVED (approve) →
 *   CLIENT_APPROVED (client-approve) → EFFECTED (effect — IRREVERSIBLE, confirm dialog)
 *   Any non-EFFECTED → VOIDED (void)
 *   Any non-void/effected → REJECTED (reject) → back to DRAFT
 *
 *   expectedVersion required on all transitions.
 *   reject body: { expectedVersion, reason: min 1 max 500 }
 *   effect: requires idempotency-key header (generated as UUID)
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, FilePen, AlertTriangle, X, Check } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListChangeOrdersQuery,
  useCreateChangeOrderMutation,
  useTransitionChangeOrderMutation,
} from '../../features/project/commercialApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { ChangeOrderStatus } from '../../types/commercialTypes';

const STATUS_BADGE: Record<ChangeOrderStatus, string> = {
  DRAFT:               'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  PENDING_APPROVAL:    'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  INTERNALLY_APPROVED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  CLIENT_APPROVED:     'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
  EFFECTED:            'border-[#a5f3fc] bg-[#ecfeff] text-[#0e7490]',
  REJECTED:            'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  VOIDED:              'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)] opacity-60',
};

const FILTERS = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'INTERNALLY_APPROVED', 'CLIENT_APPROVED', 'EFFECTED', 'REJECTED', 'VOIDED'] as const;

type FilterValue = typeof FILTERS[number];

interface ActionPanel {
  id: string;
  action: 'reject' | 'void' | 'effect';
  version: number;
}

export const ChangeOrdersPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const canCreate  = usePermission('project.change_order.create');
  const canApprove = usePermission('project.change_order.approve');
  const canEffect  = usePermission('project.change_order.effect');
  const canVoid    = usePermission('project.change_order.void');

  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [actionPanel, setActionPanel] = useState<ActionPanel | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [effectConfirmed, setEffectConfirmed] = useState(false);

  // Create form
  const [title, setTitle]       = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [reason, setReason]     = useState('');
  const [description, setDescription] = useState('');

  const { data, isLoading } = useListChangeOrdersQuery({ orgId: orgId!, projectId: projectId! });
  const [createCO, { isLoading: creating }] = useCreateChangeOrderMutation();
  const [transitionCO, { isLoading: transitioning }] = useTransitionChangeOrderMutation();

  const onCreate = async () => {
    if (!title.trim()) { toastErr('Title required', ''); return; }
    try {
      await createCO({
        orgId: orgId!, projectId: projectId!,
        input: { title: title.trim(), currencyCode: currency.toUpperCase(), description: description.trim() || undefined, reason: reason.trim() || undefined, lines: [] },
      }).unwrap();
      toastOk('Change order created', '');
      setShowCreate(false); setTitle(''); setCurrency('PKR'); setReason(''); setDescription('');
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const doTransition = async (
    changeOrderId: string,
    action: 'submit' | 'approve' | 'client-approve' | 'reject' | 'effect' | 'void',
    version: number,
    reason?: string,
  ) => {
    try {
      await transitionCO({ orgId: orgId!, projectId: projectId!, changeOrderId, action, expectedVersion: version, reason }).unwrap();
      const labels: Record<string, string> = {
        submit: 'submitted', approve: 'approved', 'client-approve': 'client-approved',
        reject: 'rejected', effect: 'effected', void: 'voided',
      };
      toastOk(`Change order ${labels[action]}`, action === 'effect' ? 'Budget has been updated.' : '');
      setActionPanel(null); setActionReason(''); setEffectConfirmed(false);
    } catch (err) { toastErr('Action failed', toastErrorMessage(err as never)); }
  };

  const cos = data?.items ?? [];
  const rows = filter === 'ALL' ? cos : cos.filter((c) => c.status === filter);

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Change orders</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{cos.length} total</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> New change order
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New change order</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Currency</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
            </div>
            <div className="sm:col-span-3">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Reason for change</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} className={inputCls()} />
            </div>
            <div className="sm:col-span-3">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={5000}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Reject / Void / Effect inline panels */}
      {actionPanel && (
        <div className={cn(
          'mb-4 p-4 border space-y-3',
          actionPanel.action === 'effect'
            ? 'border-[#fde68a] bg-[#fffbeb]'
            : 'border-[#fecaca] bg-[#fef2f2]',
        )}>
          {actionPanel.action === 'effect' ? (
            <>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#92400e]" strokeWidth={2} />
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#92400e]">
                  Irreversible — effect change order to budget
                </p>
              </div>
              <p className="text-sm text-[#92400e]">
                This will permanently apply the change order to the project budget. This action cannot be undone.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={effectConfirmed} onChange={(e) => setEffectConfirmed(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--ink)]" />
                <span className="text-sm text-[#92400e]">I confirm this is irreversible</span>
              </label>
              <div className="flex items-center gap-2">
                <button onClick={() => doTransition(actionPanel.id, 'effect', actionPanel.version)} disabled={!effectConfirmed || transitioning}
                  className="font-mono text-[9px] uppercase bg-[#92400e] text-white px-4 py-1.5 hover:bg-[#78350f] disabled:opacity-50">
                  {transitioning ? 'Effecting…' : 'Apply to budget'}
                </button>
                <button type="button" onClick={() => { setActionPanel(null); setEffectConfirmed(false); }} className="text-sm text-[#92400e]">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#991b1b]">
                {actionPanel.action === 'reject' ? 'Reject change order' : 'Void change order'}
              </p>
              {actionPanel.action === 'reject' && (
                <input type="text" value={actionReason} onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Reason (min 1 character)" maxLength={500}
                  className="w-full border border-[#fecaca] bg-white px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[#991b1b]" />
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => doTransition(actionPanel.id, actionPanel.action, actionPanel.version, actionPanel.action === 'reject' ? actionReason : undefined)}
                  disabled={transitioning || (actionPanel.action === 'reject' && !actionReason.trim())}
                  className="font-mono text-[9px] uppercase bg-[#991b1b] text-white px-4 py-1.5 hover:bg-[#7f1d1d] disabled:opacity-50">
                  {transitioning ? 'Processing…' : `Confirm ${actionPanel.action}`}
                </button>
                <button type="button" onClick={() => { setActionPanel(null); setActionReason(''); }} className="text-sm text-[#991b1b]">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex border-b border-[var(--hairline-2)] mb-6 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 whitespace-nowrap transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[110px_2fr_130px_110px_120px_220px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Number', 'Title', 'Status', 'Currency', 'Amount', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <FilePen className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No change orders yet.</p>
          </div>
        ) : rows.map((co) => (
          <div key={co.id} className="grid grid-cols-[110px_2fr_130px_110px_120px_220px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
            <p className="font-mono text-[10px] text-[var(--muted)]">{co.changeOrderNumber}</p>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{co.title}</p>
              {co.reason && <p className="font-mono text-[9px] text-[var(--muted)] truncate">{co.reason}</p>}
            </div>
            <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[co.status]}`}>
              {co.status.replace(/_/g, ' ')}
            </span>
            <p className="font-mono text-[10px] text-[var(--muted)]">{co.currencyCode}</p>
            <p className="font-mono text-[10px]">
              {co.lines.reduce((a, l) => a + parseFloat(l.amount), 0).toLocaleString()}
            </p>
            {/* Action buttons */}
            <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
              {co.status === 'DRAFT' && (
                <button onClick={() => doTransition(co.id, 'submit', co.version)} disabled={transitioning}
                  className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-50">
                  Submit
                </button>
              )}
              {co.status === 'PENDING_APPROVAL' && canApprove && (
                <button onClick={() => doTransition(co.id, 'approve', co.version)} disabled={transitioning}
                  className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7] disabled:opacity-50">
                  Approve
                </button>
              )}
              {co.status === 'INTERNALLY_APPROVED' && (
                <button onClick={() => doTransition(co.id, 'client-approve', co.version)} disabled={transitioning}
                  className="font-mono text-[8px] uppercase border border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3] px-1.5 py-0.5 hover:bg-[#e0e7ff] disabled:opacity-50">
                  Client approve
                </button>
              )}
              {co.status === 'CLIENT_APPROVED' && canEffect && (
                <button onClick={() => setActionPanel({ id: co.id, action: 'effect', version: co.version })}
                  className="font-mono text-[8px] uppercase border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-1.5 py-0.5 hover:bg-[#fef3c7]">
                  Effect
                </button>
              )}
              {['PENDING_APPROVAL', 'INTERNALLY_APPROVED', 'CLIENT_APPROVED'].includes(co.status) && canApprove && (
                <button onClick={() => { setActionPanel({ id: co.id, action: 'reject', version: co.version }); setActionReason(''); }}
                  className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[#991b1b] px-1.5 py-0.5 hover:bg-[#fef2f2]">
                  Reject
                </button>
              )}
              {!['EFFECTED', 'VOIDED'].includes(co.status) && canVoid && (
                <button onClick={() => setActionPanel({ id: co.id, action: 'void', version: co.version })}
                  className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[var(--muted)] px-1.5 py-0.5 hover:bg-[var(--surface-2)]">
                  Void
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
