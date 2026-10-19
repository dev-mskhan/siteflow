/**
 * ProposalDetailPage — /org/:orgId/projects/:projectId/preconstruction/proposals/:proposalId
 *
 * Backend:
 *   GET  /:orgId/projects/:projectId/proposals/:proposalId                permission: project.proposal.read
 *   POST /:orgId/projects/:projectId/proposals/:proposalId/submit         permission: project.proposal.submit
 *   POST /:orgId/projects/:projectId/proposals/:proposalId/approve        permission: project.proposal.approve
 *   POST /:orgId/projects/:projectId/proposals/:proposalId/reject         permission: project.proposal.approve (body: expectedVersion, reason min:10 max:500)
 *   POST /:orgId/projects/:projectId/proposals/:proposalId/issue          permission: project.proposal.issue (body: expectedVersion, deliveryMethod, deliveryNotes)
 *   POST /:orgId/projects/:projectId/proposals/:proposalId/respond        permission: project.proposal.respond (body: expectedVersion, event: ACCEPTED|REJECTED, clientSignatoryName?, responseReference?, notes?)
 *   POST /:orgId/projects/:projectId/proposals/:proposalId/withdraw       permission: project.proposal.withdraw (body: expectedVersion, reason min:1 max:500)
 *   GET  /:orgId/projects/:projectId/proposals/:proposalId/revisions      permission: project.proposal.read
 *   GET  /:orgId/projects/:projectId/proposals/:proposalId/client-events  permission: project.proposal.read
 *   POST /:orgId/projects/:projectId/proposals/:proposalId/convert        permission: project.proposal.convert
 *     body: expectedVersion, idempotencyKey (UUID), projectName, projectType?, plannedStartDate?
 *
 * State machine:
 *   DRAFT → PENDING_APPROVAL (submit) → APPROVED (approve) | REJECTED (reject)
 *   APPROVED → ISSUED (issue) → ACCEPTED | REJECTED (respond)
 *   Any withdrawable status → WITHDRAWN (withdraw)
 *   ACCEPTED → convert (idempotent, 202 first call / 200 already converted)
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import {
  useGetProposalQuery,
  useTransitionProposalMutation,
  useListProposalRevisionsQuery,
  useListClientEventsQuery,
  useRecordClientResponseMutation,
  useConvertProposalMutation,
} from '../../api/preconstructionApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
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

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">{label}</p>
    <div className="text-sm">{value ?? <span className="text-[var(--muted)]">—</span>}</div>
  </div>
);

// Small crypto UUID v4 helper — no external dependency needed
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const ProposalDetailPage: React.FC = () => {
  const { orgId, projectId, proposalId } = useParams<{ orgId: string; projectId: string; proposalId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const canApprove  = usePermission('project.proposal.approve');
  const canIssue    = usePermission('project.proposal.issue');
  const canRespond  = usePermission('project.proposal.respond');
  const canWithdraw = usePermission('project.proposal.withdraw');
  const canConvert  = usePermission('project.proposal.convert');

  // Inline action UI state
  const [actionOpen, setActionOpen] = useState<string | null>(null); // 'reject' | 'issue' | 'respond' | 'withdraw' | 'convert'
  const [reason, setReason]         = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'INTERNAL' | 'EMAIL'>('INTERNAL');
  const [deliveryNotes, setDeliveryNotes]   = useState('');
  const [respondEvent, setRespondEvent]     = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [signatory, setSignatory]           = useState('');
  const [responseRef, setResponseRef]       = useState('');
  const [respondNotes, setRespondNotes]     = useState('');
  const [convertName, setConvertName]       = useState('');
  const [showRevisions, setShowRevisions]   = useState(false);
  const [showEvents, setShowEvents]         = useState(false);

  const { data: detail, isLoading } = useGetProposalQuery(
    { orgId: orgId!, projectId: projectId!, proposalId: proposalId! },
    { skip: !orgId || !projectId || !proposalId },
  );
  const { data: revisionsData } = useListProposalRevisionsQuery(
    { orgId: orgId!, projectId: projectId!, proposalId: proposalId! },
    { skip: !showRevisions || !proposalId },
  );
  const { data: eventsData } = useListClientEventsQuery(
    { orgId: orgId!, projectId: projectId!, proposalId: proposalId! },
    { skip: !showEvents || !proposalId },
  );

  const [transition,   { isLoading: transitioning }]   = useTransitionProposalMutation();
  const [recordResponse, { isLoading: responding }]    = useRecordClientResponseMutation();
  const [convertProposal, { isLoading: converting }]   = useConvertProposalMutation();

  const proposal  = detail?.proposal;
  const revision  = detail?.revision;
  const lines     = detail?.lines ?? [];

  const doTransition = async (action: 'submit' | 'approve' | 'reject' | 'issue' | 'withdraw', extra?: object) => {
    if (!proposal) return;
    try {
      await transition({
        orgId: orgId!, projectId: projectId!, proposalId: proposal.id,
        action,
        expectedVersion: proposal.version,
        reason: (extra as any)?.reason,
        deliveryMethod: (extra as any)?.deliveryMethod,
        deliveryNotes: (extra as any)?.deliveryNotes,
      }).unwrap();
      toastOk(`Proposal ${action}d`, '');
      setActionOpen(null);
      setReason('');
    } catch (err) {
      toastErr(`${action} failed`, toastErrorMessage(err as never));
    }
  };

  const doRespond = async () => {
    if (!proposal) return;
    try {
      await recordResponse({
        orgId: orgId!, projectId: projectId!, proposalId: proposal.id,
        expectedVersion: proposal.version,
        event: respondEvent,
        clientSignatoryName: signatory.trim() || undefined,
        responseReference: responseRef.trim() || undefined,
        notes: respondNotes.trim() || undefined,
      }).unwrap();
      toastOk(`Client response recorded: ${respondEvent}`, '');
      setActionOpen(null);
    } catch (err) {
      toastErr('Record response failed', toastErrorMessage(err as never));
    }
  };

  const doConvert = async () => {
    if (!proposal || !convertName.trim()) {
      toastErr('Project name required', '');
      return;
    }
    try {
      const result = await convertProposal({
        orgId: orgId!, projectId: projectId!, proposalId: proposal.id,
        expectedVersion: proposal.version,
        idempotencyKey: uuidv4(),
        projectName: convertName.trim(),
      }).unwrap();
      if (result.alreadyConverted) {
        toastOk('Already converted', `Linked project: ${result.conversion.linkedProjectId}`);
      } else {
        toastOk('Conversion started', 'A new project is being created from this proposal.');
      }
      setActionOpen(null);
    } catch (err) {
      toastErr('Convert failed', toastErrorMessage(err as never));
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-6 w-48 animate-pulse bg-[var(--surface-2)] mb-4" />
        <div className="h-40 animate-pulse bg-[var(--surface-2)]" />
      </div>
    );
  }

  if (!proposal || !revision) {
    return (
      <div className="p-8">
        <p className="text-sm text-[var(--muted)]">Proposal not found.</p>
        <Link to={`/org/${orgId}/projects/${projectId}/preconstruction/proposals`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Back to proposals
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      {/* Back */}
      <Link
        to={`/org/${orgId}/projects/${projectId}/preconstruction/proposals`}
        className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors mb-5"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2} /> Proposals
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 ${STATUS_BADGE[proposal.status]}`}>
              {proposal.status.replace('_', ' ')}
            </span>
            <span className="font-mono text-[10px] text-[var(--muted)]">{proposal.proposalNumber}</span>
            <span className="font-mono text-[10px] text-[var(--muted)]">Rev.{proposal.currentRevisionNumber}</span>
          </div>
          <h1 className="text-xl font-medium tracking-[-0.03em]">{proposal.title}</h1>
          {proposal.clientName && <p className="text-sm text-[var(--muted)] mt-0.5">{proposal.clientName}</p>}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {proposal.status === 'DRAFT' && (
            <button type="button" disabled={transitioning} onClick={() => doTransition('submit')}
              className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-3 py-1.5 hover:bg-[var(--surface-2)] disabled:opacity-50">
              Submit
            </button>
          )}
          {proposal.status === 'PENDING_APPROVAL' && canApprove && (
            <>
              <button type="button" disabled={transitioning} onClick={() => doTransition('approve')}
                className="font-mono text-[9px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-3 py-1.5 hover:bg-[#dcfce7] disabled:opacity-50">
                Approve
              </button>
              <button type="button" onClick={() => setActionOpen(actionOpen === 'reject' ? null : 'reject')}
                className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] text-[#991b1b] px-3 py-1.5 hover:bg-[#fef2f2]">
                Reject
              </button>
            </>
          )}
          {proposal.status === 'APPROVED' && canIssue && (
            <button type="button" onClick={() => setActionOpen(actionOpen === 'issue' ? null : 'issue')}
              className="font-mono text-[9px] uppercase border border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af] px-3 py-1.5 hover:bg-[#dbeafe]">
              Issue to client
            </button>
          )}
          {proposal.status === 'ISSUED' && canRespond && (
            <button type="button" onClick={() => setActionOpen(actionOpen === 'respond' ? null : 'respond')}
              className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-3 py-1.5 hover:bg-[var(--surface-2)]">
              Record client response
            </button>
          )}
          {proposal.status === 'ACCEPTED' && canConvert && (
            <button type="button" onClick={() => setActionOpen(actionOpen === 'convert' ? null : 'convert')}
              className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase border border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3] px-3 py-1.5 hover:bg-[#e0e7ff]">
              <RefreshCw className="h-3 w-3" strokeWidth={2} /> Convert to project
            </button>
          )}
          {['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED'].includes(proposal.status) && canWithdraw && (
            <button type="button" onClick={() => setActionOpen(actionOpen === 'withdraw' ? null : 'withdraw')}
              className="font-mono text-[9px] uppercase border border-[#fecaca] text-[#991b1b] px-3 py-1.5 hover:bg-[#fef2f2]">
              Withdraw
            </button>
          )}
        </div>
      </div>

      {/* Inline action panels */}
      {actionOpen === 'reject' && (
        <div className="mb-4 border border-[#fecaca] bg-[#fef2f2] p-4 space-y-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#991b1b]">Reject proposal</p>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason (min 10 characters)" maxLength={500}
            className="w-full border border-[#fecaca] bg-white px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[#991b1b]" />
          <div className="flex items-center gap-2">
            <button onClick={() => doTransition('reject', { reason })} disabled={transitioning || reason.trim().length < 10}
              className="font-mono text-[9px] uppercase bg-[#991b1b] text-white px-4 py-1.5 hover:bg-[#7f1d1d] disabled:opacity-50">
              {transitioning ? 'Rejecting…' : 'Confirm reject'}
            </button>
            <button type="button" onClick={() => setActionOpen(null)} className="text-sm text-[#991b1b]">Cancel</button>
          </div>
        </div>
      )}

      {actionOpen === 'issue' && (
        <div className="mb-4 border border-[#bfdbfe] bg-[#eff6ff] p-4 space-y-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#1e40af]">Issue proposal to client</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Delivery method</label>
              <select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value as 'INTERNAL' | 'EMAIL')} className={inputCls()}>
                <option value="INTERNAL">Internal</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Delivery notes</label>
              <input value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} maxLength={1000} className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => doTransition('issue', { deliveryMethod, deliveryNotes: deliveryNotes.trim() || undefined })}
              disabled={transitioning}
              className="font-mono text-[9px] uppercase bg-[#1e40af] text-white px-4 py-1.5 hover:bg-[#1e3a8a] disabled:opacity-50">
              {transitioning ? 'Issuing…' : 'Issue now'}
            </button>
            <button type="button" onClick={() => setActionOpen(null)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {actionOpen === 'respond' && (
        <div className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-4 space-y-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Record client response</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Event *</label>
              <select value={respondEvent} onChange={(e) => setRespondEvent(e.target.value as 'ACCEPTED' | 'REJECTED')} className={inputCls()}>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Client signatory name</label>
              <input value={signatory} onChange={(e) => setSignatory(e.target.value)} maxLength={200} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Response reference</label>
              <input value={responseRef} onChange={(e) => setResponseRef(e.target.value)} maxLength={200} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Notes</label>
              <input value={respondNotes} onChange={(e) => setRespondNotes(e.target.value)} maxLength={2000} className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={doRespond} disabled={responding}
              className="font-mono text-[9px] uppercase bg-[var(--ink)] text-white px-4 py-1.5 hover:opacity-90 disabled:opacity-50">
              {responding ? 'Recording…' : 'Record response'}
            </button>
            <button type="button" onClick={() => setActionOpen(null)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {actionOpen === 'withdraw' && (
        <div className="mb-4 border border-[#fecaca] bg-[#fef2f2] p-4 space-y-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#991b1b]">Withdraw proposal</p>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Withdrawal reason (min 1 character)" maxLength={500}
            className="w-full border border-[#fecaca] bg-white px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[#991b1b]" />
          <div className="flex items-center gap-2">
            <button onClick={() => doTransition('withdraw', { reason })} disabled={transitioning || !reason.trim()}
              className="font-mono text-[9px] uppercase bg-[#991b1b] text-white px-4 py-1.5 hover:bg-[#7f1d1d] disabled:opacity-50">
              {transitioning ? 'Withdrawing…' : 'Confirm withdraw'}
            </button>
            <button type="button" onClick={() => setActionOpen(null)} className="text-sm text-[#991b1b]">Cancel</button>
          </div>
        </div>
      )}

      {actionOpen === 'convert' && (
        <div className="mb-4 border border-[#c7d2fe] bg-[#eef2ff] p-4 space-y-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#3730a3]">Convert to project</p>
          <p className="text-sm text-[#3730a3] opacity-80">
            This will create a new project from this accepted proposal. The operation is idempotent.
          </p>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Project name *</label>
            <input value={convertName} onChange={(e) => setConvertName(e.target.value)} maxLength={160}
              placeholder="e.g. Industrial Warehouse — Port Qasim" className={inputCls()} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={doConvert} disabled={converting || !convertName.trim()}
              className="font-mono text-[9px] uppercase bg-[#3730a3] text-white px-4 py-1.5 hover:bg-[#312e81] disabled:opacity-50">
              {converting ? 'Converting…' : 'Create project'}
            </button>
            <button type="button" onClick={() => setActionOpen(null)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        {[
          { label: 'Subtotal',  value: revision.subtotalAmount },
          { label: 'Tax',       value: revision.taxAmount },
          { label: 'Total',     value: revision.totalAmount },
          { label: 'Currency',  value: revision.currencyCode },
        ].map(({ label, value }) => (
          <div key={label} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">{label}</p>
            <p className="text-base font-medium font-mono">
              {['Subtotal', 'Tax', 'Total'].includes(label)
                ? parseFloat(value as string).toLocaleString()
                : value}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        {/* Proposal details */}
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-4">Proposal details</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
            <Field label="Client name" value={proposal.clientName} />
            <Field label="Client reference" value={proposal.clientReference} />
            <Field label="Valid until" value={revision.validUntil} />
            <Field label="Duration" value={revision.estimatedDurationDays ? `${revision.estimatedDurationDays} days` : undefined} />
            <Field label="Overhead" value={`${revision.overheadPercent}%`} />
            <Field label="Contingency" value={`${revision.contingencyPercent}%`} />
            <Field label="Markup" value={`${revision.markupPercent}%`} />
            <Field label="Tax" value={`${revision.taxPercent}%${revision.taxSource ? ` (${revision.taxSource})` : ''}`} />
          </div>
          {revision.scope && (
            <div className="mt-4 pt-4 border-t border-[var(--hairline-2)]">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Scope</p>
              <p className="text-sm whitespace-pre-wrap">{revision.scope}</p>
            </div>
          )}
          {revision.inclusions && (
            <div className="mt-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Inclusions</p>
              <p className="text-sm whitespace-pre-wrap">{revision.inclusions}</p>
            </div>
          )}
          {revision.exclusions && (
            <div className="mt-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Exclusions</p>
              <p className="text-sm whitespace-pre-wrap">{revision.exclusions}</p>
            </div>
          )}
          {revision.assumptions && (
            <div className="mt-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Assumptions</p>
              <p className="text-sm whitespace-pre-wrap">{revision.assumptions}</p>
            </div>
          )}
        </div>

        {/* Line items */}
        {lines.length > 0 && (
          <div className="border border-[var(--hairline-2)]">
            <div className="px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Line items ({lines.length})
              </p>
            </div>
            <div className="grid grid-cols-[50px_2fr_60px_80px_80px_100px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
              {['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'].map((h) => (
                <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>
              ))}
            </div>
            {lines.map((line) => (
              <div key={line.id}
                className="grid grid-cols-[50px_2fr_60px_80px_80px_100px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                <p className="font-mono text-[10px] text-[var(--muted)]">{line.itemKey}</p>
                <div className="min-w-0">
                  <p className="text-sm truncate">{line.description}</p>
                  {line.sectionKey && <p className="font-mono text-[9px] text-[var(--muted)]">§{line.sectionKey}</p>}
                </div>
                <p className="font-mono text-[10px] text-[var(--muted)]">{line.unit}</p>
                <p className="font-mono text-[10px]">{parseFloat(line.quantity).toLocaleString()}</p>
                <p className="font-mono text-[10px]">{parseFloat(line.unitRate).toLocaleString()}</p>
                <p className="font-mono text-[10px] font-medium">{parseFloat(line.amount).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Revision history */}
        <div className="border border-[var(--hairline-2)]">
          <button type="button"
            onClick={() => setShowRevisions((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)] transition-colors">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Revision history</p>
            {showRevisions ? <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={2} /> : <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={2} />}
          </button>
          {showRevisions && (
            <div className="px-4 py-3 space-y-2 bg-[var(--paper)]">
              {(revisionsData?.items ?? []).length === 0
                ? <p className="text-sm text-[var(--muted)]">No revision history.</p>
                : (revisionsData?.items ?? []).map((r) => (
                    <div key={r.id} className="flex items-center gap-4 text-sm border-b border-[var(--hairline-2)] last:border-b-0 py-2">
                      <span className="font-mono text-[10px] text-[var(--muted)] w-10">Rev.{r.revisionNumber}</span>
                      <span className="font-mono text-[9px] uppercase text-[var(--muted)]">{r.status}</span>
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {new Date(r.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  ))}
            </div>
          )}
        </div>

        {/* Client events */}
        <div className="border border-[var(--hairline-2)]">
          <button type="button"
            onClick={() => setShowEvents((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)] transition-colors">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Client event log</p>
            {showEvents ? <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={2} /> : <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={2} />}
          </button>
          {showEvents && (
            <div className="px-4 py-3 space-y-2 bg-[var(--paper)]">
              {(eventsData?.events ?? []).length === 0
                ? <p className="text-sm text-[var(--muted)]">No client events recorded.</p>
                : (eventsData?.events ?? []).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-4 text-sm border-b border-[var(--hairline-2)] last:border-b-0 py-2">
                      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">{ev.event}</span>
                      {ev.clientSignatoryName && <span className="text-sm">{ev.clientSignatoryName}</span>}
                      {ev.responseReference && <span className="font-mono text-[9px] text-[var(--muted)]">{ev.responseReference}</span>}
                      <span className="font-mono text-[10px] text-[var(--muted)] ml-auto">
                        {new Date(ev.recordedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
