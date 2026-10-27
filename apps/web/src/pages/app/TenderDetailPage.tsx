/**
 * TenderDetailPage — /org/:orgId/tenders/:tenderId
 *
 * Backend:
 *   GET   /:orgId/tenders/:tenderId              permission: project:read:any
 *   PATCH /:orgId/tenders/:tenderId              permission: project:write:any
 *   POST  /:orgId/tenders/:tenderId/submit       permission: project:write:any
 *   POST  /:orgId/tenders/:tenderId/award        permission: project:write:any
 *   POST  /:orgId/tenders/:tenderId/lost         permission: project:write:any
 *   POST  /:orgId/tenders/:tenderId/withdraw     permission: project:write:any
 *
 * State machine (proposal.service.ts):
 *   OPEN → SUBMITTED (submit) | WITHDRAWN (withdraw)
 *   SUBMITTED → AWARDED (award) | LOST (lost) | WITHDRAWN (withdraw)
 *   expectedVersion required on every transition + update
 *
 * Update body: title, clientName, submissionDeadline, submissionTimezone, expectedVersion (all required)
 */
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Check, X } from 'lucide-react';
import {
  useGetTenderQuery,
  useUpdateTenderMutation,
  useTransitionTenderMutation,
} from '../../features/project/preconstructionApi';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { TenderStatus } from '../../types/preconstructionTypes';

const STATUS_BADGE: Record<TenderStatus, string> = {
  OPEN:      'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  SUBMITTED: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  AWARDED:   'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
  LOST:      'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  WITHDRAWN: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  EXPIRED:   'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

const NEXT_TRANSITIONS: Record<TenderStatus, Array<{ label: string; status: string; danger?: boolean }>> = {
  OPEN:      [{ label: 'Submit', status: 'SUBMITTED' }, { label: 'Withdraw', status: 'WITHDRAWN', danger: true }],
  SUBMITTED: [
    { label: 'Mark awarded', status: 'AWARDED' },
    { label: 'Mark lost',    status: 'LOST',      danger: true },
    { label: 'Withdraw',     status: 'WITHDRAWN',  danger: true },
  ],
  AWARDED:   [],
  LOST:      [],
  WITHDRAWN: [],
  EXPIRED:   [],
};

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">{label}</p>
    <div className="text-sm">{value ?? <span className="text-[var(--muted)]">—</span>}</div>
  </div>
);

