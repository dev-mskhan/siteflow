/**
 * ProjectCalendarPage — /org/:orgId/projects/:projectId/calendar
 * Configure working days, work hours, and exception dates.
 * Trigger CPM schedule recalculation.
 * Backend: apps/server/src/modules/project/calendar/calendar.handler.ts
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, X, RefreshCw, CalendarDays } from 'lucide-react';
import {
  useGetCalendarQuery,
  useUpdateCalendarMutation,
  useAddCalendarExceptionMutation,
  useRemoveCalendarExceptionMutation,
  useRecalculateScheduleMutation,
} from '../features/project/taskApi';
import { usePermission } from '../hooks/usePermission';
import { inputCls } from '../components/ui/FormField';
import { useToast } from '../components/ui/Toast';
import { toastErrorMessage } from '../lib/authErrors';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const ProjectCalendarPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const canManage = usePermission('project.calendar.manage');
  const canRecalc = usePermission('project.schedule.recalculate');
  const { success: toastOk, error: toastErr } = useToast();

  const { data: calendar, isLoading } = useGetCalendarQuery({ orgId: orgId!, projectId: projectId! });
  const [updateCalendar, { isLoading: saving }] = useUpdateCalendarMutation();
  const [addException, { isLoading: addingEx }] = useAddCalendarExceptionMutation();
  const [removeException] = useRemoveCalendarExceptionMutation();
  const [recalculate, { isLoading: recalculating }] = useRecalculateScheduleMutation();

  // Local calendar form state
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [workStart, setWorkStart] = useState('08:00');
  const [workEnd, setWorkEnd] = useState('17:00');

  // Exception form state
  const [showAddEx, setShowAddEx] = useState(false);
  const [exDate, setExDate] = useState('');
  const [exType, setExType] = useState<'NON_WORKING_DAY' | 'WORKING_DAY'>('NON_WORKING_DAY');
  const [exDesc, setExDesc] = useState('');

  // Sync form with loaded calendar
  useEffect(() => {
    if (calendar) {
      setWorkingDays(calendar.workingDays);
      setWorkStart(calendar.workStartTime ?? '08:00');
      setWorkEnd(calendar.workEndTime ?? '17:00');
    }
  }, [calendar]);

  const toggleDay = (day: number) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const onSaveCalendar = async () => {
    try {
      await updateCalendar({
        orgId: orgId!, projectId: projectId!,
        input: { workingDays, workStartTime: workStart, workEndTime: workEnd },
      }).unwrap();
      toastOk('Calendar saved', '');
    } catch (err) {
      toastErr('Save failed', toastErrorMessage(err as never));
    }
  };

  const onAddException = async () => {
    if (!exDate) { toastErr('Date required', ''); return; }
    try {
      await addException({
        orgId: orgId!, projectId: projectId!,
        input: { date: exDate, exceptionType: exType, description: exDesc || undefined },
      }).unwrap();
      toastOk('Exception added', '');
      setExDate(''); setExType('NON_WORKING_DAY'); setExDesc(''); setShowAddEx(false);
    } catch (err) {
      toastErr('Add failed', toastErrorMessage(err as never));
    }
  };

  const onRemoveException = async (exceptionId: string) => {
    try {
      await removeException({ orgId: orgId!, projectId: projectId!, exceptionId }).unwrap();
      toastOk('Exception removed', '');
    } catch (err) {
      toastErr('Remove failed', toastErrorMessage(err as never));
    }
  };

  const onRecalculate = async () => {
    try {
      await recalculate({ orgId: orgId!, projectId: projectId! }).unwrap();
      toastOk('Schedule recalculated', 'Task dates have been updated.');
    } catch (err) {
      toastErr('Recalculate failed', toastErrorMessage(err as never));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 sm:p-8 space-y-3">
        {[1, 2].map((i) => <div key={i} className="h-20 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />)}
      </div>
    );
  }

  const exceptions = calendar?.exceptions ?? [];

  return (
    <div className="p-6 sm:p-8 max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Project calendar</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Working days, hours, and exception dates for CPM calculation</p>
        </div>
        {canRecalc && (
          <button type="button" onClick={onRecalculate} disabled={recalculating}
            className="inline-flex items-center gap-2 min-h-9 border border-[var(--hairline-2)] px-4 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} strokeWidth={1.8} />
            {recalculating ? 'Recalculating…' : 'Recalculate schedule'}
          </button>
        )}
      </div>

      {/* Working days */}
      <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Working days</p>

        <div className="flex gap-2">
          {DAY_LABELS.map((label, day) => (
            <button
              key={day}
              type="button"
              disabled={!canManage}
              onClick={() => toggleDay(day)}
              className={`flex-1 py-2 font-mono text-[9px] uppercase tracking-[0.12em] border transition-colors ${
                workingDays.includes(day)
                  ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                  : 'border-[var(--hairline-2)] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]'
              } disabled:cursor-not-allowed`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Work start</label>
            <input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)}
              disabled={!canManage} className={inputCls()} />
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Work end</label>
            <input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)}
              disabled={!canManage} className={inputCls()} />
          </div>
        </div>

        {canManage && (
          <button onClick={onSaveCalendar} disabled={saving}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save working days'}
          </button>
        )}
      </div>

      {/* Exceptions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Exception dates
          </p>
          {canManage && !showAddEx && (
            <button type="button" onClick={() => setShowAddEx(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-[var(--hairline-2)] px-3 py-1.5 hover:bg-[var(--surface-2)] transition-colors">
              <Plus className="h-3 w-3" strokeWidth={2} /> Add exception
            </button>
          )}
        </div>

        {showAddEx && (
          <div className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-4 space-y-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">New exception</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Date *</label>
                <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className={inputCls()} />
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Type</label>
                <select value={exType} onChange={(e) => setExType(e.target.value as any)} className={inputCls()}>
                  <option value="NON_WORKING_DAY">Non-working day</option>
                  <option value="WORKING_DAY">Working day</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Description</label>
                <input type="text" value={exDesc} onChange={(e) => setExDesc(e.target.value)}
                  placeholder="e.g. Eid holiday" className={inputCls()} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onAddException} disabled={addingEx}
                className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
                {addingEx ? 'Adding…' : 'Add'}
              </button>
              <button type="button" onClick={() => setShowAddEx(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
            </div>
          </div>
        )}

        <div className="border border-[var(--hairline-2)]">
          {/* Header */}
          <div className="grid grid-cols-[120px_140px_1fr_36px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Date', 'Type', 'Description', ''].map((h) => (
              <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
            ))}
          </div>

          {exceptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-[var(--paper)]">
              <CalendarDays className="h-8 w-8 text-[var(--muted)] mb-2" strokeWidth={1.5} />
              <p className="text-sm text-[var(--muted)]">No exception dates defined.</p>
            </div>
          ) : (
            exceptions
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((ex) => (
                <div key={ex.id} className="grid grid-cols-[120px_140px_1fr_36px] gap-4 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                  <p className="font-mono text-[10px]">{ex.date}</p>
                  <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${
                    ex.exceptionType === 'NON_WORKING_DAY'
                      ? 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]'
                      : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]'
                  }`}>
                    {ex.exceptionType === 'NON_WORKING_DAY' ? 'Holiday' : 'Working'}
                  </span>
                  <p className="text-sm text-[var(--muted)] truncate">{ex.description ?? '—'}</p>
                  {canManage && (
                    <button type="button" onClick={() => onRemoveException(ex.id)}
                      className="p-1 text-[var(--muted)] hover:text-[#991b1b] transition-colors">
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  )}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
