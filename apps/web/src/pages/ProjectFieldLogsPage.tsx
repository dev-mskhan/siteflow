/**
 * ProjectFieldLogsPage — /org/:orgId/projects/:projectId/field-logs
 * Lists all field logs for the project. Inline create panel.
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Plus, X, Check, ClipboardList } from 'lucide-react';
import { useListFieldLogsQuery, useCreateFieldLogMutation } from '../api/fieldLogApi';
import { useListTasksQuery } from '../api/taskApi';
import { usePermission } from '../hooks/usePermission';
import { InlineAlert } from '../components/ui/InlineAlert';
import { useToast } from '../components/ui/Toast';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../lib/authErrors';
import type {
  CreateFieldLogInput,
  FieldLogEntryInput,
  FieldLogStatus,
} from '../types/fieldLogTypes';

const STATUS_BADGE: Record<FieldLogStatus, string> = {
  DRAFT: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  SUBMITTED: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  LOCKED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
};

export const ProjectFieldLogsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const navigate = useNavigate();
  const canCreate = usePermission('project.field-log.create');
  const { success: toastOk, error: toastErr } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [entryRows, setEntryRows] = useState<FieldLogEntryInput[]>([]);

  const { data, isLoading } = useListFieldLogsQuery({ orgId: orgId!, projectId: projectId! });
  const { data: tasksData } = useListTasksQuery({ orgId: orgId!, projectId: projectId! });
  const [createFieldLog, { isLoading: creating, error: createErr }] = useCreateFieldLogMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFieldLogInput>();

  const onSubmit = async (values: CreateFieldLogInput) => {
    try {
      const result = await createFieldLog({
        orgId: orgId!,
        projectId: projectId!,
        input: { ...values, entries: entryRows.filter((e) => e.taskId) },
      }).unwrap();
      toastOk('Field log created', '');
      reset();
      setEntryRows([]);
      setShowCreate(false);
      navigate(`/org/${orgId}/projects/${projectId}/field-logs/${result.id}`);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const addRow = () => setEntryRows((r) => [...r, { taskId: '', completionPctRecorded: 0 }]);

  const updateRow = (idx: number, patch: Partial<FieldLogEntryInput>) =>
    setEntryRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const removeRow = (idx: number) => setEntryRows((rows) => rows.filter((_, i) => i !== idx));

  const logs = data?.data ?? [];

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium tracking-[-0.03em]">Field logs</h2>
        {canCreate && !showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New log
          </button>
        )}
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            New field log
          </p>
          {isInlineError(createErr) && (
            <InlineAlert variant="error" message={getServerError(createErr)?.message ?? 'Error'} />
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                Log date *
              </label>
              <input
                type="date"
                {...register('logDate', { required: 'Date is required' })}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              />
              {errors.logDate && (
                <p className="mt-1 font-mono text-[9px] text-[#991b1b]">{errors.logDate.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              maxLength={4000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              placeholder="Site conditions, activities, observations (max 4000 chars)"
            />
          </div>

          {/* Task entries */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Task entries
              </p>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 text-xs font-medium border border-[var(--hairline-2)] px-3 py-1.5 hover:bg-[var(--surface-2)] transition-colors"
              >
                <Plus className="h-3 w-3" strokeWidth={2} />
                Add entry
              </button>
            </div>
            {entryRows.length > 0 && (
              <div className="border border-[var(--hairline-2)] divide-y divide-[var(--hairline-2)]">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr_32px] gap-2 px-3 py-2 bg-[var(--surface-2)]">
                  {['Task', '% Done', 'Qty', 'Unit', 'Notes', ''].map((h) => (
                    <p
                      key={h}
                      className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]"
                    >
                      {h}
                    </p>
                  ))}
                </div>
                {entryRows.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr_32px] gap-2 items-center px-3 py-2.5 bg-[var(--paper)]"
                  >
                    <select
                      value={row.taskId}
                      onChange={(e) => updateRow(idx, { taskId: e.target.value })}
                      className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                    >
                      <option value="">Select task…</option>
                      {tasksData?.tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.taskCode} — {t.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={row.completionPctRecorded}
                      onChange={(e) =>
                        updateRow(idx, { completionPctRecorded: Number(e.target.value) })
                      }
                      className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                    />
                    <input
                      type="text"
                      placeholder="—"
                      value={row.quantityCompleted ?? ''}
                      onChange={(e) =>
                        updateRow(idx, { quantityCompleted: e.target.value || undefined })
                      }
                      className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                    />
                    <input
                      type="text"
                      placeholder="m³"
                      maxLength={50}
                      value={row.unit ?? ''}
                      onChange={(e) => updateRow(idx, { unit: e.target.value || undefined })}
                      className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                    />
                    <input
                      type="text"
                      maxLength={2000}
                      placeholder="Notes"
                      value={row.notes ?? ''}
                      onChange={(e) => updateRow(idx, { notes: e.target.value || undefined })}
                      className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="p-1 text-[var(--muted)] hover:text-[#991b1b] transition-colors"
                    >
                      <X className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={creating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {creating ? 'Creating…' : 'Create log'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                reset();
                setEntryRows([]);
              }}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-[var(--hairline-2)]">
        {/* Column header */}
        <div className="grid grid-cols-[150px_110px_60px_1fr] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Date', 'Status', 'Entries', 'Notes'].map((h) => (
            <p
              key={h}
              className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]"
            >
              {h}
            </p>
          ))}
        </div>

        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]"
            />
          ))
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <ClipboardList className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No field logs recorded yet.</p>
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-3 inline-flex items-center gap-2 border border-[var(--hairline-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors"
              >
                <Plus className="h-4 w-4" strokeWidth={1.8} />
                Create first log
              </button>
            )}
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              onClick={() => navigate(`/org/${orgId}/projects/${projectId}/field-logs/${log.id}`)}
              className="grid grid-cols-[150px_110px_60px_1fr] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
            >
              <p className="font-mono text-[11px] text-[var(--ink)]">{log.logDate}</p>
              <span
                className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[log.status]}`}
              >
                {log.status}
              </span>
              <p className="font-mono text-[11px] text-[var(--muted)]">
                {log.entries?.length ?? 0}
              </p>
              <p className="text-sm text-[var(--muted)] truncate">{log.notes || '—'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
