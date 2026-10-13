import React from 'react';
import { Seo } from '../../components/seo/Seo';
import { SEO_DATA } from '../../content/seo';

const sections = [
  {
    id: 'information-we-collect',
    heading: '1. Information We Collect',
    body: 'SiteFlow collects information necessary to deliver construction operations software services. This includes account information (name, work email, phone number, company name), project data (Bill of Quantities line items, cost rates, daily site work logs, delivery tickets, and payment applications), and technical session metadata (IP address, device type, browser headers).',
  },
  {
    id: 'how-we-use-data',
    heading: '2. How We Use Project & Commercial Data',
    body: 'We process your construction project data solely to operate and maintain the service for your organization. We never sell, monetize, or disclose your project estimates, contractor unit rates, or subcontractor directories to third parties or other contractors on the platform.',
  },
  {
    id: 'storage-and-isolation',
    heading: '3. Data Storage & Tenant Isolation',
    body: 'All customer records are partitioned by organization identifiers. Customer databases are hosted in secure cloud infrastructure with encrypted transport (TLS 1.3) and regular database snapshot backups.',
  },
  {
    id: 'retention-and-deletion',
    heading: '4. Data Retention and Account Deletion',
    body: 'Upon termination of your subscription, your company may request a full export of all project records in standard spreadsheet and PDF formats. Following account closure, customer data is purged from active databases after a 60-day recovery window.',
  },
  {
    id: 'privacy-contact',
    heading: '5. Contact for Privacy Inquiries',
    body: 'For questions concerning data processing practices or to exercise data rights, contact privacy@siteflow.app.',
  },
];

export const PrivacyPage: React.FC = () => (
  <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
    <Seo
      title={SEO_DATA.privacy.title}
      description={SEO_DATA.privacy.description}
      canonical={SEO_DATA.privacy.canonical}
      schemaType="WebPage"
    />

    {/* Header */}
    <section className="border-b border-[var(--hairline)] bg-drafting-grid py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Legal policy
        </p>
        <h1 className="mt-4 text-4xl font-medium tracking-[-0.05em] sm:text-6xl">Privacy Policy</h1>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          Last updated: 12 October 2026
        </p>

        {/* Owner notice */}
        <div className="mt-6 border border-[#fde68a] bg-[#fffbeb] p-4">
          <p className="text-sm leading-6 text-[#92400e]">
            <strong className="font-medium text-[#78350f]">Note for SiteFlow Owner:</strong> This
            draft privacy policy provides standard operational terms for the platform and must be
            formally reviewed by qualified legal counsel in your operating jurisdictions prior to
            commercial launch.
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
