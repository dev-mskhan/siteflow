/**
 * EstimateDetailPage — /org/:orgId/projects/:projectId/preconstruction/estimates/:estimateId
 *
 * Backend:
 *   GET  /:orgId/projects/:projectId/estimates/:estimateId               permission: project.estimate.read
 *   PATCH /:orgId/projects/:projectId/estimates/:estimateId              permission: project.estimate.update
 *   GET  /:orgId/projects/:projectId/estimates/:estimateId/compare       permission: project.estimate.actuals.read
 *   POST /:orgId/projects/:projectId/estimates/:estimateId/submit        permission: project.estimate.submit
 *   POST /:orgId/projects/:projectId/estimates/:estimateId/approve       permission: project.estimate.review
 *   POST /:orgId/projects/:projectId/estimates/:estimateId/reject        permission: project.estimate.review
 *     body: expectedVersion, reason min:10 max:500
 *
 * State machine:
 *   DRAFT → PENDING_APPROVAL (submit) → APPROVED (approve) | REJECTED (reject)
 *   REJECTED → edit (PATCH) → re-submit
 *   Actor separation: approver ≠ creator
 *   expectedVersion required on all transitions
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  useGetEstimateQuery,
  useTransitionEstimateMutation,
} from '../../features/project/preconstructionApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import type { EstimateStatus } from '../../types/preconstructionTypes';

const STATUS_BADGE: Record<EstimateStatus, string> = {
  DRAFT:            'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  PENDING_APPROVAL: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  APPROVED:         'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  REJECTED:         'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
};

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">{label}</p>
    <div className="text-sm">{value ?? <span className="text-[var(--muted)]">—</span>}</div>
  </div>
);

export const EstimateDetailPage: React.FC = () => {
  const { orgId, projectId, estimateId } = useParams<{ orgId: string; projectId: string; estimateId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const canReview = usePermission('project.estimate.review');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: estimate, isLoading } = useGetEstimateQuery(
    { orgId: orgId!, projectId: projectId!, estimateId: estimateId! },
    { skip: !orgId || !projectId || !estimateId },
  );

  const [transition, { isLoading: transitioning }] = useTransitionEstimateMutation();

  const doTransition = async (action: 'submit' | 'approve' | 'reject') => {
    if (!estimate) return;
    if (action === 'reject' && rejectReason.trim().length < 10) {
      toastErr('Reason too short', 'Min 10 characters required.');
      return;
    }
    try {
      await transition({
        orgId: orgId!, projectId: projectId!, estimateId: estimate.id,
        action,
        expectedVersion: estimate.version,
        reason: action === 'reject' ? rejectReason : undefined,
      }).unwrap();
      toastOk(`Estimate ${action}d`, '');
      setRejectOpen(false);
      setRejectReason('');
    } catch (err) {
      toastErr(`${action} failed`, toastErrorMessage(err as never));
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

  if (!estimate) {
    return (
      <div className="p-8">
        <p className="text-sm text-[var(--muted)]">Estimate not found.</p>
        <Link to={`/org/${orgId}/projects/${projectId}/preconstruction/estimates`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Back to estimates
        </Link>
      </div>
    );
  }

  const rev = estimate.revision;

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      {/* Back */}
      <Link
        to={`/org/${orgId}/projects/${projectId}/preconstruction/estimates`}
        className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors mb-5"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2} /> Estimates
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 ${STATUS_BADGE[estimate.status]}`}>
              {estimate.status.replace('_', ' ')}
            </span>
            <span className="font-mono text-[10px] text-[var(--muted)]">Rev.{estimate.currentRevisionNumber}</span>
          </div>
          <h1 className="text-xl font-medium tracking-[-0.03em]">{estimate.title}</h1>
          {estimate.description && <p className="text-sm text-[var(--muted)] mt-0.5">{estimate.description}</p>}
          {estimate.rejectionReason && (
            <p className="mt-1 font-mono text-[9px] text-[#991b1b]">Rejected: {estimate.rejectionReason}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {estimate.status === 'DRAFT' && (
            <button type="button" disabled={transitioning} onClick={() => doTransition('submit')}
              className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-3 py-1.5 hover:bg-[var(--surface-2)] disabled:opacity-50">
              Submit for approval
            </button>
          )}
          {estimate.status === 'REJECTED' && (
            <button type="button" disabled={transitioning} onClick={() => doTransition('submit')}
              className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-3 py-1.5 hover:bg-[var(--surface-2)] disabled:opacity-50">
              Re-submit
            </button>
          )}
          {estimate.status === 'PENDING_APPROVAL' && canReview && (
            <>
              <button type="button" disabled={transitioning} onClick={() => doTransition('approve')}
                className="font-mono text-[9px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-3 py-1.5 hover:bg-[#dcfce7] disabled:opacity-50">
                Approve
              </button>
              <button type="button" onClick={() => setRejectOpen((v) => !v)}
                className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] text-[#991b1b] px-3 py-1.5 hover:bg-[#fef2f2]">
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reject inline form */}
      {rejectOpen && (
        <div className="mb-4 border border-[#fecaca] bg-[#fef2f2] p-4 space-y-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#991b1b]">Reject estimate</p>
          <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (min 10 characters)" maxLength={500}
            className="w-full border border-[#fecaca] bg-white px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[#991b1b]" />
          <div className="flex items-center gap-2">
            <button onClick={() => doTransition('reject')} disabled={transitioning || rejectReason.trim().length < 10}
              className="font-mono text-[9px] uppercase bg-[#991b1b] text-white px-4 py-1.5 hover:bg-[#7f1d1d] disabled:opacity-50">
              {transitioning ? 'Rejecting…' : 'Confirm reject'}
            </button>
            <button type="button" onClick={() => setRejectOpen(false)} className="text-sm text-[#991b1b]">Cancel</button>
          </div>
        </div>
      )}

      {/* Financial summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        {[
          { label: 'Direct cost',  value: rev.directCostTotal },
          { label: 'Overhead',     value: rev.overheadAmount },
          { label: 'Contingency',  value: rev.contingencyAmount },
          { label: 'Total',        value: rev.totalAmount },
        ].map(({ label, value }) => (
          <div key={label} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">{label}</p>
            <p className="text-base font-medium font-mono">{parseFloat(value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        {/* Terms */}
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-4">Estimate terms</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            <Field label="Currency"    value={rev.currencyCode} />
            <Field label="Overhead"    value={`${rev.overheadPercent}%`} />
            <Field label="Contingency" value={`${rev.contingencyPercent}%`} />
            <Field label="Markup"      value={`${rev.markupPercent}% (${rev.markupMode})`} />
            <Field label="Discount"    value={`${rev.discountPercent}%`} />
            <Field label="Tax"         value={`${rev.taxPercent}%${rev.taxSource ? ` (${rev.taxSource})` : ''}`} />
          </div>
        </div>

        {/* Sections + lines */}
        {estimate.sections.map((section) => (
          <div key={section.id} className="border border-[var(--hairline-2)]">
            <div className="px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--hairline-2)] flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                {section.sectionNumber}. {section.title}
              </p>
              {section.description && (
                <p className="text-sm text-[var(--muted)] truncate max-w-xs">{section.description}</p>
              )}
            </div>
            <div className="grid grid-cols-[30px_2fr_80px_80px_80px_100px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
              {['#', 'Description', 'Category', 'Qty', 'Unit', 'Amount'].map((h) => (
                <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>
              ))}
            </div>
            {section.lines.map((line) => (
              <div key={line.id}
                className="grid grid-cols-[30px_2fr_80px_80px_80px_100px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                <p className="font-mono text-[10px] text-[var(--muted)]">{line.lineNumber}</p>
                <div className="min-w-0">
                  <p className="text-sm truncate">{line.description}</p>
                  {line.specification && <p className="font-mono text-[9px] text-[var(--muted)] truncate">{line.specification}</p>}
                </div>
                <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{line.category}</p>
                <p className="font-mono text-[10px]">{parseFloat(line.quantity).toLocaleString()}</p>
                <p className="font-mono text-[10px] text-[var(--muted)]">{line.unit}</p>
                <p className="font-mono text-[10px] font-medium">{parseFloat(line.directAmount).toLocaleString()}</p>
              </div>
            ))}
          </div>
        ))}

        {/* Actor trail */}
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-4">Approval trail</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            <Field label="Created by" value={estimate.createdBy} />
            {estimate.submittedBy && (
              <Field label="Submitted by" value={`${estimate.submittedBy} · ${estimate.submittedAt ? new Date(estimate.submittedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}`} />
            )}
            {estimate.approvedBy && (
              <Field label="Approved by" value={`${estimate.approvedBy} · ${estimate.approvedAt ? new Date(estimate.approvedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}`} />
            )}
            {estimate.rejectedBy && (
              <Field label="Rejected by" value={`${estimate.rejectedBy} · ${estimate.rejectedAt ? new Date(estimate.rejectedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
