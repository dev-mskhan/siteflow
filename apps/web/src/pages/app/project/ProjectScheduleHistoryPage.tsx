/**
 * ProjectScheduleHistoryPage — /org/:orgId/projects/:projectId/schedule-history
 * Backend: GET /:orgId/projects/:projectId/schedule/history  (optional taskId filter)
 * Shows the full schedule change log — who changed what task dates and when.
 */
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { History, RefreshCw } from 'lucide-react';
import { useListScheduleHistoryQuery } from '../../../features/project/scheduleApi';
import { useListTasksQuery } from '../../../features/project/taskApi';

function formatDates(start: string | null, finish: string | null): string {
  const values = [
    start ? `Start ${start}` : null,
    finish ? `Finish ${finish}` : null,
  ].filter((value): value is string => value !== null);
  return values.length ? values.join(' · ') : '—';
}

export const ProjectScheduleHistoryPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const [filterTask, setFilterTask] = useState('');

  const {
    data: entries = [],
    isLoading,
    isError,
    refetch,
  } = useListScheduleHistoryQuery({ orgId: orgId!, projectId: projectId! });
  const { data: tasksData } = useListTasksQuery({ orgId: orgId!, projectId: projectId! });
  const taskNames = useMemo(
    () => new Map((tasksData?.tasks ?? []).map((task) => [task.id, task.name])),
    [tasksData?.tasks],
  );

  const filtered = filterTask.trim()
    ? entries.filter((entry) => {
        const taskName = taskNames.get(entry.taskId) ?? entry.taskId;
        const filter = filterTask.trim().toLowerCase();
        return taskName.toLowerCase().includes(filter) || entry.taskId.toLowerCase().includes(filter);
      })
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

      {isError ? (
        <div role="alert" className="flex items-center justify-between gap-4 border border-[#fecaca] bg-[var(--paper)] p-4">
          <p className="text-sm text-[#991b1b]">Schedule history could not be loaded.</p>
          <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] hover:opacity-70"
          >
              <RefreshCw className="h-4 w-4" />
              Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="h-32 animate-pulse border border-[var(--hairline-2)] bg-[var(--surface-2)]" />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-[var(--hairline-2)] bg-[var(--paper)]">
          <History className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">
              {filterTask.trim() ? 'No schedule changes match this task.' : 'No schedule changes recorded.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--hairline-2)]">
          <div className="min-w-[48rem]">
              <div className="grid grid-cols-[120px_2fr_130px_1.5fr_1.5fr_110px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
                {['Date', 'Task', 'Source', 'Previous dates', 'Current dates', 'Actor ID'].map((h) => (
                <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>
                ))}
              </div>
              {filtered.map((entry) => (
                <div key={entry.id} className="grid grid-cols-[120px_2fr_130px_1.5fr_1.5fr_110px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
                  <p className="font-mono text-[9px] text-[var(--muted)]">
                    {new Date(entry.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <div className="min-w-0">
                    <p className="text-sm truncate">{taskNames.get(entry.taskId) ?? entry.taskId}</p>
                    {entry.reason && <p className="font-mono text-[9px] text-[var(--muted)] truncate">{entry.reason}</p>}
                  </div>
                  <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{entry.sourceType.replace(/_/g, ' ')}</p>
                  <p className="font-mono text-[10px] text-[var(--muted)]">{formatDates(entry.oldStartDate, entry.oldFinishDate)}</p>
                  <p className="font-mono text-[10px] font-medium text-[var(--ink)]">{formatDates(entry.newStartDate, entry.newFinishDate)}</p>
                  <p className="font-mono text-[9px] text-[var(--muted)] truncate">
                    {entry.actorUserId ? entry.actorUserId.slice(0, 8) : 'System'}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
