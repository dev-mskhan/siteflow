/**
 * AppLayout — outer shell for all /org/:orgId/* screens.
 *
 * Structure:
 *   OrgBootstrap            loads org + membership + permissions
 *   RequireOrgMember        verifies active membership
 *   <div class="app-shell">
 *     AppSidebar            left panel (collapsible)
 *     <main>
 *       AppTopbar           top bar
 *       <Outlet />          page content
 *     </main>
 *
 * The marketing site (PublicLayout) is completely unaffected.
 */

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
        <div className="flex min-h-dvh bg-[var(--surface)] text-[var(--ink)]">
          {/* Sidebar */}
          <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          {/* Main area */}
          <div className="flex flex-1 flex-col min-w-0">
            <AppTopbar
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen((v) => !v)}
            />
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </RequireOrgMember>
    </OrgBootstrap>
  );
};
