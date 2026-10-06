import type { ChangeOrder, ChangeOrderLine } from '@siteflow/database/schema';

export type ChangeOrderDTO = Omit<
  ChangeOrder,
  'createdAt' | 'updatedAt' | 'submittedAt' | 'approvedAt' | 'clientApprovedAt' |
  'rejectedAt' | 'effectedAt' | 'voidedAt'
> & {
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  clientApprovedAt: string | null;
  rejectedAt: string | null;
  effectedAt: string | null;
  voidedAt: string | null;
  lines: ChangeOrderLine[];
};

export interface ChangeOrderListDTO {
  changeOrders: ChangeOrderDTO[];
  nextCursor: string | null;
}
