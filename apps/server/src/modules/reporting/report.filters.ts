import { type ReportFilter, ReportFilterSchema } from '@siteflow/shared';

export function normalizeReportFilters(rawFilters: unknown): ReportFilter {
  const parsed = ReportFilterSchema.parse(rawFilters);
  const now = new Date();

  let startDate = parsed.startDate ?? null;
  let endDate = parsed.endDate ?? null;

  if (parsed.datePreset !== 'CUSTOM' && (!startDate || !endDate)) {
    // Use UTC year/month/day from `now` to avoid timezone offset issues with toISOString()
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth();
    const utcDay = now.getUTCDate();
    switch (parsed.datePreset) {
      case 'TODAY': {
        const today = now.toISOString().split('T')[0]!;
        startDate = today;
        endDate = today;
        break;
      }
      case 'THIS_WEEK': {
        const dayOfWeek = now.getUTCDay();
        const startMs = Date.UTC(utcYear, utcMonth, utcDay - dayOfWeek);
        const endMs = startMs + 6 * 24 * 60 * 60 * 1000;
        startDate = new Date(startMs).toISOString().split('T')[0]!;
        endDate = new Date(endMs).toISOString().split('T')[0]!;
        break;
      }
      case 'THIS_MONTH':
      default: {
        const firstMs = Date.UTC(utcYear, utcMonth, 1);
        // Last day: day 0 of next month = last day of current month
        const lastMs = Date.UTC(utcYear, utcMonth + 1, 0);
        startDate = new Date(firstMs).toISOString().split('T')[0]!;
        endDate = new Date(lastMs).toISOString().split('T')[0]!;
        break;
      }
    }
  }

  return {
    ...parsed,
    startDate,
    endDate,
    asOfDate: parsed.asOfDate ?? new Date().toISOString(),
  };
}
