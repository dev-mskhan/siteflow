/**
 * useRealtimeNotifications — SSE hook for real-time notification delivery.
 *
 * Opens EventSource connection to:
 *   GET /api/v1/organizations/:orgId/notifications/stream
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat monitoring (server sends `: ping\n\n` every 15s)
 * - Multi-tab support (each tab gets own connection)
 * - Automatic cache invalidation on events
 * - Clean disconnect on unmount/logout
 *
 * Usage:
 * ```tsx
 * function AppShell() {
 *   const orgId = useAppSelector((s) => s.org.currentOrg?.id);
 *   useRealtimeNotifications(orgId || '', !!orgId);
 *   return <Shell />;
 * }
 * ```
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import { useAppDispatch } from '../app/hooks';
import { notificationApi } from '../features/notification/notificationApi';

interface SSEConnectionStatus {
  connected: boolean;
  reconnectAttempts: number;
  lastError?: string;
}

export function useRealtimeNotifications(orgId: string, enabled = true) {
  const dispatch = useAppDispatch();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const [status, setStatus] = useState<SSEConnectionStatus>({
    connected: false,
    reconnectAttempts: 0,
  });

  const connect = useCallback(() => {
    if (!enabled || !orgId) {
      setStatus({ connected: false, reconnectAttempts: 0 });
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const url = `${apiUrl}/api/v1/organizations/${orgId}/notifications/stream`;

    console.log('[SSE] Connecting to:', url);

    const es = new EventSource(url, {
      withCredentials: true, // Send cookies for authentication
    });

    es.onopen = () => {
      console.log('[SSE] Connection established');
      reconnectAttempts.current = 0;
      setStatus({ connected: true, reconnectAttempts: 0 });
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Event received:', data.type);

        switch (data.type) {
          case 'CONNECTED':
            console.log('[SSE] Connected with ID:', data.connectionId);
            break;

          // ── Notification Events ─────────────────────────────────────────
          case 'notification.created':
          case 'RfiOverdue':
          case 'DocumentExpiring':
          case 'procurement.purchase_order.approved':
          case 'project.task.overdue':
          case 'project.change_order.effected':
          case 'safety.event.reported':
          case 'quality.inspection.failed':
          case 'compliance.permit.expiring':
            // Invalidate notification queries to trigger re-fetch
            dispatch(
              notificationApi.util.invalidateTags([
                { type: 'Notification', id: orgId },
                { type: 'Notification', id: `count_${orgId}` },
              ])
            );
            break;

          // ── Project Events ──────────────────────────────────────────────
          case 'project.created':
          case 'project.updated':
          case 'project.status_changed':
          case 'project.member_added':
            // Invalidate project cache
            dispatch(
              notificationApi.util.invalidateTags([{ type: 'Project', id: 'LIST' }])
            );
            break;

          // ── AI Events ───────────────────────────────────────────────────
          case 'ai.run.started':
          case 'ai.run.completed':
          case 'ai.run.failed':
          case 'ai.approval.requested':
            // Invalidate AI run cache
            dispatch(
              notificationApi.util.invalidateTags([{ type: 'AgentRun', id: 'LIST' }])
            );
            break;

          // ── Member Events ───────────────────────────────────────────────
          case 'member.joined':
            dispatch(
              notificationApi.util.invalidateTags([{ type: 'Member', id: orgId }])
            );
            break;

          // ── Document Events ─────────────────────────────────────────────
          case 'document.processing_completed':
          case 'document.processing_failed':
            dispatch(
              notificationApi.util.invalidateTags([{ type: 'Document', id: 'LIST' }])
            );
            break;

          default:
            console.log('[SSE] Unknown event type:', data.type);
        }
      } catch (err) {
        console.error('[SSE] Parse error:', err, 'Raw event:', event.data);
      }
    };

    es.onerror = (err) => {
      console.error('[SSE] Connection error:', err);
      es.close();

      setStatus((prev) => ({
        connected: false,
        reconnectAttempts: prev.reconnectAttempts + 1,
        lastError: 'Connection error',
      }));

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current++;

      console.log(
        `[SSE] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts.current})...`
      );

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    eventSourceRef.current = es;
  }, [orgId, enabled, dispatch]);

  const disconnect = useCallback(() => {
    console.log('[SSE] Disconnecting...');
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    reconnectAttempts.current = 0;
    setStatus({ connected: false, reconnectAttempts: 0 });
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    status,
    disconnect,
    reconnect: connect,
  };
}

