/**
 * PurchaseOrdersPage — /org/:orgId/projects/:projectId/procurement/orders
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart } from 'lucide-react';
import {
  useListPurchaseOrdersQuery,
  useCreatePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
  useApprovePurchaseOrderMutation,
  useSendPurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
} from '../../api/procurementApi';
import { useListSuppliersQuery } from '../../features/supplier/supplierApi';
import { usePermission } from '../../hooks/usePermission';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import {
  getServerError,
  isInlineError,
  isToastError,
  toastErrorMessage,
} from '../../lib/authErrors';
import type { PurchaseOrderStatus } from '../../types/procurementTypes';

const STATUS_BADGE: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  PENDING_APPROVAL: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  APPROVED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  SENT: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  ACKNOWLEDGED: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  PARTIALLY_RECEIVED: 'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
  RECEIVED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  CANCELLED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  CLOSED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

const FILTERS = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'CANCELLED'] as const;

export const PurchaseOrdersPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const navigate = useNavigate();
  const canCreate = usePermission('project.purchase_order.create');
  const canApprove = usePermission('project.purchase_order.approve');
  const { success: toastOk, error: toastErr } = useToast();

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]!);
  const [currencyCode, setCurrencyCode] = useState('PKR');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useListPurchaseOrdersQuery({ orgId: orgId!, projectId: projectId! });
  const { data: suppliersData } = useListSuppliersQuery({ orgId: orgId! });
  const [createPO, { isLoading: creating, error: createErr }] = useCreatePurchaseOrderMutation();
  const [submitPO] = useSubmitPurchaseOrderMutation();
  const [approvePO] = useApprovePurchaseOrderMutation();
  const [sendPO] = useSendPurchaseOrderMutation();
  const [cancelPO] = useCancelPurchaseOrderMutation();

  const onCreate = async () => {
    if (!supplierId) {
      toastErr('Supplier required', 'Select a supplier.');
      return;
    }
    try {
      const result = await createPO({
        orgId: orgId!,
        projectId: projectId!,
        input: { supplierId, orderDate, currencyCode, notes: notes || undefined, items: [] },
      }).unwrap();
      toastOk('Purchase order created', '');
      setShowCreate(false);
      setSupplierId('');
      setNotes('');
      navigate(`/org/${orgId}/projects/${projectId}/procurement/orders/${result.id}`);
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const act = async (fn: () => Promise<any>, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fn();
      toastOk(label, '');
    } catch (err) {
      toastErr(`${label} failed`, toastErrorMessage(err as never));
    }
  };

  const all = data ?? [];
  const rows = filter === 'ALL' ? all : all.filter((p) => p.status === filter);
  const suppliersById = new Map((suppliersData?.data ?? []).map((supplier) => [supplier.id, supplier]));

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Purchase orders</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {all.length} order{all.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && !showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2} /> New PO
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            New purchase order
          </p>
          {isInlineError(createErr) && (
            <InlineAlert variant="error" message={getServerError(createErr)?.message ?? 'Error'} />
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                Supplier *
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              >
                <option value="">Select supplier…</option>
                {(suppliersData?.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                Order date *
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                Currency
              </label>
              <input
                type="text"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                maxLength={3}
                className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
              />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={4000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]"
            />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button
              onClick={onCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
            >
              {creating ? 'Creating…' : 'Create PO'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[130px_2fr_120px_110px_90px_180px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['PO Number', 'Supplier', 'Status', 'Total', 'Order date', ''].map((h) => (
            <p
              key={h}
              className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]"
            >
              {h}
            </p>
          ))}
        </div>
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]"
            />
          ))
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <ShoppingCart className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No purchase orders found.</p>
          </div>
        ) : (
          rows.map((po) => (
            <div
              key={po.id}
              onClick={() =>
                navigate(`/org/${orgId}/projects/${projectId}/procurement/orders/${po.id}`)
              }
              className="grid grid-cols-[130px_2fr_120px_110px_90px_180px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
            >
              <p className="font-mono text-[10px] text-[var(--muted)]">{po.poNumber}</p>
              <p className="text-sm truncate">
                {suppliersById.get(po.supplierId)?.displayName ?? po.supplierId}
              </p>
              <span
                className={`inline-block font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[po.status]}`}
              >
                {po.status.replace('_', ' ')}
              </span>
              <p className="font-mono text-[11px]">
                {po.currencyCode} {parseFloat(po.totalAmount).toLocaleString()}
              </p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{po.orderDate}</p>
              <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                {po.status === 'DRAFT' && (
                  <button
                    onClick={(e) =>
                      act(
                        () => submitPO({ orgId: orgId!, projectId: projectId!, poId: po.id }),
                        'Submitted',
                        e,
                      )
                    }
                    className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] px-2 py-1 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    Submit
                  </button>
                )}
                {po.status === 'PENDING_APPROVAL' && canApprove && (
                  <button
                    onClick={(e) =>
                      act(
                        () => approvePO({ orgId: orgId!, projectId: projectId!, poId: po.id }),
                        'Approved',
                        e,
                      )
                    }
                    className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-2 py-1 hover:bg-[#dcfce7] transition-colors"
                  >
                    Approve
                  </button>
                )}
                {po.status === 'APPROVED' && (
                  <button
                    onClick={(e) =>
                      act(
                        () => sendPO({ orgId: orgId!, projectId: projectId!, poId: po.id }),
                        'Sent',
                        e,
                      )
                    }
                    className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af] px-2 py-1 hover:bg-[#dbeafe] transition-colors"
                  >
                    Send
                  </button>
                )}
                {['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT'].includes(po.status) && (
                  <button
                    onClick={(e) =>
                      act(
                        () => cancelPO({ orgId: orgId!, projectId: projectId!, poId: po.id }),
                        'Cancelled',
                        e,
                      )
                    }
                    className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] px-2 py-1 text-[#991b1b] hover:bg-[#fef2f2] transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
