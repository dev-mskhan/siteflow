// apps/server/src/modules/organization/sequences/sequences.seed.ts

export const DEFAULT_DOCUMENT_SEQUENCES = [
  { type: 'PROJECT', prefix: 'PRJ', padding: 4 },
  { type: 'ESTIMATE', prefix: 'EST', padding: 4 },
  { type: 'INVOICE', prefix: 'INV', padding: 4 },
  { type: 'PURCHASE_ORDER', prefix: 'PO', padding: 4 },
  { type: 'CHANGE_ORDER', prefix: 'CO', padding: 4 },
  { type: 'RFI', prefix: 'RFI', padding: 4 },
  { type: 'SUBMITTAL', prefix: 'SUB', padding: 4 },
] as const;
