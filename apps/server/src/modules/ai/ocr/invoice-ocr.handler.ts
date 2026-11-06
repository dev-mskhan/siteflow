// apps/server/src/modules/ai/ocr/invoice-ocr.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { InvoiceOcrService } from './invoice-ocr.service.js';

const ocrService = new InvoiceOcrService();

export async function handleExtractInvoice(req: FastifyRequest, reply: FastifyReply) {
  const { organizationId, projectId } = req.params as {
    organizationId: string;
    projectId: string;
  };
  const { imageBase64, matchPo } = req.body as {
    imageBase64: string;
    matchPo?: boolean;
  };

  try {
    const extraction = await ocrService.extractInvoice(imageBase64);

    let poMatchResult;
    if (matchPo && extraction.poNumber) {
      // TODO: Fetch POs from database for this project
      // For now, return stub
      poMatchResult = {
        matched: false,
        requiresReview: true,
        reviewReason: 'PO matching not yet implemented',
      };
    }

    return reply.send({
      data: extraction,
      poMatch: poMatchResult,
      requiresReview: extraction.confidence < 0.85 || poMatchResult?.requiresReview,
    });
  } catch (error) {
    return reply.status(500).send({
      error: 'Invoice OCR extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
