/**
 * SmartCtaLink — a pre-styled primary CTA link that automatically resolves
 * its destination via useSmartCta().
 *
 * Drop-in replacement for any hardcoded "Start free trial → /register" link
 * on the marketing pages. Reads auth state and routes the user to the right
 * next step without them having to think about it.
 *
 * Variants:
 *   "ink"   — solid ink background (default, for light page sections)
 *   "white" — solid white background (for inverted ink sections)
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useSmartCta } from '../../hooks/useSmartCta';

interface SmartCtaLinkProps {
  variant?: 'ink' | 'white';
  className?: string;
  /** Override the auto-resolved label */
  label?: string;
}

export const SmartCtaLink: React.FC<SmartCtaLinkProps> = ({
  variant = 'ink',
  className,
  label,
}) => {
  const smartCta = useSmartCta();
  const displayLabel = label ?? smartCta.label;

  return (
    <Link
      to={smartCta.href}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 px-5 text-sm font-medium transition-transform hover:-translate-y-0.5 active:translate-y-0',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4',
        smartCta.isLoading && 'opacity-60 pointer-events-none',
        variant === 'ink'
          ? 'bg-[var(--ink)] text-white focus-visible:outline-[var(--ink)]'
          : 'bg-white text-[var(--ink)] focus-visible:outline-white',
        className,
      )}
    >
      {displayLabel}
      <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
    </Link>
  );
};
