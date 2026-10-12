import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HardHat, ShieldCheck, Ruler, Coins, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';

export const AboutPage: React.FC = () => {
  return (
    <div className="bg-bg text-text">
      <Seo
        title={SEO_DATA.about.title}
        description={SEO_DATA.about.description}
        canonical={SEO_DATA.about.canonical}
        schemaType="Organization"
      />

      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid text-left sm:text-center">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
            Our Purpose
          </span>
          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-text mb-4">
            Built for the contractors who actually pour the concrete
          </h1>
          <p className="text-base sm:text-lg text-text-muted max-w-2xl sm:mx-auto">
            SiteFlow was created to give small and mid-sized builders a dependable operational system that protects cashflow without requiring months of consultant training.
          </p>
        </div>
      </section>

      {/* Origin Story / Honest Stance */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto space-y-10">
          <div>
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-text mb-4">
              Why we built SiteFlow
            </h2>
            <div className="space-y-4 text-xs sm:text-sm text-text-muted leading-relaxed">
              <p>
                In construction, profit does not disappear in large catastrophes. It leaks away in hundred-dollar drips and thousand-rupee errors: an unbilled design modification, three missed rebar deliveries, an unverified subcontractor invoice, or an outdated spreadsheet formula that undercounted concrete by 8%.
              </p>
              <p>
                Most existing construction software was built for mega-corporations with fifty-person administrative departments. For a contractor running 3 to 15 active sites with a small engineering team, those tools are too complicated, too expensive, and completely unsuited for supervisors entering numbers on dirty phone screens in the midday sun.
              </p>
              <p>
                We built SiteFlow with one rule: every feature must solve a real field problem that contractors experience every single week.
              </p>
            </div>
          </div>

          {/* Honest Operating Facts */}
          <div>
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-3">
              Honest Platform Facts
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-5 space-y-1.5">
                  <div className="flex items-center gap-2 font-heading font-bold text-sm text-text">
                    <Coins className="w-4 h-4 text-accent" />
                    <span>Dual Currency Architecture</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Native support for Pakistani Rupees (PKR) with Marla and Kanal measurement conventions, and US Dollars (USD) with standard CSI MasterFormat divisions.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 space-y-1.5">
                  <div className="flex items-center gap-2 font-heading font-bold text-sm text-text">
                    <ShieldCheck className="w-4 h-4 text-accent" />
                    <span>8 Gated Operational Roles</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Platform Admin, Organization Admin, Project Manager, Finance, Procurement, Site Supervisor, Subcontractor, and Client. Each person sees strictly what they need.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 space-y-1.5">
                  <div className="flex items-center gap-2 font-heading font-bold text-sm text-text">
                    <Ruler className="w-4 h-4 text-accent" />
                    <span>Immutable Audit Log</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Every baseline lock, change order approval, material receipt, and payment certificate records who authorized it, when it happened, and the exact version details.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 space-y-1.5">
                  <div className="flex items-center gap-2 font-heading font-bold text-sm text-text">
                    <HardHat className="w-4 h-4 text-accent" />
                    <span>Data Privacy per Company</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Every contracting company operates within an isolated database schema. Subcontractors and suppliers never see your internal margins or pricing.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center bg-drafting-grid">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text mb-3">
            See how SiteFlow works on your jobs
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mb-8 max-w-lg mx-auto">
            Book a 20-minute demonstration tailored specifically to your active projects in PKR or USD.
          </p>
          <Link to="/contact">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Book a demo
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
