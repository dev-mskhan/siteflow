export const COMPLIANCE_QUEUES = {
  SCAN_EXPIRY: 'compliance:scan-expiry',
} as const;

export interface ExpiryScanJobPayload {
  organizationId?: string;
}
