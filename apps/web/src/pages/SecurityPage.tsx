import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Database, KeyRound, Lock, History } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';

export const SecurityPage: React.FC = () => {
  return (
    <div className="bg-bg text-text">
      <Seo
        title={SEO_DATA.security.title}
        description={SEO_DATA.security.description}
        canonical={SEO_DATA.security.canonical}
        schemaType="WebPage"
      />

      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid text-left sm:text-center">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
            Technical Architecture
          </span>
          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-text mb-4">
            How SiteFlow protects your commercial data
          </h1>
          <p className="text-base sm:text-lg text-text-muted max-w-2xl sm:mx-auto">
            Honest architectural facts on tenant isolation, role barriers, and immutable change logging. No inflated claims or marketing jargon.
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Pillar 1: Tenant Isolation */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0 border border-accent-border">
              <Database className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <h2 className="font-heading text-lg sm:text-xl font-bold text-text">
                1. Dedicated Tenant Separation Per Company
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Every organization on SiteFlow operates inside strict multi-tenant boundaries. Data queries are filtered by organization ID at the database layer. No contractor can ever view, query, or leak another contractor’s project estimates, unit rates, or subcontractor lists.
              </p>
            </div>
          </div>

          {/* Pillar 2: Role-Based Access Control */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0 border border-accent-border">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <h2 className="font-heading text-lg sm:text-xl font-bold text-text">
                2. Role-Based Access Control (8 Distinct Roles)
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Permissions are strictly enforced based on specific operational duties:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs text-text-muted">
                <li className="p-2.5 rounded border border-border bg-bg">
                  <strong className="text-text">Organization Admin:</strong> Full billing and company control.
                </li>
                <li className="p-2.5 rounded border border-border bg-bg">
                  <strong className="text-text">Project Manager:</strong> Approves baseline BOQ and variations.
                </li>
                <li className="p-2.5 rounded border border-border bg-bg">
                  <strong className="text-text">Finance:</strong> Authorizes bank payments and tax deductions.
                </li>
                <li className="p-2.5 rounded border border-border bg-bg">
                  <strong className="text-text">Procurement:</strong> Issues material POs against cost codes.
                </li>
                <li className="p-2.5 rounded border border-border bg-bg">
                  <strong className="text-text">Site Supervisor:</strong> Enters labor and verifies delivery gate slips.
                </li>
                <li className="p-2.5 rounded border border-border bg-bg">
                  <strong className="text-text">Subcontractor:</strong> Views assigned items and submits claims only.
                </li>
              </ul>
            </div>
          </div>

          {/* Pillar 3: Project-Level Barriers */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0 border border-accent-border">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <h2 className="font-heading text-lg sm:text-xl font-bold text-text">
                3. Project-Level Access Barriers
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Just because an employee or subcontractor is added to your company does not mean they see all projects. Access is granted on a per-project basis. A site supervisor on Tower B cannot view costs or documents on your highway interchange project.
              </p>
            </div>
          </div>

          {/* Pillar 4: Change History */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0 border border-accent-border">
              <History className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <h2 className="font-heading text-lg sm:text-xl font-bold text-text">
                4. Immutable Change History & Audit Logs
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Critical construction records cannot be quietly deleted. Whenever an estimate baseline is locked, a change order approved, a slump test recorded, or a payment certificate authorized, SiteFlow records the user identity, timestamp, and previous state into an audit trail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center bg-drafting-grid border-t border-border">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text mb-3">
            Questions about our technical architecture?
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mb-8 max-w-lg mx-auto">
            Our engineering team is happy to discuss our schema isolation, session handling, and data backup routines.
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
