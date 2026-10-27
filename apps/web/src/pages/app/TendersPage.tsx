/**
 * TendersPage — /org/:orgId/tenders
 * Org-level tender opportunities list + create.
 *
 * Backend: GET/POST /:orgId/tenders
 * Transitions: OPEN → SUBMITTED → AWARDED | LOST | WITHDRAWN | EXPIRED
 * Schema: packages/shared/src/modules/project/proposal.schema.ts → createTenderSchema
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, ArrowUpRight, FileSearch } from 'lucide-react';
import {
  useListTendersQuery,
  useCreateTenderMutation,
  useTransitionTenderMutation,
} from '../../features/project/preconstructionApi';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../../lib/authErrors';
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
  SUBMITTED: [{ label: 'Mark awarded', status: 'AWARDED' }, { label: 'Mark lost', status: 'LOST', danger: true }, { label: 'Withdraw', status: 'WITHDRAWN', danger: true }],
  AWARDED:   [],
  LOST:      [],
  WITHDRAWN: [],
  EXPIRED:   [],
};

const STATUS_FILTERS = ['ALL', 'OPEN', 'SUBMITTED', 'AWARDED', 'LOST', 'WITHDRAWN'] as const;

export const TendersPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [title, setTitle]       = useState('');
  const [clientName, setClientName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tz, setTz]             = useState('Asia/Karachi');
  const [estValue, setEstValue] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [description, setDescription] = useState('');

  const { data, isLoading } = useListTendersQuery({
    orgId: orgId!,
    status: statusFilter !== 'ALL' ? (statusFilter as TenderStatus) : undefined,
  });
  const [createTender, { isLoading: creating, error: createErr }] = useCreateTenderMutation();
  const [transitionTender, { isLoading: transitioning }] = useTransitionTenderMutation();

  const handleCreate = async () => {
    if (!title.trim() || !clientName.trim() || !deadline) {
      toastErr('Required fields missing', 'Title, client name, and deadline are required.');
      return;
    }
    try {
      await createTender({
        orgId: orgId!,
        input: {
          title: title.trim(),
          clientName: clientName.trim(),
          submissionDeadline: new Date(deadline).toISOString(),
          submissionTimezone: tz,
          estimatedValue: estValue.trim() || undefined,
          currencyCode: currency || undefined,
          description: description.trim() || undefined,
        },
      }).unwrap();
      toastOk('Tender created', '');
      setShowCreate(false);
      setTitle(''); setClientName(''); setDeadline(''); setEstValue(''); setDescription('');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const onTransition = async (tenderId: string, status: string, version: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await transitionTender({ orgId: orgId!, tenderId, status, expectedVersion: version }).unwrap();
      toastOk(`Tender ${status.toLowerCase()}`, '');
    } catch (err) {
      toastErr('Transition failed', toastErrorMessage(err as never));
    }
  };

  const tenders = data?.items ?? [];

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-[-0.03em]">Tenders</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {tenders.length} tender opportunit{tenders.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
          <Plus className="h-4 w-4" strokeWidth={2} /> New tender
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New tender opportunity</p>
          {isInlineError(createErr) && <InlineAlert variant="error" message={getServerError(createErr)?.message ?? 'Error'} />}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Client name *</label>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={200} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Submission deadline *</label>
              <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Estimated value</label>
              <input type="text" value={estValue} onChange={(e) => setEstValue(e.target.value)} placeholder="e.g. 45000000.00" className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Currency</label>
              <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={5000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={handleCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
              {creating ? 'Creating…' : 'Create tender'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex border border-[var(--hairline-2)] mb-6 w-fit">
        {STATUS_FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors ${statusFilter === f ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[1fr_1fr_90px_110px_100px_120px_44px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Title', 'Client', 'Status', 'Value', 'Deadline', '', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : tenders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <FileSearch className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No tenders found.</p>
          </div>
        ) : (
          tenders.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_1fr_90px_110px_100px_120px_44px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.title}</p>
                <p className="font-mono text-[9px] text-[var(--muted)]">{t.tenderNumber}</p>
              </div>
              <p className="text-sm text-[var(--muted)] truncate">{t.clientName}</p>
              <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[t.status]}`}>{t.status}</span>
              <div>
                {t.estimatedValue ? (
                  <p className="font-mono text-[10px]">{t.currencyCode ?? ''} {parseFloat(t.estimatedValue).toLocaleString()}</p>
                ) : <p className="text-[var(--muted)]">—</p>}
              </div>
              <p className="font-mono text-[10px] text-[var(--muted)]">
                {new Date(t.submissionDeadline).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
              </p>
              <div className="flex gap-1 flex-wrap">
                {NEXT_TRANSITIONS[t.status].map((tr) => (
                  <button key={tr.status} type="button" disabled={transitioning}
                    onClick={(e) => onTransition(t.id, tr.status, t.version, e)}
                    className={`font-mono text-[8px] uppercase tracking-[0.1em] border px-1.5 py-0.5 transition-colors disabled:opacity-50 ${tr.danger ? 'border-[#fecaca] text-[#991b1b] hover:bg-[#fef2f2]' : 'border-[var(--hairline-2)] hover:bg-[var(--surface-2)]'}`}>
                    {tr.label}
                  </button>
                ))}
              </div>
              <Link to={`/org/${orgId}/tenders/${t.id}`} aria-label={`View ${t.title}`}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
