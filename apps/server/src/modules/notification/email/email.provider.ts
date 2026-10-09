import { emailService } from '../../../lib/email/email.service.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'email-provider' });

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  organizationId: string;
}

export interface EmailProvider {
  sendEmail(params: SendEmailParams): Promise<{ messageId: string; previewUrl?: string | false }>;
}

export class SmtpEmailProvider implements EmailProvider {
  async sendEmail(params: SendEmailParams): Promise<{ messageId: string; previewUrl?: string | false }> {
    if (!params.organizationId) {
      throw new Error('organizationId is required for tenant-scoped email send');
    }

    logger.info({ to: params.to, subject: params.subject, organizationId: params.organizationId }, 'Sending email via SMTP email provider');
    return emailService.sendMail({
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
  }
}

export const defaultEmailProvider = new SmtpEmailProvider();
