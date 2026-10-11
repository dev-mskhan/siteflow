// apps/server/src/modules/billing/reminder-delivery.transport.ts
// Phase 10 (Plan 10-09 Task 3): Phase 10-owned grace reminder transport.
// Delegates to the existing email service (SMTP when configured, Ethereal otherwise).
// It never uses the Phase 8 notification email provider.

import { emailService } from '../../lib/email/email.service.js';

export type ReminderTransportErrorCode = 'TRANSPORT_SEND_FAILED';

export class ReminderTransportError extends Error {
  readonly code: ReminderTransportErrorCode;

  constructor(code: ReminderTransportErrorCode) {
    super(code);
    this.name = 'ReminderTransportError';
    this.code = code;
  }
}

/** Minimal payload: no user profile data beyond the billing-admin recipients. */
export interface GraceReminderMessage {
  recipients: string[];
  planName: string;
  graceDay: number;
  amountDueText: string | null;
  billingPortalUrl: string;
}

export interface GraceReminderTransportResult {
  messageId: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSubject(message: GraceReminderMessage): string {
  return `Payment needed for your SiteFlow ${message.planName} plan (grace day ${message.graceDay} of 7)`;
}

function buildHtml(message: GraceReminderMessage): string {
  const amountLine = message.amountDueText
    ? `<p>Amount due: <strong>${escapeHtml(message.amountDueText)}</strong></p>`
    : '';
  const portalUrl = escapeHtml(message.billingPortalUrl);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #dc2626;">Payment needed</h2>
      <p>A recent payment for your SiteFlow ${escapeHtml(message.planName)} plan did not succeed.
         You are on day ${message.graceDay} of your 7-day grace period.</p>
      ${amountLine}
      <p>Update your payment method or pay the open invoice to keep full access:</p>
      <p><a href="${portalUrl}">Open billing</a></p>
      <p style="color: #666; font-size: 12px;">If you have already resolved this, you can ignore this email.</p>
    </div>
  `;
}

/** Throws ReminderTransportError on any failure; resolves only after the transport confirms acceptance. */
export async function sendGraceReminder(
  message: GraceReminderMessage,
): Promise<GraceReminderTransportResult> {
  if (message.recipients.length === 0) {
    throw new ReminderTransportError('TRANSPORT_SEND_FAILED');
  }
  try {
    const result = await emailService.sendMail({
      to: message.recipients.join(', '),
      subject: buildSubject(message),
      html: buildHtml(message),
      text: `Your SiteFlow payment failed. Day ${message.graceDay} of 7. Open billing: ${message.billingPortalUrl}`,
    });
    if (!result.messageId) {
      throw new ReminderTransportError('TRANSPORT_SEND_FAILED');
    }
    return { messageId: result.messageId };
  } catch (err) {
    if (err instanceof ReminderTransportError) throw err;
    throw new ReminderTransportError('TRANSPORT_SEND_FAILED');
  }
}
