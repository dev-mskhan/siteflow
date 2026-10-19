export const NOTIFICATION_EVENT_QUEUES = {
  PLATFORM_ORGANIZATION_SUSPENDED: 'platform.organization.suspended',
  PLATFORM_ORGANIZATION_REACTIVATED: 'platform.organization.reactivated',
  BILLING_SUBSCRIPTION_STATUS_CHANGED: 'billing.subscription.status_changed',
  BILLING_ENTITLEMENT_CHANGED: 'billing.entitlement.changed',
  BILLING_GRACE_STARTED: 'billing.grace.started',
  BILLING_GRACE_ENDED: 'billing.grace.ended',
  RFI_SUBMITTED: 'rfi.submitted',
  RFI_RESPONDED: 'rfi.responded',
  RFI_CLOSED: 'rfi.closed',
  SUBMITTAL_SUBMITTED: 'submittal.submitted',
  SUBMITTAL_REVIEWED: 'submittal.reviewed',
  SUBMITTAL_CLOSED: 'submittal.closed',
} as const;
