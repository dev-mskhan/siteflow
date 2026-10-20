/**
 * useSSENotifications — Group 13 Server-Sent Events hook.
 *
 * Connects to /api/v1/organizations/:orgId/notifications/stream using EventSource.
 * On receiving an event, invalidates the relevant RTK Query cache tags so
 * NotificationBell and listNotifications auto-refresh.
 *
 * Rules from realtime.plugin.ts:
 *   - EventSource URL carries auth via cookie (same-site session).
 *   - In bypass/mock mode (import.meta.env.VITE_API_BYPASS === 'true') — skip SSE entirely.
 *   - Event data shape: { type: string, payload: unknown }
 *   - Event types that require cache invalidation:
 *       notification.created  → invalidate Notification cache
 *       notification.updated  → invalidate Notification cache
 *       project.*             → handled by existing RTK invalidations via mutations
 *
 * The hook auto-reconnects on error with exponential backoff (max 30s).
 * The EventSource is closed and reconnect state is reset on orgId change.
 */
import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { notificationApi } from '../api/notificationApi';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const BYPASS       = import.meta.env.VITE_API_BYPASS === 'true';

export function useSSENotifications(orgId: string | undefined) {
  const dispatch    = useDispatch();
  const esRef       = useRef<EventSource | null>(null);
  const retryRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount  = useRef(0);

  useEffect(() => {
    // Skip entirely in mock/bypass mode — no server running
    if (BYPASS || !orgId) return;

    function connect() {
      // Close any existing connection
      esRef.current?.close();

      const url = `${API_BASE_URL}/api/v1/organizations/${orgId}/notifications/stream`;
      const es  = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.onopen = () => {
        retryCount.current = 0; // reset backoff on successful connect
      };

      es.addEventListener('notification.created', () => {
        dispatch(notificationApi.util.invalidateTags([
          { type: 'Notification', id: orgId },
          { type: 'Notification', id: `count_${orgId}` },
        ]));
      });

      es.addEventListener('notification.updated', () => {
        dispatch(notificationApi.util.invalidateTags([
          { type: 'Notification', id: orgId },
          { type: 'Notification', id: `count_${orgId}` },
        ]));
      });

      // Generic fallback: any message type that arrives
      es.onmessage = () => {
        dispatch(notificationApi.util.invalidateTags([
          { type: 'Notification', id: orgId },
          { type: 'Notification', id: `count_${orgId}` },
        ]));
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
        const backoff = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
        retryCount.current += 1;
        retryRef.current = setTimeout(connect, backoff);
      };
    }

    connect();

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      esRef.current?.close();
      esRef.current = null;
      retryCount.current = 0;
    };
  }, [orgId, dispatch]);
}
