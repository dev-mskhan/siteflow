import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Database, KeyRound, Lock, History } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';

const pillars = [
  {
    icon: Database,
    title: '1. Dedicated Tenant Separation Per Company',
    body: "Every organization on SiteFlow operates inside strict multi-tenant boundaries. Data queries are filtered by organization ID at the database layer. No contractor can ever view, query, or leak another contractor's project estimates, unit rates, or subcontractor lists.",
  },
  {
    icon: KeyRound,
    title: '2. Role-Based Access Control (8 Distinct Roles)',
    body: 'Permissions are strictly enforced based on specific operational duties.',
    roles: [
      { role: 'Organization Admin', desc: 'Full billing and company control.' },
      { role: 'Project Manager', desc: 'Approves baseline BOQ and variations.' },
      { role: 'Finance', desc: 'Authorizes bank payments and tax deductions.' },
      { role: 'Procurement', desc: 'Issues material POs against cost codes.' },
      { role: 'Site Supervisor', desc: 'Enters labor and verifies delivery gate slips.' },
      { role: 'Subcontractor', desc: 'Views assigned items and submits claims only.' },
    ],
  },
  {
    icon: Lock,
    title: '3. Project-Level Access Barriers',
    body: 'Just because an employee or subcontractor is added to your company does not mean they see all projects. Access is granted on a per-project basis. A site supervisor on Tower B cannot view costs or documents on your highway interchange project.',
  },
  {
    icon: History,
    title: '4. Immutable Change History & Audit Logs',
    body: 'Critical construction records cannot be quietly deleted. Whenever an estimate baseline is locked, a change order approved, a slump test recorded, or a payment certificate authorized, SiteFlow records the user identity, timestamp, and previous state into an audit trail.',
  },
];

export const SecurityPage: React.FC = () => (
  <div className="bg-[#fafafa] text-[#0a0a0a]">
    <Seo
      title={SEO_DATA.security.title}
      description={SEO_DATA.security.description}
      canonical={SEO_DATA.security.canonical}
      schemaType="WebPage"
    />

    {/* Header */}
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-[rgba(10,10,10,0.08)] bg-drafting-grid text-left sm:text-center">
      <div className="max-w-4xl mx-auto">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-[#6b6b6b] block mb-3">
          Technical Architecture
        </span>
        <h1 className="text-3xl sm:text-5xl font-heading font-bold tracking-tight text-[#0a0a0a] mb-4">
          How SiteFlow protects your commercial data
        </h1>
        <p className="text-base sm:text-lg text-[#6b6b6b] max-w-2xl sm:mx-auto leading-relaxed">
          Honest architectural facts on tenant isolation, role barriers, and immutable change
          logging. No inflated claims or marketing jargon.
        </p>
      </div>
    </section>

    {/* Pillars */}
    <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto space-y-12">
        {pillars.map(({ icon: Icon, title, body, roles }) => (
          <div key={title} className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-10 h-10 bg-[#f3f3f3] border border-[rgba(10,10,10,0.08)] text-[#0a0a0a] flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="space-y-2 min-w-0">
              <h2 className="font-heading text-lg sm:text-xl font-semibold text-[#0a0a0a]">
                {title}
              </h2>
              <p className="text-xs sm:text-sm text-[#6b6b6b] leading-relaxed">{body}</p>
              {roles && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {roles.map(({ role, desc }) => (
                    <li
                      key={role}
                      className="p-2.5 border border-[rgba(10,10,10,0.08)] bg-[#fafafa] text-xs text-[#6b6b6b]"
                    >
                      <strong className="text-[#0a0a0a] font-semibold">{role}:</strong> {desc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* CTA */}
    <section className="bg-[var(--ink)] py-20 text-white">
      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-end gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_auto] lg:px-12">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
            Questions about our architecture?
          </p>
          <h2 className="mt-6 max-w-2xl text-3xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-4xl">
            Our engineering team is happy to discuss schema isolation, session handling, and data
            backup routines.
          </h2>
        </div>
        <Link
          to="/contact"
          className="inline-flex min-h-12 items-center justify-center gap-2 bg-white px-5 text-sm font-medium text-[var(--ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Contact us
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </div>
    </section>
  </div>
);
