import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'realtime-authorization' });

export interface RealtimeSubscriptionContext {
  userId: string;
  organizationId: string;
  projectId?: string | null;
}

export function authorizeRealtimeSubscription(
  userOrgId: string,
  targetOrgId: string,
): { authorized: boolean; reason?: string } {
  if (!userOrgId || !targetOrgId) {
    logger.warn({ userOrgId, targetOrgId }, 'Realtime subscription denied: missing tenant scope');
    return { authorized: false, reason: 'Missing organization scope' };
  }

  if (userOrgId !== targetOrgId) {
    logger.warn({ userOrgId, targetOrgId }, 'Realtime subscription denied: cross-tenant access forbidden');
    return { authorized: false, reason: 'Forbidden: cross-tenant access' };
  }

  return { authorized: true };
}

export function authorizeRealtimeDelivery(
  recipientOrgId: string,
  targetOrgId: string,
): boolean {
  return Boolean(recipientOrgId && targetOrgId && recipientOrgId === targetOrgId);
}
