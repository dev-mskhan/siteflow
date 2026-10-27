/**
 * CommercialSummaryPage — /org/:orgId/projects/:projectId/commercial/commercial-summary
 *
 * Backend: commercial-summary.routes.ts (read-only GET)
 * Response: { currencyBreakdown[], forecastBasis, forecastUnavailableReason,
 *             commitmentCoverage, subcontractCommitments, invoiceLifecycleCoverage }
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { useGetCommercialSummaryQuery } from '../../features/project/commercialApi';

const MoneyCell: React.FC<{ value: string | null; highlight?: boolean }> = ({ value, highlight }) => (
  <p className={`font-mono text-[11px] ${highlight ? 'font-medium' : ''} ${value === null ? 'text-[var(--muted)]' : ''}`}>
    {value !== null ? parseFloat(value).toLocaleString() : '—'}
  </p>
);

export const CommercialSummaryPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading, refetch, isFetching } = useGetCommercialSummaryQuery({ orgId: orgId!, projectId: projectId! });

  if (isLoading) {
    return (
      <div className="p-8">
        {[1, 2].map((i) => <div key={i} className="h-14 animate-pulse bg-[var(--surface-2)] mb-3 border border-[var(--hairline-2)]" />)}
      </div>
    );
  }

  const summary = data;

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Commercial summary</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Budget, commitments, and posted actuals by currency</p>
        </div>
        <button type="button" onClick={() => refetch()} disabled={isFetching}
          className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} />
          Refresh
        </button>
      </div>

      {summary ? (
        <>
          {/* Currency breakdown table */}
          <div className="border border-[var(--hairline-2)] mb-6">
            <div className="grid grid-cols-[80px_110px_120px_120px_110px_110px_110px_110px] gap-2 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
              {['CCY', 'Original budget', 'Approved changes', 'Revised budget', 'Committed', 'Posted actual', 'Forecast', 'Variance'].map((h) => (
                <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>
              ))}
            </div>
            {summary.currencyBreakdown.map((row) => {
              const variance = row.variance ? parseFloat(row.variance) : null;
              return (
                <div key={row.currencyCode} className="grid grid-cols-[80px_110px_120px_120px_110px_110px_110px_110px] gap-2 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                  <p className="font-mono text-[10px] font-medium">{row.currencyCode}</p>
                  <MoneyCell value={row.originalBudget} />
                  <MoneyCell value={row.approvedBudgetChanges} />
                  <MoneyCell value={row.revisedBudget} highlight />
                  <MoneyCell value={row.committed} />
                  <MoneyCell value={row.postedActual} />
                  <MoneyCell value={row.forecast} />
                  <p className={`font-mono text-[11px] ${variance !== null && variance < 0 ? 'text-[#991b1b] font-medium' : variance !== null && variance > 0 ? 'text-[#166534]' : 'text-[var(--muted)]'}`}>
                    {variance !== null ? variance.toLocaleString() : '—'}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Metadata strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-4">
            {[
              { label: 'Commitment coverage', value: summary.commitmentCoverage.replace(/_/g, ' ') },
              { label: 'Subcontract commitments', value: `PKR ${parseFloat(summary.subcontractCommitments).toLocaleString()}` },
              { label: 'Invoice lifecycle', value: summary.invoiceLifecycleCoverage.replace(/_/g, ' ') },
            ].map(({ label, value }) => (
              <div key={label} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">{label}</p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>

          {/* Forecast notice */}
          {summary.forecastUnavailableReason && (
            <div className="flex items-start gap-2 border border-[#fde68a] bg-[#fffbeb] px-4 py-3">
              <TrendingUp className="h-4 w-4 text-[#92400e] mt-0.5 shrink-0" strokeWidth={1.75} />
              <p className="text-sm text-[#92400e]">
                Forecast unavailable: {summary.forecastUnavailableReason}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="py-16 text-center">
          <TrendingUp className="h-10 w-10 text-[var(--muted)] mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">No commercial summary data available.</p>
        </div>
      )}
    </div>
  );
};
