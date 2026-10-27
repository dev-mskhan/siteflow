/**
 * PortfolioReportPage — /org/:orgId/reports/portfolio
 * Org-level page in AppLayout. Shows all projects with health indicators.
 */
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { useGetPortfolioReportQuery } from '../features/reporting/reportApi';
import type { HealthColor } from '../types/reportTypes';

const HealthDot: React.FC<{ color: HealthColor }> = ({ color }) => {
  const cls = color === 'GREEN' ? 'bg-[#166534]' : color === 'AMBER' ? 'bg-[#92400e]' : color === 'RED' ? 'bg-[#991b1b]' : 'bg-[var(--muted)]';
  return <span className={`h-2.5 w-2.5 rounded-full inline-block ${cls}`} title={color} />;
};

export const PortfolioReportPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate  = useNavigate();
  const { data, isLoading, refetch, isFetching } = useGetPortfolioReportQuery({ orgId: orgId! });

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Portfolio report</h2>
          {data && <p className="text-sm text-[var(--muted)] mt-0.5">Generated {new Date(data.generatedAt).toLocaleString()}</p>}
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} /> Refresh
        </button>
      </div>

      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[2fr_80px_50px_50px_50px_80px_80px_80px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Project','Status','Sched.','Budget','Overall','Tasks done','Issues','RFIs'].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>)}
        </div>

        {isLoading ? [1,2,3].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />) :
        (data?.projects ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <BarChart3 className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No projects found.</p>
          </div>
        ) : (data?.projects ?? []).map((proj) => (
          <div key={proj.id}
            onClick={() => navigate(`/org/${orgId}/projects/${proj.id}/reports/executive`)}
            className="grid grid-cols-[2fr_80px_50px_50px_50px_80px_80px_80px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{proj.name}</p>
              <p className="font-mono text-[9px] text-[var(--muted)]">{proj.projectNumber}</p>
            </div>
            <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{proj.status}</p>
            <div className="flex justify-center"><HealthDot color={proj.scheduleHealth} /></div>
            <div className="flex justify-center"><HealthDot color={proj.budgetHealth} /></div>
            <div className="flex justify-center"><HealthDot color={proj.overallHealth} /></div>
            <p className="font-mono text-[10px]">{proj.taskStats.completed}/{proj.taskStats.total}</p>
            <p className={`font-mono text-[10px] ${proj.openIssues > 0 ? 'text-[#92400e]' : 'text-[var(--muted)]'}`}>{proj.openIssues}</p>
            <p className={`font-mono text-[10px] ${proj.openRFIs > 0 ? 'text-[#92400e]' : 'text-[var(--muted)]'}`}>{proj.openRFIs}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
