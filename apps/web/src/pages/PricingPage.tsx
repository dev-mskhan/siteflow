import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { SmartCtaLink } from '../components/ui/SmartCtaLink';
import { Button } from '../components/ui/Button';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';
import { PRICING_PLANS, PRICING_FAQ } from '../content/pricing';

export const PricingPage: React.FC = () => {

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
          {/* Trial nudge — links to smart CTA destination */}
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
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto">
          {/* 4-card grid: stacks on mobile, 2×2 on tablet, 4 columns on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-6 items-stretch">
            {PRICING_PLANS.map((plan) => {
              const price = plan.priceMonthlyUSD;
              const isContact = plan.isContact;
              const isFree = plan.isFree;

              return (
                /* overflow-visible so the badge positioned above the card is not clipped.
                   Popular tier uses a stronger hairline border instead of shadow (DESIGN.md §6). */
                <div
                  key={plan.id}
                  className={`relative flex flex-col bg-white border ${
                    plan.isPopular
                      ? 'border-[rgba(10,10,10,0.28)]'
                      : isFree
                        ? 'border-accent/30'
                        : 'border-[rgba(10,10,10,0.10)]'
                  }`}
                >
                  {plan.badge && (
                    /* Badge sits above the card — overflow-visible on parent allows this */
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
                      <span
                        className={`inline-block px-3 py-1 ${
                          isFree
                            ? 'bg-accent text-white'
                            : 'bg-[#0a0a0a] text-white'
                        } text-[10px] font-mono font-semibold uppercase tracking-widest`}
                      >
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div
                    className={`p-6 flex flex-col h-full space-y-6 ${plan.badge ? 'pt-8' : ''}`}
                  >
                    <div>
                      <h2 className="font-heading text-xl font-bold text-text mb-1">{plan.name}</h2>
                      <p className="text-xs text-text-muted min-h-[36px] leading-relaxed mb-6">
                        {plan.target}
                      </p>

                      {/* Price display */}
                      <div className="mb-6 pb-6 border-b border-[rgba(10,10,10,0.08)]">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span
                            className={`font-mono ${
                              isFree ? 'text-3xl' : 'text-2xl'
                            } font-bold text-[#0a0a0a] break-all`}
                          >
                            {price}
                          </span>
                          {!isContact && !isFree && (
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
                          {plan.features.map((feat, idx) => (
                            <li key={`${plan.id}-${idx}`} className="flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 text-status-ontrack shrink-0 mt-0.5" />
                              <span className="leading-tight">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[rgba(10,10,10,0.08)] mt-auto">
                      <Link to={plan.ctaHref}>
                        <Button
                          variant={plan.isPopular || plan.isFree ? 'primary' : 'secondary'}
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

          {/* Note on plans */}
          <div className="max-w-4xl mx-auto mt-12 p-4 rounded-md border border-border bg-bg text-xs text-text-muted">
            <div className="font-heading font-bold text-text mb-1">Plan Comparison:</div>
            <p className="leading-relaxed">
              <strong>Trial:</strong> Full Professional features with lower limits (2 projects, 5 members).
              <strong className="ml-2">Starter:</strong> Core execution features only — no procurement chain, subcontractors, payment apps, cost control, or AI chat.
              <strong className="ml-2">Professional:</strong> All features unlocked.
              <strong className="ml-2">Enterprise:</strong> Professional features at scale (100 projects, 500 members).
              Subcontractor seats are free across all plans.
            </p>
          </div>
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

          <div className="space-y-6">
            {PRICING_FAQ.map((faq, idx) => (
              <div key={`faq-${idx}`} className="p-5 rounded-md border border-border bg-surface">
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
            <SmartCtaLink />
          </div>
        </div>
      </section>
    </div>
  );
};
