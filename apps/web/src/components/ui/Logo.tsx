import React from 'react';
import { cn } from '../../lib/cn';

export interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

const sizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
};

export const Logo: React.FC<LogoProps> = ({ className, size = 'md', showTagline = false }) => (
  <span className={cn('inline-flex items-center gap-2', className)}>
    <span className="flex h-7 w-7 items-center justify-center border border-[var(--ink)] text-xs font-semibold tracking-[-0.08em]">
      SF
    </span>
    <span className="flex flex-col">
      <span className={cn('font-heading font-medium tracking-[-0.04em]', sizes[size])}>SiteFlow</span>
      {showTagline && (
        <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Construction operations
        </span>
      )}
    </span>
  </span>
);
