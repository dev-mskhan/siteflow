import React from 'react';
import { Seo } from '../../components/seo/Seo';
import { SEO_DATA } from '../../content/seo';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="bg-bg text-text">
      <Seo
        title={SEO_DATA.privacy.title}
        description={SEO_DATA.privacy.description}
        canonical={SEO_DATA.privacy.canonical}
        schemaType="WebPage"
      />

      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
            Legal Policy
          </span>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-text mb-2">
            Privacy Policy
          </h1>
          <p className="text-xs text-text-muted">
            Last updated: 12 October 2026
          </p>

          {/* Mandatory notice */}
          <div className="mt-4 p-3 rounded-md border border-status-atrisk-border bg-status-atrisk-bg/40 text-xs text-text-muted">
            <strong className="text-text">Note for SiteFlow Owner:</strong> This draft privacy policy provides standard operational terms for the platform and must be formally reviewed by qualified legal counsel in your operating jurisdictions prior to commercial launch.
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-4xl mx-auto space-y-8 text-xs sm:text-sm text-text-muted leading-relaxed">
          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              1. Information We Collect
            </h2>
            <p>
              SiteFlow collects information necessary to deliver construction operations software services. This includes account information (name, work email, phone number, company name), project data (Bill of Quantities line items, cost rates, daily site work logs, delivery tickets, and payment applications), and technical session metadata (IP address, device type, browser headers).
            </p>
          </div>

          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              2. How We Use Project & Commercial Data
            </h2>
            <p>
              We process your construction project data solely to operate and maintain the service for your organization. We never sell, monetize, or disclose your project estimates, contractor unit rates, or subcontractor directories to third parties or other contractors on the platform.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              3. Data Storage & Tenant Isolation
            </h2>
            <p>
              All customer records are partitioned by organization identifiers. Customer databases are hosted in secure cloud infrastructure with encrypted transport (TLS 1.3) and regular database snapshot backups.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              4. Data Retention and Account Deletion
            </h2>
            <p>
              Upon termination of your subscription, your company may request a full export of all project records in standard spreadsheet and PDF formats. Following account closure, customer data is purged from active databases after a 60-day recovery window.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              5. Contact for Privacy Inquiries
            </h2>
            <p>
              For questions concerning data processing practices or to exercise data rights, contact privacy@siteflow.app.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
