import React, { useState } from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, CheckCircle2, ChevronDown, Globe2 } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Seo } from '../components/seo/Seo';
import { COUNTRIES_DATA } from '../content/countries';
import { SmartCtaLink } from '../components/ui/SmartCtaLink';

const Rail = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12 ${className}`}>
    {children}
  </div>
);

export const CountryPage: React.FC = () => {
  const location = useLocation();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const slug = location.pathname.replace('/', '');
  const country = COUNTRIES_DATA[slug];
  if (!country) return <Navigate to="/" replace />;

  return (
    <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
      <Seo
        title={`${country.title} | SiteFlow`}
        description={country.supportingSentence}
        canonical={`https://siteflow.app/${country.slug}`}
        schemaType="SoftwareApplication"
        faqs={country.faqs}
      />

      {/* Hero */}
      <section className="border-b border-[var(--hairline)] bg-drafting-grid py-16 sm:py-20">
        <Rail>
          <div className="mb-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <Globe2 className="h-3.5 w-3.5" strokeWidth={1.6} />
            {country.badge}
          </div>
          <h1 className="max-w-3xl text-[clamp(2.4rem,5vw,5rem)] font-medium leading-[0.96] tracking-[-0.065em]">
            {country.headline}
          </h1>
          <p className="mt-6 max-w-[54ch] text-base leading-7 text-[var(--muted)]">
            {country.supportingSentence}
          </p>
          <div className="mt-10">
            <SmartCtaLink />
          </div>
        </Rail>
      </section>

      {/* Local problem */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface-2)] py-14 sm:py-20">
        <Rail>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                The local pain
              </p>
              <h2 className="mt-4 text-2xl font-medium tracking-[-0.04em] sm:text-3xl">
                Why generic software fails on local sites
              </h2>
            </div>
            <p className="self-center text-sm leading-7 text-[var(--muted)] lg:pt-2">
              {country.problem}
            </p>
          </div>
        </Rail>
      </section>

      {/* Local standards */}
      <section className="border-b border-[var(--hairline)] py-20 sm:py-28">
        <Rail>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Local engineering standards
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
                Preconfigured for your regional building regulations
              </h2>
            </div>
            {country.units?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                  Supported units:
                </span>
                {country.units.map((u: string) => (
                  <span
                    key={u}
                    className="border border-[var(--hairline-2)] bg-[var(--paper)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]"
                  >
                    {u}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-2">
            {country.localStandards.map((std: { title: string; description: string }) => (
              <div key={std.title} className="bg-[var(--paper)] p-7">
                <CheckCircle2 className="h-4 w-4 text-[#166534]" strokeWidth={1.6} />
                <h3 className="mt-5 text-lg font-medium tracking-[-0.03em]">{std.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{std.description}</p>
              </div>
            ))}
          </div>
        </Rail>
      </section>

      {/* Regional FAQs */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface-2)] py-20 sm:py-28">
        <Rail>
          <div className="mb-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Frequently asked in your region
            </p>
            <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.045em] sm:text-5xl">
              Questions from local contractors
            </h2>
          </div>

          <div className="border-t border-[var(--hairline-2)]">
            {country.faqs.map((faq: { question: string; answer: string }, idx: number) => {
              const open = activeFaq === idx;
              return (
                <div key={faq.question} className="border-b border-[var(--hairline-2)]">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setActiveFaq(open ? null : idx)}
                    className="flex w-full items-center justify-between gap-6 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ink)]"
                  >
                    <span className="text-base font-medium tracking-[-0.02em]">{faq.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                      strokeWidth={1.8}
                    />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
                    className="overflow-hidden"
                  >
                    <p className="max-w-2xl pb-5 pr-10 text-sm leading-7 text-[var(--muted)]">
                      {faq.answer}
                    </p>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </Rail>
      </section>

      {/* CTA */}
      <section className="border-b border-[var(--hairline)] bg-[var(--ink)] py-24 text-white sm:py-32">
        <Rail className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
              Deploy today
            </p>
            <h2 className="mt-6 max-w-2xl text-4xl font-medium leading-[1.02] tracking-[-0.055em] sm:text-5xl">
              {country.title} on your job sites.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/60">
              Start a free 14-day trial — or book a 20-minute demonstration tailored to your active
              projects in PKR or USD.
            </p>
          </div>
          <SmartCtaLink variant="white" />
        </Rail>
      </section>
    </div>
  );
};
