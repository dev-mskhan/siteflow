import type { PaymentApplication, PaymentApplicationLine } from '@siteflow/database/schema';

export type PaymentApplicationLineDTO = Omit<PaymentApplicationLine, 'createdAt'> & {
  createdAt: string;
};

export type PaymentApplicationDTO = Omit<
  PaymentApplication,
  | 'createdAt'
  | 'updatedAt'
  | 'submittedAt'
  | 'reviewedAt'
  | 'approvedAt'
  | 'rejectedAt'
  | 'voidedAt'
> & {
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  voidedAt: string | null;
  lines: PaymentApplicationLineDTO[];
  eligibleChangeOrders: Array<{
    changeOrderId: string;
    changeOrderNumber: string;
    revenueDelta: string;
  }>;
};
