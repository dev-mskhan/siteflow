/**
 * PlatformBillingPage — /platform/billing
 * Tabs: Webhook Inbox | Org Billing
 */
import React, { useState } from 'react';
import { RefreshCw, CreditCard, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useGetWebhookInboxQuery, useTriggerWebhookRecoveryMutation,
  useGetOrgBillingQuery,
} from '../../api/platformApi';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { LifecycleReasonCode } from '../../types/platformTypes';

type Tab = 'webhook' | 'org';
const TabBtn: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button type="button" onClick={onClick}
    className={cn('px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors', active ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]')}>
    {label}
  </button>
);

const REASON_CODES: LifecycleReasonCode[] = ['SECURITY_INCIDENT', 'FRAUD', 'POLICY_VIOLATION', 'CUSTOMER_REQUEST', 'OTHER'];

export const PlatformBillingPage: React.FC = () => {
  const { success: toastOk, error: toastErr } = useToast();
  const [tab, setTab] = useState<Tab>('webhook');
  const [orgId, setOrgId] = useState('');

  const { data: inbox, isLoading: inboxLoading, refetch: refetchInbox, isFetching: inboxFetching } = useGetWebhookInboxQuery();
  const { data: orgBilling } = useGetOrgBillingQuery({ orgId }, { skip: !orgId || tab !== 'org' });
  const [triggerRecovery, { isLoading: recovering }] = useTriggerWebhookRecoveryMutation();

  const [showRecovery, setShowRecovery] = useState(false);
  const [password, setPassword] = useState('');
  const [reasonCode, setReasonCode] = useState<LifecycleReasonCode>('POLICY_VIOLATION');
  const [reasonNote, setReasonNote] = useState('');

  const onRecovery = async () => {
    if (password.length < 1 || reasonNote.trim().length < 10) { toastErr('Validation', 'Password and reason note (min 10 chars) required'); return; }
    try {
      const result = await triggerRecovery({ password, reasonCode, reasonNote: reasonNote.trim() }).unwrap();
      toastOk('Webhook recovery triggered', `Processed ${result.processedCount} webhook(s).`);
      setShowRecovery(false); setPassword(''); setReasonNote('');
      refetchInbox();
    } catch (err) { toastErr('Failed', toastErrorMessage(err as never)); }
  };

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-lg font-medium tracking-[-0.03em]">Billing</h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">Webhook inbox status and organization billing views</p>
      </div>

      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        <TabBtn label="Webhook inbox" active={tab === 'webhook'} onClick={() => setTab('webhook')} />
        <TabBtn label="Org billing" active={tab === 'org'} onClick={() => setTab('org')} />
      </div>

      {/* WEBHOOK INBOX */}
      {tab === 'webhook' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Stripe webhook inbox status</p>
            <div className="flex gap-2">
              <button onClick={() => refetchInbox()} disabled={inboxFetching} className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
                <RefreshCw className={cn('h-3.5 w-3.5', inboxFetching && 'animate-spin')} strokeWidth={2} /> Refresh
              </button>
              {!showRecovery && <button onClick={() => setShowRecovery(true)} className="inline-flex items-center gap-1.5 border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-3 py-1.5 text-sm hover:bg-[#fef3c7]">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} /> Trigger recovery
              </button>}
            </div>
          </div>

          {showRecovery && (
            <div className="border border-[#fde68a] bg-[#fffbeb] p-4 space-y-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#92400e]">Trigger webhook inbox recovery</p>
              <p className="text-sm text-[#92400e]">This runs a bounded, idempotent recovery that re-fetches Stripe state under a lease. Safe to retry.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Password (re-authentication) *</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls()} /></div>
                <div><label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Reason code *</label><select value={reasonCode} onChange={(e) => setReasonCode(e.target.value as LifecycleReasonCode)} className={inputCls()}>{REASON_CODES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}</select></div>
                <div><label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Reason note (min 10) *</label><input value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} maxLength={500} className={inputCls()} /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={onRecovery} disabled={recovering || password.length < 1 || reasonNote.trim().length < 10}
                  className="font-mono text-[9px] uppercase bg-[#92400e] text-white px-4 py-1.5 disabled:opacity-50">{recovering ? 'Recovering…' : 'Trigger recovery'}</button>
                <button type="button" onClick={() => { setShowRecovery(false); setPassword(''); setReasonNote(''); }} className="text-sm text-[#92400e]">Cancel</button>
              </div>
            </div>
          )}

          {inboxLoading ? <div className="h-20 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" /> : inbox && (
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(inbox.counts).map(([status, count]) => (
                <div key={status} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">{status}</p>
                  <p className={cn('font-mono text-xl font-medium', status === 'FAILED' && count > 0 ? 'text-[#991b1b]' : '')}>{count}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ORG BILLING */}
      {tab === 'org' && (
        <div className="space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Organization billing view</p>
          <div className="flex items-center gap-3">
            <input value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="Organization ID" className={cn(inputCls(), 'max-w-sm')} />
          </div>
          {orgBilling && (
            <div className="space-y-4">
              {orgBilling.subscription && (
                <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">Subscription</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-0.5">Plan</p><p className="text-sm font-medium">{orgBilling.subscription.planName ?? '—'}</p></div>
                    <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-0.5">Status</p><p className="text-sm font-medium">{orgBilling.subscription.status}</p></div>
                    <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-0.5">Amount</p><p className="font-mono text-sm">{(orgBilling.subscription.amountCents! / 100).toFixed(2)} {orgBilling.subscription.currency?.toUpperCase()}</p></div>
                    <div><p className="font-mono text-[9px] uppercase text-[var(--muted)] mb-0.5">Grace</p><p className="text-sm">{orgBilling.subscription.graceStartsAt ? new Date(orgBilling.subscription.graceStartsAt).toLocaleDateString() : '—'}</p></div>
                  </div>
                </div>
              )}
              {orgBilling.invoices.length > 0 && (
                <div className="border border-[var(--hairline-2)]">
                  <div className="px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Recent invoices</p></div>
                  <div className="grid grid-cols-[80px_80px_100px_100px_80px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
                    {['Status', 'Amount', 'Currency', 'Created', 'Attempts'].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>)}
                  </div>
                  {orgBilling.invoices.map((inv) => (
                    <div key={inv.id} className="grid grid-cols-[80px_80px_100px_100px_80px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                      <span className={cn('font-mono text-[9px] uppercase', inv.status === 'PAID' ? 'text-[#166534]' : inv.status === 'OPEN' ? 'text-[#92400e]' : 'text-[var(--muted)]')}>{inv.status}</span>
                      <p className="font-mono text-[10px]">{(inv.amountDueCents / 100).toFixed(2)}</p>
                      <p className="font-mono text-[10px] text-[var(--muted)]">{inv.currency.toUpperCase()}</p>
                      <p className="font-mono text-[9px] text-[var(--muted)]">{new Date(inv.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</p>
                      <p className="font-mono text-[10px] text-[var(--muted)]">{inv.paymentAttemptCount}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
