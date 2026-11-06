// apps/server/tests/integration/ai/invoice-ocr.test.ts
import { describe, it, expect } from 'vitest';
import { InvoiceOcrService } from '../../../src/modules/ai/ocr/invoice-ocr.service.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Invoice OCR Tests', () => {
  const ocrService = new InvoiceOcrService();

  // Golden dataset test - requires actual invoice images
  it.skip('should extract invoice with ≥85% confidence from golden dataset image 1', async () => {
    const imagePath = join(__dirname, '../../../test-data/invoices/invoice-001.jpg');
    const imageBase64 = readFileSync(imagePath, 'base64');

    const result = await ocrService.extractInvoice(imageBase64);

    expect(result.invoiceNumber).toBeTruthy();
    expect(result.vendorName).toBeTruthy();
    expect(result.totalAmount).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should match PO when vendor and amount align', async () => {
    const extraction = {
      invoiceNumber: 'INV-001',
      invoiceDate: '2024-01-15',
      vendorName: 'ABC Contractors',
      totalAmount: 5000.0,
      currency: 'USD',
      poNumber: 'PO-12345',
      confidence: 0.95,
    };

    const pos = [
      {
        poNumber: 'PO-12345',
        vendorName: 'ABC Contractors',
        totalAmount: 5000.0,
        status: 'APPROVED',
      },
    ];

    const result = await ocrService.matchPurchaseOrder(extraction, pos);

    expect(result.matched).toBe(true);
    expect(result.requiresReview).toBe(false);
    expect(result.poMatch?.vendorMatch).toBe(true);
    expect(result.poMatch?.amountMatch).toBe(true);
  });

  it('should flag vendor mismatch for review', async () => {
    const extraction = {
      invoiceNumber: 'INV-002',
      invoiceDate: '2024-01-15',
      vendorName: 'XYZ Suppliers',
      totalAmount: 3000.0,
      currency: 'USD',
      poNumber: 'PO-12346',
      confidence: 0.92,
    };

    const pos = [
      {
        poNumber: 'PO-12346',
        vendorName: 'ABC Contractors',
        totalAmount: 3000.0,
        status: 'APPROVED',
      },
    ];

    const result = await ocrService.matchPurchaseOrder(extraction, pos);

    expect(result.matched).toBe(false);
    expect(result.requiresReview).toBe(true);
    expect(result.reviewReason).toContain('Vendor name mismatch');
  });

  it('should flag amount mismatch for review', async () => {
    const extraction = {
      invoiceNumber: 'INV-003',
      invoiceDate: '2024-01-15',
      vendorName: 'ABC Contractors',
      totalAmount: 5500.0,
      currency: 'USD',
      poNumber: 'PO-12347',
      confidence: 0.90,
    };

    const pos = [
      {
        poNumber: 'PO-12347',
        vendorName: 'ABC Contractors',
        totalAmount: 5000.0,
        status: 'APPROVED',
      },
    ];

    const result = await ocrService.matchPurchaseOrder(extraction, pos);

    expect(result.matched).toBe(false);
    expect(result.requiresReview).toBe(true);
    expect(result.reviewReason).toContain('Amount mismatch');
  });

  it('should flag low confidence extractions for review', async () => {
    const extraction = {
      invoiceNumber: 'INV-004',
      invoiceDate: '2024-01-15',
      vendorName: 'ABC Contractors',
      totalAmount: 5000.0,
      currency: 'USD',
      poNumber: 'PO-12348',
      confidence: 0.70, // Below 0.85 threshold
    };

    const pos = [
      {
        poNumber: 'PO-12348',
        vendorName: 'ABC Contractors',
        totalAmount: 5000.0,
        status: 'APPROVED',
      },
    ];

    const result = await ocrService.matchPurchaseOrder(extraction, pos);

    expect(result.requiresReview).toBe(true);
    expect(result.reviewReason).toContain('Low OCR confidence');
  });

  it('should flag missing PO number for review', async () => {
    const extraction = {
      invoiceNumber: 'INV-005',
      invoiceDate: '2024-01-15',
      vendorName: 'ABC Contractors',
      totalAmount: 5000.0,
      currency: 'USD',
      // poNumber is missing
      confidence: 0.95,
    };

    const pos: any[] = [];

    const result = await ocrService.matchPurchaseOrder(extraction, pos);

    expect(result.matched).toBe(false);
    expect(result.requiresReview).toBe(true);
    expect(result.reviewReason).toContain('No PO number found');
  });
});
