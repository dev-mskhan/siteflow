import { z } from 'zod';

export const DatePresetSchema = z.enum([
  'TODAY',
  'THIS_WEEK',
  'THIS_MONTH',
  'LAST_30_DAYS',
  'THIS_QUARTER',
  'THIS_YEAR',
  'CUSTOM',
]);

export type DatePreset = z.infer<typeof DatePresetSchema>;

export const ReportFilterSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  datePreset: DatePresetSchema.default('THIS_MONTH'),
  startDate: z.string().date().optional().nullable(),
  endDate: z.string().date().optional().nullable(),
  asOfDate: z.string().optional().nullable(),
}).superRefine((filters, context) => {
  if (filters.datePreset === 'CUSTOM' && (!filters.startDate || !filters.endDate)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['startDate'],
      message: 'CUSTOM date preset requires both startDate and endDate',
    });
  }
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'endDate must be on or after startDate',
    });
  }
});

export type ReportFilter = z.infer<typeof ReportFilterSchema>;

export const MetricCoverageSchema = z.object({
  isAvailable: z.boolean().default(true),
  reason: z.string().optional().nullable(),
  sourceModule: z.string().min(1),
});

export type MetricCoverage = z.infer<typeof MetricCoverageSchema>;

export const ReportResultEnvelopeSchema = z.object({
  reportType: z.string().min(1),
  organizationId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  asOf: z.string().datetime().or(z.date()),
  effectiveTimezone: z.string().default('UTC'),
  filters: ReportFilterSchema,
  coverage: MetricCoverageSchema,
  data: z.record(z.unknown()),
});

export type ReportResultEnvelope = z.infer<typeof ReportResultEnvelopeSchema>;
