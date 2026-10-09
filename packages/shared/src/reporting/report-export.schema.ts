import { z } from 'zod';

export const ReportExportFormatSchema = z.enum(['csv']);
export type ReportExportFormat = z.infer<typeof ReportExportFormatSchema>;

export const ReportExportStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED',
  'EXPIRED',
]);
export type ReportExportStatus = z.infer<typeof ReportExportStatusSchema>;

export const RequestReportExportSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  reportType: z.string().min(1),
  format: ReportExportFormatSchema.default('csv'),
  filters: z.record(z.unknown()).default({}),
});
export type RequestReportExportInput = z.infer<typeof RequestReportExportSchema>;

export const ReportExportRecordSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  requestedBy: z.string().min(1),
  reportType: z.string().min(1),
  format: ReportExportFormatSchema,
  status: ReportExportStatusSchema,
  lastError: z.string().optional().nullable(),
  expiresAt: z.string().datetime().or(z.date()),
  createdAt: z.string().datetime().or(z.date()),
});
export type ReportExportRecordDto = z.infer<typeof ReportExportRecordSchema>;

export const ExportDownloadUrlResponseSchema = z.object({
  downloadUrl: z.string().url(),
});
export type ExportDownloadUrlResponse = z.infer<typeof ExportDownloadUrlResponseSchema>;
