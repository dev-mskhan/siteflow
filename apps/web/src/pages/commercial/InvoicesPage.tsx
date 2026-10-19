/**
 * InvoicesPage — /org/:orgId/projects/:projectId/commercial/invoices
 *
 * Backend: invoice-payment.routes.ts
 * State machine: DRAFT → SUBMITTED → APPROVED | REJECTED → VOID
 * Create requires idempotency-key (generated in queryFn mock).
 * All transitions require expectedVersion. reject requires reason.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListInvoicesQuery,
  useCreateInvoiceMutation,
  useTransitionInvoiceMutation,
  useListPaymentsQuery,
} from '../../api/commercialApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { InvoiceStatus, InvoiceType } from '../../types/commercialTypes';

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  DRAFT:     'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  SUBMITTED: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  APPROVED:  'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  REJECTED:  'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  VOID:      'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)] opacity-60',
};

const INVOICE_TYPES: InvoiceType[] = ['PROGRESS', 'FINAL', 'VARIATION', 'RETAINAGE_RELEASE', 'ADVANCE', 'OTHER'];
const FILTERS = ['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;

// Linked payments for a single invoice
const InvoicePayments: React.FC<{ orgId: string; projectId: string; invoiceId: string }> = ({ orgId, projectId, invoiceId }) => {
  const { data } = useListPaymentsQuery({ orgId, projectId, invoiceId });
  const pmts = data?.items ?? [];
  if (pmts.length === 0) return <div className="px-4 py-3 text-sm text-[var(--muted)]">No payments linked.</div>;
  return (
    <div className="px-4 pb-3 bg-[var(--paper)]">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] py-2">Payments</p>
      <div className="space-y-1.5">
        {pmts.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm border border-[var(--hairline-2)] px-3 py-2">
            <span className="font-mono text-[10px] text-[var(--muted)]">{p.paymentNumber}</span>
            <span className="text-sm">{p.paymentMethod.replace('_', ' ')}</span>
            <span className="font-mono text-[10px] font-medium">{p.currencyCode} {parseFloat(p.amount).toLocaleString()}</span>
            <span className={cn('font-mono text-[9px] uppercase border px-1.5 py-0.5',
              p.status === 'EXECUTED' ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]' :
              p.status === 'APPROVED' ? 'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]' :
              'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]')}>
              {p.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const InvoicesPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const canCreate  = usePermission('project.invoice.create');
  const canApprove = usePermission('project.invoice.approve');

  const [filter, setFilter] = useState<typeof FILTERS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<{ id: string; version: number } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Create form
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('PROGRESS');
  const [issueDate, setIssueDate]     = useState(new Date().toISOString().split('T')[0]!);
  const [dueDate, setDueDate]         = useState('');
  const [currency, setCurrency]       = useState('PKR');
  const [lineDesc, setLineDesc]       = useState('');
  const [lineAmount, setLineAmount]   = useState('');
  const [lineTax, setLineTax]         = useState('17');

  const { data, isLoading } = useListInvoicesQuery({ orgId: orgId!, projectId: projectId! });
  const [createInvoice, { isLoading: creating }] = useCreateInvoiceMutation();
  const [transitionInvoice, { isLoading: transitioning }] = useTransitionInvoiceMutation();

  const onCreate = async () => {
    if (!lineDesc.trim() || !lineAmount) { toastErr('Line description and amount required', ''); return; }
    try {
      await createInvoice({
        orgId: orgId!, projectId: projectId!,
        input: {
          invoiceType,
          issueDate,
          dueDate: dueDate || undefined,
          currencyCode: currency.toUpperCase(),
          lines: [{ description: lineDesc.trim(), quantity: '1', unit: 'LS', unitRate: lineAmount, amount: lineAmount, taxPercent: lineTax }],
        },
      }).unwrap();
      toastOk('Invoice created', '');
      setShowCreate(false); setLineDesc(''); setLineAmount(''); setLineTax('17');
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const doTransition = async (invoiceId: string, action: 'submit' | 'approve' | 'reject' | 'void', version: number, reason?: string) => {
    try {
      await transitionInvoice({ orgId: orgId!, projectId: projectId!, invoiceId, action, expectedVersion: version, reason }).unwrap();
      toastOk(`Invoice ${action}d`, '');
      setRejectingId(null); setRejectReason('');
    } catch (err) { toastErr('Action failed', toastErrorMessage(err as never)); }
  };

  const invoices = data?.items ?? [];
  const rows = filter === 'ALL' ? invoices : invoices.filter((i) => i.status === filter);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Invoices</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{invoices.length} total</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> New invoice
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New invoice</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Type</label>
              <select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value as InvoiceType)} className={inputCls()}>
                {INVOICE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Issue date *</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Currency</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Line description *</label>
              <input value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} maxLength={500} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Amount *</label>
              <input value={lineAmount} onChange={(e) => setLineAmount(e.target.value)} placeholder="0.00" className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Tax %</label>
              <input value={lineTax} onChange={(e) => setLineTax(e.target.value)} className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">
              {creating ? 'Creating…' : 'Create invoice'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {rejectingId && (
        <div className="mb-4 border border-[#fecaca] bg-[#fef2f2] p-4 flex items-center gap-3">
          <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (required)" maxLength={500}
            className="flex-1 border border-[#fecaca] bg-white px-3 py-2 text-sm" />
          <button onClick={() => doTransition(rejectingId.id, 'reject', rejectingId.version, rejectReason)} disabled={transitioning || !rejectReason.trim()}
            className="font-mono text-[9px] uppercase bg-[#991b1b] text-white px-4 py-1.5 disabled:opacity-50">Confirm</button>
          <button type="button" onClick={() => setRejectingId(null)} className="text-sm text-[#991b1b]">✕</button>
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
        <div className="grid grid-cols-[28px_100px_90px_80px_100px_100px_100px_160px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['', 'Number', 'Type', 'Status', 'Total', 'Paid', 'Outstanding', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>
        {isLoading ? [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />) :
        rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <FileText className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No invoices yet.</p>
          </div>
        ) : rows.map((inv) => (
          <div key={inv.id}>
            <div className="grid grid-cols-[28px_100px_90px_80px_100px_100px_100px_160px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <button type="button" onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                className="p-0.5 text-[var(--muted)] hover:text-[var(--ink)]">
                {expandedId === inv.id ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} /> : <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
              </button>
              <p className="font-mono text-[10px] text-[var(--muted)]">{inv.invoiceNumber}</p>
              <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{inv.invoiceType.replace('_', ' ')}</p>
              <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[inv.status]}`}>{inv.status}</span>
              <p className="font-mono text-[10px] font-medium">{parseFloat(inv.totalAmount).toLocaleString()}</p>
              <p className="font-mono text-[10px]">{parseFloat(inv.paidAmount).toLocaleString()}</p>
              <p className={cn('font-mono text-[10px]', parseFloat(inv.outstandingAmount) > 0 ? 'text-[#92400e]' : 'text-[var(--muted)]')}>
                {parseFloat(inv.outstandingAmount).toLocaleString()}
              </p>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {inv.status === 'DRAFT' && (
                  <button onClick={() => doTransition(inv.id, 'submit', inv.version)} disabled={transitioning}
                    className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-50">Submit</button>
                )}
                {inv.status === 'SUBMITTED' && canApprove && (
                  <>
                    <button onClick={() => doTransition(inv.id, 'approve', inv.version)} disabled={transitioning}
                      className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7] disabled:opacity-50">Approve</button>
                    <button onClick={() => { setRejectingId({ id: inv.id, version: inv.version }); setRejectReason(''); }}
                      className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[#991b1b] px-1.5 py-0.5 hover:bg-[#fef2f2]">Reject</button>
                  </>
                )}
                {['DRAFT', 'REJECTED'].includes(inv.status) && (
                  <button onClick={() => doTransition(inv.id, 'void', inv.version)} disabled={transitioning}
                    className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[var(--muted)] px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-50">Void</button>
                )}
              </div>
            </div>
            {expandedId === inv.id && (
              <InvoicePayments orgId={orgId!} projectId={projectId!} invoiceId={inv.id} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
