import React from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, Printer } from 'lucide-react';
import { useGetExecutiveSummaryQuery } from '../../features/reporting/reportApi';
import type { HealthColor } from '../../types/reportTypes';

const HealthChip: React.FC<{ color: HealthColor }> = ({ color }) => {
  const cls = color === 'GREEN' ? 'bg-[#dcfce7] text-[#166534]' : color === 'AMBER' ? 'bg-[#fffbeb] text-[#92400e]' : color === 'RED' ? 'bg-[#fef2f2] text-[#991b1b]' : 'bg-[var(--surface-2)] text-[var(--muted)]';
  return <span className={`font-mono text-[9px] uppercase px-2 py-0.5 ${cls}`}>{color}</span>;
};

export const ProjectExecutiveReportPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading, refetch, isFetching } = useGetExecutiveSummaryQuery({ orgId: orgId!, projectId: projectId! });
  if (isLoading) return <div className="p-8"><div className="h-40 animate-pulse bg-[var(--surface-2)]" /></div>;
  if (!data) return null;
  const { health: h, schedule: s, cost: c, procurement: p } = data;
  return (
    <div className="p-6 sm:p-8 max-w-4xl print:p-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div><h2 className="text-lg font-medium tracking-[-0.03em]">Executive summary</h2><p className="text-sm text-[var(--muted)] mt-0.5">Generated {new Date(data.generatedAt).toLocaleString()}</p></div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]"><Printer className="h-3.5 w-3.5" strokeWidth={2} />Print</button>
          <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} />Refresh</button>
        </div>
      </div>

      <div className="space-y-5">
        {/* Health */}
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">Project health</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">Schedule</p><HealthChip color={h.scheduleHealth} /></div>
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">Budget</p><HealthChip color={h.budgetHealth} /></div>
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">Open issues</p><p className="font-mono text-lg font-medium">{h.openIssues}</p></div>
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">Open RFIs</p><p className="font-mono text-lg font-medium">{h.openRFIs}</p></div>
          </div>
        </div>

        {/* Schedule */}
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">Schedule</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">SPI</p><p className="font-mono text-lg font-medium">{s.schedulePerformanceIndex?.toFixed(2) ?? '—'}</p></div>
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">Completed tasks</p><p className="font-mono text-lg font-medium">{s.taskStats.completed} / {s.taskStats.total}</p></div>
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">Overdue</p><p className={`font-mono text-lg font-medium ${s.taskStats.overdue > 0 ? 'text-[#991b1b]' : ''}`}>{s.taskStats.overdue}</p></div>
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">End variance</p><p className={`font-mono text-lg font-medium ${(s.baselineComparison.endVarianceDays ?? 0) > 0 ? 'text-[#991b1b]' : 'text-[#166534]'}`}>{s.baselineComparison.endVarianceDays != null ? `${s.baselineComparison.endVarianceDays > 0 ? '+' : ''}${s.baselineComparison.endVarianceDays}d` : '—'}</p></div>
          </div>
        </div>

        {/* Cost */}
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">Cost</p>
          {c.currencyBreakdown.map((r) => (
            <div key={r.currencyCode} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">Original budget</p><p className="font-mono text-sm font-medium">{r.currencyCode} {parseFloat(r.originalBudget).toLocaleString()}</p></div>
              <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">Revised budget</p><p className="font-mono text-sm font-medium">{parseFloat(r.revisedBudget).toLocaleString()}</p></div>
              <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">Posted actual</p><p className="font-mono text-sm font-medium">{parseFloat(r.postedActual).toLocaleString()}</p></div>
              <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">CPI</p><p className="font-mono text-sm font-medium">{c.costPerformanceIndex?.toFixed(2) ?? '—'}</p></div>
            </div>
          ))}
        </div>

        {/* Procurement */}
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">Procurement</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">MRs</p><p className="font-mono text-lg">{p.materialRequests.total}</p></div>
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">POs</p><p className="font-mono text-lg">{p.purchaseOrders.total}</p></div>
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">Deliveries</p><p className="font-mono text-lg">{p.deliveries.total}</p></div>
            <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-1">Committed</p><p className="font-mono text-sm font-medium">PKR {parseFloat(p.purchaseOrders.totalCommittedAmount).toLocaleString()}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};
