import React from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useGetProcurementReportQuery } from '../../features/reporting/reportApi';

export const ProjectProcurementReportPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading, refetch, isFetching } = useGetProcurementReportQuery({ orgId: orgId!, projectId: projectId! });
  if (isLoading) return <div className="p-8"><div className="h-40 animate-pulse bg-[var(--surface-2)]" /></div>;
  if (!data) return null;
  const mr = data.materialRequests ?? { total: 0, approved: 0, ordered: 0, fulfilled: 0, cancelled: 0 };
  const po = data.purchaseOrders ?? { total: 0, approved: 0, sent: 0, received: 0, totalCommittedAmount: '0' };
  const del = data.deliveries ?? { total: 0, scheduled: 0, delivered: 0, cancelled: 0 };
  const rec = data.receipts ?? { total: 0, posted: 0, voided: 0 };
  const sections = [
    { title: 'Material requests', stats: [['Total', mr.total],['Approved', mr.approved],['Ordered', mr.ordered],['Fulfilled', mr.fulfilled],['Cancelled', mr.cancelled]] },
    { title: 'Purchase orders', stats: [['Total', po.total],['Approved', po.approved],['Sent', po.sent],['Received', po.received],['Committed (PKR)', parseFloat(po.totalCommittedAmount ?? '0').toLocaleString()]] },
    { title: 'Deliveries', stats: [['Total', del.total],['Scheduled', del.scheduled],['Delivered', del.delivered],['Cancelled', del.cancelled]] },
    { title: 'Receipts', stats: [['Total', rec.total],['Posted', rec.posted],['Voided', rec.voided]] },
  ];
  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-lg font-medium tracking-[-0.03em]">Procurement report</h2><p className="text-sm text-[var(--muted)] mt-0.5">Generated {new Date(data.generatedAt).toLocaleString()}</p></div>
        <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} />Refresh</button>
      </div>
      <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 mb-4 flex items-center justify-between">
        <div><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Inventory items</p><p className="font-mono text-2xl font-medium">{data.inventoryItemCount}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {sections.map((s) => (
          <div key={s.title} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">{s.title}</p>
            <div className="space-y-2">
              {s.stats.map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between">
                  <p className="text-sm text-[var(--muted)]">{label}</p>
                  <p className="font-mono text-[11px] font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
