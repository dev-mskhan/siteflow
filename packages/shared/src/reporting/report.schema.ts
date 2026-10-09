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
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  asOfDate: z.string().optional().nullable(),
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
