import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';

export const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const [isPersonasOpen, setIsPersonasOpen] = useState(false);
  const [mobileFeaturesExpanded, setMobileFeaturesExpanded] = useState(false);
  const [mobileCountriesExpanded, setMobileCountriesExpanded] = useState(false);
  const location = useLocation();

  const featureLinks = [
    { title: 'Estimating & BOQ', href: '/features/estimating-and-boq', icon: Calculator, desc: 'Structure scope & rates' },
    { title: 'Scheduling', href: '/features/scheduling', icon: Calendar, desc: 'Phase handoffs & milestones' },
    { title: 'Procurement', href: '/features/procurement', icon: Truck, desc: 'Purchase orders & receipts' },
    { title: 'Field Logs', href: '/features/field-logs', icon: ClipboardList, desc: 'Daily labor & photos' },
    { title: 'Subcontractors', href: '/features/subcontractors', icon: Users, desc: 'Dedicated trade portal' },
    { title: 'Change Orders', href: '/features/change-orders', icon: FileCheck2, desc: 'Approved paid variations' },
    { title: 'Cost Control', href: '/features/cost-control', icon: TrendingDown, desc: 'Budget vs committed vs actual' },
    { title: 'Billing & Payments', href: '/features/billing-and-payments', icon: Receipt, desc: 'IPC forms & retainage' },
    { title: 'Documents', href: '/features/documents', icon: FolderArchive, desc: 'Drawings & mill tests' },
  ];

  const personaLinks = [
    { title: 'General Contractors', href: '/for/general-contractors', desc: 'Control multiple jobs & margins' },
    { title: 'Subcontractors', href: '/for/subcontractors', desc: 'Submit claims & track retainage' },
    { title: 'Project Owners & Developers', href: '/for/project-owners', desc: 'Audit certified site progress' },
  ];

  const countryLinks = [
    { title: 'Pakistan Edition (PKR)', href: '/construction-software-pakistan', desc: 'Marla/Kanal & WHT tax' },
    { title: 'United States Edition (USD)', href: '/construction-software-us', desc: 'AIA billing & CSI divisions' },
  ];

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
    setIsFeaturesOpen(false);
    setIsPersonasOpen(false);
    setMobileFeaturesExpanded(false);
    setMobileCountriesExpanded(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand Logo with new architectural mark */}
        <Link to="/" onClick={handleLinkClick} className="shrink-0">
          <Logo size="md" />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-sm font-heading font-medium text-text-muted">
          {/* Features Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setIsFeaturesOpen(true)}
            onMouseLeave={() => setIsFeaturesOpen(false)}
          >
            <button
              type="button"
              className={`px-3 py-2 rounded-md inline-flex items-center gap-1 hover:text-text hover:bg-surface-muted transition-colors ${
                location.pathname.startsWith('/features') ? 'text-accent font-semibold' : ''
              }`}
            >
              <span>Features</span>
              <ChevronDown className="w-4 h-4 opacity-70" />
            </button>

            {isFeaturesOpen && (
              <div className="absolute top-full left-0 w-[580px] p-4 bg-surface border border-border rounded-lg shadow-modal grid grid-cols-2 gap-2 z-50 animate-in fade-in slide-in-from-top-1">
                {featureLinks.map((f) => {
                  const Icon = f.icon;
                  return (
                    <Link
                      key={f.href}
                      to={f.href}
                      onClick={handleLinkClick}
                      className="p-2.5 rounded-md hover:bg-surface-muted transition-colors flex items-start gap-3 group"
                    >
                      <div className="w-7 h-7 rounded bg-surface-muted text-accent flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-accent group-hover:text-accent-contrast transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-text group-hover:text-accent">
                          {f.title}
                        </div>
                        <div className="text-[11px] text-text-muted leading-tight mt-0.5">
                          {f.desc}
                        </div>
                      </div>
                    </Link>
                  );
                })}
                <div className="col-span-2 pt-2 border-t border-border flex items-center justify-between text-xs">
                  <Link
                    to="/features"
                    onClick={handleLinkClick}
                    className="text-accent font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>View all features overview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <span className="text-[11px] text-text-subtle">9 Core Modules</span>
                </div>
              </div>
            )}
          </div>

          {/* Who It's For Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setIsPersonasOpen(true)}
            onMouseLeave={() => setIsPersonasOpen(false)}
          >
            <button
              type="button"
              className={`px-3 py-2 rounded-md inline-flex items-center gap-1 hover:text-text hover:bg-surface-muted transition-colors ${
                location.pathname.startsWith('/for') ? 'text-accent font-semibold' : ''
              }`}
            >
              <span>Who it's for</span>
              <ChevronDown className="w-4 h-4 opacity-70" />
            </button>

            {isPersonasOpen && (
              <div className="absolute top-full left-0 w-80 p-3 bg-surface border border-border rounded-lg shadow-modal flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                  Role Profiles
                </div>
                {personaLinks.map((p) => (
                  <Link
                    key={p.href}
                    to={p.href}
                    onClick={handleLinkClick}
                    className="p-2.5 rounded-md hover:bg-surface-muted transition-colors block group"
                  >
                    <div className="text-xs font-bold text-text group-hover:text-accent">
                      {p.title}
                    </div>
                    <div className="text-[11px] text-text-muted leading-tight mt-0.5">
                      {p.desc}
                    </div>
                  </Link>
                ))}
                <div className="my-1 border-t border-border" />
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-subtle flex items-center gap-1">
                  <Globe2 className="w-3 h-3" />
                  <span>Country Editions</span>
                </div>
                {countryLinks.map((c) => (
                  <Link
                    key={c.href}
                    to={c.href}
                    onClick={handleLinkClick}
                    className="p-2 rounded-md hover:bg-surface-muted transition-colors block text-xs"
                  >
                    <div className="font-semibold text-text">{c.title}</div>
                    <div className="text-[11px] text-text-muted">{c.desc}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/pricing"
            onClick={handleLinkClick}
            className={`px-3 py-2 rounded-md hover:text-text hover:bg-surface-muted transition-colors ${
              location.pathname === '/pricing' ? 'text-accent font-semibold' : ''
            }`}
          >
            Pricing
          </Link>

          <Link
            to="/about"
            onClick={handleLinkClick}
            className={`px-3 py-2 rounded-md hover:text-text hover:bg-surface-muted transition-colors ${
              location.pathname === '/about' ? 'text-accent font-semibold' : ''
            }`}
          >
            About
          </Link>

          <Link
            to="/security"
            onClick={handleLinkClick}
            className={`px-3 py-2 rounded-md hover:text-text hover:bg-surface-muted transition-colors ${
              location.pathname === '/security' ? 'text-accent font-semibold' : ''
            }`}
          >
            Security
          </Link>
        </nav>

        {/* Right CTA Actions */}
        <div className="hidden sm:flex items-center gap-2 lg:gap-3 shrink-0">
          <Link
            to="/contact"
            className="text-xs font-heading font-semibold text-text-muted hover:text-text px-2.5 py-1.5 rounded-md hover:bg-surface-muted transition-colors"
          >
            Log in
          </Link>
          <Link to="/contact">
            <Button variant="primary" size="sm">
              Book a demo
            </Button>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link to="/contact" className="sm:hidden">
            <Button variant="primary" size="sm">
              Demo
            </Button>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
            className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-text" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu (Responsive, Accessible & Non-breaking) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-b border-border bg-surface shadow-modal px-4 pt-3 pb-6 space-y-4 max-h-[calc(100vh-64px)] overflow-y-auto">
          <div className="space-y-1">
            <Link
              to="/"
              onClick={handleLinkClick}
              className={`block px-3 py-2.5 text-sm font-heading font-semibold rounded-md ${
                location.pathname === '/' ? 'bg-accent-subtle text-accent' : 'text-text hover:bg-surface-muted'
              }`}
            >
              Home
            </Link>

            <Link
              to="/pricing"
              onClick={handleLinkClick}
              className={`block px-3 py-2.5 text-sm font-heading font-semibold rounded-md ${
                location.pathname === '/pricing' ? 'bg-accent-subtle text-accent' : 'text-text hover:bg-surface-muted'
              }`}
            >
              Pricing
            </Link>

            <Link
              to="/about"
              onClick={handleLinkClick}
              className={`block px-3 py-2.5 text-sm font-heading font-semibold rounded-md ${
                location.pathname === '/about' ? 'bg-accent-subtle text-accent' : 'text-text hover:bg-surface-muted'
              }`}
            >
              About SiteFlow
            </Link>

            <Link
              to="/security"
              onClick={handleLinkClick}
              className={`block px-3 py-2.5 text-sm font-heading font-semibold rounded-md ${
                location.pathname === '/security' ? 'bg-accent-subtle text-accent' : 'text-text hover:bg-surface-muted'
              }`}
            >
              Security & Isolation
            </Link>
          </div>

          {/* Collapsible Features Accordion for Mobile */}
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setMobileFeaturesExpanded(!mobileFeaturesExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider text-text-muted hover:text-text"
            >
              <span>Features (9 Modules)</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  mobileFeaturesExpanded ? 'rotate-180 text-accent' : ''
                }`}
              />
            </button>

            {mobileFeaturesExpanded && (
              <div className="grid grid-cols-1 gap-1 pl-2 pt-1 animate-in fade-in">
                <Link
                  to="/features"
                  onClick={handleLinkClick}
                  className="px-3 py-2 text-xs font-bold text-accent rounded-md hover:bg-surface-muted"
                >
                  → View all modules overview
                </Link>
                {featureLinks.map((f) => (
                  <Link
                    key={f.href}
                    to={f.href}
                    onClick={handleLinkClick}
                    className="px-3 py-2 text-xs text-text hover:text-accent rounded-md hover:bg-surface-muted flex items-center justify-between"
                  >
                    <span>{f.title}</span>
                    <span className="text-[10px] text-text-subtle">{f.desc}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Collapsible Country Editions for Mobile */}
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setMobileCountriesExpanded(!mobileCountriesExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider text-text-muted hover:text-text"
            >
              <span>Country Editions</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  mobileCountriesExpanded ? 'rotate-180 text-accent' : ''
                }`}
              />
            </button>

            {mobileCountriesExpanded && (
              <div className="space-y-1 pl-2 pt-1 animate-in fade-in">
                {countryLinks.map((c) => (
                  <Link
                    key={c.href}
                    to={c.href}
                    onClick={handleLinkClick}
                    className="block px-3 py-2 text-xs text-text hover:text-accent rounded-md hover:bg-surface-muted"
                  >
                    <div className="font-semibold">{c.title}</div>
                    <div className="text-[10px] text-text-subtle">{c.desc}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4 flex flex-col gap-2">
            <Link to="/contact" onClick={handleLinkClick}>
              <Button variant="primary" className="w-full" size="md">
                Book a demo
              </Button>
            </Link>
            <Link to="/contact" onClick={handleLinkClick}>
              <Button variant="secondary" className="w-full" size="sm">
                Log in to workspace
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
