import React, { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, CheckCircle2, ChevronDown } from 'lucide-react';
import { Seo } from '../components/seo/Seo';
import { PERSONAS_DATA } from '../content/personas';

const Rail = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12 ${className}`}>
    {children}
  </div>
);

export const PersonaPage: React.FC = () => {
  const { personaSlug } = useParams<{ personaSlug: string }>();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const reduce = useReducedMotion();

  const persona = personaSlug ? PERSONAS_DATA[personaSlug] : undefined;
  if (!persona) return <Navigate to="/" replace />;

  return (
    <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
      <Seo
        title={`${persona.title} | Construction Platform | SiteFlow`}
        description={persona.supportingSentence}
        canonical={`https://siteflow.app/for/${persona.slug}`}
        schemaType="SoftwareApplication"
        faqs={persona.faqs}
      />

      {/* Hero */}
      <section className="border-b border-[var(--hairline)] bg-drafting-grid py-16 sm:py-20">
        <Rail>
          <div className="mb-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <span className="h-px w-10 bg-[var(--ink)]" />
            {persona.badge}
          </div>
          <h1 className="max-w-3xl text-[clamp(2.4rem,5vw,5rem)] font-medium leading-[0.96] tracking-[-0.065em]">
            {persona.headline}
          </h1>
          <p className="mt-6 max-w-[54ch] text-base leading-7 text-[var(--muted)]">
            {persona.supportingSentence}
          </p>
          <div className="mt-10">
            <Link
              to="/contact?intent=trial"
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]"
            >
              Start free trial
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </Rail>
      </section>

      {/* Problem */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface-2)] py-14 sm:py-20">
        <Rail>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                The everyday challenge
              </p>
              <h2 className="mt-4 text-2xl font-medium tracking-[-0.04em] sm:text-3xl">
                Where construction profit leaks away
              </h2>
            </div>
            <p className="self-center text-sm leading-7 text-[var(--muted)] lg:pt-2">
              {persona.problem}
            </p>
          </div>
        </Rail>
      </section>

      {/* Benefits */}
      <section className="border-b border-[var(--hairline)] py-20 sm:py-28">
        <Rail>
          <div className="mb-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Key advantages
            </p>
            <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.045em] sm:text-5xl">
              Built specifically for how you work
            </h2>
          </div>

          {/* Benefits bento */}
          <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-2">
            {persona.benefits.map((b) => (
              <div key={b.title} className="bg-[var(--paper)] p-7">
                <CheckCircle2 className="h-4 w-4 text-[#166534]" strokeWidth={1.6} />
                <h3 className="mt-5 text-lg font-medium tracking-[-0.03em]">{b.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{b.description}</p>
              </div>
            ))}
          </div>

          {/* Workflow steps */}
          <div className="mt-10 border border-[var(--hairline-2)] bg-[var(--surface-2)]">
            <div className="border-b border-[var(--hairline-2)] px-6 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Your daily step-by-step flow
              </p>
            </div>
            <div className="grid gap-px bg-[var(--hairline-2)] sm:grid-cols-2 md:grid-cols-4">
              {persona.workflowSteps.map((step) => (
                <div key={step.num} className="bg-[var(--paper)] p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    {step.num}
                  </p>
                  <h3 className="mt-4 text-sm font-medium leading-snug">{step.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Rail>
      </section>

      {/* FAQs */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface-2)] py-20 sm:py-28">
        <Rail>
          <div className="mb-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Questions you might have
            </p>
            <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.045em] sm:text-5xl">
              Common questions from{' '}
              <em className="font-serif font-light not-italic italic">
                {persona.title.toLowerCase()}
              </em>
            </h2>
          </div>

          <div className="border-t border-[var(--hairline-2)]">
            {persona.faqs.map((faq, idx) => {
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

          {/* Related module links */}
          {persona.relatedLinks?.length > 0 && (
            <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-[var(--hairline-2)] pt-8">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Recommended modules:
              </span>
              {persona.relatedLinks.map((link: { href: string; title: string }) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="inline-flex items-center gap-1.5 border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors hover:border-[var(--ink)]"
                >
                  {link.title}
                  <ArrowUpRight className="h-3 w-3" strokeWidth={1.6} />
                </Link>
              ))}
            </div>
          )}
        </Rail>
      </section>

      {/* CTA */}
      <section className="border-b border-[var(--hairline)] bg-[var(--ink)] py-24 text-white sm:py-32">
        <Rail className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
              Start today
            </p>
            <h2 className="mt-6 max-w-2xl text-4xl font-medium leading-[1.02] tracking-[-0.055em] sm:text-5xl">
              SiteFlow for{' '}
              <em className="font-serif font-light not-italic italic">
                {persona.title.toLowerCase()}
              </em>
              .
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/60">
              Start a free 14-day trial — or book a 20-minute demonstration tailored to your active
              projects in PKR or USD.
            </p>
          </div>
          <Link
            to="/contact?intent=trial"
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-white px-5 text-sm font-medium text-[var(--ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Get started
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </Rail>
      </section>
    </div>
  );
};
