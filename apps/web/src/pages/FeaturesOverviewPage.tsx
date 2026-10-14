import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Calculator,
  Calendar,
  Truck,
  ClipboardList,
  Users,
  FileCheck2,
  TrendingDown,
  Receipt,
  FolderArchive,
} from 'lucide-react';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';
import { FEATURES_DATA } from '../content/features';

const Rail = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12 ${className}`}>
    {children}
  </div>
);

const iconMap: Record<string, React.ElementType> = {
  'estimating-and-boq': Calculator,
  scheduling: Calendar,
  procurement: Truck,
  'field-logs': ClipboardList,
  subcontractors: Users,
  'change-orders': FileCheck2,
  'cost-control': TrendingDown,
  'billing-and-payments': Receipt,
  documents: FolderArchive,
};

export const FeaturesOverviewPage: React.FC = () => {
  const featureList = Object.values(FEATURES_DATA);

  return (
    <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
      <Seo
        title={SEO_DATA.featuresOverview.title}
        description={SEO_DATA.featuresOverview.description}
        canonical={SEO_DATA.featuresOverview.canonical}
        schemaType="SoftwareApplication"
      />

      {/* Hero */}
      <section className="border-b border-[var(--hairline)] bg-drafting-grid py-16 sm:py-20">
        <Rail>
          <div className="mb-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <span className="h-px w-10 bg-[var(--ink)]" />
            Complete operations suite
          </div>
          <h1 className="max-w-3xl text-[clamp(2.4rem,5vw,5rem)] font-medium leading-[0.96] tracking-[-0.065em]">
            Nine modules built <em className="font-serif font-light not-italic italic">strictly</em>{' '}
            for construction
          </h1>
          <p className="mt-6 max-w-[54ch] text-base leading-7 text-[var(--muted)]">
            From the first quantity takeoff to the final retainage release, every feature works
            together without double entry.
          </p>
          <div className="mt-10">
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

      {/* Features grid */}
      <section className="py-20 sm:py-28">
        <Rail>
          {/* Count row */}
          <div className="mb-8 flex items-center justify-between border-b border-[var(--hairline-2)] pb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Modules
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {featureList.length} total
            </p>
          </div>

          {/* Bento grid — 3 col on lg, 2 on md, 1 on sm */}
          <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-2 lg:grid-cols-3">
            {featureList.map((f) => {
              const Icon = iconMap[f.slug] ?? Calculator;
              return (
                <Link
                  key={f.slug}
                  to={`/features/${f.slug}`}
                  className="group flex flex-col justify-between bg-[var(--paper)] p-7 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div>
                    {/* Icon box */}
                    <div className="mb-6 flex h-10 w-10 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)] transition-colors group-hover:border-[var(--ink)] group-hover:bg-[var(--ink)] group-hover:text-white">
                      <Icon className="h-4 w-4" strokeWidth={1.6} />
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                      {f.badge}
                    </p>
                    <h2 className="mt-2 text-lg font-medium tracking-[-0.03em]">{f.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                      {f.supportingSentence}
                    </p>
                  </div>
                  <div className="mt-8 flex items-center justify-between border-t border-[var(--hairline)] pt-5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                      Explore module
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                      strokeWidth={1.6}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </Rail>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--hairline)] bg-[var(--ink)] py-24 text-white sm:py-32">
        <Rail className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
              See it live
            </p>
            <h2 className="mt-6 max-w-2xl text-4xl font-medium leading-[1.02] tracking-[-0.055em] sm:text-5xl">
              All 9 modules live on your active job.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/60">
              Start a free 14-day trial — or let our specialists configure a sample project in PKR
              or USD before the call.
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
