/**
 * App UI state — Zustand store
 *
 * Handles: locale preference, active organization, sidebar open/close.
 * NOT for server data (use RTK Query) and NOT for form state (use react-hook-form).
 *
 * persisted to localStorage for locale + activeOrganizationId.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Locale = 'USD' | 'PKR';

interface AppState {
  /** USD or PKR locale affects currency display and area units */
  locale: Locale;
  setLocale: (locale: Locale) => void;

  /** Active organization context for the operations app shell */
  activeOrganizationId: string | null;
  setActiveOrganizationId: (orgId: string | null) => void;

  /** Sidebar collapse state for the operations shell */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      locale: 'USD',
      setLocale: (locale) => set({ locale }),

      activeOrganizationId: null,
      setActiveOrganizationId: (orgId) => set({ activeOrganizationId: orgId }),

      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: 'siteflow-app-store',
      partialize: (state) => ({
        locale: state.locale,
        activeOrganizationId: state.activeOrganizationId,
      }),
    }
  )
);
