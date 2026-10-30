/**
 * NotificationPreferencesPage — /org/:orgId/settings/notifications
 * Toggle notification event types per channel (IN_APP, EMAIL, REALTIME, WHATSAPP).
 * Backend: GET/PUT /api/v1/organizations/:orgId/notifications/preferences
 */
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, RefreshCw } from 'lucide-react';
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} from '../../../features/notification/notificationApi';
import { useToast } from '../../../components/ui/Toast';
import { toastErrorMessage } from '../../../lib/authErrors';
import { cn } from '../../../lib/cn';
import { useOrgContext } from '../../../features/org/useOrgContext';

const CHANNEL_LABELS = {
  IN_APP: 'In app',
  EMAIL: 'Email',
  REALTIME: 'Live',
} as const;

function eventLabel(eventType: string): string {
  const map: Record<string, string> = {
    'platform.organization.suspended': 'Organization suspended',
    'platform.organization.reactivated': 'Organization reactivated',
    'billing.subscription.status_changed': 'Subscription status changed',
    'billing.entitlement.changed': 'Subscription access changed',
    'billing.grace.started': 'Billing grace period started',
    'billing.grace.ended': 'Billing grace period ended',
    'billing.grace_reminder': 'Billing grace reminder',
    'rfi.submitted': 'RFI submitted',
    'rfi.responded': 'RFI response received',
    'rfi.closed': 'RFI closed',
    'submittal.submitted': 'Submittal submitted',
    'submittal.reviewed': 'Submittal reviewed',
    'submittal.closed': 'Submittal closed',
  };
  return map[eventType] ?? eventType.replace(/[._]/g, ' ');
}

export const NotificationPreferencesPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { org } = useOrgContext();
  const { success: toastOk, error: toastErr } = useToast();

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useGetNotificationPreferencesQuery({ orgId: orgId! });
  const [updatePref, { isLoading: updating }] = useUpdateNotificationPreferenceMutation();

  const preferenceValues = useMemo(
    () => new Map((data?.preferences ?? []).map((pref) => [`${pref.eventType}:${pref.channel}`, pref.enabled])),
    [data?.preferences],
  );

  const onToggle = async (
    eventType: string,
    channel: 'IN_APP' | 'EMAIL' | 'REALTIME',
    enabled: boolean,
  ) => {
    try {
      await updatePref({ orgId: orgId!, eventType, channel, enabled }).unwrap();
      toastOk('Preference updated', 'Your notification setting has been saved.');
    } catch (err) {
      toastErr('Update failed', toastErrorMessage(err as never));
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]"
          />
        ))}
      </div>
    );
  }

  const preferenceOptions = data?.preferenceOptions ?? [];
  const channels = [...new Set(preferenceOptions.flatMap((option) => option.channels))];

  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-lg font-medium tracking-[-0.03em]">My notification preferences</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Choose how you receive supported notifications in {org?.name ?? 'this organization'}.
          These settings apply to your account only; they do not change notification settings for
          other members.
        </p>
      </div>

      {isError ? (
        <div className="flex items-center justify-between gap-4 border border-[#fecaca] bg-[var(--paper)] p-4">
          <p className="text-sm text-[#991b1b]">
            Notification preferences could not be loaded.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] hover:opacity-70"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : preferenceOptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-[var(--hairline-2)] bg-[var(--paper)]">
          <Bell className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">There are no notification events available to configure.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
            <span>New preferences are on by default.</span>
            <span>WhatsApp delivery is not currently configured.</span>
          </div>
          <div className="overflow-x-auto border border-[var(--hairline-2)]">
            <div className="min-w-[34rem]">
              <div
                className="grid gap-2 border-b border-[var(--hairline-2)] bg-[var(--surface-2)] px-4 py-3"
                style={{ gridTemplateColumns: `minmax(14rem, 1fr) repeat(${channels.length}, 5.5rem)` }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                  Notification event
                </p>
                {channels.map((channel) => (
                  <p
                    key={channel}
                    className="text-center font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]"
                  >
                    {CHANNEL_LABELS[channel]}
                  </p>
                ))}
              </div>

              {preferenceOptions.map(({ eventType, channels: eventChannels }) => (
                <div
                  key={eventType}
                  className="grid items-center gap-2 border-b border-[var(--hairline-2)] bg-[var(--paper)] px-4 py-3.5 last:border-b-0 hover:bg-[var(--surface-2)]"
                  style={{ gridTemplateColumns: `minmax(14rem, 1fr) repeat(${channels.length}, 5.5rem)` }}
                >
                  <p className="text-sm text-[var(--ink)]">{eventLabel(eventType)}</p>
                  {channels.map((channel) => {
                    const isAvailable = eventChannels.includes(channel);
                    const enabled = preferenceValues.get(`${eventType}:${channel}`) ?? true;
                    return (
                      <div key={channel} className="flex justify-center">
                        {isAvailable ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            aria-label={`${CHANNEL_LABELS[channel]} notifications for ${eventLabel(eventType)}`}
                            disabled={updating}
                            onClick={() => void onToggle(eventType, channel, !enabled)}
                            className={cn(
                              'relative h-5 w-9 rounded-full transition-colors disabled:opacity-50',
                              enabled
                                ? 'bg-[var(--ink)]'
                                : 'border border-[var(--hairline-2)] bg-[var(--surface-2)]',
                            )}
                          >
                            <span
                              className={cn(
                                'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                                enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                              )}
                            />
                          </button>
                        ) : (
                          <span aria-label="Not available" className="text-xs text-[var(--muted)]">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
