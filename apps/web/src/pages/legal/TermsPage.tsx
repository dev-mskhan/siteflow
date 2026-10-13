import React from 'react';
import { Seo } from '../../components/seo/Seo';
import { SEO_DATA } from '../../content/seo';

const sections = [
  {
    id: 'acceptance',
    heading: '1. Acceptance of Terms',
    body: 'By subscribing to or using the SiteFlow construction operations software ("Service"), you agree on behalf of your contracting organization to be bound by these terms. If you do not agree, you must discontinue platform use.',
  },
  {
    id: 'permitted-use',
    heading: '2. Permitted Use & Account Responsibilities',
    body: 'Your company is responsible for all activity under your user seats. You agree to maintain accurate organization data and prevent unauthorized sharing of credentials between different trade contractors or unauthorized third parties.',
  },
  {
    id: 'subscription-fees',
    heading: '3. Subscription Fees and Invoicing',
    body: 'Services are billed on a recurring monthly or annual basis as specified in your selected tier (in Pakistani Rupees or US Dollars). Subscriptions renew automatically unless cancelled prior to the end of the current billing cycle.',
  },
  {
    id: 'disclaimer',
    heading: '4. Operational & Engineering Disclaimer',
    body: 'SiteFlow provides software calculations to assist project accounting, quantity tracking, and milestone logging. SiteFlow is not a licensed structural engineering firm or certified quantity surveying consultancy. Contractors remain solely responsible for professional engineering sign-offs, structural compliance, site safety, and contract administration.',
  },
  {
    id: 'governing-law',
    heading: '5. Governing Law and Dispute Resolution',
    body: 'These terms are governed by the applicable commercial laws of your contracted registration jurisdiction. Any disputes shall be submitted to confidential binding arbitration.',
  },
];

export const TermsPage: React.FC = () => (
  <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
    <Seo
      title={SEO_DATA.terms.title}
      description={SEO_DATA.terms.description}
      canonical={SEO_DATA.terms.canonical}
      schemaType="WebPage"
    />

    {/* Header */}
    <section className="border-b border-[var(--hairline)] bg-drafting-grid py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Subscription agreement
        </p>
        <h1 className="mt-4 text-4xl font-medium tracking-[-0.05em] sm:text-6xl">
          Terms of Service
        </h1>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          Last updated: 12 October 2026
        </p>

        {/* Owner notice */}
        <div className="mt-6 border border-[#fde68a] bg-[#fffbeb] p-4">
          <p className="text-sm leading-6 text-[#92400e]">
            <strong className="font-medium text-[#78350f]">Note for SiteFlow Owner:</strong> These
            standard terms of service must be formally reviewed and finalized by qualified legal
            counsel in your operating jurisdictions prior to commercial launch.
          </p>
        </div>
      </div>
    </section>

    {/* Body */}
    <section className="py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[240px_1fr]">
          {/* Sticky nav */}
          <nav className="hidden lg:block">
            <ul className="sticky top-24 space-y-1 border-l border-[var(--hairline-2)] pl-4">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="space-y-12">
            {sections.map((s) => (
              <div
                key={s.id}
                id={s.id}
                className="border-b border-[var(--hairline)] pb-12 last:border-b-0 last:pb-0"
              >
                <h2 className="text-xl font-medium tracking-[-0.03em]">{s.heading}</h2>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  </div>
);
