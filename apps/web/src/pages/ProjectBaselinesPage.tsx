/**
 * ProjectBaselinesPage — /org/:orgId/projects/:projectId/baselines
 * Create schedule snapshots, activate, compare current vs baseline.
 * Backend: apps/server/src/modules/project/baseline/baseline.handler.ts
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, GitBranch, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';
import {
  useListBaselinesQuery,
  useCreateBaselineMutation,
  useActivateBaselineMutation,
  useDeleteBaselineMutation,
} from '../features/project/taskApi';
import { useCompareBaselineQuery } from '../features/project/scheduleApi';
import { usePermission } from '../hooks/usePermission';
import { inputCls } from '../components/ui/FormField';
import { useToast } from '../components/ui/Toast';
import { toastErrorMessage } from '../lib/authErrors';

const VarianceCell: React.FC<{ days: number | null }> = ({ days }) => {
  if (days === null) return <span className="text-[var(--muted)]">—</span>;
  if (days === 0) return <span className="font-mono text-[10px] text-[#166534]">on track</span>;
  return (
    <span className={cn('font-mono text-[10px]', days > 0 ? 'text-[#991b1b]' : 'text-[#166534]')}>
      {days > 0 ? `+${days}d` : `${days}d`}
    </span>
  );
};

const ComparePanel: React.FC<{ orgId: string; projectId: string; baselineId: string }> = ({ orgId, projectId, baselineId }) => {
  const { data, isLoading } = useCompareBaselineQuery({ orgId, projectId, baselineId });

  if (isLoading) return (
    <div className="space-y-1 px-4 py-3">
      {[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse bg-[var(--surface-2)]" />)}
    </div>
  );
  if (!data) return null;

  return (
    <div className="border-t border-[var(--hairline-2)]">
      <div className="grid grid-cols-[2fr_90px_90px_90px_90px_80px_80px] gap-3 px-6 py-2 bg-[var(--surface-2)]">
        {['Task', 'BL Start', 'BL Finish', 'Curr Start', 'Curr Finish', 'Start Δ', 'Finish Δ'].map((h) => (
          <p key={h} className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{h}</p>
        ))}
      </div>
      {data.tasks.map((t) => (
        <div key={t.taskId} className="grid grid-cols-[2fr_90px_90px_90px_90px_80px_80px] gap-3 items-center px-6 py-2.5 border-t border-[var(--hairline-2)] bg-[var(--paper)]">
          <div>
            <p className="text-sm truncate">{t.name}</p>
            <p className="font-mono text-[9px] text-[var(--muted)]">{t.taskCode}</p>
          </div>
          <p className="font-mono text-[10px] text-[var(--muted)]">{t.baselineStart ?? '—'}</p>
          <p className="font-mono text-[10px] text-[var(--muted)]">{t.baselineFinish ?? '—'}</p>
          <p className="font-mono text-[10px]">{t.currentStart ?? '—'}</p>
          <p className="font-mono text-[10px]">{t.currentFinish ?? '—'}</p>
          <VarianceCell days={t.startVarianceDays} />
          <VarianceCell days={t.finishVarianceDays} />
        </div>
      ))}
    </div>
  );
};

export const ProjectBaselinesPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const canCreate = usePermission('project.baseline.create');
  const canActivate = usePermission('project.baseline.activate');
  const canDelete = usePermission('project.baseline.delete');
  const { success: toastOk, error: toastErr } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: baselines = [], isLoading } = useListBaselinesQuery({ orgId: orgId!, projectId: projectId! });
  const [createBaseline, { isLoading: creating }] = useCreateBaselineMutation();
  const [activateBaseline] = useActivateBaselineMutation();
  const [deleteBaseline] = useDeleteBaselineMutation();

  const onCreate = async () => {
    if (!newName.trim()) { toastErr('Name required', ''); return; }
    try {
      await createBaseline({ orgId: orgId!, projectId: projectId!, input: { name: newName.trim(), description: newDesc || undefined } }).unwrap();
      toastOk('Baseline created', '');
      setNewName(''); setNewDesc(''); setShowCreate(false);
    } catch (err) {
      toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const onActivate = async (baselineId: string) => {
    try {
      await activateBaseline({ orgId: orgId!, projectId: projectId!, baselineId }).unwrap();
      toastOk('Baseline activated', '');
    } catch (err) {
      toastErr('Activate failed', toastErrorMessage(err as never));
    }
  };

  const onDelete = async (baselineId: string) => {
    if (!confirm('Delete this baseline? This cannot be undone.')) return;
    try {
      await deleteBaseline({ orgId: orgId!, projectId: projectId!, baselineId }).unwrap();
      toastOk('Baseline deleted', '');
    } catch (err) {
      toastErr('Delete failed', toastErrorMessage(err as never));
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Baselines</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Schedule snapshots for comparison</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> Snapshot
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New baseline</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Name *</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Initial Baseline — Nov 2026"
                className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional note"
                className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
              {creating ? 'Snapshotting…' : 'Create baseline'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      <div className="border border-[var(--hairline-2)]">
        {/* Header */}
        <div className="grid grid-cols-[28px_2fr_80px_60px_100px_180px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['', 'Name', 'Tasks', 'Active', 'Created', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : baselines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <GitBranch className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No baselines yet.</p>
            <p className="text-xs text-[var(--muted)] mt-1">Snapshot the current schedule to track variance.</p>
          </div>
        ) : (
          baselines.map((bl) => (
            <div key={bl.id}>
              <div className="grid grid-cols-[28px_2fr_80px_60px_100px_180px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
                {/* Expand toggle */}
                <button type="button" onClick={() => setExpandedId(expandedId === bl.id ? null : bl.id)}
                  className="p-0.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                  {expandedId === bl.id
                    ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                    : <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
                </button>

                <div>
                  <p className="text-sm font-medium">{bl.name}</p>
                  {bl.description && <p className="font-mono text-[9px] text-[var(--muted)] mt-0.5">{bl.description}</p>}
                </div>

                <p className="font-mono text-[11px] text-[var(--muted)]">{bl.snapshotTaskCount}</p>

                <div>
                  {bl.isActive && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5">
                      Active
                    </span>
                  )}
                </div>

                <p className="font-mono text-[10px] text-[var(--muted)]">
                  {new Date(bl.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>

                <div className="flex items-center gap-2 justify-end">
                  {canActivate && !bl.isActive && (
                    <button type="button" onClick={() => onActivate(bl.id)}
                      className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] px-2 py-1 hover:bg-[var(--surface-2)] transition-colors">
                      Activate
                    </button>
                  )}
                  <button type="button" onClick={() => setExpandedId(expandedId === bl.id ? null : bl.id)}
                    className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] px-2 py-1 hover:bg-[var(--surface-2)] transition-colors">
                    Compare
                  </button>
                  {canDelete && !bl.isActive && (
                    <button type="button" onClick={() => onDelete(bl.id)}
                      className="p-1 text-[var(--muted)] hover:text-[#991b1b] transition-colors">
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>

              {expandedId === bl.id && (
                <ComparePanel orgId={orgId!} projectId={projectId!} baselineId={bl.id} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
