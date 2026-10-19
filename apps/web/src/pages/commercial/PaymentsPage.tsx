/**
 * PaymentsPage — /org/:orgId/projects/:projectId/commercial/payments
 *
 * Backend: invoice-payment.routes.ts (GET /payments, transitions /:paymentId/*)
 * State machine: DRAFT → SUBMITTED → APPROVED → EXECUTED → VOID
 * execute requires idempotency-key header (generated as UUID in queryFn).
 * All transitions require expectedVersion.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, CreditCard, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListPaymentsQuery,
  useListInvoicesQuery,
  useCreatePaymentMutation,
  useTransitionPaymentMutation,
} from '../../api/commercialApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { PaymentStatus, PaymentMethod } from '../../types/commercialTypes';

const STATUS_BADGE: Record<PaymentStatus, string> = {
  DRAFT:     'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  SUBMITTED: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  APPROVED:  'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
  EXECUTED:  'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  REJECTED:  'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  VOID:      'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)] opacity-60',
};

const PAYMENT_METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CHEQUE', 'CASH', 'ONLINE', 'OTHER'];
const FILTERS = ['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'EXECUTED', 'REJECTED'] as const;

interface ActionState { id: string; version: number; action: 'reject' | 'execute' | 'void' }

export const PaymentsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const canCreate  = usePermission('project.payment.create');
  const canApprove = usePermission('project.payment.approve');
  const canExecute = usePermission('project.payment.execute');
  const canVoid    = usePermission('project.payment.void');

  const [filter, setFilter]     = useState<typeof FILTERS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [executeConfirmed, setExecuteConfirmed] = useState(false);

  // Create form
  const [invoiceId, setInvoiceId]       = useState('');
  const [paymentDate, setPaymentDate]   = useState(new Date().toISOString().split('T')[0]!);
  const [method, setMethod]             = useState<PaymentMethod>('BANK_TRANSFER');
  const [amount, setAmount]             = useState('');
  const [currency, setCurrency]         = useState('PKR');
  const [reference, setReference]       = useState('');

  const { data, isLoading } = useListPaymentsQuery({ orgId: orgId!, projectId: projectId! });
  const { data: invData }   = useListInvoicesQuery({ orgId: orgId!, projectId: projectId! });
  const [createPayment, { isLoading: creating }] = useCreatePaymentMutation();
  const [transitionPayment, { isLoading: transitioning }] = useTransitionPaymentMutation();

  const onCreate = async () => {
    if (!invoiceId || !amount) { toastErr('Invoice and amount required', ''); return; }
    try {
      await createPayment({
        orgId: orgId!, projectId: projectId!, invoiceId,
        input: { paymentDate, paymentMethod: method, amount, currencyCode: currency.toUpperCase(), reference: reference || undefined },
      }).unwrap();
      toastOk('Payment created', '');
      setShowCreate(false); setInvoiceId(''); setAmount(''); setReference('');
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const doTransition = async (paymentId: string, action: 'submit' | 'approve' | 'reject' | 'execute' | 'void', version: number, reason?: string) => {
    try {
      await transitionPayment({ orgId: orgId!, projectId: projectId!, paymentId, action, expectedVersion: version, reason }).unwrap();
      const labels: Record<string, string> = { submit: 'submitted', approve: 'approved', reject: 'rejected', execute: 'executed', void: 'voided' };
      toastOk(`Payment ${labels[action]}`, action === 'execute' ? 'Payment has been executed.' : '');
      setActionState(null); setRejectReason(''); setExecuteConfirmed(false);
    } catch (err) { toastErr('Action failed', toastErrorMessage(err as never)); }
  };

  const invoices = invData?.items ?? [];
  const payments = data?.items ?? [];
  const rows = filter === 'ALL' ? payments : payments.filter((p) => p.status === filter);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Payments</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{payments.length} total</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> New payment
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New payment</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Invoice *</label>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className={inputCls()}>
                <option value="">Select invoice…</option>
                {invoices.filter((i) => i.status === 'APPROVED').map((i) => (
                  <option key={i.id} value={i.id}>{i.invoiceNumber} — {i.currencyCode} {parseFloat(i.outstandingAmount).toLocaleString()} outstanding</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Payment date *</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inputCls()}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Amount *</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Currency</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Reference</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">
              {creating ? 'Creating…' : 'Create payment'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Execute confirm panel */}
      {actionState?.action === 'execute' && (
        <div className="mb-4 border border-[#fde68a] bg-[#fffbeb] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#92400e]" strokeWidth={2} />
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#92400e]">Execute payment — idempotent</p>
          </div>
          <p className="text-sm text-[#92400e]">This will mark the payment as executed. The operation uses an idempotency key to prevent double execution.</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={executeConfirmed} onChange={(e) => setExecuteConfirmed(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--ink)]" />
            <span className="text-sm text-[#92400e]">I confirm this payment should be executed</span>
          </label>
          <div className="flex items-center gap-2">
            <button onClick={() => doTransition(actionState.id, 'execute', actionState.version)} disabled={!executeConfirmed || transitioning}
              className="font-mono text-[9px] uppercase bg-[#92400e] text-white px-4 py-1.5 disabled:opacity-50">
              {transitioning ? 'Executing…' : 'Execute payment'}
            </button>
            <button type="button" onClick={() => { setActionState(null); setExecuteConfirmed(false); }} className="text-sm text-[#92400e]">Cancel</button>
          </div>
        </div>
      )}

      {/* Reject panel */}
      {actionState?.action === 'reject' && (
        <div className="mb-4 border border-[#fecaca] bg-[#fef2f2] p-4 flex items-center gap-3">
          <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (required)" maxLength={500}
            className="flex-1 border border-[#fecaca] bg-white px-3 py-2 text-sm" />
          <button onClick={() => doTransition(actionState.id, 'reject', actionState.version, rejectReason)} disabled={transitioning || !rejectReason.trim()}
            className="font-mono text-[9px] uppercase bg-[#991b1b] text-white px-4 py-1.5 disabled:opacity-50">Confirm</button>
          <button type="button" onClick={() => { setActionState(null); setRejectReason(''); }} className="text-sm text-[#991b1b]">✕</button>
        </div>
      )}

      {/* Void panel */}
      {actionState?.action === 'void' && (
        <div className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-4 flex items-center justify-between">
          <p className="text-sm text-[var(--muted)]">Void this payment? This cannot be undone.</p>
          <div className="flex items-center gap-2">
            <button onClick={() => doTransition(actionState.id, 'void', actionState.version)} disabled={transitioning}
              className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-3 py-1.5 hover:bg-[var(--surface-2)] disabled:opacity-50">Confirm void</button>
            <button type="button" onClick={() => setActionState(null)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex border-b border-[var(--hairline-2)] mb-6 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 whitespace-nowrap transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[100px_90px_90px_80px_100px_100px_180px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Number', 'Status', 'Method', 'Date', 'Amount', 'Invoice', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>
        {isLoading ? [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />) :
        rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <CreditCard className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No payments yet.</p>
          </div>
        ) : rows.map((pmt) => (
          <div key={pmt.id} className="grid grid-cols-[100px_90px_90px_80px_100px_100px_180px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
            <p className="font-mono text-[10px] text-[var(--muted)]">{pmt.paymentNumber}</p>
            <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[pmt.status]}`}>{pmt.status}</span>
            <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{pmt.paymentMethod.replace('_', ' ')}</p>
            <p className="font-mono text-[10px] text-[var(--muted)]">{pmt.paymentDate}</p>
            <p className="font-mono text-[10px] font-medium">{pmt.currencyCode} {parseFloat(pmt.amount).toLocaleString()}</p>
            <p className="font-mono text-[9px] text-[var(--muted)] truncate">
              {invoices.find((i) => i.id === pmt.invoiceId)?.invoiceNumber ?? pmt.invoiceId.slice(0, 8)}
            </p>
            <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
              {pmt.status === 'DRAFT' && (
                <button onClick={() => doTransition(pmt.id, 'submit', pmt.version)} disabled={transitioning}
                  className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-50">Submit</button>
              )}
              {pmt.status === 'SUBMITTED' && canApprove && (
                <>
                  <button onClick={() => doTransition(pmt.id, 'approve', pmt.version)} disabled={transitioning}
                    className="font-mono text-[8px] uppercase border border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3] px-1.5 py-0.5 hover:bg-[#e0e7ff] disabled:opacity-50">Approve</button>
                  <button onClick={() => { setActionState({ id: pmt.id, version: pmt.version, action: 'reject' }); setRejectReason(''); }}
                    className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[#991b1b] px-1.5 py-0.5 hover:bg-[#fef2f2]">Reject</button>
                </>
              )}
              {pmt.status === 'APPROVED' && canExecute && (
                <button onClick={() => { setActionState({ id: pmt.id, version: pmt.version, action: 'execute' }); setExecuteConfirmed(false); }}
                  className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7]">Execute</button>
              )}
              {pmt.status === 'EXECUTED' && canVoid && (
                <button onClick={() => setActionState({ id: pmt.id, version: pmt.version, action: 'void' })}
                  className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[var(--muted)] px-1.5 py-0.5 hover:bg-[var(--surface-2)]">Void</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
