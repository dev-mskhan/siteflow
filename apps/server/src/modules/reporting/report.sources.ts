export interface ReportSourceMapping {
  reportFamily: string;
  sourceModules: string[];
  supportedSemantics: 'AS_OF' | 'DATE_RANGE' | 'LOOKAHEAD';
}

export const REPORT_SOURCE_CATALOG: Record<string, ReportSourceMapping> = {
  PROJECT_EXECUTIVE_SUMMARY: {
    reportFamily: 'PROJECT_EXECUTIVE_SUMMARY',
    sourceModules: ['project-core', 'schedule-metrics', 'commercial-summary'],
    supportedSemantics: 'AS_OF',
  },
  DAILY_SITE_ACTIVITY: {
    reportFamily: 'DAILY_SITE_ACTIVITY',
    sourceModules: ['field-log', 'safety-log', 'schedule-execution'],
    supportedSemantics: 'DATE_RANGE',
  },
  COMMERCIAL_FINANCIAL_SUMMARY: {
    reportFamily: 'COMMERCIAL_FINANCIAL_SUMMARY',
    sourceModules: ['budget', 'change-order', 'cost-transaction', 'schedule-of-values'],
    supportedSemantics: 'DATE_RANGE',
  },
  SCHEDULE_VARIANCE_PROGRESS: {
    reportFamily: 'SCHEDULE_VARIANCE_PROGRESS',
    sourceModules: ['schedule-metrics', 'task-execution'],
    supportedSemantics: 'LOOKAHEAD',
  },
  SUBCONTRACTOR_PERFORMANCE: {
    reportFamily: 'SUBCONTRACTOR_PERFORMANCE',
    sourceModules: ['subcontractor', 'purchase-order', 'inspection'],
    supportedSemantics: 'DATE_RANGE',
  },
};
