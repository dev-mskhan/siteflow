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
          <p className="text-base sm:text-lg text-text-muted max-w-2xl sm:mx-auto mb-8">
            No surprise add-ons. Unlimited Bill of Quantities line items and free subcontractor trade portal seats on every tier.
          </p>

          {/* Currency Toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-md border border-border bg-surface text-xs font-heading font-bold">
            <button
              type="button"
              onClick={() => setCurrency('PKR')}
              className={`px-3 py-1.5 rounded-sm transition-all ${
                currency === 'PKR' ? 'bg-accent text-accent-contrast shadow-subtle' : 'text-text-muted hover:text-text'
              }`}
            >
              Pakistani Rupees (PKR)
            </button>
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1.5 rounded-sm transition-all ${
                currency === 'USD' ? 'bg-accent text-accent-contrast shadow-subtle' : 'text-text-muted hover:text-text'
              }`}
            >
              US Dollars (USD)
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
              <Card
                key={plan.id}
                className={`flex flex-col justify-between h-full relative ${
                  plan.isPopular ? 'border-accent shadow-elevated ring-1 ring-accent/40' : ''
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-accent text-accent-contrast text-[11px] font-heading font-bold uppercase tracking-wider shadow-sm">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <CardContent className="p-6 sm:p-8 flex flex-col justify-between h-full space-y-6">
                  <div>
                    <h2 className="font-heading text-xl font-bold text-text mb-1">
                      {plan.name}
                    </h2>
                    <p className="text-xs text-text-muted min-h-[36px] leading-relaxed mb-6">
                      {plan.target}
                    </p>

                    {/* Price display */}
                    <div className="mb-6 pb-6 border-b border-border">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-3xl sm:text-4xl font-extrabold text-text">
                          {price}
                        </span>
                        {!isContact && (
                          <span className="text-xs text-text-muted font-normal">
                            / month
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-subtle block mt-1">
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

                  <div className="pt-4 border-t border-border">
                    <Link to="/contact">
                      <Button
                        variant={plan.isPopular ? 'primary' : 'secondary'}
                        className="w-full"
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                      >
                        {plan.ctaLabel}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Note on undecided prices */}
        <div className="max-w-4xl mx-auto mt-12 p-4 rounded-md border border-border bg-bg text-xs text-text-muted">
          <div className="font-heading font-bold text-text mb-1">
            Product Owner Pricing Notes:
          </div>
          <p className="leading-relaxed">
            Where a tier price is listed as <strong>Contact us</strong> (e.g. Enterprise Prime), custom pricing terms will be finalized directly based on organization site count and ERP integration needs. Subcontractor seats are completely free across all plans.
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
                <h3 className="font-heading text-sm font-bold text-text mb-2">
                  {faq.q}
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center bg-drafting-grid">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text mb-3">
            Still deciding on the right plan for your jobs?
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mb-8 max-w-lg mx-auto">
            Talk directly to our operations team. We will review your current active project count and recommend the right setup.
          </p>
          <Link to="/contact">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Book a demo
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
