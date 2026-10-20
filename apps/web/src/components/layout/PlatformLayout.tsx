/**
 * PlatformLayout — admin console shell for platform operators.
 * Separate from AppLayout (no org switcher). Platform-level nav only.
 * Routes: /platform/organizations, /platform/accounts, /platform/diagnostics,
 *         /platform/billing, /platform/support-grants
 */
import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Building2, Users, Activity, CreditCard, KeyRound, Shield } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Logo } from '../ui/Logo';

const NAV = [
  { to: '/platform/organizations', icon: Building2, label: 'Organizations' },
  { to: '/platform/accounts',      icon: Users,     label: 'Accounts' },
  { to: '/platform/diagnostics',   icon: Activity,  label: 'Diagnostics' },
  { to: '/platform/billing',       icon: CreditCard, label: 'Billing' },
  { to: '/platform/support-grants', icon: KeyRound, label: 'Support grants' },
];

export const PlatformLayout: React.FC = () => {
  const location = useLocation();
  const [sidebarOpen] = useState(true);

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[var(--hairline-2)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--hairline-2)] px-3 py-3.5">
            <Link to="/"><Logo size="sm" /></Link>
          </div>

          {/* Platform badge */}
          <div className="px-3 py-2 border-b border-[var(--hairline-2)]">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">Platform Admin</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Console</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {NAV.map(({ to, icon: Icon, label }) => {
              const isActive = location.pathname.startsWith(to);
              return (
                <Link key={to} to={to}
                  className={cn(
                    'group flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors duration-[120ms]',
                    isActive
                      ? 'bg-[var(--ink)] text-white'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
                  )}>
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-[var(--muted)] group-hover:text-[var(--ink)]')} strokeWidth={1.75} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-[var(--hairline-2)] px-3 py-3">
            <Link to="/" className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--ink)]">
              ← Back to app
            </Link>
          </div>
        </aside>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
