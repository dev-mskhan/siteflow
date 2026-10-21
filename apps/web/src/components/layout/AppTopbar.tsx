import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { NotificationBell } from '../ui/NotificationBell';
import { cn } from '../../lib/cn';
import { useAuth } from '../../features/auth/useAuth';
import { useOrgContext } from '../../features/org/useOrgContext';
import { useLogoutMutation } from '../../features/auth/authApi';
import { useAppDispatch } from '../../app/store';
import { authCleared } from '../../features/auth/authSlice';
import { orgContextCleared } from '../../features/org/orgSlice';
import { useToast } from '../ui/Toast';
import { useParams } from 'react-router-dom';

interface AppTopbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const AppTopbar: React.FC<AppTopbarProps> = ({ sidebarOpen, onToggleSidebar }) => {
  const { user } = useAuth();
  const { org } = useOrgContext();
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { error: toastErr } = useToast();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [logout, { isLoading: loggingOut }] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Best-effort — clear client state even if server errors
    } finally {
      dispatch(authCleared());
      dispatch(orgContextCleared());
      navigate('/login', { replace: true });
    }
  };

  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  return (
    <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-[var(--hairline-2)] bg-[var(--paper)] px-4 gap-4">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
        >
          <Menu className="h-4 w-4" strokeWidth={2} />
        </button>

        {/* Org name breadcrumb */}
        {org && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              {org.name}
            </span>
            {org.status !== 'ACTIVE' && (
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-1.5 py-0.5">
                {org.status}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: notification bell + user avatar menu */}
      <div className="flex items-center gap-1">
        <NotificationBell />
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--surface-2)] transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
          >
            {/* Avatar */}
            <div className="flex h-7 w-7 items-center justify-center bg-[var(--ink)] text-white font-mono text-[10px] font-bold">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-[var(--ink)] leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="font-mono text-[9px] text-[var(--muted)] leading-tight truncate max-w-[140px]">
                {user?.email}
              </p>
            </div>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-[var(--muted)] transition-transform duration-[120ms]',
                userMenuOpen && 'rotate-180',
              )}
              strokeWidth={2}
            />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                key="user-menu"
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] as const },
                }}
                exit={{ opacity: 0, y: -3, transition: { duration: 0.1 } }}
                className="absolute right-0 top-[calc(100%+4px)] z-50 w-52 border border-[var(--ink)] bg-[var(--paper)]"
              >
                {/* User info */}
                <div className="px-3 py-2.5 border-b border-[var(--hairline-2)]">
                  <p className="text-sm font-medium text-[var(--ink)] truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="font-mono text-[9px] text-[var(--muted)] truncate">{user?.email}</p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <Link
                    to={`/org/${orgId}/settings`}
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
                  >
                    <Settings className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.75} />
                    Organization settings
                  </Link>
                  <Link
                    to="/settings/sessions"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
                  >
                    <User className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.75} />
                    Account & sessions
                  </Link>
                </div>

                <div className="border-t border-[var(--hairline-2)] py-1">
                  <button
                    type="button"
                    disabled={loggingOut}
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors duration-[120ms] disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.75} />
                    {loggingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
