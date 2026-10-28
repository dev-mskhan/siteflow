import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { SectionNavDropdown } from '../../../components/ui/SectionNavDropdown';

export const OrgSettingsLayout: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const base = `/org/${orgId}/settings`;

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-medium tracking-[-0.03em]">Settings</h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          Manage your organization configuration.
        </p>
      </div>

      <div className="-mx-6 sm:-mx-8 mb-8">
        <SectionNavDropdown
          fallbackTo={base}
          fallbackLabel="General"
          fallbackPermission="settings:read"
          groups={[
            {
              label: 'Workspace',
              items: [
                { to: `${base}/profile`, label: 'Profile', permission: 'organization:read' },
                {
                  to: `${base}/sequences`,
                  label: 'Document sequences',
                  permission: 'settings:read',
                },
                { to: `${base}/audit`, label: 'Audit log', permission: 'audit:read' },
              ],
            },
            {
              label: 'Operations',
              items: [
                { to: `${base}/billing`, label: 'Billing' },
                { to: `${base}/exports`, label: 'Exports' },
                { to: `${base}/notifications`, label: 'Notifications' },
              ],
            },
          ]}
        />
      </div>
      <Outlet />
    </div>
  );
};
