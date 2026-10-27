import React from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useGetScheduleReportQuery } from '../../features/reporting/reportApi';

export const ProjectScheduleReportPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading, refetch, isFetching } = useGetScheduleReportQuery({ orgId: orgId!, projectId: projectId! });
  if (isLoading) return <div className="p-8"><div className="h-40 animate-pulse bg-[var(--surface-2)]" /></div>;
  if (!data) return null;
  const { baselineComparison: bc, taskStats: ts } = data;
  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-lg font-medium tracking-[-0.03em]">Schedule report</h2><p className="text-sm text-[var(--muted)] mt-0.5">Generated {new Date(data.generatedAt).toLocaleString()}</p></div>
        <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} />Refresh</button>
      </div>
      {/* SPI */}
      {data.schedulePerformanceIndex != null && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 mb-4 flex items-center justify-between">
          <div><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Schedule Performance Index (SPI)</p><p className="font-mono text-2xl font-medium">{data.schedulePerformanceIndex.toFixed(2)}</p></div>
          <p className="font-mono text-sm text-[var(--muted)]">{data.schedulePerformanceIndex >= 1 ? 'On or ahead of schedule' : 'Behind schedule'}</p>
        </div>
      )}
      {/* Baseline comparison */}
      {bc.baselineName && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">Baseline: {bc.baselineName}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Planned start', value: bc.plannedStartDate },
              { label: 'Planned end',   value: bc.plannedEndDate },
              { label: 'Current end',   value: bc.currentEndDate },
              { label: 'End variance',  value: bc.endVarianceDays != null ? `${bc.endVarianceDays > 0 ? '+' : ''}${bc.endVarianceDays} days` : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-0.5">{label}</p>
                <p className="text-sm font-medium">{value ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Milestones */}
      {data.milestones.length > 0 && (
        <div className="border border-[var(--hairline-2)]">
          <div className="px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Milestones</p></div>
          <div className="grid grid-cols-[2fr_100px_100px_90px_100px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Name', 'Planned', 'Current', 'Status', 'Variance'].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>)}
          </div>
          {data.milestones.map((m) => (
            <div key={m.id} className="grid grid-cols-[2fr_100px_100px_90px_100px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
              <p className="text-sm">{m.name}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{m.plannedDate ?? '—'}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{m.currentDate ?? '—'}</p>
              <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{m.status}</p>
              <p className={`font-mono text-[10px] ${m.varianceDays != null && m.varianceDays > 0 ? 'text-[#991b1b]' : m.varianceDays != null && m.varianceDays < 0 ? 'text-[#166534]' : 'text-[var(--muted)]'}`}>
                {m.varianceDays != null ? `${m.varianceDays > 0 ? '+' : ''}${m.varianceDays}d` : '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
