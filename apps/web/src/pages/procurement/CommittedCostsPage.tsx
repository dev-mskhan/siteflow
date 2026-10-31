/**
 * CommittedCostsPage — /org/:orgId/projects/:projectId/procurement/committed
 * Read-only ledger of committed costs. System-managed via PO approval/cancellation.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { DollarSign } from 'lucide-react';
import { useListCommittedCostsQuery } from '../../api/procurementApi';
import { useListSuppliersQuery } from '../../features/supplier/supplierApi';
import type { CommittedCostStatus } from '../../types/procurementTypes';

const STATUS_BADGE: Record<CommittedCostStatus, string> = {
  ACTIVE:    'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  RELEASED:  'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  CANCELLED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

const LIFECYCLE_BADGE: Record<string, string> = {
  APPROVED:          'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  PARTIALLY_INVOICED:'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  FULLY_INVOICED:    'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  CLOSED:            'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  CANCELLED:         'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
};

const FILTERS = ['ALL', 'ACTIVE', 'RELEASED', 'CANCELLED'] as const;

export const CommittedCostsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const [filter, setFilter] = useState<typeof FILTERS[number]>('ALL');

  const { data, isLoading } = useListCommittedCostsQuery({ orgId: orgId!, projectId: projectId! });
  const { data: suppliersData } = useListSuppliersQuery({ orgId: orgId! });

  const all = data ?? [];
  const rows = filter === 'ALL' ? all : all.filter((c) => c.status === filter);
  const suppliersById = new Map((suppliersData?.data ?? []).map((supplier) => [supplier.id, supplier]));

  const totalActive = all
    .filter((c) => c.status === 'ACTIVE')
    .reduce((sum, c) => sum + parseFloat(c.committedAmount), 0);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Committed costs</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            System-managed — created on PO approval, released on cancellation
          </p>
        </div>
        {all.length > 0 && (
          <div className="border border-[var(--hairline-2)] bg-[var(--paper)] px-5 py-3 text-right">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Total active commitment</p>
            <p className="text-xl font-medium tracking-[-0.03em] mt-0.5">
              PKR {totalActive.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[2fr_90px_110px_110px_110px_100px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Source PO', 'Status', 'Lifecycle', 'Committed', 'Currency', 'Committed at'].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>
        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <DollarSign className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No committed costs yet.</p>
            <p className="text-xs text-[var(--muted)] mt-1">Entries appear automatically when a PO is approved.</p>
          </div>
        ) : (
          rows.map((cc) => (
            <div key={cc.id} className="grid grid-cols-[2fr_90px_110px_110px_110px_100px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
              <div>
                <p className="font-mono text-[10px] text-[var(--muted)]">{cc.purchaseOrderId}</p>
                {cc.supplierId && <p className="text-xs text-[var(--muted)] mt-0.5">{suppliersById.get(cc.supplierId)?.displayName ?? cc.supplierId}</p>}
              </div>
              <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[cc.status]}`}>{cc.status}</span>
              <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${LIFECYCLE_BADGE[cc.lifecycleStatus]}`}>{cc.lifecycleStatus}</span>
              <p className="font-mono text-[11px] font-medium">{parseFloat(cc.committedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{cc.currencyCode}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">
                {new Date(cc.committedAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
