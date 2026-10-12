import React from 'react';
import { useParams, useLocation, Link, Navigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Globe2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Seo } from '../components/seo/Seo';
import { COUNTRIES_DATA } from '../content/countries';

export const CountryPage: React.FC = () => {
  const location = useLocation();

  // Route matches either /construction-software-pakistan or /construction-software-us
  const slug = location.pathname.replace('/', '');
  const country = COUNTRIES_DATA[slug];

  if (!country) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="bg-bg text-text">
      <Seo
        title={`${country.title} | SiteFlow`}
        description={country.supportingSentence}
        canonical={`https://siteflow.app/${country.slug}`}
        schemaType="SoftwareApplication"
        faqs={country.faqs}
      />

      {/* Header */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid text-left sm:text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-heading font-semibold mb-4 border bg-accent-subtle text-accent border-accent-border">
            <Globe2 className="w-3.5 h-3.5" />
            <span>{country.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-text mb-4 leading-tight">
            {country.headline}
          </h1>
          <p className="text-base sm:text-lg text-text-muted max-w-2xl sm:mx-auto mb-8 leading-relaxed">
            {country.supportingSentence}
          </p>
          <div className="flex flex-wrap items-center sm:justify-center gap-3">
            <Link to="/contact">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Book a demo
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="secondary" size="lg">
                View pricing plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Local Problem */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 sm:p-8 rounded-md border border-status-atrisk-border bg-status-atrisk-bg/30">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-status-atrisk block mb-2">
              The Local Pain
            </span>
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-text mb-3">
              Why generic foreign software fails on local construction sites
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              {country.problem}
            </p>
          </div>
        </div>
      </section>

      {/* Local Standards & Units */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-bg">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              Local Engineering Standards
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-text mb-3">
              Preconfigured for your regional building regulations
            </h2>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs text-text-muted mr-2 flex items-center">
                Supported units:
              </span>
              {country.units.map((u) => (
                <Badge key={u} variant="neutral">
                  {u}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {country.localStandards.map((std) => (
              <Card key={std.title}>
                <CardContent className="p-6 space-y-2">
                  <h3 className="font-heading text-base font-bold text-text flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-status-ontrack shrink-0" />
                    <span>{std.title}</span>
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {std.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Regional FAQs */}
          <div className="border border-border rounded-md bg-surface p-6 sm:p-8">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-4">
              Frequently Asked in Your Region
            </span>
            <div className="space-y-4">
              {country.faqs.map((faq) => (
                <div key={faq.question} className="border-b border-border pb-4 last:border-b-0 last:pb-0">
                  <h4 className="font-heading text-sm font-bold text-text mb-1">
                    {faq.question}
                  </h4>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center bg-drafting-grid">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text mb-3">
            Deploy {country.title} on your job sites today
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
