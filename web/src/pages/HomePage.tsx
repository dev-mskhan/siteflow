import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  HardHat,
  Ruler,
  TrendingUp,
  FileSpreadsheet,
  Coins,
  Truck,
  Users,
  ChevronDown,
  Play,
  Check,
  FileText,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';
import { formatMoney } from '../lib/format';

export const HomePage: React.FC = () => {
  const [currency, setCurrency] = useState<'PKR' | 'USD'>('PKR');
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [heroActiveTab, setHeroActiveTab] = useState<'pour' | 'cashflow' | 'delivery'>('pour');

  const isUSD = currency === 'USD';

  // Demo Financial Data for Section 6 & Hero
  const budgetNum = isUSD ? 2850000 : 148500000;
  const committedNum = isUSD ? 1920000 : 98200000;
  const actualNum = isUSD ? 1440000 : 74600000;
  const forecastNum = isUSD ? 2780000 : 144000000;

  const faqs = [
    {
      question: 'Can site supervisors use this on a regular phone without training?',
      answer: 'Yes. The mobile field screens are built specifically for low-end smartphones on bright, dusty sites. Logging labor or taking photos of delivery slips takes under two minutes.',
    },
    {
      question: 'How does SiteFlow prevent accidental budget overruns?',
      answer: 'Whenever someone creates a Purchase Order or approves a payment, SiteFlow immediately checks the remaining uncommitted balance for that specific cost code. If it exceeds budget, it alerts the Project Manager before commitment.',
    },
    {
      question: 'Can our subcontractors see our internal profit margins?',
      answer: 'No. Subcontractors have their own restricted portal. They only see their assigned line items, approved payment applications, and retainage deductions. Your internal markups and supplier costs remain completely private.',
    },
    {
      question: 'Does it support both Pakistani Rupees and US Dollars?',
      answer: 'Yes. You can run projects in PKR with local unit conventions (Kanal, Marla) and tax withholding, or in USD with standard CSI divisions and retainage rules.',
    },
    {
      question: 'What happens if internet cuts out on the construction site?',
      answer: 'Site supervisors can continue entering daily logs and batch deliveries offline. As soon as the phone reconnects to cellular data or Wi-Fi, the logs synchronize automatically.',
    },
    {
      question: 'Can we export our project data to Excel or PDF?',
      answer: 'Yes. Any Bill of Quantities, payment certificate, or cost summary exports to clean Excel sheets or print-ready PDF certificates with your company header in one click.',
    },
  ];

  return (
    <div className="bg-bg text-text selection:bg-accent selection:text-accent-contrast">
      <Seo
        title={SEO_DATA.home.title}
        description={SEO_DATA.home.description}
        canonical={SEO_DATA.home.canonical}
        schemaType="Organization"
        faqs={faqs}
      />

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: HERO (Outcome headline <= 8 words, subhead, main + 2nd btn, video/poster) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-8 sm:pt-14 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid">
        {/* Ambient Warm Architectural Laser Spotlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-accent/10 via-accent/5 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-left sm:text-center">
          {/* Top Audience Label */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-heading font-semibold mb-6 border bg-surface text-accent border-accent-border shadow-subtle">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span>Built for small and mid-sized contractors</span>
            <span className="text-text-subtle">|</span>
            <span className="text-text-muted font-mono text-[11px]">PKR & USD</span>
          </div>

          {/* Outcome Headline: Exactly 8 words saying result user gets (Rule 9) */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-heading font-extrabold tracking-tight leading-[1.12] mb-5 text-text">
            Protect project profit before{' '}
            <span className="text-accent-gradient inline-block">
              delays wipe it out
            </span>
          </h1>

          {/* One Supporting Sentence */}
          <p className="text-base sm:text-lg lg:text-xl text-text-muted max-w-3xl sm:mx-auto mb-8 sm:mb-10 leading-relaxed font-body">
            SiteFlow unites budgets, Bill of Quantities, daily field logs, and subcontractor payment applications into one clean system every site supervisor understands.
          </p>

          {/* Hero Buttons: Main Button (1st time) + Quiet Second Button */}
          <div className="flex flex-wrap items-center sm:justify-center gap-3.5 mb-12 sm:mb-16">
            <Link to="/contact">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Book a demo
              </Button>
            </Link>

            <Button
              variant="secondary"
              size="lg"
              leftIcon={<Play className="w-4 h-4 fill-current opacity-70" />}
              onClick={() => setVideoModalOpen(true)}
            >
              Watch how it works
            </Button>
          </div>

          {/* ─── HERO VISUAL STAGE WITH FLOATING ANIMATED CARDS ────────── */}
          <div className="relative max-w-4xl mx-auto">
            {/* Floating Card 1: Top Right (Smooth Ambient Hover Bob) */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="hidden md:flex absolute -top-8 -right-6 z-20 items-center gap-3 p-3 rounded-lg border border-border bg-surface/95 backdrop-blur-md shadow-elevated text-left max-w-xs"
            >
              <div className="w-9 h-9 rounded-full bg-status-ontrack-bg text-status-ontrack flex items-center justify-center shrink-0 border border-status-ontrack-border">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-status-ontrack font-heading">
                    Sign-Off Verified
                  </span>
                  <span className="text-[10px] text-text-subtle font-mono">10:45 AM</span>
                </div>
                <div className="text-xs font-bold text-text font-heading">
                  Slab 4 Pour Approved
                </div>
                <div className="text-[11px] text-text-muted">
                  320 m³ C35/45 • Slump 135mm OK
                </div>
              </div>
            </motion.div>

            {/* Floating Card 2: Bottom Left (Smooth Ambient Floating) */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className="hidden md:flex absolute -bottom-8 -left-6 z-20 items-center gap-3 p-3 rounded-lg border border-border bg-surface/95 backdrop-blur-md shadow-elevated text-left max-w-xs"
            >
              <div className="w-9 h-9 rounded-full bg-accent-subtle text-accent flex items-center justify-center shrink-0 border border-accent-border">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-accent font-heading">
                    Committed PO Locked
                  </span>
                </div>
                <div className="text-xs font-bold text-text font-heading">
                  45.0 Ton Rebar Fe 500D
                </div>
                <div className="text-[11px] text-status-ontrack font-mono font-semibold">
                  {formatMoney(isUSD ? 42750 : 11925000, currency)} (-2.4% variance)
                </div>
              </div>
            </motion.div>

            {/* Central Window Container */}
            <div className="rounded-lg border border-border bg-surface shadow-modal overflow-hidden relative">
              {/* Window Chrome Header with Interactive State Tabs */}
              <div className="px-3 sm:px-4 py-2.5 border-b border-border bg-surface-muted flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                  <span className="font-mono text-[11px] ml-1.5 text-text-subtle hidden sm:inline">
                    siteflow.app/gulberg-heights/tower-b
                  </span>
                </div>

                {/* Interactive Simulation Switcher */}
                <div className="flex items-center gap-1 bg-surface p-0.5 rounded border border-border text-[11px]">
                  <button
                    type="button"
                    onClick={() => setHeroActiveTab('pour')}
                    className={`px-2 py-0.5 rounded font-heading font-semibold transition-colors ${
                      heroActiveTab === 'pour' ? 'bg-accent text-accent-contrast' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    Pour Log
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroActiveTab('cashflow')}
                    className={`px-2 py-0.5 rounded font-heading font-semibold transition-colors ${
                      heroActiveTab === 'cashflow' ? 'bg-accent text-accent-contrast' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    Cost Engine
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroActiveTab('delivery')}
                    className={`px-2 py-0.5 rounded font-heading font-semibold transition-colors ${
                      heroActiveTab === 'delivery' ? 'bg-accent text-accent-contrast' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    Gate POs
                  </button>
                </div>
              </div>

              {/* Main Visual Display: Real Construction Site & Dynamic HUD */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-950">
                <img
                  src={
                    heroActiveTab === 'pour'
                      ? '/media/hero-poster.jpg'
                      : heroActiveTab === 'delivery'
                      ? '/media/site-supervisor.jpg'
                      : '/media/rebar-pour.jpg'
                  }
                  alt="Active commercial construction project with structural steel and concrete"
                  width={1280}
                  height={720}
                  className="w-full h-full object-cover transition-opacity duration-300"
                  loading="eager"
                />

                {/* Dark Readable Backdrop Tint */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/35 pointer-events-none" />

                {/* Telemetry Overlays */}
                <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-between text-white pointer-events-none">
                  {/* Top Bar Details */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="bg-black/75 backdrop-blur-md px-3 py-1.5 rounded border border-white/10 flex items-center gap-2 text-xs">
                      <Building2 className="w-3.5 h-3.5 text-accent" />
                      <span className="font-bold">Gulberg Executive Heights — Tower B</span>
                      <span className="text-neutral-400 text-[11px]">| Civil Division 03</span>
                    </div>

                    <div className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>On track — 4th Slab Pour Active</span>
                    </div>
                  </div>

                  {/* Bottom Operational Telemetry Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-black/80 backdrop-blur-md p-2.5 sm:p-3 rounded border border-white/10 text-left">
                      <div className="text-[10px] uppercase font-semibold text-neutral-400">Baseline Budget</div>
                      <div className="text-xs sm:text-base font-bold font-mono text-white">
                        {formatMoney(budgetNum, currency, { compact: true })}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">Approved contract</div>
                    </div>

                    <div className="bg-black/80 backdrop-blur-md p-2.5 sm:p-3 rounded border border-white/10 text-left">
                      <div className="text-[10px] uppercase font-semibold text-neutral-400">Committed (POs)</div>
                      <div className="text-xs sm:text-base font-bold font-mono text-amber-400">
                        {formatMoney(committedNum, currency, { compact: true })}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">Orders with suppliers</div>
                    </div>

                    <div className="bg-black/80 backdrop-blur-md p-2.5 sm:p-3 rounded border border-white/10 text-left">
                      <div className="text-[10px] uppercase font-semibold text-neutral-400">Actual Spent</div>
                      <div className="text-xs sm:text-base font-bold font-mono text-emerald-400">
                        {formatMoney(actualNum, currency, { compact: true })}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">Cleared invoices</div>
                    </div>

                    <div className="bg-black/80 backdrop-blur-md p-2.5 sm:p-3 rounded border border-white/10 text-left">
                      <div className="text-[10px] uppercase font-semibold text-neutral-400">Site Manpower</div>
                      <div className="text-xs sm:text-base font-bold font-mono text-white">
                        42 On Site
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-0.5">3 Trades verified</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: PROOF STRIP (Honest facts only: PKR/USD, 8 roles, audit trail) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-8 sm:py-10 px-4 sm:px-6 lg:px-8 border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0 border border-accent-border">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-heading font-bold text-text">
                Works in PKR and USD
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                Dual currency, Marla/Kanal or SqFt, local tax rules
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-status-ontrack-bg text-status-ontrack flex items-center justify-center shrink-0 border border-status-ontrack-border">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-heading font-bold text-text">
                8 Distinct Project Roles
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                From Site Supervisor to Finance and Subcontractors
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-surface-muted text-text flex items-center justify-center shrink-0 border border-border">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-heading font-bold text-text">
                Every Single Change Recorded
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                Immutable audit trail for every change order & payment
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3: THE PROBLEM (Real daily pain with authentic field context) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-bg">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-12 sm:mb-16">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              The Real Daily Pain
            </span>
            <h2 className="text-2xl sm:text-4xl font-heading font-extrabold tracking-tight text-text mb-4 leading-tight">
              Running sites on scattered spreadsheets costs you money every week
            </h2>
            <p className="text-sm sm:text-base text-text-muted leading-relaxed font-body">
              When crucial project numbers live across five WhatsApp groups and unverified notebook pages, small oversights become expensive disputes before handover.
            </p>
          </div>

          {/* Grid with Photography + Problem Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Visual Context Photo Card */}
            <div className="lg:col-span-5 rounded-lg border border-border overflow-hidden bg-surface flex flex-col justify-between shadow-card">
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-900 relative">
                <img
                  src="/media/site-supervisor.jpg"
                  alt="Site supervisor inspecting digital drawings on rugged tablet"
                  width={600}
                  height={450}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <span className="text-[10px] font-mono uppercase bg-black/60 px-2 py-0.5 rounded border border-white/20">
                    Field Reality
                  </span>
                  <div className="text-xs font-bold font-heading mt-1">
                    Supervisors need fast touch screens, not desktop Excel
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 bg-surface-muted text-xs text-text-muted leading-relaxed">
                SiteFlow replaces lost paper delivery challans and unverified phone authorizations with one single audit trail every supervisor can update in 120 seconds.
              </div>
            </div>

            {/* 3 Specific Problem Statements */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-4">
              <Card>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded bg-status-delayed-bg text-status-delayed flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <h3 className="font-heading text-sm sm:text-base font-bold text-text">
                      Scattered sheets and lost versions
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed pl-9.5">
                    The office works off version 4 of the BOQ while the site supervisor orders materials using version 2. Nobody knows the real quantity remaining until concrete arrives.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded bg-status-atrisk-bg text-status-atrisk flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <h3 className="font-heading text-sm sm:text-base font-bold text-text">
                      Surprise material cost increases
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed pl-9.5">
                    Cement and rebar prices climb, but nobody updates the budget forecast. You only discover the budget overrun when the supplier issues the final demand note.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded bg-status-delayed-bg text-status-delayed flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <h3 className="font-heading text-sm sm:text-base font-bold text-text">
                      Late subcontractor payments
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed pl-9.5">
                    Trade payment applications sit unverified for two weeks because manual checks take too long. Work on the ground slows down when workers have not been paid on time.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 4: HOW IT WORKS (4 steps: Estimate, Project, Site work, Payment) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              Simple 4-Step Flow
            </span>
            <h2 className="text-2xl sm:text-4xl font-heading font-extrabold tracking-tight text-text mb-3 leading-tight">
              From initial bid to cleared payment in one system
            </h2>
            <p className="text-sm sm:text-base text-text-muted">
              Click any step to see how information flows without re-entering numbers.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { num: '01', title: 'Estimate', icon: Ruler, desc: 'Import or build Bill of Quantities with unit rates' },
              { num: '02', title: 'Project', icon: Building2, desc: 'Lock the baseline budget and issue purchase orders' },
              { num: '03', title: 'Site work', icon: HardHat, desc: 'Log daily labor, deliveries, and slump tests' },
              { num: '04', title: 'Payment', icon: CheckCircle2, desc: 'Verify work completed and approve payments cleanly' },
            ].map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeWorkflowStep === idx;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setActiveWorkflowStep(idx)}
                  className={`p-4 rounded-md border text-left transition-all ${
                    isActive
                      ? 'border-accent bg-accent-subtle shadow-card ring-1 ring-accent/30'
                      : 'border-border bg-surface hover:bg-surface-muted'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-accent">{step.num}</span>
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="text-sm font-heading font-bold text-text mb-1">
                    {step.title}
                  </div>
                  <div className="text-[11px] text-text-muted leading-tight">
                    {step.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Feature Card with Photo preview */}
          <Card className="bg-bg overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-12 items-center">
              <div className="p-6 sm:p-8 md:col-span-8 space-y-3">
                <span className="text-xs font-heading font-bold text-accent uppercase tracking-wider">
                  Active Step #{activeWorkflowStep + 1}
                </span>
                <h3 className="text-lg sm:text-xl font-heading font-bold text-text">
                  {activeWorkflowStep === 0 && 'Build exact Bill of Quantities without formulas breaking'}
                  {activeWorkflowStep === 1 && 'Issue Purchase Orders directly tied to cost codes'}
                  {activeWorkflowStep === 2 && 'Site supervisors log daily progress in two minutes'}
                  {activeWorkflowStep === 3 && 'Approve subcontractor payments with zero arguments'}
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  {activeWorkflowStep === 0 && 'Enter your scope, unit rates in PKR or USD, and markup. SiteFlow prevents duplicate line items and locks the baseline contract before ground breaks.'}
                  {activeWorkflowStep === 1 && 'Every commitment is booked against a specific cost code. You see committed costs immediately, long before the vendor invoice arrives.'}
                  {activeWorkflowStep === 2 && 'Works smoothly on low-cost smartphones on dusty sites. Snap photos of delivery challans, record truck batches, and verify workers on site.'}
                  {activeWorkflowStep === 3 && 'Payment applications calculate retainage, advances, and prior payments automatically. Site supervisor verifies, PM approves, finance releases.'}
                </p>

                {/* Main Button: 2nd appearance (middle of page, same wording and style) */}
                <div className="pt-3">
                  <Link to="/contact">
                    <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Book a demo
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Photo Accent */}
              <div className="hidden md:block md:col-span-4 h-full min-h-[220px] relative bg-slate-900 border-l border-border overflow-hidden">
                <img
                  src="/media/rebar-pour.jpg"
                  alt="Construction work execution"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 5: FEATURES (Grid of cards, 6 at most, one benefit sentence each) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-bg">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              Features
            </span>
            <h2 className="text-2xl sm:text-4xl font-heading font-extrabold tracking-tight text-text mb-3 leading-tight">
              Everything you need to run profitable jobs
            </h2>
            <p className="text-sm sm:text-base text-text-muted font-body">
              Six core tools built strictly around how construction actually happens in the field.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: FileSpreadsheet,
                title: 'Structured Bill of Quantities',
                benefit: 'Track line-item quantities and rates so you never overbill or miss contracted work.',
                href: '/features/estimating-and-boq',
              },
              {
                icon: Coins,
                title: 'Budget vs Committed vs Actual',
                benefit: 'Spot cost overruns while they are happening instead of finding out at month end.',
                href: '/features/cost-control',
              },
              {
                icon: HardHat,
                title: 'Daily Field Work Logs',
                benefit: 'Site supervisors log manpower, equipment, and weather in under two minutes from their phones.',
                href: '/features/field-logs',
              },
              {
                icon: Truck,
                title: 'Material Delivery Control',
                benefit: 'Record gate deliveries and mill test certificates before pouring concrete or tying steel.',
                href: '/features/procurement',
              },
              {
                icon: ShieldCheck,
                title: 'Payment Applications & Retainage',
                benefit: 'Approve subcontractor claims with automatic deduction for advances and retainage.',
                href: '/features/billing-and-payments',
              },
              {
                icon: Users,
                title: 'Role-Based Access Control',
                benefit: 'Give clients and subcontractors access to what they need without exposing your profit margins.',
                href: '/features/subcontractors',
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <Link key={f.title} to={f.href} className="group">
                  <Card className="h-full hover:border-accent hover:shadow-card transition-all">
                    <CardContent className="p-5 space-y-2.5">
                      <div className="w-8 h-8 rounded-md bg-accent-subtle text-accent flex items-center justify-center border border-accent-border group-hover:bg-accent group-hover:text-accent-contrast transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="font-heading text-sm font-bold text-text group-hover:text-accent transition-colors">
                        {f.title}
                      </h3>
                      <p className="text-xs text-text-muted leading-relaxed">
                        {f.benefit}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 6: MONEY CONTROL (Budget, Committed, Actual, Forecast with live-looking chart) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              Money Control
            </span>
            <h2 className="text-2xl sm:text-4xl font-heading font-extrabold tracking-tight text-text mb-3 leading-tight">
              Know where every single rupee and dollar stands
            </h2>
            <p className="text-sm sm:text-base text-text-muted">
              Keep committed purchase orders separate from actual spent cash so your forecast never lies.
            </p>
          </div>

          <Card className="bg-bg">
            <CardContent className="p-6 sm:p-8">
              {/* 4 Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
                <div className="p-3.5 rounded-md border border-border bg-surface">
                  <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">
                    1. Baseline Budget
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-text">
                    {formatMoney(budgetNum, currency)}
                  </span>
                  <span className="text-[10px] text-text-subtle block mt-1">Locked contract sum</span>
                </div>

                <div className="p-3.5 rounded-md border border-accent-border bg-accent-subtle">
                  <span className="text-[10px] uppercase font-bold text-accent block mb-1">
                    2. Committed (POs)
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-accent">
                    {formatMoney(committedNum, currency)}
                  </span>
                  <span className="text-[10px] text-text-subtle block mt-1">Orders sent to vendors</span>
                </div>

                <div className="p-3.5 rounded-md border border-status-ontrack-border bg-status-ontrack-bg">
                  <span className="text-[10px] uppercase font-bold text-status-ontrack block mb-1">
                    3. Actual Spent
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-status-ontrack">
                    {formatMoney(actualNum, currency)}
                  </span>
                  <span className="text-[10px] text-text-subtle block mt-1">Cleared bank payments</span>
                </div>

                <div className="p-3.5 rounded-md border border-border bg-surface">
                  <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">
                    4. Forecast at Complete
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-text">
                    {formatMoney(forecastNum, currency)}
                  </span>
                  <span className="text-[10px] text-status-ontrack font-semibold block mt-1">
                    +3.0% under budget
                  </span>
                </div>
              </div>

              {/* Live-looking Cashflow Chart Bar */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-2">
                  <span className="text-text-muted">Cashflow Allocation (Tower B Substructure)</span>
                  <span className="font-mono text-status-ontrack">Healthy Margin Protected</span>
                </div>
                <div className="w-full h-4 rounded-sm overflow-hidden bg-surface-muted border border-border flex">
                  <div style={{ width: '50%' }} className="bg-status-ontrack h-full" title="Actual Spent: 50%" />
                  <div style={{ width: '16%' }} className="bg-accent h-full" title="Committed Orders: 16%" />
                  <div style={{ width: '31%' }} className="bg-border-strong/60 h-full" title="Uncommitted Buffer: 31%" />
                  <div style={{ width: '3%' }} className="bg-status-ontrack/60 h-full" title="Projected Savings" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[11px] text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-status-ontrack inline-block" />
                    <span>Actual Spent ({formatMoney(actualNum, currency, { compact: true })})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-accent inline-block" />
                    <span>Committed Orders ({formatMoney(committedNum, currency, { compact: true })})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-border-strong inline-block" />
                    <span>Uncommitted Budget Buffer</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 7: WORKS YOUR WAY (Pakistan & US setup: currency, units, taxes) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-bg">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              Works Your Way
            </span>
            <h2 className="text-2xl sm:text-4xl font-heading font-extrabold tracking-tight text-text mb-3 leading-tight">
              Tailored for contractors in Pakistan and the United States
            </h2>
            <p className="text-sm sm:text-base text-text-muted">
              Toggle presets to inspect how currency, measurement units, and tax withholding adjust.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pakistan Card */}
            <Card className={currency === 'PKR' ? 'border-accent ring-1 ring-accent/30' : ''}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="ontrack">Pakistan Operations</Badge>
                  <button
                    type="button"
                    onClick={() => setCurrency('PKR')}
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded transition-colors ${
                      currency === 'PKR' ? 'bg-accent text-accent-contrast' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    Set Active
                  </button>
                </div>
                <h3 className="font-heading text-base font-bold text-text">
                  Local Pakistani Contractor Flow
                </h3>
                <ul className="space-y-2 text-xs text-text-muted">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-status-ontrack shrink-0" />
                    <span>Currency: Pakistani Rupees (PKR) with Lakhs & Crores grouping</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-status-ontrack shrink-0" />
                    <span>Area Units: Marla, Kanal, Square Feet, and Running Feet</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-status-ontrack shrink-0" />
                    <span>Tax & Compliance: PRA / FBR Withholding Tax deductions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-status-ontrack shrink-0" />
                    <span>Material Batches: Deformed Steel ASTM A615 & Ordinary Portland Cement</span>
                  </li>
                </ul>
                <div className="pt-2 border-t border-border">
                  <Link
                    to="/construction-software-pakistan"
                    className="text-xs font-heading font-semibold text-accent hover:underline flex items-center gap-1"
                  >
                    <span>Read about the Pakistan Edition</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* US Card */}
            <Card className={currency === 'USD' ? 'border-accent ring-1 ring-accent/30' : ''}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="neutral">United States Operations</Badge>
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded transition-colors ${
                      currency === 'USD' ? 'bg-accent text-accent-contrast' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    Set Active
                  </button>
                </div>
                <h3 className="font-heading text-base font-bold text-text">
                  US Commercial Contractor Flow
                </h3>
                <ul className="space-y-2 text-xs text-text-muted">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-text shrink-0" />
                    <span>Currency: US Dollars (USD) with standard thousand comma separation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-text shrink-0" />
                    <span>Area Units: Square Feet, Square Yards, Linear Feet, Cubic Yards</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-text shrink-0" />
                    <span>AIA-Style Payment Apps: 10% Retainage withholding and release tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-text shrink-0" />
                    <span>CSI MasterFormat: Standard 16/50 Division cost code mapping</span>
                  </li>
                </ul>
                <div className="pt-2 border-t border-border">
                  <Link
                    to="/construction-software-us"
                    className="text-xs font-heading font-semibold text-accent hover:underline flex items-center gap-1"
                  >
                    <span>Read about the US Edition</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 8: QUESTIONS PEOPLE ASK (FAQ, exactly 6 items, plain answers) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
              Questions People Ask
            </span>
            <h2 className="text-2xl sm:text-4xl font-heading font-extrabold tracking-tight text-text mb-3 leading-tight">
              Straightforward answers for site teams
            </h2>
            <p className="text-sm sm:text-base text-text-muted">
              No sales talk. Here is how SiteFlow handles everyday contractor requirements.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={faq.question}
                  className="rounded-md border border-border bg-bg overflow-hidden transition-all"
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
                        className="px-4 pb-4 pt-1 border-t border-border text-xs text-text-muted leading-relaxed font-body"
                      >
                        {faq.answer}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 9: FINAL CALL TO ACTION (Main button appears here 3rd time) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 text-center bg-drafting-grid relative">
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-2xl sm:text-4xl font-heading font-extrabold tracking-tight text-text mb-4 leading-tight">
            Start controlling project cashflow on your next job
          </h2>
          <p className="text-sm sm:text-base text-text-muted mb-8 leading-relaxed font-body">
            Set up your first project in minutes, import your Bill of Quantities, and invite your team.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Main Button: 3rd appearance, same wording and style */}
            <Link to="/contact">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Book a demo
              </Button>
            </Link>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => setVideoModalOpen(true)}
            >
              Watch how it works
            </Button>
          </div>
        </div>
      </section>

      {/* Video Modal Walkthrough Dialog */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl rounded-md border border-border bg-surface overflow-hidden shadow-modal">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="font-heading font-bold text-sm text-text">
                SiteFlow 2-Minute Product Walkthrough
              </div>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                className="text-text-muted hover:text-text text-sm font-semibold p-1"
              >
                Close
              </button>
            </div>
            <div className="aspect-[16/9] w-full bg-black relative">
              <img
                src="/media/hero-poster.jpg"
                alt="Product video overview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mb-3 shadow-lg">
                  <Play className="w-6 h-6 fill-current text-white ml-0.5" />
                </div>
                <h4 className="font-heading font-bold text-base mb-1">
                  How SiteFlow Protects Contractor Cashflow
                </h4>
                <p className="text-xs text-neutral-300 max-w-md">
                  From uploading your initial BOQ to issuing interim payment certificates and tracking labor on the ground.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
