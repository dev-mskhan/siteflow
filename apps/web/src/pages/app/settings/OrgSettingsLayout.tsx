import React from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { PermissionGate } from '../../../components/guards/PermissionGate';
import { cn } from '../../../lib/cn';

const Tab: React.FC<{ to: string; label: string; end?: boolean }> = ({ to, label, end }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      cn(
        'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-[120ms]',
        isActive
          ? 'border-[var(--ink)] text-[var(--ink)]'
          : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]',
      )
    }
  >
    {label}
  </NavLink>
);

export const OrgSettingsLayout: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const base = `/org/${orgId}/settings`;

  return (
    <div className="p-6 sm:p-8 max-w-[1320px]">
      <div className="mb-6">
        <h1 className="text-xl font-medium tracking-[-0.03em]">Settings</h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">Manage your organization configuration.</p>
      </div>

      {/* Settings sub-nav */}
      <div className="flex gap-0 border-b border-[var(--hairline-2)] mb-8 overflow-x-auto">
        <PermissionGate require="settings:read">
          <Tab to={base} label="General" end />
        </PermissionGate>
        <PermissionGate require="organization:read">
          <Tab to={`${base}/profile`} label="Profile" />
        </PermissionGate>
        <PermissionGate require="settings:read">
          <Tab to={`${base}/sequences`} label="Document sequences" />
        </PermissionGate>
        <PermissionGate require="audit:read">
          <Tab to={`${base}/audit`} label="Audit log" />
        </PermissionGate>
      </div>

      <Outlet />
    </div>
  );
};
