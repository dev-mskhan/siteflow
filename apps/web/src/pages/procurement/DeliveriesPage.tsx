/**
 * DeliveriesPage — /org/:orgId/projects/:projectId/procurement/deliveries
 * Deliveries list + receipts sub-section. Inline create for both.
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Truck } from 'lucide-react';
import {
  useListDeliveriesQuery,
  useCreateDeliveryMutation,
  useUpdateDeliveryMutation,
  useListReceiptsQuery,
  useCreateReceiptMutation,
  usePostReceiptMutation,
  useVoidReceiptMutation,
} from '../../api/procurementApi';
import { useListPurchaseOrdersQuery } from '../../api/procurementApi';
import { usePermission } from '../../hooks/usePermission';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../../lib/authErrors';
import type { DeliveryStatus, ReceiptStatus } from '../../types/procurementTypes';

const DELIVERY_STATUS_BADGE: Record<DeliveryStatus, string> = {
  SCHEDULED:   'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  IN_TRANSIT:  'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  DELIVERED:   'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  CANCELLED:   'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

const RECEIPT_STATUS_BADGE: Record<ReceiptStatus, string> = {
  DRAFT:  'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  POSTED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  VOIDED: 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
};

const DELIVERY_TRANSITIONS: Array<{ from: DeliveryStatus; to: DeliveryStatus; label: string }> = [
  { from: 'SCHEDULED', to: 'IN_TRANSIT', label: 'Mark in transit' },
  { from: 'IN_TRANSIT', to: 'DELIVERED', label: 'Mark delivered' },
  { from: 'SCHEDULED', to: 'CANCELLED', label: 'Cancel' },
];

export const DeliveriesPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const canCreateDelivery = usePermission('project.delivery.create');
  const canCreateReceipt = usePermission('project.receipt.create');
  const canPostReceipt = usePermission('project.receipt.post');
  const canVoidReceipt = usePermission('project.receipt.void');
  const { success: toastOk, error: toastErr } = useToast();

  const [activeTab, setActiveTab] = useState<'deliveries' | 'receipts'>('deliveries');
  const [showCreateDelivery, setShowCreateDelivery] = useState(false);
  const [showCreateReceipt, setShowCreateReceipt] = useState(false);
  const [dlPoId, setDlPoId] = useState('');
  const [dlScheduledDate, setDlScheduledDate] = useState('');
  const [dlCarrier, setDlCarrier] = useState('');
  const [dlNotes, setDlNotes] = useState('');
  const [rcPoId, setRcPoId] = useState('');
  const [rcReceivedAt, setRcReceivedAt] = useState(new Date().toISOString().split('T')[0]!);
  const [rcNotes, setRcNotes] = useState('');

  const { data: deliveriesData, isLoading: dlLoading } = useListDeliveriesQuery({ orgId: orgId!, projectId: projectId! });
  const { data: receiptsData, isLoading: rcLoading } = useListReceiptsQuery({ orgId: orgId!, projectId: projectId! });
  const { data: posData } = useListPurchaseOrdersQuery({ orgId: orgId!, projectId: projectId! });

  const [createDelivery, { isLoading: creatingDl, error: dlErr }] = useCreateDeliveryMutation();
  const [updateDelivery] = useUpdateDeliveryMutation();
  const [createReceipt, { isLoading: creatingRc, error: rcErr }] = useCreateReceiptMutation();
  const [postReceipt] = usePostReceiptMutation();
  const [voidReceipt] = useVoidReceiptMutation();

  const onCreateDelivery = async () => {
    if (!dlPoId) { toastErr('PO required', ''); return; }
    try {
      await createDelivery({
        orgId: orgId!, projectId: projectId!,
        input: { purchaseOrderId: dlPoId, scheduledDate: dlScheduledDate || undefined, carrier: dlCarrier || undefined, notes: dlNotes || undefined, items: [] },
      }).unwrap();
      toastOk('Delivery scheduled', '');
      setShowCreateDelivery(false);
      setDlPoId(''); setDlScheduledDate(''); setDlCarrier(''); setDlNotes('');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const onCreateReceipt = async () => {
    if (!rcPoId) { toastErr('PO required', ''); return; }
    try {
      await createReceipt({
        orgId: orgId!, projectId: projectId!,
        input: { purchaseOrderId: rcPoId, receivedAt: new Date(rcReceivedAt).toISOString(), notes: rcNotes || undefined, items: [] },
      }).unwrap();
      toastOk('Receipt created', '');
      setShowCreateReceipt(false);
      setRcPoId(''); setRcNotes('');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const onTransitionDelivery = async (deliveryId: string, status: DeliveryStatus) => {
    try {
      const patch = status === 'DELIVERED'
        ? { status, actualDeliveryDate: new Date().toISOString().split('T')[0]! }
        : { status };
      await updateDelivery({ orgId: orgId!, projectId: projectId!, deliveryId, input: patch }).unwrap();
      toastOk(`Delivery marked ${status.toLowerCase().replace('_', ' ')}`, '');
    } catch (err) {
      toastErr('Transition failed', toastErrorMessage(err as never));
    }
  };

  const deliveries = deliveriesData?.data ?? [];
  const receipts = receiptsData?.data ?? [];
  const sentPOs = (posData?.data ?? []).filter((p) => ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(p.status));

  return (
    <div className="p-6 sm:p-8">
      {/* Tab switcher */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex border border-[var(--hairline-2)]">
          {(['deliveries', 'receipts'] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${activeTab === tab ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'}`}>
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 'deliveries' && canCreateDelivery && !showCreateDelivery && (
          <button type="button" onClick={() => setShowCreateDelivery(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> Schedule delivery
          </button>
        )}
        {activeTab === 'receipts' && canCreateReceipt && !showCreateReceipt && (
          <button type="button" onClick={() => setShowCreateReceipt(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> Record receipt
          </button>
        )}
      </div>

      {/* Delivery create panel */}
      {activeTab === 'deliveries' && showCreateDelivery && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Schedule delivery</p>
          {isInlineError(dlErr) && <InlineAlert variant="error" message={getServerError(dlErr)?.message ?? 'Error'} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Purchase order *</label>
              <select value={dlPoId} onChange={(e) => setDlPoId(e.target.value)}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]">
                <option value="">Select PO…</option>
                {sentPOs.map((p) => <option key={p.id} value={p.id}>{p.poNumber}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Scheduled date</label>
              <input type="date" value={dlScheduledDate} onChange={(e) => setDlScheduledDate(e.target.value)}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Carrier</label>
              <input type="text" value={dlCarrier} onChange={(e) => setDlCarrier(e.target.value)} maxLength={200}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Notes</label>
              <input type="text" value={dlNotes} onChange={(e) => setDlNotes(e.target.value)} maxLength={4000}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreateDelivery} disabled={creatingDl}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
              {creatingDl ? 'Scheduling…' : 'Schedule'}
            </button>
            <button type="button" onClick={() => setShowCreateDelivery(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Receipt create panel */}
      {activeTab === 'receipts' && showCreateReceipt && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Record receipt</p>
          {isInlineError(rcErr) && <InlineAlert variant="error" message={getServerError(rcErr)?.message ?? 'Error'} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Purchase order *</label>
              <select value={rcPoId} onChange={(e) => setRcPoId(e.target.value)}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]">
                <option value="">Select PO…</option>
                {(posData?.data ?? []).filter((p) => !['DRAFT', 'PENDING_APPROVAL', 'CANCELLED'].includes(p.status)).map((p) => (
                  <option key={p.id} value={p.id}>{p.poNumber}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Received at *</label>
              <input type="date" value={rcReceivedAt} onChange={(e) => setRcReceivedAt(e.target.value)}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Notes</label>
            <textarea value={rcNotes} onChange={(e) => setRcNotes(e.target.value)} rows={2} maxLength={4000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreateReceipt} disabled={creatingRc}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
              {creatingRc ? 'Creating…' : 'Create receipt'}
            </button>
            <button type="button" onClick={() => setShowCreateReceipt(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Deliveries table */}
      {activeTab === 'deliveries' && (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[130px_2fr_100px_110px_110px_160px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Number', 'PO', 'Status', 'Scheduled', 'Delivered', ''].map((h) => (
              <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
            ))}
          </div>
          {dlLoading ? (
            [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
          ) : deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
              <Truck className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
              <p className="text-sm text-[var(--muted)]">No deliveries scheduled yet.</p>
            </div>
          ) : (
            deliveries.map((dl) => (
              <div key={dl.id} className="grid grid-cols-[130px_2fr_100px_110px_110px_160px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                <p className="font-mono text-[10px] text-[var(--muted)]">{dl.deliveryNumber}</p>
                <p className="font-mono text-[10px] text-[var(--muted)]">{dl.purchaseOrderId}</p>
                <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${DELIVERY_STATUS_BADGE[dl.status]}`}>{dl.status.replace('_', ' ')}</span>
                <p className="font-mono text-[10px] text-[var(--muted)]">{dl.scheduledDate ?? '—'}</p>
                <p className="font-mono text-[10px] text-[var(--muted)]">{dl.actualDeliveryDate ?? '—'}</p>
                <div className="flex gap-1.5 justify-end">
                  {DELIVERY_TRANSITIONS.filter((t) => t.from === dl.status).map((t) => (
                    <button key={t.to} onClick={() => onTransitionDelivery(dl.id, t.to)}
                      className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] px-2 py-1 hover:bg-[var(--surface-2)] transition-colors">
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Receipts table */}
      {activeTab === 'receipts' && (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[130px_2fr_100px_120px_160px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Number', 'PO', 'Status', 'Received at', ''].map((h) => (
              <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
            ))}
          </div>
          {rcLoading ? (
            [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
          ) : receipts.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[var(--muted)]">No receipts recorded yet.</div>
          ) : (
            receipts.map((rc) => (
              <div key={rc.id} className="grid grid-cols-[130px_2fr_100px_120px_160px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                <p className="font-mono text-[10px] text-[var(--muted)]">{rc.receiptNumber}</p>
                <p className="font-mono text-[10px] text-[var(--muted)]">{rc.purchaseOrderId}</p>
                <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${RECEIPT_STATUS_BADGE[rc.status]}`}>{rc.status}</span>
                <p className="font-mono text-[10px] text-[var(--muted)]">{new Date(rc.receivedAt).toLocaleDateString()}</p>
                <div className="flex gap-1.5 justify-end">
                  {rc.status === 'DRAFT' && canPostReceipt && (
                    <button onClick={() => postReceipt({ orgId: orgId!, projectId: projectId!, receiptId: rc.id }).then(() => toastOk('Posted', '')).catch((e) => toastErr('Post failed', toastErrorMessage(e)))}
                      className="font-mono text-[9px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-2 py-1 hover:bg-[#dcfce7]">
                      Post
                    </button>
                  )}
                  {rc.status === 'POSTED' && canVoidReceipt && (
                    <button onClick={() => voidReceipt({ orgId: orgId!, projectId: projectId!, receiptId: rc.id }).then(() => toastOk('Voided', '')).catch((e) => toastErr('Void failed', toastErrorMessage(e)))}
                      className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-2 py-1 text-[#991b1b] hover:bg-[#fef2f2]">
                      Void
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
