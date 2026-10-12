import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Seo } from '../components/seo/Seo';
import { PERSONAS_DATA } from '../content/personas';

export const PersonaPage: React.FC = () => {
  const { personaSlug } = useParams<{ personaSlug: string }>();

  const persona = personaSlug ? PERSONAS_DATA[personaSlug] : undefined;

  if (!persona) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="bg-bg text-text">
      <Seo
        title={`${persona.title} | Construction Platform | SiteFlow`}
        description={persona.supportingSentence}
        canonical={`https://siteflow.app/for/${persona.slug}`}
        schemaType="SoftwareApplication"
        faqs={persona.faqs}
      />

      {/* Header */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid text-left sm:text-center">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
            {persona.badge}
          </span>
          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-text mb-4 leading-tight">
            {persona.headline}
          </h1>
          <p className="text-base sm:text-lg text-text-muted max-w-2xl sm:mx-auto mb-8 leading-relaxed">
            {persona.supportingSentence}
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

      {/* Problem Box */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 sm:p-8 rounded-md border border-status-atrisk-border bg-status-atrisk-bg/30">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-status-atrisk block mb-2">
              The Everyday Challenge
            </span>
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-text mb-3">
              Where construction profit leaks away
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              {persona.problem}
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-bg">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              Key Advantages
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-text">
              Built specifically for how you work
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {persona.benefits.map((b) => (
              <Card key={b.title}>
                <CardContent className="p-6 space-y-2">
                  <h3 className="font-heading text-base font-bold text-text flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-status-ontrack shrink-0" />
                    <span>{b.title}</span>
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {b.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Workflow Steps */}
          <div className="border border-border rounded-md bg-surface p-6 sm:p-8">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-4">
              Your Daily Step-by-Step Flow
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {persona.workflowSteps.map((step) => (
                <div key={step.num} className="p-3.5 rounded-md border border-border bg-bg">
                  <span className="font-mono text-xs font-bold text-accent block mb-1">
                    {step.num}
                  </span>
                  <div className="font-heading text-xs font-bold text-text mb-1">
                    {step.title}
                  </div>
                  <div className="text-[11px] text-text-muted leading-tight">
                    {step.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              Questions You Might Have
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-text">
              Common questions from {persona.title.toLowerCase()}
            </h2>
          </div>

          <div className="space-y-4 mb-12">
            {persona.faqs.map((faq) => (
              <div key={faq.question} className="p-5 rounded-md border border-border bg-bg">
                <h3 className="font-heading text-sm font-bold text-text mb-2">
                  {faq.question}
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>

          {/* Related Links */}
          <div className="border-t border-border pt-6 flex flex-wrap items-center gap-3">
            <span className="text-xs font-heading font-semibold text-text-muted">
              Recommended modules:
            </span>
            {persona.relatedLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-bg hover:border-accent hover:text-accent transition-colors"
              >
                {link.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center bg-drafting-grid">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text mb-3">
            Start with SiteFlow for {persona.title.toLowerCase()}
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