export const TenderDetailPage: React.FC = () => {
  const { orgId, tenderId } = useParams<{ orgId: string; tenderId: string }>();
  const navigate = useNavigate();
  const { success: toastOk, error: toastErr } = useToast();

  const [editing, setEditing] = useState(false);
  // Edit form state (pre-populated on open)
  const [editTitle, setEditTitle]       = useState('');
  const [editClient, setEditClient]     = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editTz, setEditTz]             = useState('');
  const [editReqs, setEditReqs]         = useState('');
  const [editEstValue, setEditEstValue] = useState('');
  const [editCurrency, setEditCurrency] = useState('');
  const [editNotes, setEditNotes]       = useState('');

  const { data: tender, isLoading } = useGetTenderQuery(
    { orgId: orgId!, tenderId: tenderId! },
    { skip: !orgId || !tenderId },
  );

  const [updateTender, { isLoading: updating }] = useUpdateTenderMutation();
  const [transitionTender, { isLoading: transitioning }] = useTransitionTenderMutation();

  const openEdit = () => {
    if (!tender) return;
    // Strip timezone offset for datetime-local input
    setEditTitle(tender.title);
    setEditClient(tender.clientName);
    // Convert ISO → datetime-local format (trim seconds + Z)
    const dl = tender.submissionDeadline.slice(0, 16);
    setEditDeadline(dl);
    setEditTz(tender.submissionTimezone);
    setEditReqs(tender.requirements ?? '');
    setEditEstValue(tender.estimatedValue ?? '');
    setEditCurrency(tender.currencyCode ?? 'PKR');
    setEditNotes(tender.notes ?? '');
    setEditing(true);
  };

  const onSave = async () => {
    if (!tender) return;
    if (!editTitle.trim() || !editClient.trim() || !editDeadline) {
      toastErr('Required fields missing', 'Title, client name, and deadline are required.');
      return;
    }
    try {
      await updateTender({
        orgId: orgId!,
        tenderId: tenderId!,
        input: {
          title: editTitle.trim(),
          clientName: editClient.trim(),
          submissionDeadline: new Date(editDeadline).toISOString(),
          submissionTimezone: editTz,
          requirements: editReqs.trim() || undefined,
          estimatedValue: editEstValue.trim() || undefined,
          currencyCode: editCurrency.toUpperCase() || undefined,
          notes: editNotes.trim() || undefined,
          expectedVersion: tender.version,
        },
      }).unwrap();
      toastOk('Tender updated', '');
      setEditing(false);
    } catch (err) {
      toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  const onTransition = async (status: string) => {
    if (!tender) return;
    try {
      await transitionTender({ orgId: orgId!, tenderId: tenderId!, status, expectedVersion: tender.version }).unwrap();
      toastOk(`Tender ${status.toLowerCase()}`, '');
    } catch (err) {
      toastErr('Transition failed', toastErrorMessage(err as never));
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-6 w-48 animate-pulse bg-[var(--surface-2)] mb-4" />
        <div className="h-32 animate-pulse bg-[var(--surface-2)]" />
      </div>
    );
  }

  if (!tender) {
    return (
      <div className="p-8">
        <p className="text-sm text-[var(--muted)]">Tender not found.</p>
        <Link to={`/org/${orgId}/tenders`} className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Back to tenders
        </Link>
      </div>
    );
  }

  const transitions = NEXT_TRANSITIONS[tender.status];

  return (
    <div className="p-6 sm:p-8 max-w-3xl">
      {/* Back + header */}
      <div className="mb-6">
        <Link
          to={`/org/${orgId}/tenders`}
          className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors mb-4"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={2} /> Tenders
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 ${STATUS_BADGE[tender.status]}`}>
                {tender.status}
              </span>
              <span className="font-mono text-[10px] text-[var(--muted)]">{tender.tenderNumber}</span>
            </div>
            <h1 className="text-xl font-medium tracking-[-0.03em]">{tender.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!editing && tender.status === 'OPEN' && (
              <button type="button" onClick={openEdit}
                className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors">
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /> Edit
              </button>
            )}
            {transitions.map((tr) => (
              <button key={tr.status} type="button" disabled={transitioning}
                onClick={() => onTransition(tr.status)}
                className={`font-mono text-[9px] uppercase tracking-[0.1em] border px-3 py-1.5 transition-colors disabled:opacity-50 ${
                  tr.danger
                    ? 'border-[#fecaca] text-[#991b1b] hover:bg-[#fef2f2]'
                    : 'border-[var(--hairline-2)] hover:bg-[var(--surface-2)]'
                }`}>
                {tr.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Edit tender</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={160} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Client name *</label>
              <input value={editClient} onChange={(e) => setEditClient(e.target.value)} maxLength={200} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Submission deadline *</label>
              <input type="datetime-local" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Timezone</label>
              <input value={editTz} onChange={(e) => setEditTz(e.target.value)} maxLength={100} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Est. value</label>
              <input value={editEstValue} onChange={(e) => setEditEstValue(e.target.value)} placeholder="e.g. 45000000.00" className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Currency</label>
              <input value={editCurrency} onChange={(e) => setEditCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Requirements</label>
            <textarea value={editReqs} onChange={(e) => setEditReqs(e.target.value)} rows={3} maxLength={5000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Notes</label>
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} maxLength={2000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onSave} disabled={updating}
              className="inline-flex items-center gap-1.5 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              {updating ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]">
              <X className="h-3.5 w-3.5" strokeWidth={2} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Detail panels */}
      <div className="space-y-6">
        {/* Core info */}
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-4">Tender details</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
            <Field label="Client" value={tender.clientName} />
            <Field label="Client reference" value={tender.clientReference} />
            <Field label="Issuer" value={tender.issuerName} />
            <Field label="Submission deadline" value={
              new Date(tender.submissionDeadline).toLocaleDateString('en', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })
            } />
            <Field label="Timezone" value={tender.submissionTimezone} />
            <Field label="Version" value={`v${tender.version}`} />
            {tender.estimatedValue && (
              <Field label="Estimated value" value={`${tender.currencyCode ?? ''} ${parseFloat(tender.estimatedValue).toLocaleString()}`} />
            )}
          </div>

          {tender.description && (
            <div className="mt-4 pt-4 border-t border-[var(--hairline-2)]">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</p>
              <p className="text-sm whitespace-pre-wrap">{tender.description}</p>
            </div>
          )}

          {tender.requirements && (
            <div className="mt-4 pt-4 border-t border-[var(--hairline-2)]">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Requirements</p>
              <p className="text-sm whitespace-pre-wrap">{tender.requirements}</p>
            </div>
          )}

          {tender.requiredDocuments && tender.requiredDocuments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--hairline-2)]">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-2">Required documents</p>
              <ul className="space-y-1">
                {tender.requiredDocuments.map((doc, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-[var(--muted)] shrink-0" />
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tender.notes && (
            <div className="mt-4 pt-4 border-t border-[var(--hairline-2)]">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Notes</p>
              <p className="text-sm whitespace-pre-wrap text-[var(--muted)]">{tender.notes}</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-4">Timeline</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
            <Field label="Created" value={new Date(tender.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} />
            {tender.submittedAt && <Field label="Submitted" value={new Date(tender.submittedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} />}
            {tender.awardedAt  && <Field label="Awarded"   value={new Date(tender.awardedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} />}
            {tender.closedAt   && <Field label="Closed"    value={new Date(tender.closedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} />}
          </div>
        </div>

        {/* Linked project */}
        {tender.projectId && (
          <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 flex items-center justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-0.5">Linked project</p>
              <p className="text-sm font-medium">{tender.projectId}</p>
            </div>
            <Link
              to={`/org/${orgId}/projects/${tender.projectId}`}
              className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] px-3 py-1.5 hover:bg-[var(--surface-2)] transition-colors"
            >
              Open project →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
