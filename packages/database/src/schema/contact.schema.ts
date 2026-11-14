import { text, timestamp } from 'drizzle-orm/pg-core';
import { appSchema } from './auth.schema.js';

// ─── Contact Request Status Enum ──────────────────────────────────────────────
export const contactRequestStatusEnum = appSchema.enum('contact_request_status', [
  'new',
  'contacted',
  'qualified',
  'converted',
  'spam',
  'closed',
]);

// ─── Contact Request Intent Enum ──────────────────────────────────────────────
export const contactRequestIntentEnum = appSchema.enum('contact_request_intent', [
  'trial',
  'demo',
  'pricing',
  'subcontractor',
  'other',
]);

// ─── Contact Requests Table ───────────────────────────────────────────────────
/**
 * Stores inbound contact form submissions from the website.
 * Includes demo requests, trial signups (pre-registration), pricing inquiries,
 * and general contact requests.
 */
export const contactRequests = appSchema.table('contact_requests', {
  id: text('id').primaryKey(),
  
  // Contact information
  name: text('name').notNull(),
  workEmail: text('work_email').notNull(),
  phone: text('phone'),
  
  // Company information
  companyName: text('company_name').notNull(),
  companySize: text('company_size').notNull(), // e.g., '1-10', '11-50', '51-200', '200+'
  country: text('country').notNull(), // e.g., 'Pakistan', 'United States'
  
  // Request details
  intent: contactRequestIntentEnum('intent').notNull(),
  message: text('message').notNull(),
  
  // Metadata
  status: contactRequestStatusEnum('status').default('new').notNull(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  referrerUrl: text('referrer_url'),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  contactedAt: timestamp('contacted_at', { withTimezone: true }),
  
  // Notes for sales team
  internalNotes: text('internal_notes'),
});

// ─── Types ─────────────────────────────────────────────────────────────────────
export type ContactRequest = typeof contactRequests.$inferSelect;
export type NewContactRequest = typeof contactRequests.$inferInsert;
