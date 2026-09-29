export type QuoteStatus = 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface QuoteItemDTO {
  id: string;
  organizationId: string;
  quoteId: string;
  materialRequestItemId: string | null;
  materialId: string;
  description: string | null;
  quantity: string;
  unitCode: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  lineSubtotal: string;
  lineTotal: string;
  expectedDeliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDTO {
  id: string;
  organizationId: string;
  projectId: string;
  quoteNumber: string;
  supplierId: string;
  materialRequestId: string | null;
  status: QuoteStatus;
  quoteDate: string;
  validUntil: string | null;
  currencyCode: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  notes: string | null;
  submittedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  items: QuoteItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface QuoteItemInput {
  materialRequestItemId?: string;
  materialId: string;
  description?: string;
  quantity: string;
  unitCode: string;
  unitPrice: string;
  discountAmount?: string;
  taxAmount?: string;
  expectedDeliveryDate?: string;
}

export interface CreateQuoteInput {
  supplierId: string;
  materialRequestId?: string;
  quoteDate: string;
  validUntil?: string;
  currencyCode: string;
  notes?: string;
  items: QuoteItemInput[];
}

export interface UpdateQuoteInput {
  quoteDate?: string;
  validUntil?: string | null;
  notes?: string;
}

export interface ListQuotesQuery {
  cursor?: string;
  limit?: number;
  status?: QuoteStatus;
}
