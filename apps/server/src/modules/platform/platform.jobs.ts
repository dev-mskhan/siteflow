// apps/server/src/modules/platform/platform.jobs.ts
export const PLATFORM_QUEUES = {
  ACCOUNT_SUSPENDED: 'platform.account.suspended',
  ACCOUNT_REACTIVATED: 'platform.account.reactivated',
  ORGANIZATION_SUSPENSION_REQUESTED: 'platform.organization.suspension_requested',
  ORGANIZATION_SUSPENDED: 'platform.organization.suspended',
  ORGANIZATION_REACTIVATED: 'platform.organization.reactivated',
} as const;
