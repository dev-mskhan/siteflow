import React, { useState } from 'react';
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
  Palette,
  Check,
  Layers,
  ChevronDown,
  DollarSign,
  Coins,
  FileText,
  Truck,
  Users,
  Eye,
  Briefcase,
  Play,
  HelpCircle,
  Sparkles,
  LayoutDashboard,
  Compass,
} from 'lucide-react';

type LandingDesignKey = 'designA' | 'designB' | 'designC';

interface LandingDesignConfig {
  key: LandingDesignKey;
  name: string;
  tagline: string;
  concept: string;
  heroBackground: string;
  heroText: string;
  heroMuted: string;
  cardBg: string;
  cardBorder: string;
  accentAmber: string;
  accentGradient: string;
  gridStyle: string;
}

const LANDING_DESIGNS: Record<LandingDesignKey, LandingDesignConfig> = {
  designA: {
    key: 'designA',
    name: 'Design A: The Drafting Floor & Laser Axis',
    tagline: 'Architectural precision with laser datum lines and tactile drafting grid',
    concept:
      'Warm limestone chalk backdrop with subtle millimeter drafting grids, clean slate text, and a glowing laser-orange axis line that guides the eye. High outdoor legibility with pure architectural discipline.',
    heroBackground: '#F8F9FA',
    heroText: '#1A1D20',
    heroMuted: '#606870',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E6EA',
    accentAmber: '#E65100',
    accentGradient: 'linear-gradient(135deg, #E65100 0%, #C2410C 100%)',
    gridStyle:
      'radial-gradient(#E2E6EA 1px, transparent 1px) [background-size:24px_24px]',
  },
  designB: {
    key: 'designB',
    name: 'Design B: The Monolith & Site Command',
    tagline: 'Cinematic sunset site contrast with high-visibility hazard accents',
    concept:
      'A commanding dark basalt hero zone (#13171C) inspired by evening concrete pours and illuminated cranes, seamlessly transitioning into calm stone-white panels for the features and problem sections. Delivers massive drama and trust.',
    heroBackground: '#11151A',
    heroText: '#F8FAFC',
    heroMuted: '#94A3B8',
    cardBg: '#181F26',
    cardBorder: '#273240',
    accentAmber: '#F59E0B',
    accentGradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    gridStyle:
      'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
  },
  designC: {
    key: 'designC',
    name: 'Design C: The Master Craftsman & Financial Flow',
    tagline: 'Dual-tone elevation cards, soft amber ambient glows, and live telemetry',
    concept:
      'Soft parchment tone (#FAF9F6) layered with crisp travertine white elevation cards and amber status halos. Focuses heavily on financial truth, cashflow velocity, and human craftsmanship.',
    heroBackground: '#F6F4EF',
    heroText: '#1F1B18',
    heroMuted: '#6E6760',
    cardBg: '#FFFFFF',
    cardBorder: '#E8E2D8',
    accentAmber: '#D95A00',
    accentGradient: 'linear-gradient(135deg, #D95A00 0%, #B84200 100%)',
    gridStyle:
      'radial-gradient(#DDD6CB 1.2px, transparent 1.2px) [background-size:20px_20px]',
  },
};

