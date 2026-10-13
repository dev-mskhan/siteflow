/**
 * Navbar — SiteFlow marketing site
 *
 * Industry-standard B2B SaaS pattern (Linear / Vercel / Resend reference):
 *   Desktop:  Logo  |  nav links  |  Sign in (ghost)  Get started (solid)
 *   Tablet:   Logo  |  Get started (solid)  |  hamburger
 *   Mobile:   Logo  |  hamburger  (drawer has full nav + CTAs)
 *
 * Auth-aware via useAuthState:
 *   Logged-out → "Sign in" + "Get started"
 *   Logged-in  → "Dashboard" (single solid button, Sign in hidden)
 *   Loading    → buttons render at reduced opacity, pointer-events off
 */

import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  Calculator,
  Calendar,
  Truck,
  ClipboardList,
  Users,
  FileCheck2,
  TrendingDown,
  Receipt,
  FolderArchive,
  Globe2,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { cn } from '../../lib/cn';
import { useAuthState } from '../../hooks/useAuthState';

/* ─── Data ──────────────────────────────────────────────────────────────── */

const featureLinks = [
  {
    title: 'Estimating & BOQ',
    href: '/features/estimating-and-boq',
    icon: Calculator,
    desc: 'Structure scope & rates',
  },
  {
    title: 'Scheduling',
    href: '/features/scheduling',
    icon: Calendar,
    desc: 'Phase handoffs & milestones',
  },
  {
    title: 'Procurement',
    href: '/features/procurement',
    icon: Truck,
    desc: 'Purchase orders & receipts',
  },
  {
    title: 'Field Logs',
    href: '/features/field-logs',
    icon: ClipboardList,
    desc: 'Daily labor & photos',
  },
  {
    title: 'Subcontractors',
    href: '/features/subcontractors',
    icon: Users,
    desc: 'Dedicated trade portal',
  },
  {
    title: 'Change Orders',
    href: '/features/change-orders',
    icon: FileCheck2,
    desc: 'Approved paid variations',
  },
  {
    title: 'Cost Control',
    href: '/features/cost-control',
    icon: TrendingDown,
    desc: 'Budget vs committed vs actual',
  },
  {
    title: 'Billing & Payments',
    href: '/features/billing-and-payments',
    icon: Receipt,
    desc: 'IPC forms & retainage',
  },
  {
    title: 'Documents',
    href: '/features/documents',
    icon: FolderArchive,
    desc: 'Drawings & mill tests',
  },
];

const personaLinks = [
  {
    title: 'General Contractors',
    href: '/for/general-contractors',
    desc: 'Control multiple jobs & margins',
  },
  { title: 'Subcontractors', href: '/for/subcontractors', desc: 'Submit claims & track retainage' },
  {
    title: 'Project Owners & Developers',
    href: '/for/project-owners',
    desc: 'Audit certified site progress',
  },
];

const countryLinks = [
  {
    title: 'Pakistan Edition',
    href: '/construction-software-pakistan',
    flag: 'PK',
    desc: 'Marla/Kanal & WHT',
  },
  {
    title: 'United States',
    href: '/construction-software-us',
    flag: 'US',
    desc: 'AIA billing & CSI',
  },
];

/* ─── Animation variants ─────────────────────────────────────────────────── */

const ddVariants = {
  hidden: { opacity: 0, y: -4, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -3,
    scale: 0.99,
    transition: { duration: 0.1, ease: [0.4, 0, 1, 1] as const },
  },
};

const drawerVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: { opacity: 0, height: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const } },
};

/* ─── NavLink — desktop text trigger ────────────────────────────────────── */

const NavLink: React.FC<{
  isActive?: boolean;
  onClick?: () => void;
  as?: 'button' | 'span';
  children: React.ReactNode;
}> = ({ isActive, onClick, as: Tag = 'button', children }) => (
  <Tag
    type={Tag === 'button' ? 'button' : undefined}
    onClick={onClick}
    className={cn(
      'relative px-3 py-2 text-sm font-heading font-medium inline-flex items-center gap-1',
      'transition-opacity duration-[120ms] hover:opacity-60',
      isActive ? 'text-[#0a0a0a] opacity-100' : 'text-[#6b6b6b]',
      isActive &&
        'after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:bg-[#0a0a0a]',
    )}
  >
    {children}
  </Tag>
);

/* ─── FeaturesDropdown ───────────────────────────────────────────────────── */

