// apps/server/src/modules/reporting/exports/csv.renderer.ts
// F.17A — CSV serialization from authorized ReportResultEnvelope.
// Rules:
//   - Values come ONLY from the server-provided envelope; no domain recalculation.
//   - Formula-injection defense: cells starting with =, +, -, @ are prefixed with a tab.
//   - Fields with commas, quotes, or newlines are double-quoted with escaped inner quotes.
//   - All timestamps are ISO-8601 UTC. Numbers are numeric. Nulls/unavailable are empty string.

import type { ReportResultEnvelope } from '@siteflow/shared';
import type { ReportRenderer, RenderedReport } from './report-renderer.js';

/** Escape a cell value for safe CSV inclusion. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str = String(value);

  // Formula injection defense — spreadsheet formulas start with =, +, -, @
  if (/^[=+\-@\t]/.test(str)) {
    str = '\t' + str;
  }

  // Wrap in quotes if contains comma, double-quote, or newline
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/** Flatten a nested object into key-value pairs (max 2 levels). */
function flattenData(data: Record<string, unknown>, prefix = ''): Array<{ key: string; value: unknown }> {
  const result: Array<{ key: string; value: unknown }> = [];
  for (const [k, v] of Object.entries(data)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result.push(...flattenData(v as Record<string, unknown>, key));
    } else if (Array.isArray(v)) {
      result.push({ key, value: JSON.stringify(v) });
    } else {
      result.push({ key, value: v });
    }
  }
  return result;
}

export class CsvReportRenderer implements ReportRenderer {
  render(envelope: ReportResultEnvelope): RenderedReport {
    const { reportType, organizationId, projectId, asOf, effectiveTimezone, filters, coverage, data } = envelope;

    // Meta rows
    const metaRows: string[] = [
      ['report_type', escapeCsvCell(reportType ?? 'REPORT')].join(','),
      ['organization_id', escapeCsvCell(organizationId ?? '')].join(','),
      ['project_id', escapeCsvCell(projectId ?? '')].join(','),
      ['as_of', escapeCsvCell(typeof asOf === 'string' ? asOf : asOf ? (asOf as Date).toISOString() : new Date().toISOString())].join(','),
      ['effective_timezone', escapeCsvCell(effectiveTimezone ?? 'UTC')].join(','),
      ['filter_date_preset', escapeCsvCell(filters?.datePreset ?? 'THIS_MONTH')].join(','),
      ['filter_start_date', escapeCsvCell(filters?.startDate ?? '')].join(','),
      ['filter_end_date', escapeCsvCell(filters?.endDate ?? '')].join(','),
      ['coverage_available', escapeCsvCell(String(coverage?.isAvailable ?? true))].join(','),
      ['coverage_source_module', escapeCsvCell(coverage?.sourceModule ?? 'reporting')].join(','),
      ['coverage_reason', escapeCsvCell(coverage?.reason ?? '')].join(','),
      ['', ''].join(','), // blank separator row
    ];

    // Data rows — flattened key/value pairs
    const dataRows: string[] = [];
    const isCoverageAvailable = coverage ? coverage.isAvailable !== false : true;
    if (isCoverageAvailable && data) {
      const pairs = flattenData(data as Record<string, unknown>);
      dataRows.push(['field', 'value'].join(','));
      for (const { key, value } of pairs) {
        dataRows.push([escapeCsvCell(key), escapeCsvCell(value)].join(','));
      }
    } else {
      dataRows.push(['field', 'value'].join(','));
      dataRows.push([escapeCsvCell('coverage_unavailable'), escapeCsvCell(coverage?.reason ?? 'Data not available')].join(','));
    }

    const content = [...metaRows, ...dataRows].join('\r\n') + '\r\n';
    const safeType = (reportType ?? 'report').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const filename = `siteflow-${safeType}-${new Date().toISOString().slice(0, 10)}.csv`;

    return {
      content,
      mimeType: 'text/csv; charset=utf-8',
      filename,
      format: 'csv',
    };
  }
}
