/**
 * ProjectFieldLogDetailPage — /org/:orgId/projects/:projectId/field-logs/:logId
 * Detail view with entries table, state machine actions, amendments section.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Plus, X, ArrowRight, Lock, Send, Pencil } from 'lucide-react';
import {
  useGetFieldLogQuery,
  useUpdateFieldLogMutation,
  useSubmitFieldLogMutation,
  useLockFieldLogMutation,
  useListAmendmentsQuery,
  useCreateAmendmentMutation,
} from '../features/project/fieldLogApi';
import { useListTasksQuery } from '../features/project/taskApi';
import { usePermission } from '../hooks/usePermission';
import { InlineAlert } from '../components/ui/InlineAlert';
import { useToast } from '../components/ui/Toast';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../lib/authErrors';
import type {
  UpdateFieldLogInput,
  FieldLogEntryInput,
  CreateAmendmentInput,
  FieldLogStatus,
} from '../types/fieldLogTypes';

const STATUS_BADGE: Record<FieldLogStatus, string> = {
  DRAFT: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  SUBMITTED: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  LOCKED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
};

const STEPS: FieldLogStatus[] = ['DRAFT', 'SUBMITTED', 'LOCKED'];

export const ProjectFieldLogDetailPage: React.FC = () => {
  const { orgId, projectId, logId } = useParams<{
    orgId: string;
    projectId: string;
    logId: string;
  }>();
  const canUpdate = usePermission('project.field-log.update');
  const canSubmit = usePermission('project.field-log.submit');
  const canLock = usePermission('project.field-log.lock');
  const { success: toastOk, error: toastErr } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [editRows, setEditRows] = useState<FieldLogEntryInput[]>([]);
  const [showAmendForm, setShowAmendForm] = useState(false);

  const { data: log, isLoading } = useGetFieldLogQuery({
    orgId: orgId!,
    projectId: projectId!,
    logId: logId!,
  });
  const { data: amendmentsData } = useListAmendmentsQuery({
    orgId: orgId!,
    projectId: projectId!,
    logId: logId!,
  });
  const { data: tasksData } = useListTasksQuery({ orgId: orgId!, projectId: projectId! });

  const [updateFieldLog, { isLoading: updating, error: updateErr }] = useUpdateFieldLogMutation();
  const [submitFieldLog, { isLoading: submitting }] = useSubmitFieldLogMutation();
  const [lockFieldLog, { isLoading: locking }] = useLockFieldLogMutation();
  const [createAmendment, { isLoading: creatingAmend, error: amendErr }] =
    useCreateAmendmentMutation();

  const {
    register: regUpdate,
    handleSubmit: handleUpdate,
    reset: resetUpdate,
  } = useForm<UpdateFieldLogInput>();
  const {
    register: regAmend,
    handleSubmit: handleAmend,
    reset: resetAmend,
  } = useForm<{ reason: string; correctionRaw: string }>();

  const getTaskName = (taskId: string) => {
    const t = tasksData?.tasks.find((t) => t.id === taskId);
    return t ? `${t.taskCode} — ${t.name}` : taskId;
  };

  const startEdit = () => {
    if (!log) return;
    resetUpdate({ notes: log.notes ?? '' });
    setEditRows(
      (log.entries ?? []).map((e) => ({
        taskId: e.taskId,
        completionPctRecorded: e.completionPctRecorded,
        quantityCompleted: e.quantityCompleted ?? undefined,
        unit: e.unit ?? undefined,
        notes: e.notes ?? undefined,
      })),
    );
    setIsEditing(true);
  };

  const addRow = () => setEditRows((r) => [...r, { taskId: '', completionPctRecorded: 0 }]);
  const updateRow = (idx: number, patch: Partial<FieldLogEntryInput>) =>
    setEditRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx: number) => setEditRows((rows) => rows.filter((_, i) => i !== idx));

  const onSave = async (values: UpdateFieldLogInput) => {
    try {
      await updateFieldLog({
        orgId: orgId!,
        projectId: projectId!,
        logId: logId!,
        input: { ...values, entries: editRows.filter((e) => e.taskId) },
      }).unwrap();
      toastOk('Log updated', '');
      setIsEditing(false);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  const onSubmit = async () => {
    try {
      await submitFieldLog({ orgId: orgId!, projectId: projectId!, logId: logId! }).unwrap();
      toastOk('Log submitted', '');
    } catch (err) {
      toastErr('Submit failed', toastErrorMessage(err as never));
    }
  };

  const onLock = async () => {
    try {
      await lockFieldLog({ orgId: orgId!, projectId: projectId!, logId: logId! }).unwrap();
      toastOk('Log locked', '');
    } catch (err) {
      toastErr('Lock failed', toastErrorMessage(err as never));
    }
  };

  const onAmend = async (values: { reason: string; correctionRaw: string }) => {
    let correction: Record<string, unknown>;
    try {
      correction = JSON.parse(values.correctionRaw);
    } catch {
      toastErr('Invalid JSON', 'The correction field must be valid JSON.');
      return;
    }
    try {
      await createAmendment({
        orgId: orgId!,
        projectId: projectId!,
        logId: logId!,
        input: { reason: values.reason, correction },
      }).unwrap();
      toastOk('Amendment submitted', '');
      resetAmend();
      setShowAmendForm(false);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Amendment failed', toastErrorMessage(err as never));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 sm:p-8 space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]"
          />
        ))}
      </div>
    );
  }

  if (!log) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-sm text-[var(--muted)]">Field log not found.</p>
      </div>
    );
  }

  const amendments = amendmentsData?.data ?? [];

  return (
    <div className="p-6 sm:p-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--hairline-2)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Field log
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-[-0.04em]">{log.logDate}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-2 py-0.5 ${STATUS_BADGE[log.status]}`}
            >
              {log.status}
            </span>
            <span className="font-mono text-[10px] text-[var(--muted)]">
              Supervisor: {log.supervisorId}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {log.status === 'DRAFT' && canUpdate && !isEditing && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-2 border border-[var(--hairline-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              Edit
            </button>
          )}
          {log.status === 'DRAFT' && canSubmit && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              <Send className="h-4 w-4" strokeWidth={1.8} />
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          )}
          {log.status === 'SUBMITTED' && canLock && (
            <button
              type="button"
              onClick={onLock}
              disabled={locking}
              className="inline-flex items-center gap-2 min-h-10 bg-[#166534] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" strokeWidth={1.8} />
              {locking ? 'Locking…' : 'Lock'}
            </button>
          )}
          {log.status === 'LOCKED' && canUpdate && !showAmendForm && (
            <button
              type="button"
              onClick={() => setShowAmendForm(true)}
              className="inline-flex items-center gap-2 border border-[var(--hairline-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-2)] transition-colors"
            >
              <Plus className="h-4 w-4" strokeWidth={1.8} />
              Add amendment
            </button>
          )}
        </div>
      </div>

      {/* Status pipeline */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, idx) => {
          const active = log.status === step;
          const done = STEPS.indexOf(log.status) > idx;
          return (
            <React.Fragment key={step}>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 border ${active ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : done ? 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]' : 'border-[var(--hairline-2)] bg-[var(--paper)] text-[var(--muted)]'}`}
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.14em]">{step}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <ArrowRight
                  className="h-3.5 w-3.5 text-[var(--muted)] shrink-0"
                  strokeWidth={1.5}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Notes */}
      {!isEditing && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-2">
            Notes
          </p>
          <p className="text-sm">{log.notes || '—'}</p>
        </div>
      )}

      {/* Edit form */}
      {isEditing && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Edit log
          </p>
          {isInlineError(updateErr) && (
            <InlineAlert variant="error" message={getServerError(updateErr)?.message ?? 'Error'} />
          )}
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
              Notes
            </label>
            <textarea
              {...regUpdate('notes')}
              rows={3}
              maxLength={4000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
            />
          </div>

          {/* Entry rows */}
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
                <Plus className="h-3 w-3" strokeWidth={2} /> Add entry
              </button>
            </div>
            {editRows.length > 0 && (
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
                {editRows.map((row, idx) => (
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
              onClick={handleUpdate(onSave)}
              disabled={updating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
            >
              {updating ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Entries table (read-only) */}
      {!isEditing && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-3">
            Task entries
          </p>
          <div className="border border-[var(--hairline-2)]">
            <div className="grid grid-cols-[2fr_160px_80px_80px_2fr] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
              {['Task', 'Progress', 'Qty', 'Unit', 'Notes'].map((h) => (
                <p
                  key={h}
                  className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]"
                >
                  {h}
                </p>
              ))}
            </div>
            {!log.entries || log.entries.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                No entries recorded.
              </div>
            ) : (
              log.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[2fr_160px_80px_80px_2fr] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]"
                >
                  <p className="text-sm font-medium truncate">{getTaskName(entry.taskId)}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[var(--surface-2)] border border-[var(--hairline-2)]">
                      <div
                        className="h-full bg-[var(--ink)]"
                        style={{ width: `${entry.completionPctRecorded}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-[var(--muted)] w-8 text-right">
                      {entry.completionPctRecorded}%
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-[var(--muted)]">
                    {entry.quantityCompleted ?? '—'}
                  </p>
                  <p className="font-mono text-[11px] text-[var(--muted)]">{entry.unit ?? '—'}</p>
                  <p className="text-sm text-[var(--muted)] truncate">{entry.notes ?? '—'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Amendments (only on LOCKED logs) */}
      {log.status === 'LOCKED' && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-3">
            Amendments
          </p>

          {showAmendForm && (
            <form
              onSubmit={handleAmend(onAmend)}
              className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4"
            >
              {isInlineError(amendErr) && (
                <InlineAlert
                  variant="error"
                  message={getServerError(amendErr)?.message ?? 'Error'}
                />
              )}
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                  Reason *
                </label>
                <textarea
                  {...regAmend('reason', { required: true, minLength: 1, maxLength: 2000 })}
                  rows={3}
                  className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                />
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                  Correction (JSON) *
                </label>
                <textarea
                  {...regAmend('correctionRaw', { required: true })}
                  rows={4}
                  placeholder='{"field": "oldValue", "correctedValue": "newValue"}'
                  className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm font-mono resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
                />
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
                <button
                  type="submit"
                  disabled={creatingAmend}
                  className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                >
                  {creatingAmend ? 'Submitting…' : 'Submit amendment'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAmendForm(false);
                    resetAmend();
                  }}
                  className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="border border-[var(--hairline-2)]">
            {amendments.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                No amendments yet.
              </div>
            ) : (
              amendments.map((a, idx) => (
                <div
                  key={a.id}
                  className="px-4 py-4 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-mono text-[10px] text-[var(--muted)]">
                        #{idx + 1} · Requested by {a.requestedBy} ·{' '}
                        {new Date(a.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {a.approvedBy && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5">
                        Approved
                      </span>
                    )}
                  </div>
                  <p className="text-sm mb-3">{a.reason}</p>
                  <details>
                    <summary className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] cursor-pointer hover:text-[var(--ink)]">
                      View correction JSON
                    </summary>
                    <pre className="mt-2 p-3 bg-[var(--surface-2)] border border-[var(--hairline-2)] text-xs font-mono overflow-x-auto">
                      {JSON.stringify(a.correction, null, 2)}
                    </pre>
                  </details>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
