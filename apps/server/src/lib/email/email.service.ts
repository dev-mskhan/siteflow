// apps/server/src/lib/email/email.service.ts
import nodemailer, { type Transporter } from 'nodemailer';
import { createLogger } from '@siteflow/observability/server';
import { serverEnv } from '../../config/env.js';

const logger = createLogger({ name: 'email-service' });

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporterPromise: Promise<Transporter>;
  private isEthereal = false;

  constructor() {
    this.transporterPromise = this.initTransporter();
  }

  private async initTransporter(): Promise<Transporter> {
    // 1. Production / Configured SMTP
    if (serverEnv.SMTP_HOST && serverEnv.SMTP_USER && serverEnv.SMTP_PASS) {
      logger.info(
        { host: serverEnv.SMTP_HOST, port: serverEnv.SMTP_PORT ?? 587 },
        'Initializing SMTP mail transporter',
      );
      return nodemailer.createTransport({
        host: serverEnv.SMTP_HOST,
        port: serverEnv.SMTP_PORT ?? 587,
        secure: (serverEnv.SMTP_PORT ?? 587) === 465,
        auth: {
          user: serverEnv.SMTP_USER,
          pass: serverEnv.SMTP_PASS,
        },
      });
    }

    // 2. Free Ethereal Email test account fallback (Development / Testing)
    logger.info('No custom SMTP configured. Creating free Ethereal Email test account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.isEthereal = true;
      logger.info(
        { user: testAccount.user },
        'Ethereal test account created successfully. Sent emails will log a preview URL.',
      );

      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to create Ethereal test account. Falling back to JSON transport log.');
      return nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  /**
   * Sends an email via configured SMTP or Ethereal.
   */
  async sendMail(options: SendMailOptions): Promise<{ messageId: string; previewUrl?: string | false }> {
    const transporter = await this.transporterPromise;

    const from = serverEnv.SMTP_FROM ?? 'SiteFlow <noreply@siteflow.dev>';

    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    let previewUrl: string | false = false;
    if (this.isEthereal) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(
          { to: options.to, subject: options.subject, previewUrl },
          `📧 REAL EMAIL SENT (Ethereal Preview): ${previewUrl}`,
        );
      }
    } else {
      logger.info({ to: options.to, subject: options.subject, messageId: info.messageId }, '📧 REAL EMAIL SENT via SMTP');
    }

    return { messageId: info.messageId, previewUrl };
  }

  /**
   * Send Email Verification
   */
  async sendEmailVerification(to: string, token: string): Promise<void> {
    const verifyUrl = `http://localhost:3000/verify-email?token=${token}`;
    const subject = 'Verify your SiteFlow account email';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb;">Welcome to SiteFlow!</h2>
        <p>Please click the button below to verify your email address and activate your account:</p>
        <div style="margin: 30px 0;">
          <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">${verifyUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">If you did not create a SiteFlow account, please ignore this email.</p>
      </div>
    `;

    await this.sendMail({ to, subject, html });
  }

  /**
   * Send Password Reset Email
   */
  async sendPasswordReset(to: string, token: string): Promise<void> {
    const resetUrl = `http://localhost:3000/reset-password?token=${token}`;
    const subject = 'Reset your SiteFlow password';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #dc2626;">Password Reset Request</h2>
        <p>You requested a password reset for your SiteFlow account. Click the button below to reset your password:</p>
        <div style="margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">${resetUrl}</p>
        <p style="color: #dc2626; font-size: 13px;">This link will expire in 1 hour.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">If you did not request a password reset, please secure your account immediately.</p>
      </div>
    `;

    await this.sendMail({ to, subject, html });
  }

  /**
   * Send Password Changed Notification
   */
  async sendPasswordChangedNotification(to: string): Promise<void> {
    const subject = 'Security Alert: Your SiteFlow password was changed';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb;">Password Changed</h2>
        <p>Your SiteFlow account password was changed successfully.</p>
        <p>All active sessions on other devices have been logged out for security.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">If you did not make this change, please contact support immediately.</p>
      </div>
    `;

    await this.sendMail({ to, subject, html });
  }

  /**
   * Send New Login Notification
   */
  async sendNewLoginNotification(to: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const subject = 'Security Alert: New login to your SiteFlow account';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb;">New Login Detected</h2>
        <p>We detected a new login to your SiteFlow account:</p>
        <ul>
          <li><strong>IP Address:</strong> ${ipAddress ?? 'Unknown'}</li>
          <li><strong>User Agent:</strong> ${userAgent ?? 'Unknown'}</li>
          <li><strong>Time:</strong> ${new Date().toUTCString()}</li>
        </ul>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">If this was you, no action is needed.</p>
      </div>
    `;

    await this.sendMail({ to, subject, html });
  }

  /**
   * Send Organization Invitation Email
   */
  async sendInvitationEmail(
    to: string,
    options: { orgName: string; inviterName: string; token: string },
  ): Promise<void> {
    const acceptUrl = `http://localhost:3000/accept-invitation?token=${options.token}`;
    const subject = `You've been invited to join ${options.orgName} on SiteFlow`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb;">Organization Invitation</h2>
        <p><strong>${options.inviterName}</strong> has invited you to join <strong>${options.orgName}</strong> on SiteFlow.</p>
        <div style="margin: 30px 0;">
          <a href="${acceptUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation</a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">${acceptUrl}</p>
        <p style="color: #666; font-size: 13px;">This invitation will expire in 7 days.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">If you were not expecting this invitation, you can safely ignore this email.</p>
      </div>
    `;

    await this.sendMail({ to, subject, html });
  }
}

export const emailService = new EmailService();
