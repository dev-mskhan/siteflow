import type { CostTransaction } from '@siteflow/database/schema';

export type CostTransactionDTO = Omit<
  CostTransaction,
  'createdAt' | 'postedAt' | 'voidedAt' | 'reversalOfId'
> & {
  createdAt: string;
  postedAt: string | null;
  voidedAt: string | null;
  reversalId: string | null;
};

export interface CostTransactionListDTO {
  transactions: CostTransactionDTO[];
  nextCursor: string | null;
}
