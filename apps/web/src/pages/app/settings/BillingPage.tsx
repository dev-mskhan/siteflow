/**
 * BillingPage — /org/:orgId/settings/billing
 * Shows trial status, plan selection (checkout), customer portal link, invoice history.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, ExternalLink, FileText, Zap, Crown } from 'lucide-react';
import {
  useGetTrialQuery, useProvisionTrialMutation,
  useCreateCheckoutMutation, useCreatePortalSessionMutation,
  useListInvoicesQuery,
} from '../../../api/billingApi';
import { useToast } from '../../../components/ui/Toast';
import { toastErrorMessage } from '../../../lib/authErrors';
import { cn } from '../../../lib/cn';

const PLANS = [
  { id: 'starter', name: 'Starter', price: '$49/mo', icon: Zap, features: ['5 projects', '10 members', 'Basic reporting'] },
  { id: 'professional', name: 'Professional', price: '$149/mo', icon: Crown, features: ['Unlimited projects', '50 members', 'Advanced reporting', 'AI insights', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', icon: Crown, features: ['Everything in Pro', 'Unlimited members', 'SSO & SAML', 'Dedicated support', 'Custom integrations'] },
] as const;

const INVOICE_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  OPEN: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  PAID: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  UNCOLLECTIBLE: 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  VOID: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

export const BillingPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const { data: trial, isLoading: trialLoading } = useGetTrialQuery({ orgId: orgId! });
  const { data: invData } = useListInvoicesQuery({ orgId: orgId! });
  const [provisionTrial, { isLoading: provisioning }] = useProvisionTrialMutation();
  const [createCheckout, { isLoading: checkingOut }] = useCreateCheckoutMutation();
  const [createPortal, { isLoading: portaling }] = useCreatePortalSessionMutation();

  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'professional' | 'enterprise'>('professional');
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  const onCheckout = async () => {
    try {
      const result = await createCheckout({ orgId: orgId!, planId: selectedPlan, interval }).unwrap();
      toastOk('Redirecting to checkout', result.checkoutUrl);
      window.open(result.checkoutUrl, '_blank');
    } catch (err) { toastErr('Checkout failed', toastErrorMessage(err as never)); }
  };

  const onPortal = async () => {
    try {
      const result = await createPortal({ orgId: orgId! }).unwrap();
      toastOk('Opening customer portal', '');
      window.open(result.portalUrl, '_blank');
    } catch (err) { toastErr('Portal failed', toastErrorMessage(err as never)); }
  };

  const onProvision = async () => {
    try {
      await provisionTrial({ orgId: orgId! }).unwrap();
      toastOk('Trial started', '14-day free trial is now active.');
    } catch (err) { toastErr('Failed', toastErrorMessage(err as never)); }
  };

  const invoices = invData?.invoices ?? [];

  return (
    <div className="p-6 sm:p-8 max-w-2xl space-y-8">
      {/* Trial status */}
      <section className="space-y-3">
        <div className="border-b border-[var(--hairline-2)] pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Trial status</p>
        </div>
        {trialLoading ? (
          <div className="h-20 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />
        ) : trial ? (
          <div className={cn('border p-5', trial.status === 'ACTIVE' ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[var(--hairline-2)] bg-[var(--paper)]')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{trial.planTier} plan — {trial.status}</p>
                <p className="font-mono text-[10px] text-[var(--muted)] mt-1">
                  Started {new Date(trial.startedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} · Expires {new Date(trial.expiresAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-medium">{trial.daysRemaining}</p>
                <p className="font-mono text-[9px] uppercase text-[var(--muted)]">days left</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-3">
            <p className="text-sm text-[var(--muted)]">No trial started yet. Start a 14-day free trial with no credit card required.</p>
            <button onClick={onProvision} disabled={provisioning}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white disabled:opacity-50">
              {provisioning ? 'Starting…' : 'Start free trial'}
            </button>
          </div>
        )}
      </section>

      {/* Plan selection */}
      <section className="space-y-3">
        <div className="border-b border-[var(--hairline-2)] pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Choose a plan</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {PLANS.map((plan) => (
            <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)}
              className={cn('border p-4 text-left transition-colors',
                selectedPlan === plan.id
                  ? 'border-[var(--ink)] bg-[var(--surface)]'
                  : 'border-[var(--hairline-2)] bg-[var(--paper)] hover:bg-[var(--surface-2)]')}>
              <plan.icon className="h-5 w-5 mb-2 text-[var(--muted)]" strokeWidth={1.75} />
              <p className="text-sm font-medium">{plan.name}</p>
              <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{plan.price}</p>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border border-[var(--hairline-2)]">
            <button type="button" onClick={() => setInterval('month')} className={cn('px-3 py-1.5 text-sm', interval === 'month' ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)]')}>Monthly</button>
            <button type="button" onClick={() => setInterval('year')} className={cn('px-3 py-1.5 text-sm', interval === 'year' ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)]')}>Yearly (-20%)</button>
          </div>
          <button onClick={onCheckout} disabled={checkingOut}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white disabled:opacity-50">
            <CreditCard className="h-4 w-4" strokeWidth={1.75} /> {checkingOut ? 'Redirecting…' : 'Subscribe'}
          </button>
        </div>
      </section>

      {/* Customer portal */}
      <section className="space-y-3">
        <div className="border-b border-[var(--hairline-2)] pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Manage subscription</p>
        </div>
        <button onClick={onPortal} disabled={portaling}
          className="inline-flex items-center gap-2 border border-[var(--hairline-2)] px-4 py-2 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
          <ExternalLink className="h-4 w-4" strokeWidth={1.75} /> {portaling ? 'Opening…' : 'Open customer portal'}
        </button>
      </section>

      {/* Invoice history */}
      <section className="space-y-3">
        <div className="border-b border-[var(--hairline-2)] pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Invoice history</p>
        </div>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-[var(--hairline-2)] bg-[var(--paper)]">
            <FileText className="h-8 w-8 text-[var(--muted)] mb-2" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No invoices yet.</p>
          </div>
        ) : (
          <div className="border border-[var(--hairline-2)]">
            <div className="grid grid-cols-[100px_80px_100px_100px_100px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
              {['Number', 'Status', 'Amount', 'Period', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>)}
            </div>
            {invoices.map((inv) => (
              <div key={inv.id} className="grid grid-cols-[100px_80px_100px_100px_100px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
                <p className="font-mono text-[10px]">{inv.invoiceNumber ?? '—'}</p>
                <span className={cn('inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit', INVOICE_STATUS_BADGE[inv.status])}>{inv.status}</span>
                <p className="font-mono text-[10px]">{(inv.amountPaidCents / 100).toFixed(2)} {inv.currency.toUpperCase()}</p>
                <p className="font-mono text-[9px] text-[var(--muted)]">{new Date(inv.periodStart).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</p>
                <div>
                  {inv.hostedInvoiceUrl && (
                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase text-[var(--muted)] hover:text-[var(--ink)]">View →</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
