import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUpRight,
  ChevronDown,
  ClipboardList,
  FileCheck2,
  HardHat,
  Play,
  Receipt,
  ShieldCheck,
  Truck,
  Users,
  Sparkles,
  Calculator,
} from 'lucide-react';
import { DemoModal } from '../components/ui/DemoModal';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';
import { useSmartCta } from '../hooks/useSmartCta';

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

const operatingFlow = [
  { label: 'Estimate', detail: 'Lock the BOQ and baseline budget.', icon: FileCheck2 },
  { label: 'Commit', detail: 'Raise POs against live cost codes.', icon: ClipboardList },
  { label: 'Deliver', detail: 'Capture site work and materials.', icon: Truck },
  { label: 'Certify', detail: 'Approve work and release payment.', icon: Receipt },
];

const faqs = [
  {
    q: 'Can site supervisors use SiteFlow from a phone?',
    a: 'Yes. Field screens are designed for everyday smartphones. Labor, deliveries, photos, and notes can be captured quickly, including while offline.',
  },
  {
    q: 'How does SiteFlow prevent budget overruns?',
    a: 'Purchase orders and payment approvals check the remaining balance for each cost code before a commitment is recorded.',
  },
  {
    q: 'Can subcontractors see internal margins?',
    a: 'No. Trade users see only their assigned work, certified amounts, retainage, and payment history.',
  },
  {
    q: 'Does it support Pakistani Rupees and US Dollars?',
    a: 'Yes. SiteFlow supports PKR projects with Marla and Kanal units, and USD projects with CSI divisions and AIA-style retainage.',
  },
];

