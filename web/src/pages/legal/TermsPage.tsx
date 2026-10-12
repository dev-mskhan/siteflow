import React from 'react';
import { Seo } from '../../components/seo/Seo';
import { SEO_DATA } from '../../content/seo';

export const TermsPage: React.FC = () => {
  return (
    <div className="bg-bg text-text">
      <Seo
        title={SEO_DATA.terms.title}
        description={SEO_DATA.terms.description}
        canonical={SEO_DATA.terms.canonical}
        schemaType="WebPage"
      />

      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
            Subscription Agreement
          </span>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-text mb-2">
            Terms of Service
          </h1>
          <p className="text-xs text-text-muted">
            Last updated: 12 October 2026
          </p>

          {/* Mandatory notice */}
          <div className="mt-4 p-3 rounded-md border border-status-atrisk-border bg-status-atrisk-bg/40 text-xs text-text-muted">
            <strong className="text-text">Note for SiteFlow Owner:</strong> These standard terms of service must be formally reviewed and finalized by qualified legal counsel in your operating jurisdictions prior to commercial launch.
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-4xl mx-auto space-y-8 text-xs sm:text-sm text-text-muted leading-relaxed">
          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              1. Acceptance of Terms
            </h2>
            <p>
              By subscribing to or using the SiteFlow construction operations software ("Service"), you agree on behalf of your contracting organization to be bound by these terms. If you do not agree, you must discontinue platform use.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              2. Permitted Use & Account Responsibilities
            </h2>
            <p>
              Your company is responsible for all activity under your user seats. You agree to maintain accurate organization data and prevent unauthorized sharing of credentials between different trade contractors or unauthorized third parties.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              3. Subscription Fees and Invoicing
            </h2>
            <p>
              Services are billed on a recurring monthly or annual basis as specified in your selected tier (in Pakistani Rupees or US Dollars). Subscriptions renew automatically unless cancelled prior to the end of the current billing cycle.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              4. Operational & Engineering Disclaimer
            </h2>
            <p>
              SiteFlow provides software calculations to assist project accounting, quantity tracking, and milestone logging. SiteFlow is not a licensed structural engineering firm or certified quantity surveying consultancy. Contractors remain solely responsible for professional engineering sign-offs, structural compliance, site safety, and contract administration.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              5. Governing Law and Dispute Resolution
            </h2>
            <p>
              These terms are governed by the applicable commercial laws of your contracted registration jurisdiction. Any disputes shall be submitted to confidential binding arbitration.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
