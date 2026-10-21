/**
 * NotificationBell — Group 13 realtime notification badge + dropdown.
 *
 * Renders in AppLayout header. Polls unread-count via RTK Query (pollingInterval 60s).
 * Clicking opens a dropdown with the 20 most recent notifications.
 * Individual "mark read" and "mark all read" supported.
 * useSSENotifications is mounted here to push cache invalidations on new events.
 */
import React, { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, Check, CheckCheck, Wifi, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import {
  useGetUnreadCountQuery,
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllReadMutation,
} from '../../api/notificationApi';
import { useSSENotifications } from '../../hooks/useSSENotifications';
import { useAppSelector } from '../../app/store';
import type { SSEConnectionStatus } from '../../features/notification/notificationSlice';
import type { NotificationRecord } from '../../types/reportTypes';

// Human-readable event type labels
function eventLabel(eventType: string): string {
  const map: Record<string, string> = {
    RfiOverdue: 'RFI overdue',
    DocumentExpiring: 'Document expiring',
    'procurement.purchase_order.approved': 'PO approved',
    'procurement.purchase_order.rejected': 'PO rejected',
    'project.task.overdue': 'Task overdue',
    'safety.event.reported': 'Safety event reported',
    'project.change_order.effected': 'Change order effected',
    'project.invoice.approved': 'Invoice approved',
    'project.payment.executed': 'Payment executed',
  };
  return map[eventType] ?? eventType.replace(/[._]/g, ' ');
}

function payloadSummary(payload: Record<string, unknown>): string {
  const keys = [
    'subject',
    'name',
    'title',
    'rfiNumber',
    'invoiceNumber',
    'paymentNumber',
    'changeOrderNumber',
  ];
  for (const k of keys) {
    if (payload[k]) return String(payload[k]);
  }
  return '';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export const NotificationBell: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Wire SSE — auto-invalidates RTK tags on new events + shows toasts
  useSSENotifications(orgId);

  // Read SSE connection status from Redux for the indicator dot
  const sseStatus: SSEConnectionStatus = useAppSelector(
    (state) => state.sseNotification?.connectionStatus ?? 'idle',
  );

  const { data: countData } = useGetUnreadCountQuery(
    { orgId: orgId! },
    { skip: !orgId, pollingInterval: 60000 },
  );
  const { data: listData, isLoading } = useListNotificationsQuery(
    { orgId: orgId!, limit: 20 },
    { skip: !orgId || !open },
  );

  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllReadMutation();

  const unread = countData?.unreadCount ?? 0;
  const notifs = listData?.notifications ?? [];
  const hasUnread = unread > 0;

  const onMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markRead({ orgId: orgId!, notificationId: id })
      .unwrap()
      .catch(() => null);
  };

  const onMarkAll = async () => {
    await markAllRead({ orgId: orgId! })
      .unwrap()
      .catch(() => null);
  };

  // Close panel on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label={`Notifications${hasUnread ? ` — ${unread} unread` : ''}`}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-[var(--muted)] hover:text-[var(--ink)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {/* SSE connection status indicator */}
        {sseStatus === 'connected' && (
          <span
            className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-[#166534] border border-[var(--surface)]"
            title="Real-time connected"
          />
        )}
        {sseStatus === 'connecting' && (
          <span
            className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-[#92400e] border border-[var(--surface)] animate-pulse"
            title="Connecting…"
          />
        )}
        {sseStatus === 'disconnected' && (
          <span
            className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-[#991b1b] border border-[var(--surface)]"
            title="Real-time disconnected — using polling"
          />
        )}
        {hasUnread && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-[#991b1b] border-2 border-[var(--surface)] flex items-center justify-center">
            <span className="font-mono text-[8px] text-white leading-none font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="notif-panel"
            initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scaleY: 1,
              transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] as const },
            }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            style={{ originY: 0 }}
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-80 border border-[var(--ink)] bg-[var(--paper)] shadow-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hairline-2)]">
              <div className="flex items-center gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Notifications{hasUnread ? ` · ${unread} unread` : ''}
                </p>
                {/* Connection status chip */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 border',
                    sseStatus === 'connected'
                      ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]'
                      : sseStatus === 'connecting'
                        ? 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]'
                        : sseStatus === 'disconnected'
                          ? 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]'
                          : 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
                  )}
                >
                  {sseStatus === 'connected' && <Wifi className="h-2.5 w-2.5" strokeWidth={2} />}
                  {sseStatus === 'disconnected' && (
                    <WifiOff className="h-2.5 w-2.5" strokeWidth={2} />
                  )}
                  {sseStatus === 'connecting' && '…'}
                  {sseStatus === 'connected'
                    ? 'live'
                    : sseStatus === 'disconnected'
                      ? 'polling'
                      : sseStatus === 'connecting'
                        ? 'connecting'
                        : 'idle'}
                </span>
              </div>
              {hasUnread && (
                <button
                  type="button"
                  onClick={onMarkAll}
                  disabled={markingAll}
                  className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="h-3 w-3" strokeWidth={2} />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse border-b border-[var(--hairline-2)] bg-[var(--surface-2)]"
                  />
                ))
              ) : notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Bell className="h-8 w-8 text-[var(--muted)] mb-2" strokeWidth={1.5} />
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    No notifications
                  </p>
                </div>
              ) : (
                notifs.map((n) => <NotifRow key={n.id} notif={n} onMarkRead={onMarkRead} />)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Row ───────────────────────────────────────────────────────────────────────

const NotifRow: React.FC<{
  notif: NotificationRecord;
  onMarkRead: (id: string, e: React.MouseEvent) => void;
}> = ({ notif, onMarkRead }) => {
  const isUnread = notif.readAt === null;
  const summary = payloadSummary(notif.payload);

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 transition-colors',
        isUnread ? 'bg-[var(--surface)]' : 'bg-[var(--paper)]',
      )}
    >
      {/* Unread dot */}
      <span
        className={cn(
          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
          isUnread ? 'bg-[var(--ink)]' : 'bg-transparent',
        )}
      />

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm truncate', isUnread ? 'font-medium' : '')}>
          {eventLabel(notif.eventType)}
        </p>
        {summary && (
          <p className="font-mono text-[9px] text-[var(--muted)] truncate mt-0.5">{summary}</p>
        )}
        <p className="font-mono text-[9px] text-[var(--muted)] mt-0.5">
          {relativeTime(notif.deliveredAt ?? notif.createdAt)}
        </p>
      </div>

      {isUnread && (
        <button
          type="button"
          onClick={(e) => onMarkRead(notif.id, e)}
          title="Mark as read"
          className="mt-1 p-0.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors shrink-0"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};
