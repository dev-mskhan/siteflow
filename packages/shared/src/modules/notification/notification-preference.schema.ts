import { z } from 'zod';
import { NotificationChannelSchema } from './notification.schema.js';

export const NotificationPreferenceSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  eventType: z.string().min(1),
  channel: NotificationChannelSchema,
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
});
export type NotificationPreferenceDto = z.infer<typeof NotificationPreferenceSchema>;

export const UpdateNotificationPreferenceSchema = z.object({
  eventType: z.string().min(1),
  channel: NotificationChannelSchema,
  enabled: z.boolean(),
});
export type UpdateNotificationPreferenceInput = z.infer<typeof UpdateNotificationPreferenceSchema>;
