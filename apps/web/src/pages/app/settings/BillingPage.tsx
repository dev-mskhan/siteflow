/**
 * BillingPage — /org/:orgId/settings/billing
 *
 * Shows:
 *  - Current billing state (trial, subscription, grace period, expired)
 *  - Plan selection with prices from VITE_ env vars (single source of truth)
 *  - Stripe Checkout button
 *  - Customer portal link
 *  - Invoice history
 */
import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CreditCard, ExternalLink, FileText, Zap, Crown, Building2, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  useGetBillingStatusQuery,
  useProvisionTrialMutation,
  useCreateCheckoutSessionMutation,
  useCreatePortalSessionMutation,
  useListInvoicesQuery,
} from '../../../features/billing/billingApi';
import { PRICING_PLANS } from '../../../content/pricing';
import { useToast } from '../../../components/ui/Toast';
import { toastErrorMessage } from '../../../lib/authErrors';
import { cn } from '../../../lib/cn';

const PLAN_ICONS = { trial: CheckCircle, starter: Zap, professional: Crown, enterprise: Building2 } as const;

const STATE_BANNER: Record<string, { bg: string; border: string; icon: React.ElementType; text: string }> = {
  trial:         { bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]', icon: CheckCircle, text: 'text-[#166534]' },
  trial_grace:   { bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]', icon: AlertTriangle, text: 'text-[#92400e]' },
  trial_expired: { bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]', icon: AlertTriangle, text: 'text-[#991b1b]' },
  active:        { bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]', icon: CheckCircle, text: 'text-[#166534]' },
  past_due:      { bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]', icon: AlertTriangle, text: 'text-[#92400e]' },
  canceled:      { bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]', icon: AlertTriangle, text: 'text-[#991b1b]' },
  none:          { bg: 'bg-[var(--paper)]', border: 'border-[var(--hairline-2)]', icon: AlertTriangle, text: 'text-[var(--muted)]' },
};

const INVOICE_BADGE: Record<string, string> = {
  DRAFT:          'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  OPEN:           'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  PAID:           'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  UNCOLLECTIBLE:  'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  VOID:           'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

export const BillingPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams] = useSearchParams();
  const { success: toastOk, error: toastErr } = useToast();

  // Flow detection from URL params
  const flow = searchParams.get('flow'); // 'trial' | 'checkout' | null
  const urlPlan = searchParams.get('plan'); // 'starter' | 'professional' | 'enterprise' | null

  // Pre-select plan from query param (set when user clicks CTA on /pricing)
  const initialPlan = (['starter', 'professional', 'enterprise'] as const)
    .find(p => p === urlPlan) ?? 'professional';

  const [selectedPlan, setSelectedPlan] = useState<'trial' | 'starter' | 'professional' | 'enterprise'>(initialPlan);
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  const { data: billing, isLoading } = useGetBillingStatusQuery({ orgId: orgId! });
  const { data: invData } = useListInvoicesQuery({ orgId: orgId! });
  const [provisionTrial, { isLoading: provisioning }] = useProvisionTrialMutation();
  const [createCheckout, { isLoading: checkingOut }] = useCreateCheckoutSessionMutation();
  const [createPortal, { isLoading: portaling }] = useCreatePortalSessionMutation();

  const onCheckout = async () => {
    // Ensure we never try to checkout with 'trial' - shouldn't happen with UI flow, but TypeScript guard
    if (selectedPlan === 'trial') {
      toastErr('Invalid plan', 'Trial cannot be purchased. Please select a paid plan.');
      return;
    }
    try {
      const { checkoutUrl } = await createCheckout({ orgId: orgId!, planId: selectedPlan, interval }).unwrap();
      window.location.href = checkoutUrl; // full redirect so Stripe can set cookies
    } catch (err) {
      toastErr('Checkout failed', toastErrorMessage(err as never));
    }
  };

  const onPortal = async () => {
    try {
      const { portalUrl } = await createPortal({ orgId: orgId! }).unwrap();
      window.open(portalUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toastErr('Portal failed', toastErrorMessage(err as never));
    }
  };

  const onProvision = async () => {
    try {
      await provisionTrial({ orgId: orgId! }).unwrap();
      toastOk('Trial started', '14-day Professional trial is now active.');
    } catch (err) {
      toastErr('Failed', toastErrorMessage(err as never));
    }
  };

  const invoices = invData?.invoices ?? [];
  const state = billing?.billingState ?? 'none';
  const banner = STATE_BANNER[state] ?? STATE_BANNER.none;
  const BannerIcon = banner.icon;

  // Human-readable state summary line
  const stateSummary = (): string => {
    if (!billing) return '';
    const { trial, subscription } = billing;
    if (state === 'active' && subscription) return `${subscription.planName} plan — active`;
    if (state === 'past_due' && subscription) return `${subscription.planName} plan — payment past due`;
    if (state === 'canceled' && subscription) return `${subscription.planName} plan — canceled`;
    if (state === 'trial' && trial) return `Professional trial — ${trial.daysRemaining} day${trial.daysRemaining !== 1 ? 's' : ''} remaining`;
    if (state === 'trial_grace' && trial) return `Trial ended · ${trial.gracePeriodRemainingDays} grace day${trial.gracePeriodRemainingDays !== 1 ? 's' : ''} left`;
    if (state === 'trial_expired') return 'Trial expired — subscribe to continue';
    return 'No active trial or subscription';
  };

  return (
    <div className="p-6 sm:p-8 max-w-2xl space-y-10">

      {/* ── Billing Status Banner ── */}
      <section className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] border-b border-[var(--hairline-2)] pb-2">
          Current status
        </p>

        {isLoading ? (
          <div className="h-20 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />
        ) : (
          <div className={cn('border p-5 flex items-start justify-between gap-4', banner.bg, banner.border)}>
            <div className="flex items-start gap-3">
              <BannerIcon className={cn('mt-0.5 h-4 w-4 shrink-0', banner.text)} strokeWidth={1.75} />
              <div>
                <p className={cn('text-sm font-medium', banner.text)}>{stateSummary()}</p>
                {billing?.trial && (
                  <p className="font-mono text-[10px] text-[var(--muted)] mt-1">
                    {state.startsWith('trial') && `Started ${new Date(billing.trial.startedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} · Expires ${new Date(billing.trial.expiresAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  </p>
                )}
                {billing?.subscription?.currentPeriodEnd && (
                  <p className="font-mono text-[10px] text-[var(--muted)] mt-1">
                    Current period ends {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>

            {/* Trial CTA: Show when user has no billing and flow=trial OR state=none */}
            {(flow === 'trial' || state === 'none') && (
              <button
                onClick={onProvision}
                disabled={provisioning}
                className="shrink-0 inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {provisioning ? 'Starting…' : 'Start free trial'}
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Checkout Flow CTA (for direct purchase intent) ── */}
      {flow === 'checkout' && state === 'none' && !billing?.subscription && (
        <section className="space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] border-b border-[var(--hairline-2)] pb-2">
            Complete your purchase
          </p>
          
          <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
            <div>
              <h3 className="text-lg font-medium">
                {PRICING_PLANS.find(p => p.id === selectedPlan)?.name ?? 'Professional'} Plan
              </h3>
              <p className="text-sm text-[var(--muted)] mt-1">
                {PRICING_PLANS.find(p => p.id === selectedPlan)?.target}
              </p>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-medium">
                {PRICING_PLANS.find(p => p.id === selectedPlan)?.priceMonthlyUSD ?? '$100'}
              </span>
              <span className="text-sm text-[var(--muted)]">
                per month (billed {interval === 'year' ? 'annually' : 'monthly'})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex border border-[var(--hairline-2)]">
                <button
                  type="button"
                  onClick={() => setInterval('month')}
                  className={cn('px-3 py-1.5 text-sm transition-colors', interval === 'month' ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:bg-[var(--surface-2)]')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setInterval('year')}
                  className={cn('px-3 py-1.5 text-sm transition-colors', interval === 'year' ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:bg-[var(--surface-2)]')}
                >
                  Yearly <span className="font-mono text-[10px]">−20%</span>
                </button>
              </div>

              <button
                onClick={onCheckout}
                disabled={checkingOut}
                className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" strokeWidth={1.75} />
                {checkingOut ? 'Redirecting…' : 'Continue to payment'}
              </button>
            </div>

            <p className="text-xs text-[var(--muted)]">
              Want to try first? <a href={`/org/${orgId}/settings/billing?flow=trial`} className="underline hover:text-[var(--ink)]">Start a free 14-day trial</a>
            </p>
          </div>
        </section>
      )}

      {/* ── Plan Selection (existing subscriptions or upgrade flow) ── */}
      {state !== 'active' && flow !== 'checkout' && (
        <section className="space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] border-b border-[var(--hairline-2)] pb-2">
            Choose a plan
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRICING_PLANS.filter(p => p.id !== 'trial').map((plan) => {
              const Icon = PLAN_ICONS[plan.id];
              const price = `$${plan.priceMonthlyUSD.replace('$', '')}`;
              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled={plan.isContact}
                  onClick={() => !plan.isContact && plan.id !== 'trial' && setSelectedPlan(plan.id as 'starter' | 'professional' | 'enterprise')}
                  className={cn(
                    'relative border p-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                    selectedPlan === plan.id
                      ? 'border-[var(--ink)] bg-[var(--surface)]'
                      : 'border-[var(--hairline-2)] bg-[var(--paper)] hover:bg-[var(--surface-2)]',
                  )}
                >
                  {plan.badge && (
                    <span className="absolute -top-2.5 left-3 inline-block px-2 py-0.5 bg-[var(--ink)] text-white text-[9px] font-mono font-semibold uppercase tracking-wider">
                      {plan.badge}
                    </span>
                  )}
                  <Icon className="h-4 w-4 mb-2 text-[var(--muted)]" strokeWidth={1.75} />
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
                    {plan.isContact ? 'Contact sales' : `${plan.priceMonthlyUSD}/mo`}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex border border-[var(--hairline-2)]">
              <button
                type="button"
                onClick={() => setInterval('month')}
                className={cn('px-3 py-1.5 text-sm transition-colors', interval === 'month' ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:bg-[var(--surface-2)]')}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setInterval('year')}
                className={cn('px-3 py-1.5 text-sm transition-colors', interval === 'year' ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:bg-[var(--surface-2)]')}
              >
                Yearly <span className="font-mono text-[10px] text-[var(--muted)]">−20%</span>
              </button>
            </div>

            <button
              onClick={onCheckout}
              disabled={checkingOut}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" strokeWidth={1.75} />
              {checkingOut ? 'Redirecting to Stripe…' : 'Subscribe'}
            </button>
          </div>
        </section>
      )}

      {/* ── Manage Subscription (Customer Portal) ── */}
      {(billing?.subscription != null) && (
        <section className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] border-b border-[var(--hairline-2)] pb-2">
            Manage subscription
          </p>
          <button
            onClick={onPortal}
            disabled={portaling}
            className="inline-flex items-center gap-2 border border-[var(--hairline-2)] px-4 py-2 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50 transition-colors"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
            {portaling ? 'Opening…' : 'Open customer portal'}
          </button>
          <p className="text-xs text-[var(--muted)]">
            Update payment method, download invoices, or cancel your subscription.
          </p>
        </section>
      )}

      {/* ── Invoice History ── */}
      <section className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] border-b border-[var(--hairline-2)] pb-2">
          Invoice history
        </p>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-[var(--hairline-2)] bg-[var(--paper)]">
            <FileText className="h-8 w-8 text-[var(--muted)] mb-2" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No invoices yet.</p>
          </div>
        ) : (
          <div className="border border-[var(--hairline-2)] divide-y divide-[var(--hairline-2)]">
            <div className="grid grid-cols-[1fr_80px_90px_90px_60px] gap-3 px-4 py-2 bg-[var(--surface-2)]">
              {['Number', 'Status', 'Amount', 'Period', ''].map((h) => (
                <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>
              ))}
            </div>
            {invoices.map((inv) => (
              <div key={inv.id} className="grid grid-cols-[1fr_80px_90px_90px_60px] gap-3 items-center px-4 py-3 bg-[var(--paper)]">
                <p className="font-mono text-[10px] truncate">{inv.invoiceNumber ?? '—'}</p>
                <span className={cn('inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit', INVOICE_BADGE[inv.status] ?? '')}>
                  {inv.status}
                </span>
                <p className="font-mono text-[10px]">
                  {(inv.amountPaidCents / 100).toFixed(2)} {inv.currency.toUpperCase()}
                </p>
                <p className="font-mono text-[9px] text-[var(--muted)]">
                  {new Date(inv.periodStart).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
                </p>
                <div>
                  {inv.hostedInvoiceUrl && (
                    <a
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[9px] uppercase text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      View →
                    </a>
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
