/**
 * PreconstructionShell — sub-nav for /org/:orgId/projects/:projectId/preconstruction/*
 * Tabs: Proposals | Estimates | BOQ | Takeoffs | Pricing
 */
import React from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { cn } from '../../lib/cn';

const Tab: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <NavLink to={to}
    className={({ isActive }) =>
      cn(
        'px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors whitespace-nowrap',
        isActive
          ? 'border-[var(--ink)] text-[var(--ink)]'
          : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]',
      )
    }
  >
    {label}
  </NavLink>
);

export const PreconstructionShell: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const base = `/org/${orgId}/projects/${projectId}/preconstruction`;

  return (
    <div className="flex flex-col min-h-0">
      <div className="border-b border-[var(--hairline-2)] bg-[var(--paper)] px-6 sm:px-8">
        <nav className="flex overflow-x-auto gap-0 -mb-px">
          <Tab to={`${base}/proposals`} label="Proposals" />
          <Tab to={`${base}/estimates`} label="Estimates" />
          <Tab to={`${base}/boq`} label="BOQ" />
          <Tab to={`${base}/takeoffs`} label="Takeoffs" />
          <Tab to={`${base}/pricing`} label="Pricing" />
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};
