/**
 * ProcurementShell — renders the procurement sub-nav and Outlet.
 * Lives inside ProjectShell at /org/:orgId/projects/:projectId/procurement/*
 */
import React from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { cn } from '../../lib/cn';

const Tab: React.FC<{ to: string; label: string; end?: boolean }> = ({ to, label, end }) => (
  <NavLink
    to={to}
    end={end}
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

export const ProcurementShell: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const base = `/org/${orgId}/projects/${projectId}/procurement`;

  return (
    <div className="flex flex-col min-h-0">
      <div className="border-b border-[var(--hairline-2)] bg-[var(--paper)] px-6 sm:px-8">
        <nav className="flex overflow-x-auto gap-0 -mb-px">
          <Tab to={`${base}/requests`} label="Requests" />
          <Tab to={`${base}/quotes`} label="Quotes" />
          <Tab to={`${base}/orders`} label="Orders" />
          <Tab to={`${base}/approvals`} label="Approvals" />
          <Tab to={`${base}/deliveries`} label="Deliveries" />
          <Tab to={`${base}/committed`} label="Committed" />
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};
