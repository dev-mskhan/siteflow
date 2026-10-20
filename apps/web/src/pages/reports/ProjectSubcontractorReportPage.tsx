import React from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useGetSubcontractorReportQuery } from '../../api/reportApi';

export const ProjectSubcontractorReportPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading, refetch, isFetching } = useGetSubcontractorReportQuery({ orgId: orgId!, projectId: projectId! });
  if (isLoading) return <div className="p-8"><div className="h-40 animate-pulse bg-[var(--surface-2)]" /></div>;
  if (!data) return null;
  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-lg font-medium tracking-[-0.03em]">Subcontractor performance</h2><p className="text-sm text-[var(--muted)] mt-0.5">Generated {new Date(data.generatedAt).toLocaleString()}</p></div>
        <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} />Refresh</button>
      </div>
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[2fr_80px_80px_80px_80px_80px_120px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Subcontractor','Tasks','Done','Late','Late del.','Rejections','On-time rate'].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{h}</p>)}
        </div>
        {data.subcontractors.map((sc) => (
          <div key={sc.subcontractorId} className="grid grid-cols-[2fr_80px_80px_80px_80px_80px_120px] gap-3 items-center px-4 py-4 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
            <div><p className="text-sm font-medium">{sc.displayName}</p>{sc.trade && <p className="font-mono text-[9px] text-[var(--muted)]">{sc.trade}</p>}</div>
            <p className="font-mono text-[10px]">{sc.assignedTaskCount}</p>
            <p className="font-mono text-[10px]">{sc.completedTaskCount}</p>
            <p className={`font-mono text-[10px] ${sc.lateTaskCount > 0 ? 'text-[#991b1b]' : 'text-[var(--muted)]'}`}>{sc.lateTaskCount}</p>
            <p className={`font-mono text-[10px] ${sc.lateDeliveryCount > 0 ? 'text-[#92400e]' : 'text-[var(--muted)]'}`}>{sc.lateDeliveryCount}</p>
            <p className={`font-mono text-[10px] ${sc.receiptRejectionCount > 0 ? 'text-[#991b1b]' : 'text-[var(--muted)]'}`}>{sc.receiptRejectionCount}</p>
            <div>
              {sc.onTimeRate != null ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[var(--surface-2)] overflow-hidden"><div className="h-full bg-[var(--ink)]" style={{ width: `${sc.onTimeRate * 100}%` }} /></div>
                  <span className="font-mono text-[9px] text-[var(--muted)] w-8 text-right">{Math.round(sc.onTimeRate * 100)}%</span>
                </div>
              ) : <p className="font-mono text-[9px] text-[var(--muted)]">—</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
