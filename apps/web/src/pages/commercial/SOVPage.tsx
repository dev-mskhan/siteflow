/**
 * SOVPage — /org/:orgId/projects/:projectId/commercial/sov
 * Schedule of Values: list, create, submit/approve, progress view.
 *
 * State machine: DRAFT → SUBMITTED (submit) → APPROVED (approve)
 * expectedVersion required on submit and approve.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, ChevronDown, ChevronRight, TableProperties } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListSOVsQuery,
  useCreateSOVMutation,
  useTransitionSOVMutation,
  useGetSOVProgressQuery,
} from '../../api/commercialApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { SOVStatus } from '../../types/commercialTypes';

const STATUS_BADGE: Record<SOVStatus, string> = {
  DRAFT:     'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  SUBMITTED: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  APPROVED:  'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
};

// Progress sub-panel for a single SOV
const SOVProgressPanel: React.FC<{ orgId: string; projectId: string; sovId: string }> = ({ orgId, projectId, sovId }) => {
  const { data: progress } = useGetSOVProgressQuery({ orgId, projectId, sovId });
  if (!progress) return <div className="px-6 py-4 text-sm text-[var(--muted)]">Loading progress…</div>;
  return (
    <div className="px-4 pb-4 bg-[var(--paper)]">
      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-4 py-3 border-b border-[var(--hairline-2)] mb-3">
        {[
          { label: 'Scheduled value', value: parseFloat(progress.totalScheduledValue).toLocaleString() },
          { label: 'Earned to date',  value: parseFloat(progress.totalEarnedToDate).toLocaleString() },
          { label: 'Retainage held',  value: parseFloat(progress.totalRetainage).toLocaleString() },
          { label: '% complete',      value: `${progress.percentComplete}%` },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-0.5">{label}</p>
            <p className="font-mono text-[11px] font-medium">{value}</p>
          </div>
        ))}
      </div>
      {/* Line items */}
      <div className="grid grid-cols-[2fr_100px_100px_100px] gap-3 px-0 py-1 border-b border-[var(--hairline-2)] mb-1">
        {['Line', 'Scheduled', 'Earned', '% Complete'].map((h) => (
          <p key={h} className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{h}</p>
        ))}
      </div>
      {progress.lines.map((l) => (
        <div key={l.lineId} className="grid grid-cols-[2fr_100px_100px_100px] gap-3 items-center py-2 border-b border-[var(--hairline-2)] last:border-b-0">
          <p className="text-sm truncate">{l.description}</p>
          <p className="font-mono text-[10px]">{parseFloat(l.scheduledValue).toLocaleString()}</p>
          <p className="font-mono text-[10px]">{parseFloat(l.totalEarned).toLocaleString()}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[var(--surface-2)] overflow-hidden">
              <div className="h-full bg-[var(--ink)]" style={{ width: `${Math.min(100, parseFloat(l.percentComplete))}%` }} />
            </div>
            <span className="font-mono text-[9px] text-[var(--muted)] w-8 text-right">{l.percentComplete}%</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export const SOVPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const canCreate  = usePermission('project.schedule_of_values.create');
  const canApprove = usePermission('project.schedule_of_values.approve');

  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [title, setTitle]     = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [description, setDescription] = useState('');

  const { data, isLoading } = useListSOVsQuery({ orgId: orgId!, projectId: projectId! });
  const [createSOV, { isLoading: creating }] = useCreateSOVMutation();
  const [transitionSOV, { isLoading: transitioning }] = useTransitionSOVMutation();

  const onCreate = async () => {
    if (!title.trim()) { toastErr('Title required', ''); return; }
    try {
      await createSOV({
        orgId: orgId!, projectId: projectId!,
        input: { title: title.trim(), currencyCode: currency.toUpperCase(), description: description.trim() || undefined },
      }).unwrap();
      toastOk('SOV created', '');
      setShowCreate(false); setTitle(''); setCurrency('PKR'); setDescription('');
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const doTransition = async (sovId: string, action: 'submit' | 'approve', version: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await transitionSOV({ orgId: orgId!, projectId: projectId!, sovId, action, expectedVersion: version }).unwrap();
      toastOk(`SOV ${action}d`, '');
    } catch (err) { toastErr('Transition failed', toastErrorMessage(err as never)); }
  };

  const sovs = data?.items ?? [];

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Schedule of values</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{sovs.length} SOV{sovs.length !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> New SOV
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New schedule of values</p>
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
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">
              {creating ? 'Creating…' : 'Create SOV'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[28px_2fr_100px_100px_120px_180px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['', 'Title', 'Status', 'Currency', 'Total SV', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : sovs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <TableProperties className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No schedule of values yet.</p>
          </div>
        ) : sovs.map((sov) => (
          <div key={sov.id}>
            <div className="grid grid-cols-[28px_2fr_100px_100px_120px_180px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <button type="button" onClick={() => setExpandedId(expandedId === sov.id ? null : sov.id)}
                className="p-0.5 text-[var(--muted)] hover:text-[var(--ink)]">
                {expandedId === sov.id
                  ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                  : <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
              </button>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{sov.title}</p>
                <p className="font-mono text-[9px] text-[var(--muted)]">{sov.sovNumber}</p>
              </div>
              <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[sov.status]}`}>
                {sov.status}
              </span>
              <p className="font-mono text-[10px] text-[var(--muted)]">{sov.currencyCode}</p>
              <p className="font-mono text-[10px] font-medium">{parseFloat(sov.totalScheduledValue).toLocaleString()}</p>
              <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                {sov.status === 'DRAFT' && (
                  <button onClick={(e) => doTransition(sov.id, 'submit', sov.version, e)} disabled={transitioning}
                    className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-50">
                    Submit
                  </button>
                )}
                {sov.status === 'SUBMITTED' && canApprove && (
                  <button onClick={(e) => doTransition(sov.id, 'approve', sov.version, e)} disabled={transitioning}
                    className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7] disabled:opacity-50">
                    Approve
                  </button>
                )}
              </div>
            </div>
            {expandedId === sov.id && (
              <SOVProgressPanel orgId={orgId!} projectId={projectId!} sovId={sov.id} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