const FeaturesDropdown: React.FC<{ onNavigate: () => void }> = ({ onNavigate }) => (
  <motion.div
    key="features-dd"
    variants={ddVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    className="absolute top-[calc(100%+4px)] left-0 w-[500px] bg-white border border-[rgba(10,10,10,0.12)] z-50 origin-top-left"
  >
    <div className="p-1.5 grid grid-cols-2 gap-0">
      {featureLinks.map(({ title, href, icon: Icon, desc }) => (
        <Link
          key={href}
          to={href}
          onClick={onNavigate}
          className="group flex items-center gap-2.5 px-3 py-2 hover:bg-[#f3f3f3] transition-colors duration-[120ms]"
        >
          <div className="shrink-0 w-6 h-6 bg-[#f3f3f3] flex items-center justify-center group-hover:bg-[#0a0a0a] group-hover:text-white transition-colors duration-[120ms]">
            <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-[#0a0a0a] leading-tight truncate">
              {title}
            </div>
            <div className="text-[10px] text-[#9b9b9b] leading-tight truncate">{desc}</div>
          </div>
        </Link>
      ))}
    </div>
    <div className="flex items-center justify-between px-3 py-2 border-t border-[rgba(10,10,10,0.08)] bg-[#f3f3f3]">
      <Link
        to="/features"
        onClick={onNavigate}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0a0a0a] hover:opacity-60 transition-opacity duration-[120ms]"
      >
        View all 9 modules <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
      </Link>
      <span className="text-[10px] font-mono uppercase tracking-widest text-[#9b9b9b]">
        Core Platform
      </span>
    </div>
  </motion.div>
);

/* ─── WhoDropdown ────────────────────────────────────────────────────────── */

const WhoDropdown: React.FC<{ onNavigate: () => void }> = ({ onNavigate }) => (
  <motion.div
    key="who-dd"
    variants={ddVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    className="absolute top-[calc(100%+4px)] left-0 w-[260px] bg-white border border-[rgba(10,10,10,0.12)] z-50 origin-top-left"
  >
    <div className="p-1.5">
      <div className="px-2 py-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#9b9b9b]">
          By Role
        </span>
      </div>
      {personaLinks.map(({ href, title, desc }) => (
        <Link
          key={href}
          to={href}
          onClick={onNavigate}
          className="flex items-start gap-2 px-2.5 py-2 hover:bg-[#f3f3f3] transition-colors duration-[120ms]"
        >
          <div className="shrink-0 w-1 h-1 bg-[#9b9b9b] mt-[6px]" />
          <div>
            <div className="text-[12px] font-semibold text-[#0a0a0a] leading-tight">{title}</div>
            <div className="text-[10px] text-[#9b9b9b] leading-tight mt-0.5">{desc}</div>
          </div>
        </Link>
      ))}
    </div>
    <div className="p-1.5 border-t border-[rgba(10,10,10,0.08)]">
      <div className="px-2 py-1 flex items-center gap-1.5">
        <Globe2 className="w-3 h-3 text-[#9b9b9b]" strokeWidth={2} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#9b9b9b]">
          Country Editions
        </span>
      </div>
      {countryLinks.map(({ href, flag, title, desc }) => (
        <Link
          key={href}
          to={href}
          onClick={onNavigate}
          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#f3f3f3] transition-colors duration-[120ms]"
        >
          <span className="text-sm leading-none select-none shrink-0">
            {flag === 'PK' ? '🇵🇰' : '🇺🇸'}
          </span>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-[#0a0a0a] leading-none truncate">
              {title}
            </div>
            <div className="text-[10px] text-[#9b9b9b] leading-tight mt-0.5">{desc}</div>
          </div>
        </Link>
      ))}
    </div>
  </motion.div>
);

/* ─── Navbar ─────────────────────────────────────────────────────────────── */

export const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'features' | 'who' | null>(null);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const [mobileWhoOpen, setMobileWhoOpen] = useState(false);

  const { isLoggedIn, isLoading } = useAuthState();
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);

  /* Close dropdowns on outside click */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* Close everything on route change */
  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
    setMobileFeaturesOpen(false);
    setMobileWhoOpen(false);
  }, [location.pathname]);

  const closeAll = () => {
    setMobileOpen(false);
    setOpenDropdown(null);
    setMobileFeaturesOpen(false);
    setMobileWhoOpen(false);
  };

  /* ── Shared CTA button styles ─────────────────────────────────────────── */
  const solidCta = cn(
    'inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-heading font-semibold',
    'bg-[#0a0a0a] text-white border border-[#0a0a0a]',
    'hover:opacity-80 active:scale-[0.97] transition-opacity duration-[120ms]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2',
    isLoading && 'opacity-40 pointer-events-none',
  );

  const ghostCta = cn(
    'inline-flex items-center px-3.5 py-1.5 text-sm font-heading font-medium',
    'text-[#6b6b6b] border border-[rgba(10,10,10,0.16)] bg-white',
    'hover:bg-[#f3f3f3] hover:border-[rgba(10,10,10,0.28)] transition-colors duration-[120ms]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2',
    isLoading && 'opacity-40 pointer-events-none',
  );

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[rgba(10,10,10,0.08)]">
      <div
        ref={navRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[64px] flex items-center justify-between gap-4"
      >
        {/* Logo */}
        <Link
          to="/"
          onClick={closeAll}
          className="shrink-0 flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
          aria-label="SiteFlow home"
        >
          <Logo size="md" showTagline={false} />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-0 flex-1 ml-2">
          <div className="relative">
            <NavLink
              isActive={location.pathname.startsWith('/features')}
              onClick={() => setOpenDropdown((p) => (p === 'features' ? null : 'features'))}
            >
              Features
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 transition-transform duration-[120ms]',
                  openDropdown === 'features' && 'rotate-180',
                )}
                strokeWidth={2}
              />
            </NavLink>
            <AnimatePresence>
              {openDropdown === 'features' && <FeaturesDropdown onNavigate={closeAll} />}
            </AnimatePresence>
          </div>

          <div className="relative">
            <NavLink
              isActive={location.pathname.startsWith('/for')}
              onClick={() => setOpenDropdown((p) => (p === 'who' ? null : 'who'))}
            >
              Who it's for
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 transition-transform duration-[120ms]',
                  openDropdown === 'who' && 'rotate-180',
                )}
                strokeWidth={2}
              />
            </NavLink>
            <AnimatePresence>
              {openDropdown === 'who' && <WhoDropdown onNavigate={closeAll} />}
            </AnimatePresence>
          </div>

          {[
            { to: '/pricing', label: 'Pricing' },
            { to: '/about', label: 'About' },
            { to: '/security', label: 'Security' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} onClick={closeAll}>
              <NavLink as="span" isActive={location.pathname === to}>
                {label}
              </NavLink>
            </Link>
          ))}
        </nav>

        {/* ── Desktop CTAs ──────────────────────────────────────────────
            Logged-out: Sign in (ghost)  +  Get started (solid)
            Logged-in:  single Dashboard (solid)
            This is the canonical Linear / Vercel / Resend pattern.
        ──────────────────────────────────────────────────────────────── */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          {!isLoading && isLoggedIn ? (
            <a href="/app" className={solidCta}>
              Dashboard <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </a>
          ) : (
            <>
              <Link to="/contact" onClick={closeAll} className={ghostCta}>
                Sign in
              </Link>
              <Link to="/contact?intent=trial" onClick={closeAll} className={solidCta}>
                Get started <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </Link>
            </>
          )}
        </div>

        {/* ── Tablet CTAs (sm–lg) ───────────────────────────────────── */}
        <div className="hidden sm:flex lg:hidden items-center gap-2 shrink-0">
          {!isLoading && isLoggedIn ? (
            <a href="/app" className={solidCta}>
              Dashboard
            </a>
          ) : (
            <Link to="/contact?intent=trial" onClick={closeAll} className={solidCta}>
              Get started <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          )}
        </div>

        {/* ── Mobile hamburger ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            className="p-2 text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#f3f3f3] transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen ? (
                <motion.span
                  key="close"
                  initial={{ rotate: -45, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 45, opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="block"
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </motion.span>
              ) : (
                <motion.span
                  key="open"
                  initial={{ rotate: 45, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -45, opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="block"
                >
                  <Menu className="w-5 h-5" strokeWidth={2} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-menu"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="lg:hidden overflow-hidden border-b border-[rgba(10,10,10,0.08)] bg-white"
          >
            <div className="px-4 pt-2 pb-6 space-y-0.5 max-h-[calc(100dvh-64px)] overflow-y-auto">
              {/* Flat nav links */}
              {[
                { to: '/', label: 'Home' },
                { to: '/pricing', label: 'Pricing' },
                { to: '/about', label: 'About' },
                { to: '/security', label: 'Security' },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={closeAll}
                  className={cn(
                    'flex items-center px-3 py-2.5 text-sm font-heading font-medium transition-colors duration-[120ms]',
                    location.pathname === to
                      ? 'text-[#0a0a0a] bg-[#f3f3f3]'
                      : 'text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#f3f3f3]',
                  )}
                >
                  {label}
                </Link>
              ))}

              {/* Features accordion */}
              <div className="border-t border-[rgba(10,10,10,0.08)] mt-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMobileFeaturesOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-heading font-medium text-[#0a0a0a] hover:bg-[#f3f3f3] transition-colors duration-[120ms]"
                >
                  Features
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-[#9b9b9b] transition-transform duration-[120ms]',
                      mobileFeaturesOpen && 'rotate-180',
                    )}
                    strokeWidth={2}
                  />
                </button>
                <AnimatePresence>
                  {mobileFeaturesOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{
                        opacity: 1,
                        height: 'auto',
                        transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
                      }}
                      exit={{
                        opacity: 0,
                        height: 0,
                        transition: { duration: 0.14, ease: [0.4, 0, 1, 1] as const },
                      }}
                      className="overflow-hidden"
                    >
                      <div className="pl-2 py-1 space-y-0">
                        <Link
                          to="/features"
                          onClick={closeAll}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0a0a0a] hover:bg-[#f3f3f3] transition-colors duration-[120ms]"
                        >
                          View all 9 modules <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
                        </Link>
                        {featureLinks.map(({ href, icon: Icon, title }) => (
                          <Link
                            key={href}
                            to={href}
                            onClick={closeAll}
                            className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#f3f3f3] transition-colors duration-[120ms]"
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                            <span className="font-medium">{title}</span>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Who accordion */}
              <div className="border-t border-[rgba(10,10,10,0.08)] pt-2">
                <button
                  type="button"
                  onClick={() => setMobileWhoOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-heading font-medium text-[#0a0a0a] hover:bg-[#f3f3f3] transition-colors duration-[120ms]"
                >
                  Who it's for
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-[#9b9b9b] transition-transform duration-[120ms]',
                      mobileWhoOpen && 'rotate-180',
                    )}
                    strokeWidth={2}
                  />
                </button>
                <AnimatePresence>
                  {mobileWhoOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{
                        opacity: 1,
                        height: 'auto',
                        transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
                      }}
                      exit={{
                        opacity: 0,
                        height: 0,
                        transition: { duration: 0.14, ease: [0.4, 0, 1, 1] as const },
                      }}
                      className="overflow-hidden"
                    >
                      <div className="pl-2 py-1 space-y-0">
                        {personaLinks.map(({ href, title, desc }) => (
                          <Link
                            key={href}
                            to={href}
                            onClick={closeAll}
                            className="block px-3 py-2 text-sm text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#f3f3f3] transition-colors duration-[120ms]"
                          >
                            <div className="font-medium">{title}</div>
                            <div className="text-[11px] text-[#9b9b9b] mt-0.5">{desc}</div>
                          </Link>
                        ))}
                        <div className="px-3 pt-2 pb-1">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Globe2 className="w-3 h-3 text-[#9b9b9b]" strokeWidth={2} />
                            <span className="text-[10px] font-mono uppercase tracking-widest text-[#9b9b9b]">
                              Country Editions
                            </span>
                          </div>
                          {countryLinks.map(({ href, flag, title, desc }) => (
                            <Link
                              key={href}
                              to={href}
                              onClick={closeAll}
                              className="flex items-center gap-2.5 px-2 py-1.5 text-sm text-[#6b6b6b] hover:text-[#0a0a0a] hover:bg-[#f3f3f3] transition-colors duration-[120ms]"
                            >
                              <span className="text-base leading-none shrink-0">
                                {flag === 'PK' ? '🇵🇰' : '🇺🇸'}
                              </span>
                              <div>
                                <div className="font-medium text-sm">{title}</div>
                                <div className="text-[11px] text-[#9b9b9b]">{desc}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile CTAs */}
              <div className="border-t border-[rgba(10,10,10,0.08)] pt-4 flex flex-col gap-2">
                {isLoggedIn ? (
                  <a
                    href="/app"
                    onClick={closeAll}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-heading font-semibold bg-[#0a0a0a] text-white hover:opacity-80 active:scale-[0.97] transition-opacity duration-[120ms]"
                  >
                    Open dashboard <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </a>
                ) : (
                  <>
                    <Link
                      to="/contact?intent=trial"
                      onClick={closeAll}
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-heading font-semibold bg-[#0a0a0a] text-white hover:opacity-80 active:scale-[0.97] transition-opacity duration-[120ms]"
                    >
                      Get started <ArrowRight className="w-4 h-4" strokeWidth={2} />
                    </Link>
                    <Link
                      to="/contact"
                      onClick={closeAll}
                      className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-heading font-medium text-[#6b6b6b] border border-[rgba(10,10,10,0.16)] bg-white hover:bg-[#f3f3f3] transition-colors duration-[120ms]"
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
