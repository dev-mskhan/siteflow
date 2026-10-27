/**
 * CostTransactionsPage — /org/:orgId/projects/:projectId/commercial/cost-transactions
 *
 * Backend: cost-transaction.routes.ts + cost-transaction.schemas.ts
 * States: DRAFT → POSTED (post, idempotency-key) → VOIDED (void, idempotency-key + reason)
 * Create: requires idempotency-key header (generated in queryFn mock)
 * Post: requires idempotency-key + expectedVersion
 * Void: requires idempotency-key + { expectedVersion, reason min:1 max:500 }
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Receipt } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListCostTransactionsQuery,
  useCreateCostTransactionMutation,
  usePostCostTransactionMutation,
  useVoidCostTransactionMutation,
} from '../../features/project/commercialApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { CostTransactionStatus } from '../../types/commercialTypes';

const STATUS_BADGE: Record<CostTransactionStatus, string> = {
  DRAFT:  'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  POSTED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  VOIDED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)] opacity-60',
};

const FILTERS = ['ALL', 'DRAFT', 'POSTED', 'VOIDED'] as const;

interface VoidState { id: string; version: number }

export const CostTransactionsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const canCreate = usePermission('project.cost_transaction.create');
  const canPost   = usePermission('project.cost_transaction.post');
  const canVoid   = usePermission('project.cost_transaction.void');

  const [filter, setFilter]   = useState<typeof FILTERS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [voidState, setVoidState]   = useState<VoidState | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Create form
  const [costCodeId, setCostCodeId]       = useState('cc_structural');
  const [txnDate, setTxnDate]             = useState(new Date().toISOString().split('T')[0]!);
  const [description, setDescription]     = useState('');
  const [currency, setCurrency]           = useState('PKR');
  const [quantity, setQuantity]           = useState('');
  const [unit, setUnit]                   = useState('');
  const [unitCost, setUnitCost]           = useState('');
  const [subtotal, setSubtotal]           = useState('');
  const [taxAmount, setTaxAmount]         = useState('0.00');

  const { data, isLoading } = useListCostTransactionsQuery({ orgId: orgId!, projectId: projectId! });
  const [createTxn, { isLoading: creating }] = useCreateCostTransactionMutation();
  const [postTxn, { isLoading: posting }]    = usePostCostTransactionMutation();
  const [voidTxn, { isLoading: voiding }]    = useVoidCostTransactionMutation();

  // Derive subtotal from qty × unitCost when both provided
  const derivedSubtotal = quantity && unitCost
    ? (parseFloat(quantity) * parseFloat(unitCost)).toFixed(2)
    : subtotal;

  const onCreate = async () => {
    if (!description.trim() || !derivedSubtotal) { toastErr('Description and amount required', ''); return; }
    try {
      await createTxn({
        orgId: orgId!, projectId: projectId!,
        input: {
          costCodeId,
          transactionDate: txnDate,
          description: description.trim(),
          currencyCode: currency.toUpperCase(),
          quantity: quantity || undefined,
          unit: unit || undefined,
          unitCost: unitCost || undefined,
          subtotal: derivedSubtotal || undefined,
          taxAmount: taxAmount || undefined,
        },
      }).unwrap();
      toastOk('Transaction created', '');
      setShowCreate(false);
      setDescription(''); setQuantity(''); setUnit(''); setUnitCost(''); setSubtotal(''); setTaxAmount('0.00');
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const onPost = async (transactionId: string, version: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await postTxn({ orgId: orgId!, projectId: projectId!, transactionId, expectedVersion: version }).unwrap();
      toastOk('Transaction posted', '');
    } catch (err) { toastErr('Post failed', toastErrorMessage(err as never)); }
  };

  const onVoid = async () => {
    if (!voidState || !voidReason.trim()) { toastErr('Reason required', ''); return; }
    try {
      await voidTxn({ orgId: orgId!, projectId: projectId!, transactionId: voidState.id, expectedVersion: voidState.version, reason: voidReason }).unwrap();
      toastOk('Transaction voided', '');
      setVoidState(null); setVoidReason('');
    } catch (err) { toastErr('Void failed', toastErrorMessage(err as never)); }
  };

  const txns = data?.transactions ?? [];
  const rows = filter === 'ALL' ? txns : txns.filter((t) => t.status === filter);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Cost transactions</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{txns.length} total</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> New transaction
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New cost transaction</p>
          <p className="text-sm text-[var(--muted)]">Created as DRAFT. Post to commit to the project ledger (idempotent).</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Cost code *</label>
              <input value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)} maxLength={128} placeholder="cc_structural" className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Transaction date *</label>
              <input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Currency *</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
            </div>
            <div className="sm:col-span-4">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description *</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Qty</label>
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 12.500" className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Unit</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={64} placeholder="MT" className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Unit cost</label>
              <input value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="182000.00" className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">
                Subtotal {quantity && unitCost ? `(auto: ${derivedSubtotal})` : ''}
              </label>
              <input value={quantity && unitCost ? derivedSubtotal : subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                readOnly={!!(quantity && unitCost)}
                placeholder="0.00"
                className={cn(inputCls(), quantity && unitCost ? 'bg-[var(--surface-2)]' : '')} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Tax amount</label>
              <input value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} placeholder="0.00" className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">
              {creating ? 'Creating…' : 'Create transaction'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {voidState && (
        <div className="mb-4 border border-[#fecaca] bg-[#fef2f2] p-4 flex items-center gap-3">
          <input type="text" value={voidReason} onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Void reason (required)" maxLength={500}
            className="flex-1 border border-[#fecaca] bg-white px-3 py-2 text-sm" />
          <button onClick={onVoid} disabled={voiding || !voidReason.trim()}
            className="font-mono text-[9px] uppercase bg-[#991b1b] text-white px-4 py-1.5 disabled:opacity-50">Confirm void</button>
          <button type="button" onClick={() => setVoidState(null)} className="text-sm text-[#991b1b]">✕</button>
        </div>
      )}

      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[80px_2fr_80px_80px_100px_100px_130px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Date', 'Description', 'Status', 'Currency', 'Subtotal', 'Total', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>
        {isLoading ? [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />) :
        rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <Receipt className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No cost transactions yet.</p>
          </div>
        ) : rows.map((t) => (
          <div key={t.id} className="grid grid-cols-[80px_2fr_80px_80px_100px_100px_130px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
            <p className="font-mono text-[10px] text-[var(--muted)]">{t.transactionDate}</p>
            <div className="min-w-0">
              <p className="text-sm truncate">{t.description}</p>
              {t.quantity && <p className="font-mono text-[9px] text-[var(--muted)]">{t.quantity} {t.unit} @ {t.unitCost}</p>}
              {t.voidedBy && <p className="font-mono text-[9px] text-[var(--muted)]">Voided by {t.voidedBy}</p>}
            </div>
            <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[t.status]}`}>{t.status}</span>
            <p className="font-mono text-[10px] text-[var(--muted)]">{t.currencyCode}</p>
            <p className="font-mono text-[10px]">{parseFloat(t.subtotal).toLocaleString()}</p>
            <p className="font-mono text-[10px] font-medium">{parseFloat(t.totalAmount).toLocaleString()}</p>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {t.status === 'DRAFT' && canPost && (
                <button onClick={(e) => onPost(t.id, t.version, e)} disabled={posting}
                  className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7] disabled:opacity-50">Post</button>
              )}
              {t.status === 'POSTED' && canVoid && (
                <button onClick={() => { setVoidState({ id: t.id, version: t.version }); setVoidReason(''); }}
                  className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[#991b1b] px-1.5 py-0.5 hover:bg-[#fef2f2]">Void</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
