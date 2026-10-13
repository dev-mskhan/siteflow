/**
 * HeroSection — Editorial Split Hero
 *
 * Desktop: 5/7 col split, copy left, image right, both top-aligned.
 * Tablet (sm–lg): single column, copy above image.
 * Mobile: single column, buttons stack, image full-width at 4/3.
 *
 * Fixes applied:
 *  - Explicit grid-cols-[5fr_7fr] instead of 12-col span system (Tailwind v4 safe)
 *  - Proper bottom padding so section doesn't clip next section
 *  - Responsive aspect ratio: 4/3 on mobile, 16/10 on lg+
 *  - Buttons: flex-col on xs, flex-row from sm, no w-full fighting
 *  - fetchpriority lowercase (valid HTML attr, React forwards it)
 *  - Removed inline maxWidth that broke mobile heading
 *  - lg:items-center so copy and image align vertically when heights differ
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';

/* ── Helpers ──────────────────────────────────────────────────────────── */
const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.48, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const fadeRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.56, delay: 0.16, ease: [0.16, 1, 0.3, 1] as const },
};

const still = { initial: {}, animate: {}, transition: {} };

/* ── Component ────────────────────────────────────────────────────────── */
interface HeroSectionProps {
  onWatchDemo?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onWatchDemo }) => {
  const reduce = useReducedMotion();
  const p = (delay: number) => (reduce ? still : fadeUp(delay));
  const img = reduce ? still : fadeRight;

  return (
    <section className="bg-bg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-14 sm:pt-18 sm:pb-18 lg:pt-24 lg:pb-20">
        {/*
          Grid: 1 col on mobile/tablet, 5fr + 7fr on lg+
          gap-y handles the vertical space when stacked
        */}
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-y-10 lg:gap-x-12 xl:gap-x-16 lg:items-center">
          {/* ── LEFT: Copy ──────────────────────────────────────────── */}
          <div className="flex flex-col">
            {/* Eyebrow */}
            <motion.p
              className="text-[11px] font-mono font-semibold text-accent tracking-[0.14em] uppercase mb-5"
              {...p(0)}
            >
              Construction Operations Platform
            </motion.p>

            {/* H1 — clamp keeps it 2 lines on desktop, readable on mobile */}
            <motion.h1
              className="font-heading font-bold text-text leading-[1.05] tracking-tight mb-5"
              style={{ fontSize: 'clamp(2.25rem, 4.5vw, 5rem)' }}
              {...p(0.06)}
            >
              One system for every site, every cost, every trade
            </motion.h1>

            {/* Sub */}
            <motion.p
              className="font-body text-text-muted text-base sm:text-lg leading-relaxed mb-8 max-w-prose lg:max-w-[38ch]"
              {...p(0.13)}
            >
              SiteFlow connects Bill of Quantities, purchase orders, field logs, and subcontractor
              payments into one auditable record.
            </motion.p>

            {/* CTAs — stack on xs, row from sm */}
            <motion.div className="flex flex-col xs:flex-row sm:flex-row gap-3 mb-10" {...p(0.2)}>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-accent-gradient text-white font-heading font-semibold text-sm shadow-[0_2px_14px_rgba(230,81,0,0.3)] hover:opacity-95 active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 whitespace-nowrap"
              >
                Book a demo
                <ArrowRight className="w-4 h-4 shrink-0" strokeWidth={2.5} />
              </Link>

              <button
                type="button"
                onClick={onWatchDemo}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md border border-border bg-surface text-text font-heading font-semibold text-sm hover:bg-surface-hover hover:border-border-strong active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 whitespace-nowrap"
              >
                <span className="w-5 h-5 rounded-full bg-surface-muted border border-border flex items-center justify-center shrink-0">
                  <Play className="w-2.5 h-2.5 fill-current text-text-muted ml-[1px]" />
                </span>
                Watch it work
              </button>
            </motion.div>

            {/* Three proof facts — plain text, no pills, no dots */}
            <motion.ul
              className="pt-7 border-t border-border space-y-2.5 text-sm text-text-muted font-body"
              {...p(0.27)}
            >
              <li className="flex items-start gap-2">
                <span className="mt-[5px] w-3.5 h-px bg-accent shrink-0" />
                Runs in PKR and USD with local tax and unit conventions
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[5px] w-3.5 h-px bg-accent shrink-0" />
                Eight distinct roles from Site Supervisor to Finance
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[5px] w-3.5 h-px bg-accent shrink-0" />
                Every change order and payment in an immutable audit trail
              </li>
            </motion.ul>
          </div>

          {/* ── RIGHT: Image + caption ───────────────────────────────── */}
          <motion.div className="flex flex-col" {...img}>
            {/*
              aspect-[4/3] on mobile (taller = more image context)
              aspect-[16/10] on lg+ (cinematic, fits the split layout)
            */}
            <div className="w-full aspect-[4/3] lg:aspect-[16/10] overflow-hidden rounded-md border border-border bg-surface-muted">
              <img
                src="/media/hero-poster.jpg"
                alt="Construction crew on an active reinforced-concrete site with structural steel and formwork"
                width={1280}
                height={800}
                loading="eager"
                // @ts-ignore — valid HTML attribute, forwarded by React 18
                fetchpriority="high"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Caption — below the image, never overlaid */}
            <p className="mt-3 text-[11px] font-mono text-text-subtle leading-relaxed">
              Field teams log daily progress, deliveries, and sign-offs from any smartphone.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
