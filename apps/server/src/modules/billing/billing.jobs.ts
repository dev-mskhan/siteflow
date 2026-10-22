// apps/server/src/modules/billing/billing.jobs.ts
export const STRIPE_WEBHOOK_RECOVERY_QUEUE = 'billing:stripe-webhook-recovery' as const;
export const BILLING_LIFECYCLE_QUEUE = 'billing:grace-reminder-dispatch' as const;
