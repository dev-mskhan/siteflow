/**
 * NotificationPreferencesPage — /org/:orgId/settings/notifications
 * Toggle notification event types per channel (IN_APP, EMAIL, REALTIME, WHATSAPP).
 * Backend: GET/PUT /api/v1/organizations/:orgId/notifications/preferences
 */
import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Bell } from 'lucide-react';
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} from '../../../api/notificationApi';
import { useToast } from '../../../components/ui/Toast';
import { toastErrorMessage } from '../../../lib/authErrors';
import { cn } from '../../../lib/cn';

const CHANNELS = ['IN_APP', 'EMAIL', 'REALTIME', 'WHATSAPP'] as const;

function eventLabel(eventType: string): string {
  const map: Record<string, string> = {
    'RfiOverdue': 'RFI overdue',
    'DocumentExpiring': 'Document expiring',
    'project.task.overdue': 'Task overdue',
    'procurement.purchase_order.approved': 'PO approved',
    'procurement.purchase_order.rejected': 'PO rejected',
    'project.change_order.effected': 'Change order effected',
    'project.invoice.approved': 'Invoice approved',
    'project.payment.executed': 'Payment executed',
    'safety.event.reported': 'Safety event reported',
  };
  return map[eventType] ?? eventType.replace(/[._]/g, ' ');
}

export const NotificationPreferencesPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const { data, isLoading } = useGetNotificationPreferencesQuery({ orgId: orgId! });
  const [updatePref, { isLoading: updating }] = useUpdateNotificationPreferenceMutation();

  // Group by event type
  const eventGroups = useMemo(() => {
    const prefs = data?.preferences ?? [];
    const groups: Record<string, Record<string, boolean>> = {};
    prefs.forEach((p) => {
      if (!groups[p.eventType]) groups[p.eventType] = {};
      groups[p.eventType][p.channel] = p.enabled;
    });
    return groups;
  }, [data]);

  const onToggle = async (eventType: string, channel: string, enabled: boolean) => {
    try {
      await updatePref({ orgId: orgId!, eventType, channel: channel as any, enabled }).unwrap();
      toastOk('Preference updated', '');
    } catch (err) { toastErr('Update failed', toastErrorMessage(err as never)); }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />)}
      </div>
    );
  }

  const eventTypes = Object.keys(eventGroups);

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-medium tracking-[-0.03em]">Notification preferences</h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">Choose which events you receive and on which channels</p>
      </div>

      {eventTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-[var(--hairline-2)] bg-[var(--paper)]">
          <Bell className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">No notification preferences configured.</p>
        </div>
      ) : (
        <div className="border border-[var(--hairline-2)]">
          {/* Header */}
          <div className="grid grid-cols-[2fr_80px_80px_80px_80px] gap-2 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Event type</p>
            {CHANNELS.map((ch) => (
              <p key={ch} className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)] text-center">{ch.replace('_', ' ')}</p>
            ))}
          </div>

          {/* Rows */}
          {eventTypes.map((eventType) => (
            <div key={eventType} className="grid grid-cols-[2fr_80px_80px_80px_80px] gap-2 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <p className="text-sm">{eventLabel(eventType)}</p>
              {CHANNELS.map((ch) => {
                const enabled = eventGroups[eventType]?.[ch] ?? false;
                return (
                  <div key={ch} className="flex justify-center">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => onToggle(eventType, ch, !enabled)}
                      className={cn(
                        'relative h-5 w-9 rounded-full transition-colors disabled:opacity-50',
                        enabled ? 'bg-[var(--ink)]' : 'bg-[var(--surface-2)] border border-[var(--hairline-2)]',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                        enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                      )} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
