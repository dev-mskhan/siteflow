// apps/server/src/modules/organization/sequences/sequences.types.ts

export type DocumentSequenceType =
  | 'PROJECT'
  | 'ESTIMATE'
  | 'INVOICE'
  | 'PURCHASE_ORDER'
  | 'CHANGE_ORDER'
  | 'RFI'
  | 'SUBMITTAL';

export interface DocumentSequenceDTO {
  id: string;
  organizationId: string;
  type: DocumentSequenceType;
  prefix: string;
  padding: number;
  nextValue: number;
  updatedAt: string;
}

/**
 * Only prefix and padding are user-configurable.
 * nextValue is never exposed as writable via API.
 */
export type UpdateSequenceInput = {
  prefix?: string;
  padding?: number;
};

export interface AllocateNextResult {
  number: number;
  formatted: string; // e.g. "PRJ-0001"
}
