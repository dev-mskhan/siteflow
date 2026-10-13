import React from 'react';
import { Seo } from '../../components/seo/Seo';
import { SEO_DATA } from '../../content/seo';

const sections = [
  {
    id: 'what-are-cookies',
    heading: '1. What Are Cookies',
    body: 'Cookies are small text files placed on your computer or mobile device when you interact with modern web applications. They allow the platform to remember your sign-in state and preferred project settings.',
  },
  {
    id: 'how-siteflow-uses-cookies',
    heading: '2. How SiteFlow Uses Essential Cookies',
    body: 'SiteFlow uses strictly essential session cookies and local browser storage. These are required to authenticate your user session securely, prevent cross-site request forgery, and remember which active project you selected in the dashboard.',
  },
  {
    id: 'no-third-party-trackers',
    heading: '3. No Third-Party Advertising Trackers',
    body: 'SiteFlow does not sell ad space or embed invasive third-party cross-site advertising trackers on our platform. Your construction project data is never shared with external ad exchanges.',
  },
  {
    id: 'managing-cookies',
    heading: '4. Managing Your Cookies',
    body: 'You may configure your web browser to reject cookies. However, disabling essential session cookies will prevent you from signing in and accessing your projects.',
  },
];

export const CookiesPage: React.FC = () => (
  <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
    <Seo
      title={SEO_DATA.cookies.title}
      description={SEO_DATA.cookies.description}
      canonical={SEO_DATA.cookies.canonical}
      schemaType="WebPage"
    />

    {/* Header */}
    <section className="border-b border-[var(--hairline)] bg-drafting-grid py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Browser storage policy
        </p>
        <h1 className="mt-4 text-4xl font-medium tracking-[-0.05em] sm:text-6xl">Cookie Policy</h1>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          Last updated: 12 October 2026
        </p>

        {/* Owner notice */}
        <div className="mt-6 border border-[#fde68a] bg-[#fffbeb] p-4">
          <p className="text-sm leading-6 text-[#92400e]">
            <strong className="font-medium text-[#78350f]">Note for SiteFlow Owner:</strong> This
            cookie policy must be formally reviewed by qualified legal counsel in accordance with
            local privacy directives (such as ePrivacy / GDPR) before commercial launch.
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
