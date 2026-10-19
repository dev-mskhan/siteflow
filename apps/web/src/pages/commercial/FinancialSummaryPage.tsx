/**
 * FinancialSummaryPage — /org/:orgId/projects/:projectId/commercial/financial-summary
 *
 * Backend: financial-summary.routes.ts (read-only)
 * Tabs: Cost | Commitments | Billing | Cash | Audit
 * Audit: cursor-paginated (GET /financial-audit?cursor=&limit=20)
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, BarChart3 } from 'lucide-react';
import {
  useGetFinancialSummaryQuery,
  useGetFinancialAuditQuery,
} from '../../api/commercialApi';
import { cn } from '../../lib/cn';

type Tab = 'cost' | 'commitments' | 'billing' | 'cash' | 'audit';

const SummaryRow: React.FC<{ label: string; value: string; highlight?: boolean; danger?: boolean }> = ({
  label, value, highlight, danger,
}) => (
  <div className="flex items-center justify-between py-2.5 border-b border-[var(--hairline-2)] last:border-b-0">
    <p className={cn('text-sm', highlight && 'font-medium')}>{label}</p>
    <p className={cn('font-mono text-[11px]', highlight && 'font-medium', danger && 'text-[#991b1b]')}>
      {parseFloat(value).toLocaleString()}
    </p>
  </div>
);

export const FinancialSummaryPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('billing');

  const { data: summary, isLoading, refetch, isFetching } = useGetFinancialSummaryQuery({ orgId: orgId!, projectId: projectId! });
  const { data: auditData, isLoading: auditLoading } = useGetFinancialAuditQuery(
    { orgId: orgId!, projectId: projectId!, limit: 20 },
    { skip: activeTab !== 'audit' },
  );

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: 'billing', label: 'Billing' },
    { key: 'cost', label: 'Cost' },
    { key: 'commitments', label: 'Commitments' },
    { key: 'cash', label: 'Cash' },
    { key: 'audit', label: 'Audit log' },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Financial summary</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Cost, commitments, billing, cash, and audit trail</p>
        </div>
        <button type="button" onClick={() => refetch()} disabled={isFetching}
          className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} />
          Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        {TABS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 transition-colors ${activeTab === key ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        [1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse bg-[var(--surface-2)] mb-2 border border-[var(--hairline-2)]" />)
      ) : !summary ? (
        <div className="py-16 text-center">
          <BarChart3 className="h-10 w-10 text-[var(--muted)] mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">No financial data available.</p>
        </div>
      ) : (
        <>
          {/* BILLING */}
          {activeTab === 'billing' && summary.billing.map((b) => (
            <div key={b.currencyCode} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-4">{b.currencyCode} — Billing</p>
              <SummaryRow label="Contract amount"        value={b.contractAmount} />
              <SummaryRow label="Approved changes"       value={b.approvedChanges} />
              <SummaryRow label="Revised contract"       value={b.revisedContractAmount} highlight />
              <SummaryRow label="Total billed"           value={b.totalBilled} />
              <SummaryRow label="Total approved"         value={b.totalApproved} />
              <SummaryRow label="Outstanding"            value={b.totalOutstanding} danger={parseFloat(b.totalOutstanding) > 0} highlight />
              <div className="mt-4 pt-4 border-t border-[var(--hairline-2)]">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-2">Retainage</p>
                <SummaryRow label="Held"     value={b.retainageHeld} />
                <SummaryRow label="Released" value={b.retainageReleased} />
                <SummaryRow label="Net"      value={b.netRetainage} highlight />
              </div>
            </div>
          ))}

          {/* COST */}
          {activeTab === 'cost' && summary.cost.map((c) => (
            <div key={c.currencyCode} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-4">{c.currencyCode} — Cost</p>
              <SummaryRow label="Direct cost"   value={c.directCost} />
              <SummaryRow label="Overhead"      value={c.overhead} />
              <SummaryRow label="Contingency"   value={c.contingency} />
              <SummaryRow label="Total cost"    value={c.totalCost} highlight />
              {c.forecastCost && <SummaryRow label="Forecast cost" value={c.forecastCost} />}
              <div className="mt-3 pt-3 border-t border-[var(--hairline-2)]">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
                  Forecast coverage: {c.documentedForecastCoverage.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
          ))}

          {/* COMMITMENTS */}
          {activeTab === 'commitments' && summary.commitments.map((c) => (
            <div key={c.currencyCode} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-4">{c.currencyCode} — Commitments</p>
              <SummaryRow label="Approved PO total"    value={c.approvedPOTotal} />
              <SummaryRow label="Subcontract total"    value={c.subcontractTotal} />
              <SummaryRow label="Total committed"      value={c.totalCommitted} highlight />
            </div>
          ))}

          {/* CASH */}
          {activeTab === 'cash' && summary.cash.map((c) => (
            <div key={c.currencyCode} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-4">{c.currencyCode} — Cash</p>
              <SummaryRow label="Total received" value={c.totalReceived} />
              <SummaryRow label="Total paid"     value={c.totalPaid} />
              <SummaryRow label="Net cash"       value={c.netCash} highlight danger={parseFloat(c.netCash) < 0} />
            </div>
          ))}

          {/* AUDIT */}
          {activeTab === 'audit' && (
            <div className="border border-[var(--hairline-2)]">
              <div className="grid grid-cols-[130px_100px_100px_2fr_100px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
                {['Date', 'Entity type', 'Action', 'Details', 'Actor'].map((h) => (
                  <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>
                ))}
              </div>
              {auditLoading ? (
                [1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
              ) : (auditData?.events ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 bg-[var(--paper)]">
                  <p className="text-sm text-[var(--muted)]">No audit events yet.</p>
                </div>
              ) : (auditData?.events ?? []).map((ev) => (
                <div key={ev.id} className="grid grid-cols-[130px_100px_100px_2fr_100px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                  <p className="font-mono text-[9px] text-[var(--muted)]">
                    {new Date(ev.occurredAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{ev.entityType}</p>
                  <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{ev.action}</p>
                  <p className="text-sm truncate text-[var(--muted)]">
                    {Object.entries(ev.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                  <p className="font-mono text-[9px] text-[var(--muted)] truncate">{ev.actorName ?? ev.actorId}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
