import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ArrowUpRight } from 'lucide-react';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';

export const ThanksPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isTrial = searchParams.get('intent') === 'trial';

  return (
    <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
      <Seo
        title={SEO_DATA.thanks.title}
        description={SEO_DATA.thanks.description}
        canonical={SEO_DATA.thanks.canonical}
        schemaType="WebPage"
      />

      <section className="flex min-h-[calc(100dvh-72px)] items-center justify-center py-20 px-5">
        <div className="w-full max-w-lg border border-[var(--hairline-2)] bg-[var(--paper)] p-10 sm:p-14 text-center">
          {/* Icon */}
          <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center border border-[#bbf7d0] bg-[#f0fdf4]">
            <CheckCircle2 className="h-7 w-7 text-[#166534]" strokeWidth={1.6} />
          </div>

          {/* Eyebrow */}
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            {isTrial ? 'Trial request received' : 'Demo request received'}
          </p>

          {/* Heading */}
          <h1 className="mt-4 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
            {isTrial ? (
              <>
                You are on the
                <br />
                <em className="font-serif font-light not-italic italic">list.</em>
              </>
            ) : (
              <>
                We will be in
                <br />
                <em className="font-serif font-light not-italic italic">touch.</em>
              </>
            )}
          </h1>

          {/* Body */}
          <p className="mx-auto mt-6 max-w-[38ch] text-sm leading-7 text-[var(--muted)]">
            {isTrial
              ? 'A construction operations specialist will contact you within one business day to confirm your trial setup and configure your first project.'
              : 'We have received your request. A construction operations specialist will review your details and contact you within one business day with scheduled meeting times.'}
          </p>

          {/* What happens next — trial only */}
          {isTrial && (
            <div className="mt-8 border border-[var(--hairline-2)] bg-[var(--surface-2)] p-5 text-left">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                What happens next
              </p>
              <ol className="mt-4 space-y-3">
                {[
                  'We confirm your details and provision your 14-day trial workspace.',
                  'You receive login credentials and a guided setup checklist.',
                  'Your first project goes live — BOQ, cost codes, and team invites ready.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[var(--muted)]">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink)] shrink-0 mt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Actions */}
          <div className="mt-10 flex flex-col items-center gap-3 border-t border-[var(--hairline-2)] pt-8 sm:flex-row sm:justify-center">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]"
            >
              Back to home
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
            <Link
              to="/features"
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--hairline-2)] bg-[var(--paper)] px-5 text-sm font-medium transition-colors hover:border-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]"
            >
              Explore modules
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
