import { createLogger } from '@siteflow/observability/server';
import { ContactRepository } from './contact.repository.js';
import { EmailService } from '../../lib/email/email.service.js';
import { generateId } from '../../lib/id.js';
import type { NewContactRequest, ContactRequest } from '@siteflow/database';
import { serverEnv } from '../../config/env.js';

const logger = createLogger({ name: 'contact-service' });

export interface ContactSubmissionData {
  name: string;
  workEmail: string;
  phone?: string;
  companyName: string;
  companySize: string;
  country: string;
  intent: 'trial' | 'demo' | 'pricing' | 'subcontractor' | 'other';
  message: string;
  // Optional metadata
  userAgent?: string;
  ipAddress?: string;
  referrerUrl?: string;
}

export interface ContactSubmissionResult {
  success: boolean;
  requestId: string;
  message: string;
}

export class ContactService {
  constructor(
    private contactRepo: ContactRepository,
    private emailService: EmailService,
  ) {}

  /**
   * Submit a new contact/demo request
   */
  async submitContactRequest(
    data: ContactSubmissionData,
  ): Promise<ContactSubmissionResult> {
    // Rate limiting check (prevent spam)
    const hasRecent = await this.contactRepo.hasRecentSubmission(data.workEmail, 15);
    if (hasRecent) {
      logger.warn(
        { email: data.workEmail },
        'Rate limit: email has recent submission within 15 minutes',
      );
      throw new Error(
        'You have recently submitted a request. Please wait before submitting again.',
      );
    }

    // Create contact request
    const requestData: NewContactRequest = {
      id: generateId(),
      name: data.name,
      workEmail: data.workEmail.toLowerCase().trim(),
      phone: data.phone?.trim(),
      companyName: data.companyName,
      companySize: data.companySize,
      country: data.country,
      intent: data.intent,
      message: data.message,
      status: 'new',
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
      referrerUrl: data.referrerUrl,
    };

    const request = await this.contactRepo.create(requestData);

    // Send notification emails (non-blocking)
    this.sendNotificationEmails(request).catch((err) => {
      logger.error({ err, requestId: request.id }, 'Failed to send notification emails');
    });

    logger.info(
      { requestId: request.id, intent: request.intent, email: request.workEmail },
      'Contact request submitted successfully',
    );

    return {
      success: true,
      requestId: request.id,
      message: this.getSuccessMessage(request.intent),
    };
  }

  /**
   * Send notification emails for new contact request
   */
  private async sendNotificationEmails(request: ContactRequest): Promise<void> {
    // Send to sales team
    await this.sendSalesNotification(request);

    // Send confirmation to user
    await this.sendUserConfirmation(request);
  }

  /**
   * Send notification to sales team
   */
  private async sendSalesNotification(request: ContactRequest): Promise<void> {
    const salesEmail = serverEnv.SALES_EMAIL || 'sales@siteflow.dev';

    const intentLabels = {
      trial: '🚀 Free Trial Request',
      demo: '📺 Demo Request',
      pricing: '💰 Pricing Inquiry',
      subcontractor: '👷 Subcontractor Onboarding',
      other: '📧 General Inquiry',
    };

    const subject = `${intentLabels[request.intent]} from ${request.companyName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #ff1e00; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { margin: 0; color: #1a1a1a; font-size: 24px; }
    .badge { display: inline-block; background: #ff1e00; color: white; padding: 4px 12px; border-radius: 3px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 20px; }
    .section { margin-bottom: 25px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b6b6b; margin-bottom: 5px; }
    .value { font-size: 15px; color: #1a1a1a; margin-bottom: 15px; }
    .message-box { background: #f5f5f5; border-left: 3px solid #ff1e00; padding: 15px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 13px; color: #6b6b6b; }
    .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 3px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Contact Request</h1>
    </div>

    <div class="badge">${intentLabels[request.intent]}</div>

    <div class="section">
      <div class="label">Contact Information</div>
      <div class="value">
        <strong>${request.name}</strong><br>
        ${request.workEmail}<br>
        ${request.phone ? `${request.phone}<br>` : ''}
      </div>
    </div>

    <div class="section">
      <div class="label">Company Details</div>
      <div class="value">
        <strong>${request.companyName}</strong><br>
        Size: ${request.companySize} employees<br>
        Country: ${request.country}
      </div>
    </div>

    <div class="section">
      <div class="label">Message</div>
      <div class="message-box">
        ${request.message.replace(/\n/g, '<br>')}
      </div>
    </div>

    <div class="section">
      <div class="label">Metadata</div>
      <div class="value" style="font-size: 13px; color: #6b6b6b;">
        Request ID: ${request.id}<br>
        Submitted: ${request.createdAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}<br>
        ${request.ipAddress ? `IP: ${request.ipAddress}<br>` : ''}
        ${request.referrerUrl ? `Referrer: ${request.referrerUrl}<br>` : ''}
      </div>
    </div>

    <div class="footer">
      <p><strong>Next Steps:</strong></p>
      <ul>
        <li>Respond within 1 business day</li>
        <li>${request.intent === 'trial' ? 'Set up trial account and schedule onboarding call' : 'Schedule demo or follow-up call'}</li>
        <li>Update status in admin dashboard</li>
      </ul>
    </div>
  </div>
</body>
</html>
    `.trim();

    await this.emailService.sendMail({
      to: salesEmail,
      subject,
      html,
      text: `${subject}\n\nContact: ${request.name} (${request.workEmail})\nCompany: ${request.companyName}\n\nMessage:\n${request.message}`,
    });

    logger.info({ requestId: request.id, salesEmail }, 'Sales notification sent');
  }

