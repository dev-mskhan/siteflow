import React, { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  Check,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Seo } from '../components/seo/Seo';
import { FEATURES_DATA } from '../content/features';

export const FeaturePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const feature = slug ? FEATURES_DATA[slug] : undefined;

  if (!feature) {
    return <Navigate to="/features" replace />;
  }

  const relatedFeatures = feature.relatedSlugs
    .map((s) => FEATURES_DATA[s])
    .filter(Boolean);

  return (
    <div className="bg-bg text-text">
      <Seo
        title={`${feature.title} | Construction Management | SiteFlow`}
        description={feature.supportingSentence}
        canonical={`https://siteflow.app/features/${feature.slug}`}
        schemaType="SoftwareApplication"
        faqs={feature.faqs}
      />

      {/* Header / Hero */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid">
        <div className="max-w-4xl mx-auto text-left sm:text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-heading font-semibold mb-4 border bg-accent-subtle text-accent border-accent-border">
            <span>{feature.badge}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-text mb-4 leading-tight">
            {feature.headline}
          </h1>

          <p className="text-base sm:text-lg text-text-muted max-w-2xl sm:mx-auto mb-8 leading-relaxed">
            {feature.supportingSentence}
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

      {/* The Problem Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 sm:p-8 rounded-md border border-status-atrisk-border bg-status-atrisk-bg/30">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-status-atrisk block mb-2">
              The Pain In The Field
            </span>
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-text mb-3">
              Why traditional methods fail on site
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              {feature.problem}
            </p>
          </div>
        </div>
      </section>

      {/* 3 to 4 Benefits */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-bg">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              Key Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-text">
              How {feature.title} keeps your project protected
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {feature.benefits.map((b, i) => (
              <Card key={b.title}>
                <CardContent className="p-5 space-y-2.5">
                  <div className="w-7 h-7 rounded-md bg-accent text-accent-contrast font-mono text-xs font-bold flex items-center justify-center">
                    0{i + 1}
                  </div>
                  <h3 className="font-heading text-sm font-bold text-text">
                    {b.title}
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {b.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* How It Works In The App (Real UI Component Rendering) */}
          <div className="border border-border rounded-md bg-surface overflow-hidden shadow-card">
            <div className="p-4 bg-surface-muted border-b border-border flex items-center justify-between text-xs">
              <span className="font-heading font-bold text-text">
                Live App Preview — {feature.title} Control
              </span>
              <span className="text-text-subtle font-mono text-[11px]">
                Active Project View
              </span>
            </div>

            <div className="p-4 sm:p-6">
              <p className="text-xs text-text-muted mb-4">
                {feature.appPreviewDescription}
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code & Description</TableHead>
                    <TableHead>Scope Details</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feature.sampleItems.map((item) => (
                    <TableRow key={item.code}>
                      <TableCell>
                        <div className="font-mono text-xs font-bold text-text">
                          {item.code}
                        </div>
                        <div className="text-xs text-text font-medium">
                          {item.title}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-text-muted font-mono">
                        {item.meta}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.status}>
                          {item.status === 'ontrack' ? 'On track' : item.status === 'atrisk' ? 'At risk' : 'Delayed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </section>

      {/* Short Feature FAQ */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              Common Questions
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-text">
              Frequently asked about {feature.title}
            </h2>
          </div>

          <div className="space-y-3 mb-12">
            {feature.faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={faq.question}
                  className="rounded-md border border-border bg-bg overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 font-heading font-semibold text-xs sm:text-sm text-text"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-accent' : 'text-text-muted'
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="px-4 pb-4 pt-1 border-t border-border text-xs text-text-muted leading-relaxed"
                      >
                        {faq.answer}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Links to 2 or 3 related pages */}
          <div className="border-t border-border pt-8">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-text-muted block mb-4">
              Explore Related Modules
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedFeatures.map((rel) => (
                <Link key={rel.slug} to={`/features/${rel.slug}`} className="group">
                  <div className="p-4 rounded-md border border-border bg-bg hover:border-accent hover:shadow-card transition-all">
                    <div className="text-xs font-heading font-bold text-text group-hover:text-accent mb-1">
                      {rel.title}
                    </div>
                    <div className="text-[11px] text-text-muted leading-tight">
                      {rel.badge}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA with Main Button */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 text-center bg-drafting-grid">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text mb-3">
            Ready to upgrade your {feature.title.toLowerCase()} workflow?
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
