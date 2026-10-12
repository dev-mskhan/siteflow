import React from 'react';
import { Seo } from '../../components/seo/Seo';
import { SEO_DATA } from '../../content/seo';

export const CookiesPage: React.FC = () => {
  return (
    <div className="bg-bg text-text">
      <Seo
        title={SEO_DATA.cookies.title}
        description={SEO_DATA.cookies.description}
        canonical={SEO_DATA.cookies.canonical}
        schemaType="WebPage"
      />

      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
            Browser Storage Policy
          </span>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-text mb-2">
            Cookie Policy
          </h1>
          <p className="text-xs text-text-muted">
            Last updated: 12 October 2026
          </p>

          {/* Mandatory notice */}
          <div className="mt-4 p-3 rounded-md border border-status-atrisk-border bg-status-atrisk-bg/40 text-xs text-text-muted">
            <strong className="text-text">Note for SiteFlow Owner:</strong> This cookie policy must be formally reviewed by qualified legal counsel in accordance with local privacy directives (such as ePrivacy / GDPR) before commercial launch.
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-4xl mx-auto space-y-8 text-xs sm:text-sm text-text-muted leading-relaxed">
          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              1. What Are Cookies
            </h2>
            <p>
              Cookies are small text files placed on your computer or mobile device when you interact with modern web applications. They allow the platform to remember your sign-in state and preferred project settings.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              2. How SiteFlow Uses Essential Cookies
            </h2>
            <p>
              SiteFlow uses strictly essential session cookies and local browser storage. These are required to authenticate your user session securely, prevent cross-site request forgery, and remember which active project you selected in the dashboard.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              3. No Third-Party Advertising Trackers
            </h2>
            <p>
              SiteFlow does not sell ad space or embed invasive third-party cross-site advertising trackers on our platform. Your construction project data is never shared with external ad exchanges.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-base sm:text-lg font-bold text-text mb-2">
              4. Managing Your Cookies
            </h2>
            <p>
              You may configure your web browser to reject cookies. However, disabling essential session cookies will prevent you from signing in and accessing your projects.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
