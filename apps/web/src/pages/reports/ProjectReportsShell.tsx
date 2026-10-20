import React from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { cn } from '../../lib/cn';

const Tab: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <NavLink to={to} className={({ isActive }) => cn('px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors whitespace-nowrap', isActive ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]')}>
    {label}
  </NavLink>
);

export const ProjectReportsShell: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const base = `/org/${orgId}/projects/${projectId}/reports`;
  return (
    <div className="flex flex-col min-h-0">
      <div className="border-b border-[var(--hairline-2)] bg-[var(--paper)] px-6 sm:px-8">
        <nav className="flex overflow-x-auto gap-0 -mb-px">
          <Tab to={`${base}/health`}       label="Health" />
          <Tab to={`${base}/schedule`}     label="Schedule" />
          <Tab to={`${base}/cost`}         label="Cost" />
          <Tab to={`${base}/procurement`}  label="Procurement" />
          <Tab to={`${base}/subcontractor`} label="Subcontractors" />
          <Tab to={`${base}/executive`}    label="Executive" />
        </nav>
      </div>
      <div className="flex-1 overflow-auto"><Outlet /></div>
    </div>
  );
};
