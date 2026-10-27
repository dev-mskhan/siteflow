import React from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useGetHealthReportQuery } from '../../features/reporting/reportApi';
import type { HealthColor } from '../../types/reportTypes';

const HealthDot: React.FC<{ color: HealthColor; label: string }> = ({ color, label }) => {
  const cls = color === 'GREEN' ? 'bg-[#166534]' : color === 'AMBER' ? 'bg-[#92400e]' : color === 'RED' ? 'bg-[#991b1b]' : 'bg-[var(--muted)]';
  return (
    <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 flex items-center gap-4">
      <span className={`h-4 w-4 rounded-full shrink-0 ${cls}`} />
      <div><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-0.5">Health</p><p className="text-sm font-medium">{label}</p></div>
      <p className={`ml-auto font-mono text-[10px] uppercase font-bold ${cls.replace('bg-', 'text-')}`}>{color}</p>
    </div>
  );
};

export const ProjectHealthReportPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading, refetch, isFetching } = useGetHealthReportQuery({ orgId: orgId!, projectId: projectId! });
  if (isLoading) return <div className="p-8"><div className="h-40 animate-pulse bg-[var(--surface-2)]" /></div>;
  if (!data) return null;
  const { taskStats: ts } = data;
  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-lg font-medium tracking-[-0.03em]">Health report</h2><p className="text-sm text-[var(--muted)] mt-0.5">Generated {new Date(data.generatedAt).toLocaleString()}</p></div>
        <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} /> Refresh</button>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <HealthDot color={data.scheduleHealth} label="Schedule" />
        <HealthDot color={data.budgetHealth} label="Budget" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        {[
          { label: 'Total tasks', value: ts.total },
          { label: 'Completed', value: ts.completed },
          { label: 'In progress', value: ts.inProgress },
          { label: 'Overdue', value: ts.overdue },
          { label: 'Blocked', value: ts.blocked ?? 0 },
          { label: 'Open issues', value: data.openIssues },
          { label: 'Open RFIs', value: data.openRFIs },
          { label: 'Open safety events', value: data.openSafetyEvents },
        ].map(({ label, value }) => (
          <div key={label} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">{label}</p>
            <p className="font-mono text-xl font-medium">{value}</p>
          </div>
        ))}
      </div>
      {/* Task completion bar */}
      <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">Task breakdown</p>
        <div className="h-3 w-full flex overflow-hidden">
          {[
            { count: ts.completed, cls: 'bg-[#166534]' },
            { count: ts.inProgress, cls: 'bg-[#1e40af]' },
            { count: ts.overdue, cls: 'bg-[#991b1b]' },
            { count: (ts.notStarted ?? ts.total - ts.completed - ts.inProgress - ts.overdue), cls: 'bg-[var(--surface-2)]' },
          ].map(({ count, cls }, i) => (
            <div key={i} className={cls} style={{ width: `${(count / (ts.total || 1)) * 100}%` }} />
          ))}
        </div>
        <div className="flex items-center gap-6 mt-2">
          {[
            { label: 'Completed', cls: 'bg-[#166534]' },
            { label: 'In progress', cls: 'bg-[#1e40af]' },
            { label: 'Overdue', cls: 'bg-[#991b1b]' },
            { label: 'Not started', cls: 'bg-[var(--surface-2)] border border-[var(--hairline-2)]' },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${cls}`} />
              <p className="font-mono text-[9px] text-[var(--muted)]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
