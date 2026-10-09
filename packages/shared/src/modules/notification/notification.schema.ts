import { z } from 'zod';

export const NotificationStatusSchema = z.enum([
  'PENDING',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
]);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const NotificationChannelSchema = z.enum([
  'EMAIL',
  'IN_APP',
  'REALTIME',
  'WHATSAPP',
]);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NotificationRecordSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  recipientId: z.string().min(1),
  eventId: z.string().optional().nullable(),
  eventType: z.string().min(1),
  channel: NotificationChannelSchema,
  templateId: z.string().optional().nullable(),
  payload: z.record(z.unknown()),
  status: NotificationStatusSchema,
  retryCount: z.number().int().nonnegative().default(0),
  lastError: z.string().optional().nullable(),
  deliveredAt: z.string().datetime().or(z.date()).optional().nullable(),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
});
export type NotificationRecordDto = z.infer<typeof NotificationRecordSchema>;
