/**
 * AuthLayout — shared shell for all auth screens.
 *
 * Structure:
 *   Left panel  — branding, tagline, feature bullets (hidden on mobile)
 *   Right panel — form card (full-width on mobile)
 *
 * Follows the Vault three-color palette: ink / paper / hairline.
 * No rounded corners, no shadows — depth via hairlines only.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
  /** Overrides the default headline in the left branding panel */
  headline?: React.ReactNode;
  /** Overrides the default sub-copy in the left branding panel */
  subline?: string;
  /** Whether to show the decorative left panel (hide on narrow screens already via CSS) */
  showPanel?: boolean;
}

const DEFAULT_BULLETS = [
  'Estimate to payment — one connected record',
  'BOQ, procurement, field logs, certifications',
  'PKR and USD — multi-currency out of the box',
  'Role-based access for every team member',
];

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  headline,
  subline,
  showPanel = true,
}) => (
  <div className="min-h-dvh bg-[var(--surface)] flex">
    {/* ── Left branding panel (md+) ────────────────────────────────────── */}
    {showPanel && (
      <div className="hidden md:flex md:w-[420px] lg:w-[480px] xl:w-[520px] shrink-0 flex-col justify-between bg-[var(--ink)] text-white p-10 lg:p-14 relative overflow-hidden">
        {/* Dot-grid texture */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Link to="/" aria-label="SiteFlow home">
            <Logo size="md" />
          </Link>
        </div>

        {/* Headline + bullets */}
        <div className="relative z-10 space-y-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50 mb-4">
              Construction operations
            </p>
            <h1 className="text-3xl font-medium leading-[1.1] tracking-[-0.045em] lg:text-4xl">
              {headline ?? (
                <>
                  The job is complex.
                  <br />
                  <em className="font-serif font-light not-italic italic">Control</em> should not be.
                </>
              )}
            </h1>
            {subline && (
              <p className="mt-4 text-sm leading-6 text-white/60">{subline}</p>
            )}
          </div>

          <ul className="space-y-3">
            {DEFAULT_BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-white/70">
                <span className="mt-2 h-1 w-1 shrink-0 bg-white/40" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <p className="relative z-10 font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">
          © 2026 SiteFlow · PKR / USD ready
        </p>
      </div>
    )}

    {/* ── Right form area ──────────────────────────────────────────────── */}
    <div className="flex flex-1 flex-col">
      {/* Mobile-only logo bar */}
      <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-4 md:hidden">
        <Link to="/" aria-label="SiteFlow home">
          <Logo size="sm" />
        </Link>
        <Link
          to="/"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          ← Back to site
        </Link>
      </div>

      {/* Centered form container */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>

      {/* Desktop back-to-site link */}
      <div className="hidden md:flex justify-center pb-8">
        <Link
          to="/"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          ← Back to siteflow.app
        </Link>
      </div>
    </div>
  </div>
);
