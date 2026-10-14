/**
 * SessionsPage — lists all active sessions for the current user.
 * Route: /settings/sessions  (protected, reachable from a future app shell)
 *
 * Actions:
 *  - Revoke individual session  → DELETE /auth/sessions/:id  (toast on error)
 *  - Revoke all sessions        → POST   /auth/logout-all    (clears auth + redirect /login)
 *
 * Current session is flagged by isCurrent: true from the server.
 * Revoking the current session is treated as logout.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Smartphone, Trash2, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  useGetSessionsQuery,
  useDeleteSessionMutation,
  useLogoutAllMutation,
  useLogoutMutation,
} from '../../features/auth/authApi';
import { useAppDispatch } from '../../app/store';
import { authCleared } from '../../features/auth/authSlice';
import { toastErrorMessage } from '../../lib/authErrors';
import { useToast } from '../../components/ui/Toast';
import { RequireAuth } from '../../components/guards/RequireAuth';

// Infer device icon from user-agent string
function deviceIcon(userAgent: string | null) {
  if (!userAgent) return Monitor;
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return Smartphone;
  return Monitor;
}

// Format "Mozilla/5.0 (Windows NT 10.0; Win64…" → "Chrome on Windows"
function parseUA(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    if (ua.includes('Windows')) return 'Chrome on Windows';
    if (ua.includes('Mac')) return 'Chrome on macOS';
    if (ua.includes('Android')) return 'Chrome on Android';
  }
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Mobile')) return 'Mobile browser';
  return 'Desktop browser';
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

const SessionsPageContent: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { error: toastErr, success: toastOk } = useToast();

  const { data, isLoading, refetch } = useGetSessionsQuery();
  const [deleteSession, { isLoading: deleting }] = useDeleteSessionMutation();
  const [logoutAll, { isLoading: loggingOutAll }] = useLogoutAllMutation();
  const [logout] = useLogoutMutation();

  const sessions = data?.sessions ?? [];

  const handleRevoke = async (sessionId: string, isCurrent: boolean) => {
    try {
      await deleteSession(sessionId).unwrap();
      if (isCurrent) {
        dispatch(authCleared());
        navigate('/login', { replace: true });
      } else {
        toastOk('Session revoked', 'That device has been signed out.');
      }
    } catch (err: unknown) {
      toastErr('Could not revoke session', toastErrorMessage(err as Parameters<typeof toastErrorMessage>[0]));
    }
  };

  const handleLogoutAll = async () => {
    try {
      await logoutAll().unwrap();
      try { await logout().unwrap(); } catch { /* best-effort */ }
      dispatch(authCleared());
      toastOk('Signed out everywhere', 'All sessions have been revoked.');
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      toastErr('Sign-out failed', toastErrorMessage(err as Parameters<typeof toastErrorMessage>[0]));
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--hairline-2)] pb-4">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-5 w-5 text-[var(--muted)]" strokeWidth={1.5} />
          <div>
            <h1 className="text-lg font-medium tracking-[-0.03em]">Active sessions</h1>
            <p className="text-sm text-[var(--muted)]">
              Devices that currently have access to your account
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          aria-label="Refresh sessions list"
          className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>

      {/* Sessions list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse border border-[var(--hairline-2)] bg-[var(--surface-2)]"
            />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No active sessions found.</p>
      ) : (
        <div className="border border-[var(--hairline-2)] divide-y divide-[var(--hairline-2)]">
          {sessions.map((session) => {
            const DeviceIcon = deviceIcon(session.userAgent);
            return (
              <div
                key={session.id}
                className="flex items-center gap-4 px-4 py-4"
              >
                {/* Icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
                  <DeviceIcon className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.5} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--ink)] truncate">
                      {parseUA(session.userAgent)}
                    </p>
                    {session.isCurrent && (
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] border border-[var(--hairline-2)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[var(--muted)]">
                        This device
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-[var(--muted)] mt-0.5">
                    {session.ipAddress ? `${session.ipAddress} · ` : ''}
                    Last active {formatDate(session.lastUsedAt ?? session.createdAt)}
                  </p>
                </div>

                {/* Revoke button */}
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => handleRevoke(session.id, session.isCurrent ?? false)}
                  aria-label={session.isCurrent ? 'Sign out' : 'Revoke this session'}
                  className="shrink-0 p-1.5 text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-40 transition-colors"
                >
                  {session.isCurrent ? (
                    <LogOut className="h-4 w-4" strokeWidth={1.8} />
                  ) : (
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Revoke all */}
      {sessions.length > 1 && (
        <div className="border-t border-[var(--hairline-2)] pt-5">
          <button
            type="button"
            disabled={loggingOutAll}
            onClick={handleLogoutAll}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] underline underline-offset-4 hover:opacity-60 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
            {loggingOutAll ? 'Signing out everywhere…' : 'Sign out of all devices'}
          </button>
          <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
            Revokes all sessions including this one
          </p>
        </div>
      )}
    </div>
  );
};

// Wrapped with RequireAuth so it can be used directly as a route element
export const SessionsPage: React.FC = () => (
  <RequireAuth>
    <SessionsPageContent />
  </RequireAuth>
);