  /**
   * Send confirmation email to user
   */
  private async sendUserConfirmation(request: ContactRequest): Promise<void> {
    const intentMessages = {
      trial: {
        title: 'Your Free Trial Request',
        body: 'Thank you for requesting a 14-day free trial of SiteFlow. Our team will set up your account and reach out within one business day to schedule an onboarding call.',
      },
      demo: {
        title: 'Your Demo Request',
        body: 'Thank you for requesting a product demo. We will reach out within one business day to schedule a 20-minute walkthrough at a time that works for you.',
      },
      pricing: {
        title: 'Your Pricing Inquiry',
        body: 'Thank you for your interest in SiteFlow pricing. Our team will review your requirements and send you detailed pricing information within one business day.',
      },
      subcontractor: {
        title: 'Subcontractor Onboarding Request',
        body: 'Thank you for your interest in the SiteFlow trade portal. Our team will reach out within one business day to discuss your onboarding needs.',
      },
      other: {
        title: 'Your Message to SiteFlow',
        body: 'Thank you for contacting SiteFlow. We have received your message and will respond within one business day.',
      },
    };

    const { title, body } = intentMessages[request.intent];

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1a1a1a; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: white; border: 1px solid #e5e5e5; }
    .header { background: #1a1a1a; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 500; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 18px; margin-bottom: 20px; }
    .message { font-size: 15px; line-height: 1.8; margin-bottom: 25px; }
    .info-box { background: #f9fafb; border: 1px solid #e5e5e5; padding: 20px; margin: 25px 0; }
    .info-box strong { display: block; margin-bottom: 10px; color: #ff1e00; }
    .button { display: inline-block; background: #ff1e00; color: white; padding: 14px 28px; text-decoration: none; margin: 20px 0; font-weight: 500; }
    .footer { background: #f9fafb; padding: 30px; text-align: center; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e5e5e5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SiteFlow</h1>
    </div>

    <div class="content">
      <div class="greeting">Hi ${request.name.split(' ')[0]},</div>

      <div class="message">
        <p>${body}</p>
        
        <p>Here's a summary of what you submitted:</p>
      </div>

      <div class="info-box">
        <strong>${title}</strong>
        <p style="margin: 10px 0 0 0; font-size: 14px; line-height: 1.6;">
          Company: ${request.companyName}<br>
          Email: ${request.workEmail}<br>
          ${request.phone ? `Phone: ${request.phone}<br>` : ''}
          Submitted: ${request.createdAt.toLocaleDateString('en-US', { dateStyle: 'long' })}
        </p>
      </div>

      <div class="message">
        <p>In the meantime, feel free to explore our resources:</p>
        <ul style="line-height: 1.8;">
          <li><a href="https://siteflow.dev/features">Product features</a></li>
          <li><a href="https://siteflow.dev/pricing">Pricing details</a></li>
          <li><a href="https://docs.siteflow.dev">Documentation</a></li>
        </ul>
      </div>

      <a href="https://siteflow.dev" class="button">Visit SiteFlow</a>

      <div class="message" style="margin-top: 30px; font-size: 14px; color: #6b6b6b;">
        If you have any immediate questions, reply to this email and our team will get back to you.
      </div>
    </div>

    <div class="footer">
      <p>
        <strong>SiteFlow</strong><br>
        Construction Operations Platform<br>
        <a href="https://siteflow.dev" style="color: #6b6b6b;">siteflow.dev</a>
      </p>
      <p style="margin-top: 20px; font-size: 12px;">
        This is an automated confirmation. You're receiving this because you submitted<br>
        a contact request at siteflow.dev on ${request.createdAt.toLocaleDateString()}.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    await this.emailService.sendMail({
      to: request.workEmail,
      subject: `${title} - We'll be in touch soon`,
      html,
      text: `Hi ${request.name.split(' ')[0]},\n\n${body}\n\nWe'll be in touch within one business day.\n\nBest regards,\nSiteFlow Team`,
    });

    logger.info({ requestId: request.id, userEmail: request.workEmail }, 'User confirmation sent');
  }

  /**
   * Get success message based on intent
   */
  private getSuccessMessage(intent: ContactRequest['intent']): string {
    const messages = {
      trial: 'Thank you! We will set up your free trial and contact you within one business day.',
      demo: 'Thank you! We will reach out within one business day to schedule your demo.',
      pricing: 'Thank you! We will send you pricing details within one business day.',
      subcontractor: 'Thank you! We will contact you within one business day about onboarding.',
      other: 'Thank you! We will respond to your message within one business day.',
    };

    return messages[intent];
  }
}
