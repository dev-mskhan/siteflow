import { NOTIFICATION_EVENT_QUEUES } from '../notification.jobs.js';

export type PreferenceChannel = 'IN_APP' | 'EMAIL' | 'REALTIME';

export interface NotificationPreferenceOption {
  eventType: string;
  channels: PreferenceChannel[];
}

const EMAIL_EVENT_TYPES = new Set([
  'platform.organization.suspended',
  'platform.organization.reactivated',
  'billing.grace_reminder',
]);

export const NOTIFICATION_PREFERENCE_OPTIONS: NotificationPreferenceOption[] = [
  ...Object.values(NOTIFICATION_EVENT_QUEUES).map((eventType) => ({
    eventType,
    channels: [
      'IN_APP',
      'REALTIME',
      ...(EMAIL_EVENT_TYPES.has(eventType) ? (['EMAIL'] as const) : []),
    ],
  })),
  {
    eventType: 'billing.grace_reminder',
    channels: ['EMAIL'],
  },
];