const Rail = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12 ${className}`}>
    {children}
  </div>
);

const Reveal = ({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial={reduce ? false : 'hidden'}
      whileInView={reduce ? undefined : 'visible'}
      viewport={{ once: true, amount: 0.18 }}
      transition={reduce ? undefined : { delay }}
    >
      {children}
    </motion.div>
  );
};

export const HomePage: React.FC = () => {
  const [activeFaq, setActiveFaq] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  const reduce = useReducedMotion();
  const smartCta = useSmartCta();

  return (
    <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <Seo
        title={SEO_DATA.home.title}
        description={SEO_DATA.home.description}
        canonical={SEO_DATA.home.canonical}
        schemaType="Organization"
        faqs={faqs.map((faq) => ({ question: faq.q, answer: faq.a }))}
      />

      {/* ── Hero ── */}
      <section className="relative border-b border-[var(--hairline)]">
        {/*
          Gradient accent: a faint action-red radial glow anchored bottom-left of the hero,
          behind the headline. Stays well below the text so it's atmospheric not garish.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-[600px] w-[700px]"
          style={{
            background:
              'radial-gradient(ellipse 60% 60% at 10% 100%, rgba(255,30,0,0.08) 0%, transparent 70%)',
          }}
        />

        <Rail className="grid min-h-[calc(100dvh-72px)] grid-cols-1 items-end gap-12 pb-12 pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:pb-16 lg:pt-20">
          <motion.div
            className="max-w-3xl self-center"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <div className="mb-8 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <span className="h-px w-10 bg-[var(--ink)]" />
              Construction operations, connected
            </div>
            {/* AI badge */}
            <Link
              to="/features/ai-assistant"
              className="group mb-6 inline-flex items-center gap-2 border border-[var(--action)] bg-[var(--action-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[rgba(255,30,0,0.10)]"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--action)]" strokeWidth={1.8} />
              <span>Now with AI Assistant</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--action)]">
                New
              </span>
              <ArrowUpRight
                className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.8}
              />
            </Link>
            <h1 className="max-w-6xl text-[clamp(3rem,6vw,6rem)] font-medium leading-[0.96] tracking-[-0.065em]">
              The job is complex.
              <br />
              <em className="font-serif font-light not-italic italic">Control</em> should not be.
            </h1>
            <p className="mt-8 max-w-[54ch] text-base leading-7 text-[var(--muted)] sm:text-lg">
              SiteFlow gives contractors one calm operating view from estimate to payment, so every
              decision is made from the same live job record.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              {/* Primary CTA — action red */}
              <Link
                to={smartCta.href}
                className={`inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--action)] px-5 text-sm font-medium text-white transition-[background-color,transform] duration-[120ms] hover:bg-[var(--action-hover)] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--action)]${smartCta.isLoading ? ' opacity-60 pointer-events-none' : ''}`}
              >
                {smartCta.label}
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
              {/* Secondary CTA — neutral */}
              <button
                type="button"
                onClick={() => setDemoOpen(true)}
                className="inline-flex min-h-12 items-center justify-center gap-2.5 border border-[var(--hairline-2)] bg-white px-5 text-sm font-medium transition-colors hover:border-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]"
              >
                <span className="flex h-5 w-5 items-center justify-center border border-[var(--hairline-2)]">
                  <Play
                    className="h-2.5 w-2.5 translate-x-px fill-[var(--ink)] text-[var(--ink)]"
                    strokeWidth={0}
                  />
                </span>
                Watch demo
              </button>
            </div>
          </motion.div>

          <motion.div
            className="relative"
            initial={reduce ? false : { opacity: 0, x: 28 }}
            animate={reduce ? undefined : { opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <div className="overflow-hidden border border-[var(--hairline-2)] bg-[var(--paper)]">
              <img
                src="/media/hero-poster.jpg"
                alt="Construction team reviewing progress beside a concrete structure"
                className="aspect-[4/5] w-full object-cover grayscale contrast-110 lg:aspect-[5/6]"
                width="900"
                height="1080"
                fetchPriority="high"
              />
              <div className="grid grid-cols-2 border-t border-[var(--hairline-2)] font-mono text-[10px] uppercase tracking-[0.14em]">
                <div className="border-r border-[var(--hairline-2)] p-4 text-[var(--muted)]">
                  Live project record
                </div>
                <div className="p-4 text-right text-[var(--ink)]">PKR / USD ready</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-px border border-[var(--hairline)] bg-[var(--hairline)]">
              <div className="bg-[var(--surface)] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  One source
                </p>
                <p className="mt-2 text-sm leading-6">BOQ, field work, procurement, and payment.</p>
              </div>
              <div className="bg-[var(--surface)] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Every handoff
                </p>
                <p className="mt-2 text-sm leading-6">Visible, permissioned, and auditable.</p>
              </div>
            </div>
          </motion.div>
        </Rail>
      </section>

      {/* ── Marquee strip ── */}
      <div className="overflow-hidden border-b border-[var(--hairline)] bg-[var(--surface-2)] py-3">
        <div className="marquee-track flex min-w-max gap-10 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
          {[
            'Budget control',
            'Field logs',
            'Procurement',
            'Payment certification',
            'Audit trail',
            'PKR / USD',
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
          {[
            'Budget control',
            'Field logs',
            'Procurement',
            'Payment certification',
            'Audit trail',
            'PKR / USD',
          ].map((item) => (
            <span key={`${item}-repeat`}>{item}</span>
          ))}
        </div>
      </div>

      {/* ── Bento features ── */}
      <section className="border-b border-[var(--hairline)] py-24 sm:py-32">
        <Rail>
          <Reveal className="max-w-2xl">
            <h2 className="text-4xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-6xl">
              One job record.
              <br />
              <em className="font-serif font-light not-italic italic">Every</em> handoff.
            </h2>
            <p className="mt-6 max-w-[52ch] text-base leading-7 text-[var(--muted)]">
              The app follows the work, not the org chart. A quantity entered in the estimate can be
              checked at procurement, verified in the field, and certified for payment.
            </p>
          </Reveal>

          <Reveal delay={0.08} className="mt-16">
            <div className="grid-flow-dense grid grid-cols-1 gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] md:grid-cols-12">
              <Link
                to="/features/estimating-and-boq"
                className="group bg-[var(--paper)] p-7 transition-colors hover:bg-[var(--surface-2)] md:col-span-7 md:row-span-2"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Estimating and BOQ
                </p>
                <h3 className="mt-20 max-w-md text-3xl font-medium leading-tight tracking-[-0.04em]">
                  Start with a baseline everyone can trust.
                </h3>
                <p className="mt-5 max-w-md text-sm leading-6 text-[var(--muted)]">
                  Structure scope, rates, markup, and quantities before the first order is raised.
                </p>
                <ArrowUpRight className="mt-12 h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </Link>
              <Link
                to="/features/cost-control"
                className="group bg-[var(--paper)] p-7 transition-colors hover:bg-[var(--surface-2)] md:col-span-5"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Cost control
                </p>
                <h3 className="mt-10 text-2xl font-medium leading-tight tracking-[-0.04em]">
                  Budget, committed, actual.
                </h3>
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                  See the financial state of the job before the overrun reaches the client.
                </p>
              </Link>
              <Link
                to="/features/field-logs"
                className="group bg-[var(--paper)] p-7 transition-colors hover:bg-[var(--surface-2)] md:col-span-5"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Field logs
                </p>
                <h3 className="mt-10 text-2xl font-medium leading-tight tracking-[-0.04em]">
                  Capture the work where it happens.
                </h3>
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                  Daily labor, deliveries, photos, and notes stay attached to the project record.
                </p>
              </Link>
              <Link
                to="/features/procurement"
                className="group bg-[var(--paper)] p-7 transition-colors hover:bg-[var(--surface-2)] md:col-span-4"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Procurement
                </p>
                <h3 className="mt-10 text-xl font-medium leading-tight tracking-[-0.03em]">
                  Deliveries with a paper trail.
                </h3>
              </Link>
              <Link
                to="/features/billing-and-payments"
                className="group bg-[var(--paper)] p-7 transition-colors hover:bg-[var(--surface-2)] md:col-span-8"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Billing and payments
                </p>
                <h3 className="mt-10 text-xl font-medium leading-tight tracking-[-0.03em]">
                  Certify work, calculate retainage, release with confidence.
                </h3>
              </Link>
            </div>
          </Reveal>
        </Rail>
      </section>

      {/* ── Operating flow ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface-2)] py-24 sm:py-32">
        <Rail className="grid grid-cols-1 gap-14 lg:grid-cols-[0.72fr_1.28fr]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="max-w-md text-4xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-6xl">
              From <em className="font-serif font-light not-italic italic">scope</em> to signed
              payment.
            </h2>
            <p className="mt-6 max-w-sm text-base leading-7 text-[var(--muted)]">
              SiteFlow makes the sequence visible. That means fewer duplicate entries, fewer
              surprises, and a cleaner answer when someone asks what happened.
            </p>
          </Reveal>
          <div className="border-l border-[var(--hairline-2)] pl-6 sm:pl-10">
            {operatingFlow.map(({ label, detail, icon: Icon }, index) => (
              <Reveal
                key={label}
                delay={index * 0.05}
                className="border-b border-[var(--hairline-2)] py-8 first:pt-0 last:border-b-0"
              >
                <div className="grid grid-cols-[42px_1fr] gap-5">
                  <div className="flex h-10 w-10 items-center justify-center border border-[var(--hairline-2)] bg-white">
                    <Icon className="h-4 w-4" strokeWidth={1.6} />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                      {String(index + 1).padStart(2, '0')}
                    </p>
                    <h3 className="mt-3 text-2xl font-medium tracking-[-0.03em]">{label}</h3>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">{detail}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Rail>
      </section>

      {/* ── AI Assistant section ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface-2)] py-24 sm:py-32">
        <Rail>
          {/* Section header */}
          <Reveal className="max-w-2xl">
            <div className="mb-5 flex items-center gap-2 border border-[var(--action)] bg-[var(--action-subtle)] px-3 py-1 w-fit">
              <Sparkles className="h-3.5 w-3.5 text-[var(--action)]" strokeWidth={1.8} />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--action)]">
                New
              </span>
            </div>
            <h2 className="text-4xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-6xl">
              Ask your project a{' '}
              <em className="font-serif font-light not-italic italic">question</em>.
            </h2>
            <p className="mt-6 max-w-[52ch] text-base leading-7 text-[var(--muted)]">
              Type in plain English and get an instant answer from your live project data. No
              reports to build, no formulas to write, no spreadsheets to open.
            </p>
          </Reveal>

          {/* Chat preview mockup */}
          <Reveal delay={0.08} className="mt-14">
            <div className="overflow-hidden border border-[var(--hairline-2)] bg-[var(--paper)]">
              {/* Window header */}
              <div className="flex items-center justify-between border-b border-[var(--hairline-2)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center bg-[var(--action)]">
                    <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={1.8} />
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink)]">
                    AI Assistant — Cost & Finance
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[var(--muted)]">Live data</span>
              </div>

              {/* Chat body */}
              <div className="space-y-4 p-6">
                {/* User message */}
                <div className="ml-auto max-w-[80%] border border-[var(--hairline-2)] bg-[var(--surface-2)] px-4 py-3">
                  <p className="text-sm leading-6 text-[var(--ink)]">
                    What is the budget variance on concrete and steel?
                  </p>
                </div>

                {/* AI response */}
                <div className="max-w-[85%] space-y-3">
                  <p className="text-sm leading-6 text-[var(--ink)]">
                    Here is the current budget status for structural works:
                  </p>
                  <div className="border border-[var(--hairline-2)] bg-[var(--surface)]">
                    <div className="grid grid-cols-3 gap-px bg-[var(--hairline-2)]">
                      <div className="bg-[var(--paper)] p-3">
                        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                          Budget
                        </p>
                        <p className="mt-1 text-sm font-medium">PKR 78.5M</p>
                      </div>
                      <div className="bg-[var(--paper)] p-3">
                        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                          Committed
                        </p>
                        <p className="mt-1 text-sm font-medium">PKR 64.2M</p>
                      </div>
                      <div className="bg-[var(--paper)] p-3">
                        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                          Variance
                        </p>
                        <p className="mt-1 text-sm font-medium text-[#166534]">+2.1%</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    Source: get_financial_summary tool call — figures from live project budget data.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Agent cards */}
          <Reveal delay={0.12} className="mt-12">
            <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Five specialised agents
            </p>
            <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-2 lg:grid-cols-5">
              {[
                {
                  icon: TrendingDown,
                  name: 'Cost & Finance',
                  desc: 'Budget, cost, billing, and cash flow',
                },
                {
                  icon: Truck,
                  name: 'Procurement',
                  desc: 'Purchase orders, quotes, deliveries',
                },
                {
                  icon: ShieldCheck,
                  name: 'Safety & Compliance',
                  desc: 'Inspections, incidents, permits',
                },
                {
                  icon: Calculator,
                  name: 'Estimating & BOQ',
                  desc: 'Quantities, takeoffs, cost codes',
                },
                {
                  icon: FileCheck2,
                  name: 'Reports',
                  desc: 'Executive summaries and exports',
                },
              ].map(({ icon: Icon, name, desc }) => (
                <div
                  key={name}
                  className="group bg-[var(--paper)] p-5 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div className="mb-4 flex h-9 w-9 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)] transition-colors group-hover:border-[var(--ink)] group-hover:bg-[var(--ink)] group-hover:text-white">
                    <Icon className="h-4 w-4" strokeWidth={1.6} />
                  </div>
                  <h3 className="text-sm font-medium tracking-[-0.02em]">{name}</h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{desc}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Trust signals */}
          <Reveal delay={0.16} className="mt-10">
            <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-3">
              <div className="bg-[var(--paper)] p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Real numbers only
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--ink)]">
                  Every figure in an AI answer comes from your live project data. No guessing, no
                  made-up numbers.
                </p>
              </div>
              <div className="bg-[var(--paper)] p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  You stay in control
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--ink)]">
                  The AI cannot send messages or create orders without your approval. You review
                  every action first.
                </p>
              </div>
              <div className="bg-[var(--paper)] p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Works across modules
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--ink)]">
                  Ask about budgets, procurement, safety, or documents. The AI routes your question
                  to the right specialist.
                </p>
              </div>
            </div>
          </Reveal>

          {/* CTA */}
          <Reveal delay={0.2} className="mt-10">
            <Link
              to="/features/ai-assistant"
              className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink)]"
            >
              Explore AI Assistant
              <ArrowUpRight
                className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                strokeWidth={1.6}
              />
            </Link>
          </Reveal>
        </Rail>
      </section>

      {/* ── Persona rail ── */}
      <section className="border-b border-[var(--hairline)] py-24 sm:py-32">
        <Rail>
          <Reveal className="max-w-2xl">
            <h2 className="text-4xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-6xl">
              Built for the people who carry the job.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="mt-14">
            <div className="flex snap-x gap-px overflow-x-auto border-y border-[var(--hairline-2)] bg-[var(--hairline-2)] pb-1">
              {[
                {
                  title: 'General contractors',
                  body: 'Protect margin across active projects with one view of forecast, commitments, and certified work.',
                  href: '/for/general-contractors',
                  icon: Users,
                },
                {
                  title: 'Subcontractors',
                  body: 'Submit claims, track retainage, and see payment history without chasing spreadsheets.',
                  href: '/for/subcontractors',
                  icon: HardHat,
                },
                {
                  title: 'Project owners',
                  body: 'Review certified progress and the financial story of the build without leaving the office.',
                  href: '/for/project-owners',
                  icon: ShieldCheck,
                },
              ].map(({ title, body, href, icon: Icon }) => (
                <Link
                  key={title}
                  to={href}
                  className="group min-w-[min(86vw,360px)] snap-start bg-[var(--paper)] p-7 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                  <h3 className="mt-16 text-2xl font-medium tracking-[-0.03em]">{title}</h3>
                  <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{body}</p>
                  <span className="mt-10 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]">
                    Explore role
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </span>
                </Link>
              ))}
            </div>
          </Reveal>
        </Rail>
      </section>

      {/* ── CTA block — dark ink section with action-red gradient accent + action CTA ── */}
      <section className="relative overflow-hidden border-b border-[var(--hairline)] bg-[var(--ink)] py-24 text-white sm:py-32">
        {/*
          Gradient: a tight action-red radial bloom at the top-right corner of the
          dark section — gives it warmth without flooding the ink background.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-[480px] w-[480px]"
          style={{
            background:
              'radial-gradient(ellipse 55% 55% at 100% 0%, rgba(255,30,0,0.18) 0%, transparent 70%)',
          }}
        />
        <Rail className="relative">
          <Reveal>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
              A clearer operating rhythm
            </p>
            <h2 className="mt-6 max-w-3xl text-4xl font-medium leading-[1.02] tracking-[-0.055em] sm:text-6xl">
              See what the job needs next.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/60">
              Replace scattered spreadsheets with a system that carries the project forward from
              estimate to final payment — without double entry.
            </p>
            {/* Action CTA on dark background — white variant so it reads clearly */}
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="inline-flex min-h-12 items-center gap-2 bg-[var(--action)] px-5 text-sm font-medium text-white transition-[background-color,transform] duration-[120ms] hover:bg-[var(--action-hover)] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--action)]"
              >
                Start free trial
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
              <Link
                to="/features"
                className="inline-flex min-h-12 items-center gap-2 border border-white/20 px-5 text-sm font-medium text-white/80 transition-colors duration-[120ms] hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Explore modules
              </Link>
            </div>
          </Reveal>
        </Rail>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 sm:py-32">
        <Rail className="max-w-4xl">
          <Reveal>
            <h2 className="text-4xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-6xl">
              Clear answers, before the next meeting.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="mt-12 border-t border-[var(--hairline-2)]">
            {faqs.map((faq, index) => {
              const open = activeFaq === index;
              return (
                <div key={faq.q} className="border-b border-[var(--hairline-2)]">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setActiveFaq(open ? -1 : index)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ink)]"
                  >
                    <span className="text-base font-medium tracking-[-0.02em]">{faq.q}</span>
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
                    <p className="max-w-2xl pb-6 pr-10 text-sm leading-6 text-[var(--muted)]">
                      {faq.a}
                    </p>
                  </motion.div>
                </div>
              );
            })}
          </Reveal>
        </Rail>
      </section>
    </div>
  );
};
