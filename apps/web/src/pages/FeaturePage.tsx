import React, { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ChevronDown, CheckCircle2 } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Seo } from '../components/seo/Seo';
import { FEATURES_DATA } from '../content/features';

const Rail = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12 ${className}`}>
    {children}
  </div>
);

export const FeaturePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const reduce = useReducedMotion();

  const feature = slug ? FEATURES_DATA[slug] : undefined;
  if (!feature) return <Navigate to="/features" replace />;

  const relatedFeatures = feature.relatedSlugs.map((s) => FEATURES_DATA[s]).filter(Boolean);

  return (
    <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
      <Seo
        title={`${feature.title} | Construction Management | SiteFlow`}
        description={feature.supportingSentence}
        canonical={`https://siteflow.app/features/${feature.slug}`}
        schemaType="SoftwareApplication"
        faqs={feature.faqs}
      />

      {/* Hero */}
      <section className="border-b border-[var(--hairline)] bg-drafting-grid py-16 sm:py-20">
        <Rail>
          <div className="mb-5 inline-block border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            {feature.badge}
          </div>
          <h1 className="max-w-3xl text-[clamp(2.4rem,5vw,5rem)] font-medium leading-[0.96] tracking-[-0.065em]">
            {feature.headline}
          </h1>
          <p className="mt-6 max-w-[54ch] text-base leading-7 text-[var(--muted)]">
            {feature.supportingSentence}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
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
                The pain in the field
              </p>
              <h2 className="mt-4 text-2xl font-medium tracking-[-0.04em] sm:text-3xl">
                Why traditional methods fail on site
              </h2>
            </div>
            <p className="self-center text-sm leading-7 text-[var(--muted)] lg:pt-2">
              {feature.problem}
            </p>
          </div>
        </Rail>
      </section>

      {/* Benefits */}
      <section className="border-b border-[var(--hairline)] py-20 sm:py-28">
        <Rail>
          <div className="mb-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Key capabilities
            </p>
            <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.045em] sm:text-5xl">
              How {feature.title} keeps your project protected
            </h2>
          </div>

          {/* Benefits bento */}
          <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-3">
            {feature.benefits.map((b, i) => (
              <div key={b.title} className="bg-[var(--paper)] p-7">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-6 text-lg font-medium tracking-[-0.03em]">{b.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{b.description}</p>
              </div>
            ))}
          </div>

          {/* App preview */}
          <div className="mt-10 border border-[var(--hairline-2)] bg-[var(--paper)]">
            <div className="flex items-center justify-between border-b border-[var(--hairline-2)] px-5 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink)]">
                Live app preview — {feature.title} control
              </span>
              <span className="font-mono text-[10px] text-[var(--muted)]">Active project view</span>
            </div>
            <div className="p-5">
              <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
                {feature.appPreviewDescription}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code &amp; Description</TableHead>
                    <TableHead>Scope Details</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feature.sampleItems.map((item) => (
                    <TableRow key={item.code}>
                      <TableCell>
                        <div className="font-mono text-xs font-bold">{item.code}</div>
                        <div className="text-xs font-medium">{item.title}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--muted)]">
                        {item.meta}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.status}>
                          {item.status === 'ontrack'
                            ? 'On track'
                            : item.status === 'atrisk'
                              ? 'At risk'
                              : 'Delayed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                        >
                          Inspect
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Rail>
      </section>

      {/* FAQ */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface-2)] py-20 sm:py-28">
        <Rail>
          <div className="mb-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Common questions
            </p>
            <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.045em] sm:text-5xl">
              Frequently asked about {feature.title}
            </h2>
          </div>

          <div className="border-t border-[var(--hairline-2)]">
            {feature.faqs.map((faq, idx) => {
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

          {/* Related modules */}
          {relatedFeatures.length > 0 && (
            <div className="mt-14 border-t border-[var(--hairline-2)] pt-10">
              <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Explore related modules
              </p>
              <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-3">
                {relatedFeatures.map((rel) => (
                  <Link
                    key={rel.slug}
                    to={`/features/${rel.slug}`}
                    className="group flex items-start justify-between gap-4 bg-[var(--paper)] p-6 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                        {rel.badge}
                      </p>
                      <h3 className="mt-2 text-sm font-medium">{rel.title}</h3>
                    </div>
                    <ArrowUpRight
                      className="mt-1 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                      strokeWidth={1.6}
                    />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Rail>
      </section>

      {/* CTA */}
      <section className="border-b border-[var(--hairline)] bg-[var(--ink)] py-24 text-white sm:py-32">
        <Rail className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
              Upgrade your workflow
            </p>
            <h2 className="mt-6 max-w-2xl text-4xl font-medium leading-[1.02] tracking-[-0.055em] sm:text-5xl">
              Ready to modernise your{' '}
              <em className="font-serif font-light not-italic italic">
                {feature.title.toLowerCase()}
              </em>{' '}
              process?
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/60">
              Start a free 14-day trial — or book a 20-minute demonstration tailored to your active
              projects in PKR or USD.
            </p>
          </div>
          <Link
            to="/register"
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
