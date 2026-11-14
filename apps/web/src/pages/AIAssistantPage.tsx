import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Sparkles, TrendingDown, Truck, ShieldCheck, Calculator, FileCheck2, CheckCircle2 } from 'lucide-react';
import { Seo } from '../components/seo/Seo';
import { SmartCtaLink } from '../components/ui/SmartCtaLink';
import { AgentFlowVisualization } from '../components/visualizations/AgentFlowVisualization';
import { Agent3DIcon } from '../components/visualizations/Agent3DIcon';
import { ParticleBackground } from '../components/visualizations/ParticleBackground';
import { FEATURES_DATA } from '../content/features';

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
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={reduce ? undefined : { delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
    >
      {children}
    </motion.div>
  );
};

export const AIAssistantPage: React.FC = () => {
  const feature = FEATURES_DATA['ai-assistant'];
  const reduce = useReducedMotion();

  return (
    <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
      <Seo
        title={`${feature.title} | Construction AI | SiteFlow`}
        description={feature.supportingSentence}
        canonical="https://siteflow.app/features/ai-assistant"
        schemaType="SoftwareApplication"
        faqs={feature.faqs}
      />

      {/* Hero */}
      <section className="relative border-b border-[var(--hairline)] bg-drafting-grid py-16 sm:py-20 overflow-hidden">
        <ParticleBackground variant="connections" />
        <Rail>
          <div className="relative z-10">
            <div className="mb-5 inline-flex items-center gap-2 border border-[var(--action)] bg-[var(--action-subtle)] px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[var(--action)]" strokeWidth={1.8} />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--action)]">
                {feature.badge}
              </span>
            </div>
            <h1 className="max-w-3xl text-[clamp(2.4rem,5vw,5rem)] font-medium leading-[0.96] tracking-[-0.065em]">
              {feature.headline}
            </h1>
            <p className="mt-6 max-w-[54ch] text-base leading-7 text-[var(--muted)]">
              {feature.supportingSentence}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <SmartCtaLink />
            </div>
          </div>
        </Rail>
      </section>

      {/* Agent Flow Visualization */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface-2)] py-20 sm:py-28">
        <Rail>
          <Reveal>
            <div className="mb-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                How it works
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.045em] sm:text-5xl">
                From question to answer in seconds
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
                Your question is routed to specialized agents that query your live project data.
                Every number in the answer is cited, so you know exactly where it came from.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <AgentFlowVisualization />
          </Reveal>

          <Reveal delay={0.2} className="mt-10">
            <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-3">
              <div className="bg-[var(--paper)] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded border border-[var(--action)] bg-[var(--action)]/5">
                  <span className="font-mono text-sm font-medium text-[var(--action)]">1</span>
                </div>
                <h3 className="mt-5 text-base font-medium">Natural language</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Type your question in plain English. No SQL, no formulas, no report builders.
                </p>
              </div>
              <div className="bg-[var(--paper)] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded border border-[var(--action)] bg-[var(--action)]/5">
                  <span className="font-mono text-sm font-medium text-[var(--action)]">2</span>
                </div>
                <h3 className="mt-5 text-base font-medium">Agent routing</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  The system routes your question to the right specialist agent—cost, procurement, safety, etc.
                </p>
              </div>
              <div className="bg-[var(--paper)] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded border border-[var(--action)] bg-[var(--action)]/5">
                  <span className="font-mono text-sm font-medium text-[var(--action)]">3</span>
                </div>
                <h3 className="mt-5 text-base font-medium">Cited answer</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Get an instant answer backed by real data. Every figure includes the source query.
                </p>
              </div>
            </div>
          </Reveal>
        </Rail>
      </section>

      {/* Agent Specialists */}
      <section className="border-b border-[var(--hairline)] py-20 sm:py-28">
        <Rail>
          <Reveal>
            <div className="mb-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Five specialized agents
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.045em] sm:text-5xl">
                Each agent knows its domain
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Agent3DIcon
                Icon={TrendingDown}
                name="Cost & Finance"
                description="Budget, cost, billing, and cash flow questions"
                delay={0}
              />
              <Agent3DIcon
                Icon={Truck}
                name="Procurement"
                description="Purchase orders, quotes, and delivery tracking"
                delay={0.1}
              />
              <Agent3DIcon
                Icon={ShieldCheck}
                name="Safety & Compliance"
                description="Quality inspections, safety events, and permits"
                delay={0.2}
              />
              <Agent3DIcon
                Icon={Calculator}
                name="Estimating & BOQ"
                description="Quantities, takeoffs, and cost codes"
                delay={0.3}
              />
              <Agent3DIcon
                Icon={FileCheck2}
                name="Reports"
                description="Executive summaries and data exports"
                delay={0.4}
              />
            </div>
          </Reveal>
        </Rail>
      </section>

      {/* Benefits */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface-2)] py-20 sm:py-28">
        <Rail>
          <Reveal>
            <div className="mb-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Built for trust
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.045em] sm:text-5xl">
                Real numbers only. No guessing.
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-3">
              {feature.benefits.map((benefit, index) => (
                <div key={benefit.title} className="bg-[var(--paper)] p-7">
                  <div className="flex items-center gap-3 text-[var(--action)]">
                    <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em]">
                      {String(index + 1).padStart(2, '0')}
                    </p>
                  </div>
                  <h3 className="mt-6 text-lg font-medium tracking-[-0.03em]">{benefit.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{benefit.description}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </Rail>
      </section>

      {/* FAQ */}
      <section className="border-b border-[var(--hairline)] py-20 sm:py-28">
        <Rail>
          <Reveal>
            <div className="mb-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Common questions
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.045em] sm:text-5xl">
                What people ask about AI Assistant
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] lg:grid-cols-2">
              {feature.faqs.map((faq, index) => (
                <div key={faq.question} className="bg-[var(--paper)] p-7">
                  <h3 className="text-base font-medium">{faq.question}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{faq.answer}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </Rail>
      </section>

      {/* CTA */}
      <section className="border-b border-[var(--hairline)] bg-[var(--ink)] py-24 text-white sm:py-32">
        <Rail className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
              Ask better questions
            </p>
            <h2 className="mt-6 max-w-2xl text-4xl font-medium leading-[1.02] tracking-[-0.055em] sm:text-5xl">
              Ready to talk to your{' '}
              <em className="font-serif font-light not-italic italic">project</em>?
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/60">
              Start a free 14-day trial and ask your first question. No credit card required.
            </p>
          </div>
          <SmartCtaLink variant="white" />
        </Rail>
      </section>
    </div>
  );
};
