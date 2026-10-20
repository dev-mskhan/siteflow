/**
 * ProjectScheduleHistoryPage — /org/:orgId/projects/:projectId/schedule-history
 * Backend: GET /:orgId/projects/:projectId/schedule/history  (optional taskId filter)
 * Shows the full schedule change log — who changed what task dates and when.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { History } from 'lucide-react';

interface ScheduleHistoryEntry {
  id: string;
  taskId: string;
  taskName: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: string;
  reason: string | null;
}

const MOCK_HISTORY: ScheduleHistoryEntry[] = [
  { id: 'sh_01', taskId: 'task_01', taskName: 'Site mobilisation', field: 'currentStartDate', oldValue: '2024-01-20', newValue: '2024-01-20', changedBy: 'Tariq Mehmood', changedAt: '2024-01-15T09:00:00.000Z', reason: 'Initial scheduling' },
  { id: 'sh_02', taskId: 'task_05', taskName: 'Superstructure Level 1', field: 'currentFinishDate', oldValue: '2024-06-30', newValue: '2024-07-14', changedBy: 'Tariq Mehmood', changedAt: '2024-06-01T10:00:00.000Z', reason: 'Weather delay — 14 days variance' },
  { id: 'sh_03', taskId: 'task_08', taskName: 'MEP Rough-in', field: 'currentStartDate', oldValue: '2024-07-01', newValue: '2024-07-15', changedBy: 'Tariq Mehmood', changedAt: '2024-06-28T14:00:00.000Z', reason: 'Dependency shift from superstructure' },
  { id: 'sh_04', taskId: 'task_03', taskName: 'Foundation pour', field: 'progressPercent', oldValue: '50', newValue: '100', changedBy: 'Tariq Mehmood', changedAt: '2024-03-28T16:00:00.000Z', reason: null },
  { id: 'sh_05', taskId: 'task_05', taskName: 'Superstructure Level 1', field: 'currentDurationDays', oldValue: '30', newValue: '44', changedBy: 'Tariq Mehmood', changedAt: '2024-06-01T10:00:00.000Z', reason: 'Weather delay extension' },
];

export const ProjectScheduleHistoryPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [filterTask, setFilterTask] = useState('');

  const entries = MOCK_HISTORY; // In mock mode, all entries belong to proj_01

  const filtered = filterTask.trim()
    ? entries.filter((e) => e.taskName.toLowerCase().includes(filterTask.toLowerCase()) || e.taskId.includes(filterTask.trim()))
    : entries;

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Schedule history</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{filtered.length} change{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={filterTask}
          onChange={(e) => setFilterTask(e.target.value)}
          placeholder="Filter by task name or ID…"
          className="w-full max-w-sm border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-[var(--hairline-2)] bg-[var(--paper)]">
          <History className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">No schedule changes recorded.</p>
        </div>
      ) : (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[120px_2fr_110px_100px_100px_100px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Date', 'Task', 'Field', 'Old', 'New', 'By'].map((h) => (
              <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>
            ))}
          </div>
          {filtered.map((h) => (
            <div key={h.id} className="grid grid-cols-[120px_2fr_110px_100px_100px_100px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <p className="font-mono text-[9px] text-[var(--muted)]">
                {new Date(h.changedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <div className="min-w-0">
                <p className="text-sm truncate">{h.taskName}</p>
                {h.reason && <p className="font-mono text-[9px] text-[var(--muted)] truncate">{h.reason}</p>}
              </div>
              <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{h.field}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{h.oldValue ?? '—'}</p>
              <p className="font-mono text-[10px] font-medium text-[var(--ink)]">{h.newValue ?? '—'}</p>
              <p className="font-mono text-[9px] text-[var(--muted)] truncate">{h.changedBy}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
