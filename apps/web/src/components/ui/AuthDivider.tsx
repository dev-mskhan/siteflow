/** Horizontal divider with centered "OR" label — used between Google OAuth and email form */
import React from 'react';

export const AuthDivider: React.FC = () => (
  <div className="flex items-center gap-3 my-5">
    <span className="h-px flex-1 bg-[var(--hairline-2)]" />
    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)] select-none">
      or
    </span>
    <span className="h-px flex-1 bg-[var(--hairline-2)]" />
  </div>
);
