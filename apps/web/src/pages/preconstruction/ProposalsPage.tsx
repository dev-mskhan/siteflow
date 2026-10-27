/**
 * ProposalsPage — /org/:orgId/projects/:projectId/preconstruction/proposals
 *
 * Backend:
 *   GET  /:orgId/projects/:projectId/proposals          permission: project.proposal.read
 *   POST /:orgId/projects/:projectId/proposals          permission: project.proposal.create
 *   POST /:orgId/projects/:projectId/proposals/:id/submit    permission: project.proposal.submit
 *   POST /:orgId/projects/:projectId/proposals/:id/approve   permission: project.proposal.approve
 *   POST /:orgId/projects/:projectId/proposals/:id/reject    permission: project.proposal.approve
 *   POST /:orgId/projects/:projectId/proposals/:id/issue     permission: project.proposal.issue
 *   POST /:orgId/projects/:projectId/proposals/:id/withdraw  permission: project.proposal.withdraw
 *
 * State machine (proposal.service.ts):
 *   DRAFT → PENDING_APPROVAL → APPROVED → ISSUED → ACCEPTED | REJECTED
 *   Withdraw from: DRAFT | PENDING_APPROVAL | APPROVED | ISSUED
 *   Edit on: DRAFT | REJECTED only
 *   expectedVersion required on every transition
 *
 * Validation: packages/shared/src/modules/project/proposal.schema.ts
 *   title: min:1 max:160
 *   currencyCode: 3-char uppercase
 *   taxPercent: 0-100 (4 decimal places); taxSource required when taxPercent > 0
 *   lines: max:1000
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, FileText, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListProposalsQuery,
  useCreateProposalMutation,
  useTransitionProposalMutation,
} from '../../features/project/preconstructionApi';
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
import type { ProposalStatus } from '../../types/preconstructionTypes';

const STATUS_BADGE: Record<ProposalStatus, string> = {
  DRAFT:            'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  PENDING_APPROVAL: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  APPROVED:         'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  ISSUED:           'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  ACCEPTED:         'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
  REJECTED:         'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  WITHDRAWN:        'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  EXPIRED:          'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

const TRANSITIONS: Record<ProposalStatus, Array<{ label: string; action: string; danger?: boolean; needsReason?: boolean }>> = {
  DRAFT:            [{ label: 'Submit', action: 'submit' }, { label: 'Withdraw', action: 'withdraw', danger: true, needsReason: true }],
  PENDING_APPROVAL: [{ label: 'Approve', action: 'approve' }, { label: 'Reject', action: 'reject', danger: true, needsReason: true }, { label: 'Withdraw', action: 'withdraw', danger: true, needsReason: true }],
  APPROVED:         [{ label: 'Issue', action: 'issue' }, { label: 'Withdraw', action: 'withdraw', danger: true, needsReason: true }],
  ISSUED:           [{ label: 'Withdraw', action: 'withdraw', danger: true, needsReason: true }],
  ACCEPTED:         [],
  REJECTED:         [],
  WITHDRAWN:        [],
  EXPIRED:          [],
};

const FILTER_OPTIONS = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'ACCEPTED', 'REJECTED'] as const;

export const ProposalsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const navigate = useNavigate();
  const canCreate = usePermission('project.proposal.create');
  const { success: toastOk, error: toastErr } = useToast();

  const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedAction, setExpandedAction] = useState<{ id: string; action: string } | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Create form
  const [title, setTitle]       = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [clientName, setClientName] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [description, setDescription] = useState('');

  const { data, isLoading } = useListProposalsQuery({ orgId: orgId!, projectId: projectId! });
  const [createProposal, { isLoading: creating, error: createErr }] = useCreateProposalMutation();
  const [transition, { isLoading: transitioning }] = useTransitionProposalMutation();

  const onCreate = async () => {
    if (!title.trim()) { toastErr('Title required', ''); return; }
    try {
      const result = await createProposal({
        orgId: orgId!, projectId: projectId!,
        input: {
          title: title.trim(),
          currencyCode: currency.toUpperCase(),
          clientName: clientName.trim() || undefined,
          validUntil: validUntil || undefined,
          description: description.trim() || undefined,
          lines: [],
        },
      }).unwrap();
      toastOk('Proposal created', '');
      setShowCreate(false);
      setTitle(''); setCurrency('PKR'); setClientName(''); setValidUntil(''); setDescription('');
      navigate(`/org/${orgId}/projects/${projectId}/preconstruction/proposals/${result.id}`);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const onTransition = async (proposalId: string, action: string, version: number, needsReason: boolean) => {
    if (needsReason && actionReason.trim().length < 10) {
      toastErr('Reason too short', 'Provide at least 10 characters.');
      return;
    }
    try {
      await transition({
        orgId: orgId!, projectId: projectId!,
        proposalId,
        action: action as any,
        expectedVersion: version,
        reason: needsReason ? actionReason : undefined,
      }).unwrap();
      toastOk(`Proposal ${action}d`, '');
      setExpandedAction(null);
      setActionReason('');
    } catch (err) {
      toastErr('Action failed', toastErrorMessage(err as never));
    }
  };

  const proposals = data?.items ?? [];
  const rows = filter === 'ALL' ? proposals : proposals.filter((p) => p.status === filter);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Proposals</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{proposals.length} proposal{proposals.length !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> New proposal
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New proposal</p>
          {isInlineError(createErr) && <InlineAlert variant="error" message={getServerError(createErr)?.message ?? 'Error'} />}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Currency</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Client name</label>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={200} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Valid until</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls()} />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={5000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
              {creating ? 'Creating…' : 'Create proposal'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex border-b border-[var(--hairline-2)] mb-6 overflow-x-auto">
        {FILTER_OPTIONS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 whitespace-nowrap transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[1fr_90px_90px_90px_80px_160px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Proposal', 'Status', 'Rev.', 'Total', 'Valid until', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <FileText className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No proposals yet.</p>
          </div>
        ) : (
          rows.map((p) => (
            <div key={p.id}>
              {/* Main row */}
              <div
                onClick={() => navigate(`/org/${orgId}/projects/${projectId}/preconstruction/proposals/${p.id}`)}
                className="grid grid-cols-[1fr_90px_90px_90px_80px_160px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="font-mono text-[9px] text-[var(--muted)]">{p.proposalNumber}</p>
                </div>
                <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[p.status]}`}>
                  {p.status.replace('_', ' ')}
                </span>
                <p className="font-mono text-[10px] text-[var(--muted)]">Rev.{p.currentRevisionNumber}</p>
                <p className="font-mono text-[10px]">
                  {p.revision?.totalAmount ? parseFloat(p.revision.totalAmount).toLocaleString() : '—'}
                </p>
                <p className="font-mono text-[10px] text-[var(--muted)]">{p.revision?.validUntil ?? '—'}</p>

                {/* Inline action buttons */}
                <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                  {TRANSITIONS[p.status].map((tr) => (
                    <button key={tr.action} type="button" disabled={transitioning}
                      onClick={() => {
                        if (tr.needsReason) {
                          setExpandedAction(expandedAction?.id === p.id && expandedAction.action === tr.action ? null : { id: p.id, action: tr.action });
                          setActionReason('');
                        } else {
                          onTransition(p.id, tr.action, p.version, false);
                        }
                      }}
                      className={cn(
                        'font-mono text-[8px] uppercase tracking-[0.1em] border px-1.5 py-0.5 transition-colors disabled:opacity-50',
                        tr.danger
                          ? 'border-[#fecaca] text-[#991b1b] hover:bg-[#fef2f2]'
                          : 'border-[var(--hairline-2)] hover:bg-[var(--surface-2)]',
                      )}
                    >
                      {tr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inline reason form for reject/withdraw */}
              {expandedAction?.id === p.id && (
                <div className="px-4 py-3 border-b border-[var(--hairline-2)] bg-[var(--surface-2)] flex items-center gap-3">
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Reason (min 10 characters)"
                    maxLength={500}
                    className="flex-1 border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                  />
                  <button
                    type="button"
                    onClick={() => onTransition(p.id, expandedAction.action, p.version, true)}
                    disabled={transitioning || actionReason.trim().length < 10}
                    className="font-mono text-[9px] uppercase border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] px-3 py-1.5 hover:bg-[#fee2e2] disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button type="button" onClick={() => setExpandedAction(null)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">✕</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
