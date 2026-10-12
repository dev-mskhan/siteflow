import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { formatCurrency } from '../../lib/utils/index';

export default function HomePage() {
  const [activeCurrency, setActiveCurrency] = useState<'USD' | 'PKR'>('USD');

  const workflowSteps = [
    { num: '01', title: 'Estimate', desc: 'AI takeoff & cost breakdown' },
    { num: '02', title: 'BOQ Matrix', desc: 'Itemized material & labor rates' },
    { num: '03', title: 'Project Execution', desc: 'Critical path & field logs' },
    { num: '04', title: 'Commercials', desc: 'AIA G702 / IPC payment certs' },
  ];

  const features = [
    {
      title: 'Precision Estimating & BOQ',
      category: 'Preconstruction',
      desc: 'Hierarchical Bill of Quantities with CSI MasterFormat & regional item codes. Real-time cost rolled up from subcontractor quotes.',
      icon: '📐',
    },
    {
      title: 'CPM Critical Path Scheduling',
      category: 'Operations',
      desc: 'Automatic critical path calculation, milestone tracking, and task dependency graphs synchronized directly with daily field logs.',
      icon: '⚡',
    },
    {
      title: 'Procurement & Material Chains',
      category: 'Supply Chain',
      desc: 'Purchase orders, delivery tracking, material requests, and 3-way matching between PO, delivery ticket, and vendor invoice.',
      icon: '🚚',
    },
    {
      title: 'Daily Field Telemetry',
      category: 'Site Operations',
      desc: 'Weather capture, crew headcount, equipment runtime, and safety logs submitted from mobile and approved by project managers.',
      icon: '📋',
    },
    {
      title: 'Commercial Retainage & Progress Billing',
      category: 'Financials',
      desc: 'Automated retainage calculations, change order reconciliation, and AIA G702/G703 or Interim Payment Certificates (IPC).',
      icon: '💳',
    },
    {
      title: 'Dual US & Pakistan Localization',
      category: 'Global Standards',
      desc: 'Native support for USD ($) & PKR (Rs.), Square Feet & Marla/Kanal units, and regional tax compliance (Sales Tax / FBR).',
      icon: '🌐',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* ─── Hero Section with Blueprint Dark Depth Glow ─── */}
      <section className="relative pt-20 pb-24 md:pt-32 md:pb-36 px-4 sm:px-6 lg:px-8 text-center hero-glow blueprint-grid overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10 space-y-6">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface-2 text-xs font-mono text-text-muted">
            <span className="w-2 h-2 rounded-full bg-accent-1 animate-pulse" />
            <span>The Construction Operations Operating System</span>
          </div>

          {/* Headline with Brand Gradient */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-text leading-[1.08]">
            From Blueprint to Billing,{' '}
            <span className="gradient-text">Zero Construction Friction</span>.
          </h1>

          {/* Subtext */}
          <p className="text-base sm:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
            Eliminate operational disconnect between the site trailer, estimation room, and accounting desk.
            Built for modern general contractors and engineering teams.
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/trial">
              <Button size="lg" variant="primary" className="w-full sm:w-auto shadow-glow">
                Start 14-Day Free Trial →
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Schedule Engineering Demo
              </Button>
            </Link>
          </div>

          <p className="text-xs text-text-dim font-mono">
            No credit card required • Instant workspace deployment • Multi-currency ready
          </p>
        </div>

        {/* ─── Product Showcase Card ─── */}
        <div className="max-w-5xl mx-auto mt-16 relative z-10">
          <div className="p-3 sm:p-5 rounded-2xl border border-border bg-surface/90 shadow-2xl backdrop-blur-xl text-left">
            {/* Window bar */}
            <div className="flex items-center justify-between pb-4 border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-3 text-xs font-mono text-text-muted">SiteFlow Core — Apex Heights Project #408</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveCurrency('USD')}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                    activeCurrency === 'USD' ? 'bg-accent-1 text-white' : 'bg-surface-2 text-text-muted'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  onClick={() => setActiveCurrency('PKR')}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                    activeCurrency === 'PKR' ? 'bg-accent-1 text-white' : 'bg-surface-2 text-text-muted'
                  }`}
                >
                  PKR (Rs.)
                </button>
              </div>
            </div>

            {/* Mock Live Dashboard Teaser */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-surface-2 border border-border">
                <span className="text-[10px] font-mono text-text-muted uppercase">Contract Budget</span>
                <p className="text-xl font-bold font-mono text-text mt-1">
                  {formatCurrency(activeCurrency === 'USD' ? 4250000 : 1180000000, activeCurrency)}
                </p>
                <span className="text-xs text-success flex items-center gap-1 mt-1 font-mono">
                  ● On Budget (98.2% baseline)
                </span>
              </div>

              <div className="p-4 rounded-xl bg-surface-2 border border-border">
                <span className="text-[10px] font-mono text-text-muted uppercase">BOQ Committed Costs</span>
                <p className="text-xl font-bold font-mono text-text mt-1">
                  {formatCurrency(activeCurrency === 'USD' ? 3120000 : 865000000, activeCurrency)}
                </p>
                <span className="text-xs text-text-muted flex items-center gap-1 mt-1 font-mono">
                  34 POs issued • 92% fulfilled
                </span>
              </div>

              <div className="p-4 rounded-xl bg-surface-2 border border-border">
                <span className="text-[10px] font-mono text-text-muted uppercase">Critical Path Progress</span>
                <p className="text-xl font-bold font-mono text-text mt-1">Day 142 / 280</p>
                <span className="text-xs text-accent-1 flex items-center gap-1 mt-1 font-mono">
                  +3 Days ahead of baseline schedule
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Trust Workflow Strip: Estimate → BOQ → Project → Payment ─── */}
      <section className="py-16 border-y border-border bg-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-xs font-mono font-bold tracking-widest text-accent-1 uppercase">
              The SiteFlow End-to-End Core Lifecycle
            </h2>
            <p className="text-xl font-bold text-text mt-1">One Continuous Flow from Bid to Final Settlement</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflowSteps.map((step, idx) => (
              <div
                key={step.num}
                className="relative p-6 rounded-xl border border-border bg-surface hover:border-accent-1/50 transition-all card-glass"
              >
                <div className="text-2xl font-black font-mono text-text-dim mb-2">{step.num}</div>
                <h3 className="text-base font-bold text-text mb-1">{step.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{step.desc}</p>
                {idx < workflowSteps.length - 1 && (
                  <span className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20 text-text-dim font-bold">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Feature Bento Grid ─── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <h2 className="text-xs font-mono font-bold tracking-widest text-accent-1 uppercase">Core Platform Modules</h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-text">
            Engineered Specifically for Construction Realities
          </h3>
          <p className="text-sm text-text-muted leading-relaxed">
            Generic ERPs and spreadsheets fail on construction sites. SiteFlow combines operational rigor with intuitive modern tooling.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => (
            <Card key={feat.title} className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{feat.icon}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-text-muted border border-border">
                    {feat.category}
                  </span>
                </div>
                <CardTitle className="text-lg">{feat.title}</CardTitle>
                <CardDescription className="leading-relaxed mt-2">{feat.desc}</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Link to="/features" className="text-xs text-accent-1 font-semibold hover:underline inline-flex items-center gap-1">
                  Explore module specs <span>→</span>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ─── Dual US & Pakistan Construction Standards Section ─── */}
      <section className="py-20 border-t border-border bg-surface-2/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-surface-2 border border-border text-xs font-mono text-accent-1">
                Regional Engineering Standards
              </div>
              <h2 className="text-3xl font-extrabold text-text">
                Native Support for Both North American & Pakistani Construction
              </h2>
              <p className="text-sm text-text-muted leading-relaxed">
                Whether managing luxury commercial builds in Houston or large-scale developments across Islamabad and Lahore,
                SiteFlow adapts instantly to local contract laws, measurement units, and tax regulations.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-surface border border-border">
                  <h4 className="text-sm font-bold text-text mb-1">United States (USD)</h4>
                  <ul className="text-xs text-text-muted space-y-1">
                    <li>• CSI MasterFormat 50 divisions</li>
                    <li>• AIA G702 / G703 progress billing</li>
                    <li>• Square Feet, Yards, Tons</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-border">
                  <h4 className="text-sm font-bold text-text mb-1">Pakistan (PKR)</h4>
                  <ul className="text-xs text-text-muted space-y-1">
                    <li>• PEC standard contract formats</li>
                    <li>• Interim Payment Certificates (IPC)</li>
                    <li>• Marla, Kanal, Square Feet units</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Visual Box */}
            <div className="p-6 rounded-2xl border border-border bg-surface card-glass space-y-4">
              <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted">Live Rate Analysis Sample</h4>
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between p-2.5 rounded bg-surface-2 border border-border/80">
                  <span className="text-text-muted">Ready-mix Concrete (Grade C25)</span>
                  <span className="font-bold text-text">PKR 18,500 / m³ ($66.40 / yd³)</span>
                </div>
                <div className="flex justify-between p-2.5 rounded bg-surface-2 border border-border/80">
                  <span className="text-text-muted">Deformed Steel Rebar (Grade 60)</span>
                  <span className="font-bold text-text">PKR 265,000 / Ton ($950 / Ton)</span>
                </div>
                <div className="flex justify-between p-2.5 rounded bg-surface-2 border border-border/80">
                  <span className="text-text-muted">Brickwork in Cement Sand (1:4)</span>
                  <span className="font-bold text-text">PKR 145 / sq ft ($0.52 / sq ft)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA Banner ─── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 text-center hero-glow">
        <div className="max-w-4xl mx-auto p-12 rounded-3xl border border-border bg-surface card-glass relative z-10 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text">
            Start Your 14-Day Free Trial Today
          </h2>
          <p className="text-sm text-text-muted max-w-xl mx-auto leading-relaxed">
            Experience complete control over budgets, critical path schedules, field operations, and payments.
            Setup takes less than two minutes.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/trial">
              <Button size="lg" variant="primary" className="shadow-glow">
                Activate Free Trial Now →
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="secondary">
                View All Plans & Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
