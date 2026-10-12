import React from 'react';
import { cn } from '../../lib/cn';

export interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className,
  size = 'md',
  showTagline = true,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none group', className)}>
      {/* Precision Geometric Architectural Symbol */}
      <div
        className={cn(
          'relative rounded-md bg-[#13171C] border border-[#2D3748] flex items-center justify-center shrink-0 shadow-sm overflow-hidden group-hover:border-accent transition-colors',
          iconSizes[size]
        )}
      >
        {/* Isometric Girder / Laser Level Vector */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5"
        >
          {/* Base Drafting Axis Lines */}
          <line x1="4" y1="16" x2="28" y2="16" stroke="#4A5568" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="16" y1="4" x2="16" y2="28" stroke="#4A5568" strokeWidth="1" strokeDasharray="2 2" />

          {/* Structural Steel Column 1 (Left Wing) */}
          <path
            d="M7 23V11L14 7V19L7 23Z"
            fill="#E2E8F0"
            stroke="#CBD5E1"
            strokeWidth="0.8"
          />

          {/* Structural Steel Column 2 (Right Wing) */}
          <path
            d="M18 25V13L25 9V21L18 25Z"
            fill="#94A3B8"
            stroke="#64748B"
            strokeWidth="0.8"
          />

          {/* Safety Amber Laser Datum Point */}
          <circle cx="16" cy="16" r="3" fill="#E65100" />
          <circle cx="16" cy="16" r="5" stroke="#E65100" strokeWidth="0.75" strokeOpacity="0.6" className="animate-pulse" />
        </svg>
      </div>

      {/* Typography */}
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5 leading-none">
          <span
            className={cn(
              'font-heading font-extrabold tracking-tight text-text',
              textSizes[size]
            )}
          >
            SiteFlow
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
        </div>
        {showTagline && (
          <span className="text-[9px] font-mono tracking-widest uppercase text-text-muted mt-0.5">
            Operations Engine
          </span>
        )}
      </div>
    </div>
  );
};