export function ThemePicker() {
  const [selectedDesignKey, setSelectedDesignKey] = useState<LandingDesignKey>('designA');
  const [activeView, setActiveView] = useState<'landing' | 'dashboard' | 'split'>('landing');
  const [currency, setCurrency] = useState<'PKR' | 'USD'>('PKR');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);

  const activeDesign = LANDING_DESIGNS[selectedDesignKey];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Floating Control Bar */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-amber-500 flex items-center justify-center text-black font-black text-sm">
              SF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">SiteFlow Design Lab</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  Theme 1 Foundation
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Exploring 3 unique, animated landing page directions for Theme 1
              </p>
            </div>
          </div>

          {/* Interactive Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Design Selector Tabs */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(Object.keys(LANDING_DESIGNS) as LandingDesignKey[]).map((key) => {
                const item = LANDING_DESIGNS[key];
                const isSelected = selectedDesignKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDesignKey(key)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {key === 'designA' ? 'Design A (Drafting Grid)' : key === 'designB' ? 'Design B (Monolith Dark)' : 'Design C (Craftsman)'}
                  </button>
                );
              })}
            </div>

            {/* View Switcher: Landing vs Dashboard vs Side-by-Side */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveView('landing')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 ${
                  activeView === 'landing' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                Landing Page
              </button>
              <button
                type="button"
                onClick={() => setActiveView('dashboard')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 ${
                  activeView === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                Dashboard (Calm)
              </button>
              <button
                type="button"
                onClick={() => setActiveView('split')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 ${
                  activeView === 'split' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Side-by-Side
              </button>
            </div>

            {/* Currency Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setCurrency('PKR')}
                className={`px-2 py-1 rounded font-mono font-bold ${
                  currency === 'PKR' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'
                }`}
              >
                PKR
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2 py-1 rounded font-mono font-bold ${
                  currency === 'USD' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'
                }`}
              >
                USD
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Concept Explainer Strip */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-bold text-amber-400">{activeDesign.name}: </span>
            <span className="text-slate-300">{activeDesign.tagline}</span>
          </div>
          <p className="text-slate-400 max-w-2xl text-[11px] leading-relaxed">
            {activeDesign.concept}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {activeView === 'landing' && (
          <LandingPageBlueprintView
            design={activeDesign}
            currency={currency}
            activeFaq={activeFaq}
            setActiveFaq={setActiveFaq}
            activeWorkflowStep={activeWorkflowStep}
            setActiveWorkflowStep={setActiveWorkflowStep}
          />
        )}

        {activeView === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  Theme 1 Inside: The Calm Operational Dashboard
                </h2>
                <p className="text-xs text-slate-400">
                  Strictly follows Rule 4: "The landing page is expressive. The app inside is calm."
                  No decorative gradients, no distracting glows. Pure tabular clarity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('landing')}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded font-medium"
              >
                Back to landing design
              </button>
            </div>
            <DashboardCalmView currency={currency} />
          </div>
        )}

        {activeView === 'split' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 p-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <span className="font-bold text-xs uppercase tracking-wider text-amber-400">
                  Expressive Public Experience ({activeDesign.name})
                </span>
                <span className="text-[11px] text-slate-400">Animated & Cinematic</span>
              </div>
              <LandingPageBlueprintView
                design={activeDesign}
                currency={currency}
                activeFaq={activeFaq}
                setActiveFaq={setActiveFaq}
                activeWorkflowStep={activeWorkflowStep}
                setActiveWorkflowStep={setActiveWorkflowStep}
                isCompact
              />
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 p-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <span className="font-bold text-xs uppercase tracking-wider text-emerald-400">
                  Calm Operations Inside (Theme 1 Foundation)
                </span>
                <span className="text-[11px] text-slate-400">Zero Clutter & Pure Tabular Density</span>
              </div>
              <DashboardCalmView currency={currency} isCompact />
            </div>
          </div>
        )}
      </main>

      {/* Decision Callout Footer */}
      <footer className="mt-16 border-t border-slate-800 bg-slate-900/80 px-4 py-8 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
            <Check className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            Confirm Your Preferred Landing Page Direction
          </h3>
          <p className="text-xs text-slate-300 mb-6 leading-relaxed">
            Which landing page treatment matches your vision?
            <br />
            <strong className="text-amber-400">Design A</strong> (The Drafting Floor & Laser Axis),{' '}
            <strong className="text-amber-400">Design B</strong> (The Monolith & Site Command), or{' '}
            <strong className="text-amber-400">Design C</strong> (The Master Craftsman & Financial Flow)?
            <br />
            Once selected, I will lock Theme 1 in <code className="text-amber-300 font-mono">web/src/styles/theme.css</code> and proceed immediately to Task 1.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            {(Object.keys(LANDING_DESIGNS) as LandingDesignKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDesignKey(key)}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  selectedDesignKey === key
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                Select {key === 'designA' ? 'Design A' : key === 'designB' ? 'Design B' : 'Design C'}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BLUEPRINT COMPLIANT LANDING PAGE COMPONENT (ALL 9 SECTIONS IN EXACT ORDER)
// ─────────────────────────────────────────────────────────────────────────────

function LandingPageBlueprintView({
  design,
  currency,
  activeFaq,
  setActiveFaq,
  activeWorkflowStep,
  setActiveWorkflowStep,
  isCompact = false,
}: {
  design: LandingDesignConfig;
  currency: 'PKR' | 'USD';
  activeFaq: number | null;
  setActiveFaq: (id: number | null) => void;
  activeWorkflowStep: number;
  setActiveWorkflowStep: (step: number) => void;
  isCompact?: boolean;
}) {
  const isUSD = currency === 'USD';

  // Demo Financial Data
  const budgetStr = isUSD ? '$2,850,000' : 'PKR 148,500,000';
  const committedStr = isUSD ? '$1,920,000' : 'PKR 98,200,000';
  const actualStr = isUSD ? '$1,440,000' : 'PKR 74,600,000';
  const forecastStr = isUSD ? '$2,780,000' : 'PKR 144,000,000';

  const isDarkHero = design.key === 'designB';

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl border transition-colors"
      style={{
        backgroundColor: design.heroBackground,
        borderColor: design.cardBorder,
        color: design.heroText,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: HERO (Outcome headline <= 8 words, subhead, main + 2nd btn, video/poster) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-8 pb-12 px-5 md:px-10 border-b" style={{ borderColor: design.cardBorder }}>
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              design.key === 'designA'
                ? 'radial-gradient(#CBD5E1 1px, transparent 1px)'
                : design.key === 'designB'
                ? 'radial-gradient(#334155 1px, transparent 1px)'
                : 'radial-gradient(#D6D3D1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Ambient Warm Laser Glow */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ backgroundColor: design.accentAmber }}
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Top Subhead Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold mb-6 border"
            style={{
              backgroundColor: isDarkHero ? 'rgba(245, 158, 11, 0.12)' : '#FFF3E0',
              borderColor: isDarkHero ? 'rgba(245, 158, 11, 0.3)' : '#FFE0B2',
              color: isDarkHero ? '#FBBF24' : '#E65100',
            }}
          >
            <HardHat className="w-3.5 h-3.5" />
            <span>Built for small and mid-sized contractors</span>
          </div>

          {/* Outcome Headline: Exactly 8 words (Rule 9: <= 8 words saying result user gets) */}
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-5"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: design.heroText,
            }}
          >
            Protect project profit before{' '}
            <span
              style={{
                background: design.accentGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              delays wipe it out
            </span>
          </h1>

          {/* One supporting sentence */}
          <p
            className="text-base sm:text-lg md:text-xl max-w-2xl mb-8 leading-relaxed"
            style={{ color: design.heroMuted }}
          >
            SiteFlow unites budgets, Bill of Quantities, site logs, and subcontractor payment
            approvals into one clean flow that every site supervisor understands in seconds.
          </p>

          {/* Hero Buttons (Rule 9: one main button, one quiet second button "Watch how it works") */}
          <div className="flex flex-wrap items-center gap-4 mb-10">
            <button
              type="button"
              className="px-6 py-3.5 rounded-md text-sm font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center gap-2"
              style={{
                background: design.accentGradient,
              }}
            >
              <span>Save project</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              className="px-5 py-3.5 rounded-md text-sm font-semibold border transition-colors flex items-center gap-2"
              style={{
                backgroundColor: isDarkHero ? '#1E293B' : '#FFFFFF',
                borderColor: design.cardBorder,
                color: design.heroText,
              }}
            >
              <Play className="w-4 h-4 fill-current opacity-80" />
              <span>Watch how it works</span>
            </button>
          </div>

          {/* Hero Video & Live Product View Container (Rule 9: autoplay muted loop playsinline poster) */}
          <div
            className="rounded-xl overflow-hidden border shadow-2xl relative"
            style={{
              borderColor: design.cardBorder,
              backgroundColor: isDarkHero ? '#0F172A' : '#FFFFFF',
            }}
          >
            {/* Window Chrome Header */}
            <div
              className="px-4 py-2.5 border-b flex items-center justify-between text-xs"
              style={{
                borderColor: design.cardBorder,
                backgroundColor: isDarkHero ? '#1E293B' : '#F1F5F9',
                color: design.heroMuted,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                <span className="font-mono text-[11px] ml-2 text-slate-500">
                  siteflow.app/projects/tower-b-phase-4
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Site Active
                </span>
              </div>
            </div>

            {/* Poster & Interactive Simulation Overlay */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-900">
              <img
                src="/media/hero-poster.jpg"
                alt="Active commercial construction project with concrete slabs and cranes"
                width={1280}
                height={720}
                className="w-full h-full object-cover"
                loading="eager"
              />

              {/* Dark Gradient Overlay for Legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />

              {/* Live Overlay HUD: Live Real Contractor Project Cards */}
              <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-between text-white pointer-events-none">
                {/* Top Badge Ticker */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/10 flex items-center gap-2 text-xs">
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold">Gulberg Executive Heights — Tower B</span>
                    <span className="text-xs text-neutral-400">| Lahore, PK</span>
                  </div>
                  <div className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>On track — Slab 4 Cast</span>
                  </div>
                </div>

                {/* Bottom Live Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <div className="bg-black/80 backdrop-blur-md p-2.5 sm:p-3 rounded-lg border border-white/10">
                    <div className="text-[10px] uppercase font-semibold text-neutral-400">Total Budget</div>
                    <div className="text-xs sm:text-base font-bold font-mono text-white">{budgetStr}</div>
                  </div>
                  <div className="bg-black/80 backdrop-blur-md p-2.5 sm:p-3 rounded-lg border border-white/10">
                    <div className="text-[10px] uppercase font-semibold text-neutral-400">Committed (POs)</div>
                    <div className="text-xs sm:text-base font-bold font-mono text-amber-400">{committedStr}</div>
                  </div>
                  <div className="bg-black/80 backdrop-blur-md p-2.5 sm:p-3 rounded-lg border border-white/10">
                    <div className="text-[10px] uppercase font-semibold text-neutral-400">Actual Spent</div>
                    <div className="text-xs sm:text-base font-bold font-mono text-emerald-400">{actualStr}</div>
                  </div>
                  <div className="bg-black/80 backdrop-blur-md p-2.5 sm:p-3 rounded-lg border border-white/10">
                    <div className="text-[10px] uppercase font-semibold text-neutral-400">Workers on Site</div>
                    <div className="text-xs sm:text-base font-bold font-mono text-white">42 Active today</div>
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
      <section
        className="py-6 px-5 border-b"
        style={{
          backgroundColor: isDarkHero ? '#141A22' : '#FFFFFF',
          borderColor: design.cardBorder,
        }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className="w-9 h-9 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold" style={{ color: design.heroText }}>
                Works in PKR and USD
              </div>
              <div className="text-[11px]" style={{ color: design.heroMuted }}>
                Dual currency, Kanal/Marla or SqFt, local tax rules
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className="w-9 h-9 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold" style={{ color: design.heroText }}>
                8 Distinct Project Roles
              </div>
              <div className="text-[11px]" style={{ color: design.heroMuted }}>
                From Site Supervisor to Finance and Subcontractors
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className="w-9 h-9 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold" style={{ color: design.heroText }}>
                Every Single Change Recorded
              </div>
              <div className="text-[11px]" style={{ color: design.heroMuted }}>
                Immutable audit trail for every change order & payment
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3: THE PROBLEM (The real daily pain in plain words) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-12 px-5 md:px-10 border-b" style={{ borderColor: design.cardBorder }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">
              The Real Daily Pain
            </div>
            <h2
              className="text-2xl md:text-3xl font-extrabold tracking-tight mb-3"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: design.heroText }}
            >
              Running sites on scattered spreadsheets costs you money every week
            </h2>
            <p className="text-sm" style={{ color: design.heroMuted }}>
              When information lives in WhatsApp groups and messy notebook pages, small mistakes turn into big losses before you notice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              className="p-6 rounded-xl border relative"
              style={{
                backgroundColor: design.cardBg,
                borderColor: design.cardBorder,
              }}
            >
              <div className="w-8 h-8 rounded bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: design.heroText }}>
                Scattered sheets and lost versions
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: design.heroMuted }}>
                The office is working off version 4 of the BOQ while the site supervisor is ordering materials with version 2. Nobody knows the real quantity left.
              </p>
            </div>

            <div
              className="p-6 rounded-xl border relative"
              style={{
                backgroundColor: design.cardBg,
                borderColor: design.cardBorder,
              }}
            >
              <div className="w-8 h-8 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: design.heroText }}>
                Surprise material costs
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: design.heroMuted }}>
                Cement and steel prices climb, but nobody updates the budget forecast. You only realize the overrun when the supplier sends the final demand note.
              </p>
            </div>

            <div
              className="p-6 rounded-xl border relative"
              style={{
                backgroundColor: design.cardBg,
                borderColor: design.cardBorder,
              }}
            >
              <div className="w-8 h-8 rounded bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: design.heroText }}>
                Late subcontractor payments
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: design.heroMuted }}>
                Subcontractor payment applications sit unverified for two weeks. Work on the ground slows down because workers have not been paid on time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 4: HOW IT WORKS (4 steps: Estimate, Project, Site work, Payment) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section
        className="py-12 px-5 md:px-10 border-b"
        style={{
          backgroundColor: isDarkHero ? '#12171E' : '#FFFFFF',
          borderColor: design.cardBorder,
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">
              Simple 4-Step Flow
            </div>
            <h2
              className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: design.heroText }}
            >
              From initial bid to cleared payment in one system
            </h2>
            <p className="text-sm" style={{ color: design.heroMuted }}>
              Click any step to see how information flows without double data entry.
            </p>
          </div>

          {/* Interactive Steps Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { num: '01', title: 'Estimate', icon: Ruler, desc: 'Import or build your Bill of Quantities with unit rates' },
              { num: '02', title: 'Project', icon: Building2, desc: 'Lock the baseline budget and issue purchase orders' },
              { num: '03', title: 'Site work', icon: HardHat, desc: 'Log daily labor, deliveries, and slump test results' },
              { num: '04', title: 'Payment', icon: CheckCircle2, desc: 'Verify work completed and approve payments cleanly' },
            ].map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeWorkflowStep === idx;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setActiveWorkflowStep(idx)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isActive
                      ? 'border-amber-500 shadow-md ring-1 ring-amber-500/30'
                      : 'border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: isActive ? (isDarkHero ? '#1F2937' : '#FFF9F5') : design.cardBg,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-amber-600">{step.num}</span>
                    <Icon className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-sm font-bold mb-1" style={{ color: design.heroText }}>
                    {step.title}
                  </div>
                  <div className="text-[11px] leading-tight" style={{ color: design.heroMuted }}>
                    {step.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Real Preview Card */}
          <div
            className="p-5 md:p-6 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-6"
            style={{
              backgroundColor: design.cardBg,
              borderColor: design.cardBorder,
            }}
          >
            <div>
              <span className="text-xs uppercase font-semibold text-amber-600 tracking-wider">
                Active Step #{activeWorkflowStep + 1}
              </span>
              <h3 className="text-lg font-bold mt-1 mb-2" style={{ color: design.heroText }}>
                {activeWorkflowStep === 0 && 'Build exact Bill of Quantities without formulas breaking'}
                {activeWorkflowStep === 1 && 'Issue Purchase Orders directly tied to cost codes'}
                {activeWorkflowStep === 2 && 'Site supervisors log daily progress in two minutes'}
                {activeWorkflowStep === 3 && 'Approve subcontractor payments with zero arguments'}
              </h3>
              <p className="text-xs leading-relaxed max-w-xl" style={{ color: design.heroMuted }}>
                {activeWorkflowStep === 0 && 'Enter your scope, unit rates in PKR or USD, and markup. SiteFlow prevents duplicate line items and locks the baseline contract before work starts.'}
                {activeWorkflowStep === 1 && 'Every commitment is booked against a specific cost code. You see committed costs immediately, long before the vendor invoice arrives.'}
                {activeWorkflowStep === 2 && 'Works seamlessly on low-cost smartphones on dusty sites. Take photos of delivery slips, record truck batches, and verify workers on site.'}
                {activeWorkflowStep === 3 && 'Payment applications calculate retainage, advances, and previous payments automatically. Site supervisor verifies, PM approves, finance releases.'}
              </p>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                className="px-5 py-2.5 rounded-md text-xs font-bold text-white shadow-sm flex items-center gap-2"
                style={{ background: design.accentGradient }}
              >
                <span>Save project</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 5: FEATURES (Grid of cards, 6 at most, one benefit sentence each) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-12 px-5 md:px-10 border-b" style={{ borderColor: design.cardBorder }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">
              Engineered For Contractors
            </div>
            <h2
              className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: design.heroText }}
            >
              Everything you need to run profitable jobs
            </h2>
            <p className="text-sm" style={{ color: design.heroMuted }}>
              Six core tools built strictly around how construction actually happens in the field.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: FileSpreadsheet,
                title: 'Structured Bill of Quantities',
                benefit: 'Track line-item quantities and rates so you never overbill or miss contracted work.',
              },
              {
                icon: Coins,
                title: 'Budget vs Committed vs Actual',
                benefit: 'Spot cost overruns while they are happening instead of finding out at month end.',
              },
              {
                icon: HardHat,
                title: 'Daily Field Work Logs',
                benefit: 'Site supervisors log manpower, equipment, and weather in under two minutes from their phones.',
              },
              {
                icon: Truck,
                title: 'Material Delivery Control',
                benefit: 'Record gate deliveries and mill test certificates before pouring concrete or tying steel.',
              },
              {
                icon: ShieldCheck,
                title: 'Payment Applications & Retainage',
                benefit: 'Approve subcontractor claims with automatic deduction for advances and retainage.',
              },
              {
                icon: Users,
                title: 'Role-Based Access Control',
                benefit: 'Give clients and subcontractors access to what they need without exposing your profit margins.',
              },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-5 rounded-xl border relative"
                  style={{
                    backgroundColor: design.cardBg,
                    borderColor: design.cardBorder,
                  }}
                >
                  <div className="w-8 h-8 rounded bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold mb-1.5" style={{ color: design.heroText }}>
                    {feature.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: design.heroMuted }}>
                    {feature.benefit}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 6: MONEY CONTROL (Budget, Committed, Actual, Forecast with live-looking chart) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section
        className="py-12 px-5 md:px-10 border-b"
        style={{
          backgroundColor: isDarkHero ? '#131922' : '#FFFFFF',
          borderColor: design.cardBorder,
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">
              Money Control
            </div>
            <h2
              className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: design.heroText }}
            >
              Know where every single rupee and dollar stands
            </h2>
            <p className="text-sm" style={{ color: design.heroMuted }}>
              Keep committed purchase orders separate from actual spent cash so your forecast never lies.
            </p>
          </div>

          <div
            className="p-6 rounded-2xl border"
            style={{
              backgroundColor: design.cardBg,
              borderColor: design.cardBorder,
            }}
          >
            {/* 4 Financial Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-3.5 rounded-lg border bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                  1. Baseline Budget
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100">
                  {budgetStr}
                </span>
                <span className="text-[10px] text-neutral-400 block mt-1">Approved contract total</span>
              </div>

              <div className="p-3.5 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50">
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block mb-1">
                  2. Committed (POs)
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                  {committedStr}
                </span>
                <span className="text-[10px] text-neutral-400 block mt-1">Orders sent to vendors</span>
              </div>

              <div className="p-3.5 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
                  3. Actual Spent
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {actualStr}
                </span>
                <span className="text-[10px] text-neutral-400 block mt-1">Cleared bank payments</span>
              </div>

              <div className="p-3.5 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50">
                <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 block mb-1">
                  4. Forecast at Complete
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                  {forecastStr}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-1">
                  +3.0% under budget
                </span>
              </div>
            </div>

            {/* Live Visual Chart Representation */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span style={{ color: design.heroMuted }}>Cashflow Allocation (Tower B Substructure)</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">Healthy Margin</span>
              </div>
              <div className="w-full h-4 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex">
                <div style={{ width: '50%' }} className="bg-emerald-500 h-full" title="Actual: 50%" />
                <div style={{ width: '16%' }} className="bg-amber-500 h-full" title="Committed: 16%" />
                <div style={{ width: '31%' }} className="bg-blue-400/30 h-full" title="Remaining: 31%" />
                <div style={{ width: '3%' }} className="bg-emerald-400 h-full" title="Margin buffer" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[11px] text-neutral-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                  <span>Actual Spent ({actualStr})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                  <span>Committed POs ({committedStr})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-300 inline-block" />
                  <span>Uncommitted Budget Buffer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 7: WORKS YOUR WAY (Pakistan & US setup: currency, units, taxes) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-12 px-5 md:px-10 border-b" style={{ borderColor: design.cardBorder }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">
              Works Your Way
            </div>
            <h2
              className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: design.heroText }}
            >
              Tailored for contractors in Pakistan and the United States
            </h2>
            <p className="text-sm" style={{ color: design.heroMuted }}>
              Switch configuration presets with one click. Currency, area units, and tax withholding adjust automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pakistan Setup Card */}
            <div
              className={`p-6 rounded-xl border relative transition-all ${
                currency === 'PKR' ? 'ring-2 ring-amber-500 shadow-md' : 'opacity-85'
              }`}
              style={{
                backgroundColor: design.cardBg,
                borderColor: design.cardBorder,
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Pakistan Operations
                </span>
                <span className="font-mono text-xs font-bold text-neutral-500">PKR Mode</span>
              </div>
              <h3 className="text-base font-bold mb-3" style={{ color: design.heroText }}>
                Local Pakistani Contractor Flow
              </h3>
              <ul className="space-y-2 text-xs" style={{ color: design.heroMuted }}>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Currency: Pakistani Rupees (PKR) with Lakhs & Crores formatting</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Area Units: Marla, Kanal, Square Feet, and Running Feet</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Tax & Compliance: PRA / FBR Withholding Tax calculation & deductions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Material Batches: Deformed Steel ASTM A615 & Ordinary Portland Cement</span>
                </li>
              </ul>
            </div>

            {/* US Setup Card */}
            <div
              className={`p-6 rounded-xl border relative transition-all ${
                currency === 'USD' ? 'ring-2 ring-amber-500 shadow-md' : 'opacity-85'
              }`}
              style={{
                backgroundColor: design.cardBg,
                borderColor: design.cardBorder,
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  United States Operations
                </span>
                <span className="font-mono text-xs font-bold text-neutral-500">USD Mode</span>
              </div>
              <h3 className="text-base font-bold mb-3" style={{ color: design.heroText }}>
                US Commercial Contractor Flow
              </h3>
              <ul className="space-y-2 text-xs" style={{ color: design.heroMuted }}>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Currency: US Dollars (USD) with standard thousands separation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Area Units: Square Feet, Square Yards, Linear Feet, Cubic Yards</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>AIA-Style Payment Apps: 10% Retainage withholding and release tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>CSI MasterFormat: Standard 16/50 Division cost code mapping</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 8: QUESTIONS PEOPLE ASK (FAQ, exactly 6 items, plain answers) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section
        className="py-12 px-5 md:px-10 border-b"
        style={{
          backgroundColor: isDarkHero ? '#12171E' : '#FFFFFF',
          borderColor: design.cardBorder,
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">
              Questions People Ask
            </div>
            <h2
              className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: design.heroText }}
            >
              Straightforward answers for site teams
            </h2>
            <p className="text-sm" style={{ color: design.heroMuted }}>
              No sales talk. Here is how SiteFlow handles everyday contractor requirements.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Can site supervisors use this on a regular phone without training?',
                a: 'Yes. The mobile field screens are built specifically for low-end smartphones on bright, dusty sites. Logging labor or taking photos of delivery slips takes under two minutes.',
              },
              {
                q: 'How does SiteFlow prevent accidental budget overruns?',
                a: 'Whenever someone creates a Purchase Order or approves a payment, SiteFlow immediately checks the remaining uncommitted balance for that specific cost code. If it exceeds budget, it alerts the Project Manager before commitment.',
              },
              {
                q: 'Can our subcontractors see our internal profit margins?',
                a: 'No. Subcontractors have their own restricted portal. They only see their assigned line items, approved payment applications, and retainage deductions. Your internal markups and supplier costs remain completely private.',
              },
              {
                q: 'Does it support both Pakistani Rupees and US Dollars?',
                a: 'Yes. You can run projects in PKR with local unit conventions (Kanal, Marla) and tax withholding, or in USD with standard CSI divisions and retainage rules.',
              },
              {
                q: 'What happens if internet cuts out on the construction site?',
                a: 'Site supervisors can continue entering daily logs and batch deliveries offline. As soon as the phone reconnects to cellular data or Wi-Fi, the logs synchronize automatically.',
              },
              {
                q: 'Can we export our project data to Excel or PDF?',
                a: 'Yes. Any Bill of Quantities, payment certificate, or cost summary exports to clean Excel sheets or print-ready PDF certificates with your company header in one click.',
              },
            ].map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={faq.q}
                  className="rounded-xl border overflow-hidden transition-all"
                  style={{
                    backgroundColor: design.cardBg,
                    borderColor: design.cardBorder,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm"
                    style={{ color: design.heroText }}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-amber-500' : 'text-neutral-400'
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
                        className="px-4 pb-4 pt-1 border-t text-xs leading-relaxed"
                        style={{
                          borderColor: design.cardBorder,
                          color: design.heroMuted,
                        }}
                      >
                        {faq.a}
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
      <section className="py-16 px-5 md:px-10 text-center relative overflow-hidden">
        {/* Glow behind final CTA */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: design.accentGradient }}
        />

        <div className="max-w-2xl mx-auto relative z-10">
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: design.heroText }}
          >
            Start controlling project cashflow on your next job
          </h2>
          <p className="text-sm md:text-base mb-8 leading-relaxed" style={{ color: design.heroMuted }}>
            Set up your first project in minutes, import your Bill of Quantities, and invite your team.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Main Button: 3rd appearance, same wording and style */}
            <button
              type="button"
              className="px-7 py-3.5 rounded-md text-sm font-bold text-white shadow-xl transition-transform active:scale-95 flex items-center gap-2"
              style={{
                background: design.accentGradient,
              }}
            >
              <span>Save project</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              className="px-5 py-3.5 rounded-md text-sm font-semibold border transition-colors"
              style={{
                backgroundColor: isDarkHero ? '#1F2937' : '#FFFFFF',
                borderColor: design.cardBorder,
                color: design.heroText,
              }}
            >
              <span>Watch how it works</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALM DASHBOARD VIEW (CONFIRMING THEME 1 CALM OPERATIONAL INTERIOR)
// ─────────────────────────────────────────────────────────────────────────────

function DashboardCalmView({
  currency,
  isCompact = false,
}: {
  currency: 'PKR' | 'USD';
  isCompact?: boolean;
}) {
  const isUSD = currency === 'USD';

  return (
    <div
      className="p-6 rounded-xl border bg-white text-slate-900 shadow-md font-sans"
      style={{
        borderColor: '#E2E6EA',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Top Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-[#E2E6EA] gap-3">
        <div>
          <div className="text-[11px] font-semibold text-[#606870] uppercase tracking-wider">
            Project Overview • Code PK-2026-08
          </div>
          <h2
            className="text-xl font-bold text-[#1A1D20]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Gulberg Executive Heights — Tower B
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#DCFCE7] text-[#166534] text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            On track
          </span>
          <button
            type="button"
            className="px-4 py-2 bg-[#E65100] text-white text-xs font-semibold rounded hover:bg-[#C2410C] transition-colors"
          >
            Save project
          </button>
        </div>
      </div>

      {/* 4 Financial Metric Cards in Theme 1 Calm Styling */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="p-3.5 rounded border border-[#E2E6EA] bg-[#F8F9FA]">
          <div className="text-[10px] uppercase font-bold text-[#606870]">Baseline Budget</div>
          <div className="text-sm md:text-base font-bold font-mono text-[#1A1D20] mt-0.5">
            {isUSD ? '$2,850,000' : 'PKR 148,500,000'}
          </div>
        </div>

        <div className="p-3.5 rounded border border-[#E2E6EA] bg-[#F8F9FA]">
          <div className="text-[10px] uppercase font-bold text-[#606870]">Committed Orders</div>
          <div className="text-sm md:text-base font-bold font-mono text-[#E65100] mt-0.5">
            {isUSD ? '$1,920,000' : 'PKR 98,200,000'}
          </div>
        </div>

        <div className="p-3.5 rounded border border-[#E2E6EA] bg-[#F8F9FA]">
          <div className="text-[10px] uppercase font-bold text-[#606870]">Actual Spent</div>
          <div className="text-sm md:text-base font-bold font-mono text-[#166534] mt-0.5">
            {isUSD ? '$1,440,000' : 'PKR 74,600,000'}
          </div>
        </div>

        <div className="p-3.5 rounded border border-[#E2E6EA] bg-[#F8F9FA]">
          <div className="text-[10px] uppercase font-bold text-[#606870]">Remaining Forecast</div>
          <div className="text-sm md:text-base font-bold font-mono text-[#1A1D20] mt-0.5">
            {isUSD ? '$2,780,000' : 'PKR 144,000,000'}
          </div>
        </div>
      </div>

      {/* Real BOQ Table (Calm Operational interior) */}
      <div className="border border-[#E2E6EA] rounded overflow-hidden">
        <div className="px-4 py-2.5 bg-[#F8F9FA] border-b border-[#E2E6EA] flex items-center justify-between text-xs">
          <span className="font-bold text-[#1A1D20]">Active Bill of Quantities Items</span>
          <span className="text-[11px] text-[#606870] font-mono">Division 03 Concrete & Steel</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E6EA] bg-[#F8F9FA] text-[#606870] text-[11px] uppercase tracking-wider">
                <th className="p-3">Item Description</th>
                <th className="p-3 text-right">Quantity</th>
                <th className="p-3 text-right">Unit Rate</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#E2E6EA] hover:bg-[#F8F9FA]">
                <td className="p-3">
                  <div className="font-semibold text-[#1A1D20]">Deformed Rebar Fe 500D (32mm dia)</div>
                  <div className="text-[11px] text-[#606870]">Mill Test ASTM A615 / Grade 60</div>
                </td>
                <td className="p-3 text-right font-mono text-[#1A1D20]">45.0 Ton</td>
                <td className="p-3 text-right font-mono text-[#606870]">
                  {isUSD ? '$950.00' : 'PKR 265,000'}
                </td>
                <td className="p-3 text-right font-mono font-bold text-[#1A1D20]">
                  {isUSD ? '$42,750.00' : 'PKR 11,925,000'}
                </td>
                <td className="p-3 text-center">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#DCFCE7] text-[#166534]">
                    Delivered
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    className="px-2.5 py-1 text-xs font-semibold bg-[#E65100] text-white rounded hover:bg-[#C2410C]"
                  >
                    Inspect batch
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-[#F8F9FA]">
                <td className="p-3">
                  <div className="font-semibold text-[#1A1D20]">Ready-Mix Concrete C35/45</div>
                  <div className="text-[11px] text-[#606870]">4th Floor Raft Slab Pour</div>
                </td>
                <td className="p-3 text-right font-mono text-[#1A1D20]">320.0 m³</td>
                <td className="p-3 text-right font-mono text-[#606870]">
                  {isUSD ? '$135.00' : 'PKR 37,800'}
                </td>
                <td className="p-3 text-right font-mono font-bold text-[#1A1D20]">
                  {isUSD ? '$43,200.00' : 'PKR 12,096,000'}
                </td>
                <td className="p-3 text-center">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FFEDD5] text-[#9A3412]">
                    Pouring today
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    className="px-2.5 py-1 text-xs font-medium border border-[#E2E6EA] text-[#1A1D20] rounded hover:bg-[#F1F5F9]"
                  >
                    Slump test
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
