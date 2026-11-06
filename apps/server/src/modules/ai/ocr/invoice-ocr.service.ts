// apps/server/src/modules/ai/ocr/invoice-ocr.service.ts
import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '@siteflow/env/server';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const InvoiceExtractionSchema = z.object({
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  dueDate: z.string().optional(),
  vendorName: z.string(),
  vendorAddress: z.string().optional(),
  totalAmount: z.number(),
  currency: z.string().default('USD'),
  taxAmount: z.number().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().optional(),
        unitPrice: z.number().optional(),
        amount: z.number(),
      })
    )
    .optional(),
  poNumber: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;

export class InvoiceOcrService {
  async extractInvoice(imageBase64: string): Promise<InvoiceExtraction> {
    const prompt = `Extract invoice information from this image. Return JSON with:
- invoiceNumber (string)
- invoiceDate (YYYY-MM-DD)
- dueDate (YYYY-MM-DD, optional)
- vendorName (string)
- vendorAddress (string, optional)
- totalAmount (number)
- currency (string, default USD)
- taxAmount (number, optional)
- lineItems (array of {description, quantity, unitPrice, amount}, optional)
- poNumber (string, optional if mentioned)
- confidence (0-1, your confidence in extraction accuracy)

Return ONLY valid JSON, no markdown formatting.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI Vision API');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return InvoiceExtractionSchema.parse(parsed);
  }

  async matchPurchaseOrder(
    extraction: InvoiceExtraction,
    purchaseOrders: Array<{
      poNumber: string;
      vendorName: string;
      totalAmount: number;
      status: string;
    }>
  ): Promise<{
    matched: boolean;
    poMatch?: {
      poNumber: string;
      vendorMatch: boolean;
      amountMatch: boolean;
      amountDiff: number;
    };
    requiresReview: boolean;
    reviewReason?: string;
  }> {
    if (!extraction.poNumber) {
      return {
        matched: false,
        requiresReview: true,
        reviewReason: 'No PO number found on invoice',
      };
    }

    const po = purchaseOrders.find(
      (p) => p.poNumber === extraction.poNumber && p.status === 'APPROVED'
    );

    if (!po) {
      return {
        matched: false,
        requiresReview: true,
        reviewReason: `PO ${extraction.poNumber} not found or not approved`,
      };
    }

    const vendorMatch =
      po.vendorName.toLowerCase().trim() === extraction.vendorName.toLowerCase().trim();
    const amountDiff = Math.abs(po.totalAmount - extraction.totalAmount);
    const amountMatch = amountDiff < 0.01; // Within 1 cent

    const requiresReview = !vendorMatch || !amountMatch || extraction.confidence < 0.85;
    const reviewReason = !vendorMatch
      ? 'Vendor name mismatch'
      : !amountMatch
        ? `Amount mismatch: PO $${po.totalAmount}, Invoice $${extraction.totalAmount}`
        : extraction.confidence < 0.85
          ? 'Low OCR confidence'
          : undefined;

    return {
      matched: vendorMatch && amountMatch,
      poMatch: {
        poNumber: po.poNumber,
        vendorMatch,
        amountMatch,
        amountDiff,
      },
      requiresReview,
      reviewReason,
    };
  }
}
