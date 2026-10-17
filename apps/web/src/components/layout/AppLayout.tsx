import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { OrgBootstrap } from '../../features/org/OrgBootstrap';
import { RequireOrgMember } from '../guards/RequireOrgMember';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <OrgBootstrap>
      <RequireOrgMember>
        {/*
          The outer div is a flex row.
          Sidebar is only rendered in the DOM when open (md+).
          Main area always gets flex-1 so it fills 100% when sidebar is hidden.
        */}
        <div className="flex h-dvh overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
          {/* Sidebar — only occupies space when open */}
          <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          {/* Main column — always fills remaining width */}
          <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
            <AppTopbar
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen((v) => !v)}
            />
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              <Outlet />
            </main>
          </div>
        </div>
      </RequireOrgMember>
    </OrgBootstrap>
  );
};
