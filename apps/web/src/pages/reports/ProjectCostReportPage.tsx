import React from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useGetCostReportQuery } from '../../api/reportApi';

export const ProjectCostReportPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading, refetch, isFetching } = useGetCostReportQuery({ orgId: orgId!, projectId: projectId! });
  if (isLoading) return <div className="p-8"><div className="h-40 animate-pulse bg-[var(--surface-2)]" /></div>;
  if (!data) return null;
  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-lg font-medium tracking-[-0.03em]">Cost report</h2><p className="text-sm text-[var(--muted)] mt-0.5">Generated {new Date(data.generatedAt).toLocaleString()}</p></div>
        <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} />Refresh</button>
      </div>
      {data.costPerformanceIndex != null && (
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 mb-4 flex items-center justify-between">
          <div><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Cost Performance Index (CPI)</p><p className="font-mono text-2xl font-medium">{data.costPerformanceIndex.toFixed(2)}</p></div>
          <p className="font-mono text-sm text-[var(--muted)]">{data.costPerformanceIndex >= 1 ? 'Under or on budget' : 'Over budget'}</p>
        </div>
      )}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[80px_110px_120px_120px_110px_110px_110px_110px] gap-2 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['CCY','Original budget','Approved changes','Revised budget','Committed','Posted actual','Forecast','Variance'].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{h}</p>)}
        </div>
        {data.currencyBreakdown.map((r) => {
          const variance = r.variance ? parseFloat(r.variance) : null;
          return (
            <div key={r.currencyCode} className="grid grid-cols-[80px_110px_120px_120px_110px_110px_110px_110px] gap-2 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
              <p className="font-mono text-[10px] font-medium">{r.currencyCode}</p>
              <p className="font-mono text-[10px]">{parseFloat(r.originalBudget).toLocaleString()}</p>
              <p className="font-mono text-[10px]">{parseFloat(r.approvedBudgetChanges).toLocaleString()}</p>
              <p className="font-mono text-[10px] font-medium">{parseFloat(r.revisedBudget).toLocaleString()}</p>
              <p className="font-mono text-[10px]">{parseFloat(r.committed).toLocaleString()}</p>
              <p className="font-mono text-[10px]">{parseFloat(r.postedActual).toLocaleString()}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{r.forecast ? parseFloat(r.forecast).toLocaleString() : '—'}</p>
              <p className={`font-mono text-[10px] ${variance != null && variance < 0 ? 'text-[#991b1b] font-medium' : variance != null && variance > 0 ? 'text-[#166534]' : 'text-[var(--muted)]'}`}>{variance != null ? variance.toLocaleString() : '—'}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
