// apps/server/src/modules/reporting/exports/report-renderer.ts
// F.17A — Shared renderer contract.
// Takes an authorized canonical ReportResultEnvelope and serializes to a format string.

import type { ReportResultEnvelope } from '@siteflow/shared';

export type RenderFormat = 'csv';

export interface RenderedReport {
  content: string;
  mimeType: string;
  filename: string;
  format: RenderFormat;
}

export interface ReportRenderer {
  render(envelope: ReportResultEnvelope): RenderedReport;
}

export function getRenderer(format: RenderFormat): ReportRenderer {
  if (format === 'csv') {
    const { CsvReportRenderer } = require('./csv.renderer.js') as typeof import('./csv.renderer.js');
    return new CsvReportRenderer();
  }
  throw new Error(`Unsupported render format: ${format}`);
}
