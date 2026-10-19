/**
 * CommercialShell — sub-nav for /org/:orgId/projects/:projectId/commercial/*
 * Tabs: Change Orders | SOV | Payment Apps | Invoices | Payments | Retainage | Cost Transactions | Summary | Financial
 */
import React from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { cn } from '../../lib/cn';

const Tab: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <NavLink
    to={to}
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

export const CommercialShell: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const base = `/org/${orgId}/projects/${projectId}/commercial`;

  return (
    <div className="flex flex-col min-h-0">
      <div className="border-b border-[var(--hairline-2)] bg-[var(--paper)] px-6 sm:px-8">
        <nav className="flex overflow-x-auto gap-0 -mb-px">
          <Tab to={`${base}/change-orders`}       label="Change orders" />
          <Tab to={`${base}/sov`}                  label="SOV" />
          <Tab to={`${base}/payment-applications`} label="Payment apps" />
          <Tab to={`${base}/invoices`}             label="Invoices" />
          <Tab to={`${base}/payments`}             label="Payments" />
          <Tab to={`${base}/retainage`}            label="Retainage" />
          <Tab to={`${base}/cost-transactions`}    label="Cost txns" />
          <Tab to={`${base}/commercial-summary`}   label="Commercial" />
          <Tab to={`${base}/financial-summary`}    label="Financial" />
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};
