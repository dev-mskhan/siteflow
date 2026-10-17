/**
 * ApprovalsPage — /org/:orgId/projects/:projectId/procurement/approvals
 * Queue of pending/reviewed procurement approvals (MR, Quote, PO).
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import {
  useListApprovalsQuery,
  useCreateApprovalMutation,
  useApproveApprovalMutation,
  useRejectApprovalMutation,
  useCancelApprovalMutation,
} from '../../api/procurementApi';
import { usePermission } from '../../hooks/usePermission';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../../lib/authErrors';
import type { ProcurementApprovalStatus, ProcurementApprovalResourceType } from '../../types/procurementTypes';

const STATUS_BADGE: Record<ProcurementApprovalStatus, string> = {
  PENDING:   'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  APPROVED:  'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  REJECTED:  'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  CANCELLED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

const RESOURCE_BADGE: Record<ProcurementApprovalResourceType, string> = {
  MATERIAL_REQUEST: 'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
  QUOTE:            'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  PURCHASE_ORDER:   'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
};

const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

export const ApprovalsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const canApprove = usePermission('project.procurement_approval.approve');
  const canCreate = usePermission('project.procurement_approval.create');
  const { success: toastOk, error: toastErr } = useToast();

  const [filter, setFilter] = useState<typeof FILTERS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [resourceType, setResourceType] = useState<ProcurementApprovalResourceType>('PURCHASE_ORDER');
  const [resourceId, setResourceId] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useListApprovalsQuery({ orgId: orgId!, projectId: projectId! });
  const [createApproval, { isLoading: creating, error: createErr }] = useCreateApprovalMutation();
  const [approveApproval] = useApproveApprovalMutation();
  const [rejectApproval] = useRejectApprovalMutation();
  const [cancelApproval] = useCancelApprovalMutation();

  const onCreate = async () => {
    if (!resourceId.trim()) { toastErr('Resource ID required', ''); return; }
    try {
      await createApproval({ orgId: orgId!, projectId: projectId!, input: { resourceType, resourceId: resourceId.trim() } }).unwrap();
      toastOk('Approval request created', '');
      setShowCreate(false);
      setResourceId('');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const onApprove = async (approvalId: string) => {
    try {
      await approveApproval({ orgId: orgId!, projectId: projectId!, approvalId, input: { decisionReason: decisionReason || undefined } }).unwrap();
      toastOk('Approved', '');
      setPendingActionId(null);
      setDecisionReason('');
    } catch (err) {
      toastErr('Approve failed', toastErrorMessage(err as never));
    }
  };

  const onReject = async (approvalId: string) => {
    try {
      await rejectApproval({ orgId: orgId!, projectId: projectId!, approvalId, input: { decisionReason: rejectReason || undefined } }).unwrap();
      toastOk('Rejected', '');
      setShowRejectForm(null);
      setRejectReason('');
    } catch (err) {
      toastErr('Reject failed', toastErrorMessage(err as never));
    }
  };

  const onCancel = async (approvalId: string) => {
    try {
      await cancelApproval({ orgId: orgId!, projectId: projectId!, approvalId }).unwrap();
      toastOk('Cancelled', '');
    } catch (err) {
      toastErr('Cancel failed', toastErrorMessage(err as never));
    }
  };

  const all = data?.data ?? [];
  const rows = filter === 'ALL' ? all : all.filter((a) => a.status === filter);
  const pendingCount = all.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">
            Approval queue
            {pendingCount > 0 && (
              <span className="ml-2 font-mono text-[10px] border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-1.5 py-0.5">
                {pendingCount} pending
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{all.length} approval{all.length !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            Request approval
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Request approval</p>
          {isInlineError(createErr) && <InlineAlert variant="error" message={getServerError(createErr)?.message ?? 'Error'} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Resource type *</label>
              <select value={resourceType} onChange={(e) => setResourceType(e.target.value as ProcurementApprovalResourceType)}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]">
                <option value="MATERIAL_REQUEST">Material request</option>
                <option value="QUOTE">Quote</option>
                <option value="PURCHASE_ORDER">Purchase order</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Resource ID *</label>
              <input type="text" value={resourceId} onChange={(e) => setResourceId(e.target.value)}
                placeholder="e.g. mr_01, qt_01, po_01"
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
              {creating ? 'Requesting…' : 'Request'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="border border-[var(--hairline-2)] divide-y divide-[var(--hairline-2)]">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-[var(--surface-2)]" />)
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <CheckCircle className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No approvals found.</p>
          </div>
        ) : (
          rows.map((appr) => (
            <div key={appr.id} className="bg-[var(--paper)]">
              <div className="grid grid-cols-[120px_110px_2fr_120px_1fr] gap-4 items-center px-4 py-3.5">
                <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${RESOURCE_BADGE[appr.resourceType]}`}>
                  {appr.resourceType.replace('_', ' ')}
                </span>
                <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[appr.status]}`}>
                  {appr.status}
                </span>
                <div>
                  <p className="font-mono text-[10px] text-[var(--muted)]">Resource: {appr.resourceId}</p>
                  {appr.decisionReason && <p className="text-xs text-[var(--muted)] mt-0.5 italic">{appr.decisionReason}</p>}
                </div>
                <p className="font-mono text-[10px] text-[var(--muted)]">
                  {new Date(appr.requestedAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                </p>
                {canApprove && appr.status === 'PENDING' && (
                  <div className="flex gap-2 justify-end">
                    {pendingActionId === appr.id ? (
                      <div className="flex items-center gap-2">
                        <input type="text" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)}
                          placeholder="Reason (optional)" maxLength={2000}
                          className="border border-[var(--hairline-2)] bg-[var(--paper)] px-2 py-1 text-xs w-40 focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
                        <button onClick={() => onApprove(appr.id)}
                          className="font-mono text-[9px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-2 py-1 hover:bg-[#dcfce7]">
                          Confirm
                        </button>
                        <button onClick={() => setPendingActionId(null)} className="text-xs text-[var(--muted)] hover:text-[var(--ink)]">✕</button>
                      </div>
                    ) : showRejectForm === appr.id ? (
                      <div className="flex items-center gap-2">
                        <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Rejection reason (optional)" maxLength={2000}
                          className="border border-[var(--hairline-2)] bg-[var(--paper)] px-2 py-1 text-xs w-40 focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
                        <button onClick={() => onReject(appr.id)}
                          className="font-mono text-[9px] uppercase border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] px-2 py-1 hover:bg-[#fee2e2]">
                          Confirm
                        </button>
                        <button onClick={() => setShowRejectForm(null)} className="text-xs text-[var(--muted)] hover:text-[var(--ink)]">✕</button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setPendingActionId(appr.id)}
                          className="font-mono text-[9px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-2 py-1 hover:bg-[#dcfce7]">
                          Approve
                        </button>
                        <button onClick={() => setShowRejectForm(appr.id)}
                          className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-2 py-1 text-[#991b1b] hover:bg-[#fef2f2]">
                          Reject
                        </button>
                        <button onClick={() => onCancel(appr.id)}
                          className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-2 py-1 text-[var(--muted)] hover:bg-[var(--surface-2)]">
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
