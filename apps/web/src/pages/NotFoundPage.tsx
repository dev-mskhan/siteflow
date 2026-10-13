import React from 'react';
import { Link } from 'react-router-dom';
import { HardHat, ArrowUpRight } from 'lucide-react';
import { Seo } from '../components/seo/Seo';

export const NotFoundPage: React.FC = () => (
  <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
    <Seo
      title="Page Not Found (404) | SiteFlow"
      description="The construction operations page you are looking for does not exist or has been moved."
      canonical="https://siteflow.app/404"
      noindex={true}
    />

    <section className="flex min-h-[calc(100dvh-72px)] items-center justify-center py-20 px-5">
      <div className="w-full max-w-md border border-[var(--hairline-2)] bg-[var(--paper)] p-10 sm:p-14 text-center">
        {/* Icon */}
        <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
          <HardHat className="h-6 w-6" strokeWidth={1.6} />
        </div>

        {/* Eyebrow */}
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          Error 404
        </p>

        {/* Heading */}
        <h1 className="mt-4 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
          Page not <em className="font-serif font-light not-italic italic">found.</em>
        </h1>

        <p className="mx-auto mt-5 max-w-[34ch] text-sm leading-7 text-[var(--muted)]">
          The page you are looking for has been relocated or does not exist. Check the URL or return
          to the homepage.
        </p>

        {/* Actions */}
        <div className="mt-10 flex flex-col items-center gap-3 border-t border-[var(--hairline-2)] pt-8">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]"
          >
            Back to home
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </section>
  </div>
);
