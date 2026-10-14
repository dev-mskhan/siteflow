import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';
import { PRICING_PLANS, PRICING_FAQ } from '../content/pricing';

export const PricingPage: React.FC = () => {
  const [currency, setCurrency] = useState<'PKR' | 'USD'>('PKR');

  return (
    <div className="bg-bg text-text">
      <Seo
        title={SEO_DATA.pricing.title}
        description={SEO_DATA.pricing.description}
        canonical={SEO_DATA.pricing.canonical}
        schemaType="SoftwareApplication"
        faqs={PRICING_FAQ.map((f) => ({ question: f.q, answer: f.a }))}
      />

      {/* Header */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid text-left sm:text-center">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
            Transparent Subscription
          </span>
          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-text mb-4">
            Predictable plans that scale with your project volume
          </h1>
          <p className="text-base sm:text-lg text-text-muted max-w-2xl sm:mx-auto mb-4">
            No surprise add-ons. Unlimited Bill of Quantities line items and free subcontractor
            trade portal seats on every tier.
          </p>
          {/* Trial nudge */}
          <p className="text-sm font-medium text-[#0a0a0a] mb-8">
            Every paid plan starts with a{' '}
            <Link
              to="/register"
              className="underline underline-offset-4 hover:opacity-60 transition-opacity"
            >
              14-day free trial
            </Link>
            . No credit card required.
          </p>

          {/* Currency Toggle */}
          <div className="inline-flex items-center gap-1 p-1 border border-[rgba(10,10,10,0.12)] bg-white text-xs font-mono font-semibold">
            <button
              type="button"
              onClick={() => setCurrency('PKR')}
              className={`px-3 py-1.5 transition-colors duration-[120ms] ${
                currency === 'PKR' ? 'bg-[#0a0a0a] text-white' : 'text-[#6b6b6b] hover:bg-[#f3f3f3]'
              }`}
            >
              PKR
            </button>
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1.5 transition-colors duration-[120ms] ${
                currency === 'USD' ? 'bg-[#0a0a0a] text-white' : 'text-[#6b6b6b] hover:bg-[#f3f3f3]'
              }`}
            >
              USD
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {PRICING_PLANS.map((plan) => {
            const price = currency === 'PKR' ? plan.priceMonthlyPKR : plan.priceMonthlyUSD;
            const isContact = price === 'Contact us';

            return (
              /* overflow-visible so the badge positioned above the card is not clipped.
                 Popular tier uses a stronger hairline border instead of shadow (DESIGN.md §6). */
              <div
                key={plan.id}
                className={`relative flex flex-col bg-white border ${
                  plan.isPopular ? 'border-[rgba(10,10,10,0.28)]' : 'border-[rgba(10,10,10,0.10)]'
                }`}
              >
                {plan.badge && (
                  /* Badge sits above the card — overflow-visible on parent allows this */
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
                    <span className="inline-block px-3 py-1 bg-[#0a0a0a] text-white text-[10px] font-mono font-semibold uppercase tracking-widest">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div
                  className={`p-6 sm:p-8 flex flex-col h-full space-y-6 ${plan.badge ? 'pt-8' : ''}`}
                >
                  <div>
                    <h2 className="font-heading text-xl font-bold text-text mb-1">{plan.name}</h2>
                    <p className="text-xs text-text-muted min-h-[36px] leading-relaxed mb-6">
                      {plan.target}
                    </p>

                    {/* Price display */}
                    <div className="mb-6 pb-6 border-b border-[rgba(10,10,10,0.08)]">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-mono text-2xl font-bold text-[#0a0a0a] break-all">
                          {price}
                        </span>
                        {!isContact && (
                          <span className="text-xs text-[#6b6b6b] font-normal shrink-0">
                            / month
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#9b9b9b] block mt-1">
                        {plan.billingInterval}
                      </span>
                    </div>

                    {/* Feature list */}
                    <div className="space-y-3">
                      <div className="text-[11px] font-heading font-bold uppercase tracking-wider text-text-subtle">
                        What is included:
                      </div>
                      <ul className="space-y-2.5 text-xs text-text-muted">
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-status-ontrack shrink-0 mt-0.5" />
                            <span className="leading-tight">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[rgba(10,10,10,0.08)]">
                    <Link
                      to={
                        plan.ctaLabel === 'Start free trial' ? '/register' : '/contact'
                      }
                    >
                      <Button
                        variant={plan.isPopular ? 'primary' : 'secondary'}
                        className="w-full"
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                      >
                        {plan.ctaLabel}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Note on undecided prices */}
        <div className="max-w-4xl mx-auto mt-12 p-4 rounded-md border border-border bg-bg text-xs text-text-muted">
          <div className="font-heading font-bold text-text mb-1">Product Owner Pricing Notes:</div>
          <p className="leading-relaxed">
            Where a tier price is listed as <strong>Contact us</strong> (e.g. Enterprise Prime),
            custom pricing terms will be finalized directly based on organization site count and ERP
            integration needs. Subcontractor seats are completely free across all plans.
          </p>
        </div>
      </section>

      {/* Pricing FAQs */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-bg border-b border-border">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10 text-center">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              Subscription Questions
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-text">
              Frequently asked about SiteFlow plans
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PRICING_FAQ.map((faq) => (
              <div key={faq.q} className="p-5 rounded-md border border-border bg-surface">
                <h3 className="font-heading text-sm font-bold text-text mb-2">{faq.q}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center bg-drafting-grid">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text mb-3">
            Still deciding on the right plan?
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mb-8 max-w-lg mx-auto">
            Start a free 14-day trial and explore with your real projects — or talk to our team to
            find the right tier for your organization.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]"
            >
              Start free trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
