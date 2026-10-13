import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HardHat, ShieldCheck, Ruler, Coins, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';

export const AboutPage: React.FC = () => {
  return (
    <div className="bg-bg text-[#0a0a0a]">
      <Seo
        title={SEO_DATA.about.title}
        description={SEO_DATA.about.description}
        canonical={SEO_DATA.about.canonical}
        schemaType="Organization"
      />

      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-[rgba(10,10,10,0.08)] bg-drafting-grid text-left sm:text-center">
        <div className="max-w-4xl mx-auto">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-[#6b6b6b] block mb-3">
            Our Purpose
          </span>
          <h1 className="text-3xl sm:text-5xl font-heading font-bold tracking-tight text-[#0a0a0a] mb-4">
            Built for the contractors who actually pour the concrete
          </h1>
          <p className="text-base sm:text-lg text-[#6b6b6b] max-w-2xl sm:mx-auto leading-relaxed">
            SiteFlow was created to give small and mid-sized builders a dependable operational
            system that protects cashflow without requiring months of consultant training.
          </p>
        </div>
      </section>

      {/* Origin Story / Honest Stance */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface border-b border-[rgba(10,10,10,0.08)]">
        <div className="max-w-4xl mx-auto space-y-10">
          <div>
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-[#0a0a0a] mb-4">
              Why we built SiteFlow
            </h2>
            <div className="space-y-4 text-xs sm:text-sm text-[#6b6b6b] leading-relaxed">
              <p>
                In construction, profit does not disappear in large catastrophes. It leaks away in
                hundred-dollar drips and thousand-rupee errors: an unbilled design modification,
                three missed rebar deliveries, an unverified subcontractor invoice, or an outdated
                spreadsheet formula that undercounted concrete by 8%.
              </p>
              <p>
                Most existing construction software was built for mega-corporations with
                fifty-person administrative departments. For a contractor running 3 to 15 active
                sites with a small engineering team, those tools are too complicated, too expensive,
                and completely unsuited for supervisors entering numbers on dirty phone screens in
                the midday sun.
              </p>
              <p>
                We built SiteFlow with one rule: every feature must solve a real field problem that
                contractors experience every single week.
              </p>
            </div>
          </div>

          {/* Honest Operating Facts */}
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-[#6b6b6b] block mb-3">
              Honest Platform Facts
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-5 space-y-1.5">
                  <div className="flex items-center gap-2 font-heading font-bold text-sm text-[#0a0a0a]">
                    <Coins className="w-4 h-4 text-[#0a0a0a]" />
                    <span>Dual Currency Architecture</span>
                  </div>
                  <p className="text-xs text-[#6b6b6b] leading-relaxed">
                    Native support for Pakistani Rupees (PKR) with Marla and Kanal measurement
                    conventions, and US Dollars (USD) with standard CSI MasterFormat divisions.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 space-y-1.5">
                  <div className="flex items-center gap-2 font-heading font-bold text-sm text-[#0a0a0a]">
                    <ShieldCheck className="w-4 h-4 text-[#0a0a0a]" />
                    <span>8 Gated Operational Roles</span>
                  </div>
                  <p className="text-xs text-[#6b6b6b] leading-relaxed">
                    Platform Admin, Organization Admin, Project Manager, Finance, Procurement, Site
                    Supervisor, Subcontractor, and Client. Each person sees strictly what they need.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 space-y-1.5">
                  <div className="flex items-center gap-2 font-heading font-bold text-sm text-[#0a0a0a]">
                    <Ruler className="w-4 h-4 text-[#0a0a0a]" />
                    <span>Immutable Audit Log</span>
                  </div>
                  <p className="text-xs text-[#6b6b6b] leading-relaxed">
                    Every baseline lock, change order approval, material receipt, and payment
                    certificate records who authorized it, when it happened, and the exact version
                    details.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 space-y-1.5">
                  <div className="flex items-center gap-2 font-heading font-bold text-sm text-[#0a0a0a]">
                    <HardHat className="w-4 h-4 text-[#0a0a0a]" />
                    <span>Data Privacy per Company</span>
                  </div>
                  <p className="text-xs text-[#6b6b6b] leading-relaxed">
                    Every contracting company operates within an isolated database schema.
                    Subcontractors and suppliers never see your internal margins or pricing.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[var(--ink)] text-white">
        <div className="max-w-[1320px] mx-auto grid grid-cols-1 items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
              Want to learn more?
            </p>
            <h2 className="mt-6 max-w-2xl text-3xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-4xl">
              Talk to the team behind SiteFlow.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/60">
              We work directly with contractors to understand the job-site problems we are solving.
              Reach out any time.
            </p>
          </div>
          <Link
            to="/contact"
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-white px-5 text-sm font-medium text-[var(--ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Get in touch
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      </section>
    </div>
  );
};
