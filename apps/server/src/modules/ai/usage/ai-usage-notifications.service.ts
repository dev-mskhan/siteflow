/**
 * AI Usage Notifications Service
 * Sends email and webhook notifications when organizations approach or hit their AI token limits
 */

import type { Logger } from '@siteflow/observability/server';
import type { EmailService } from '../../../lib/email/email.service';
import type { AiUsageRepository } from './ai-usage.repository';
import type { AiUsageService } from './ai-usage.service';

interface NotificationThreshold {
  percentage: number;
  label: string;
  shouldNotify: (current: number, last: number) => boolean;
}

interface UsageNotificationContext {
  organizationId: string;
  organizationName: string;
  tokensUsed: number;
  tokenLimit: number;
  percentageUsed: number;
  planName: string;
  resetDate: Date;
  threshold: string;
}

export class AiUsageNotificationsService {
  // Notification thresholds (80%, 90%, 100%)
  private readonly THRESHOLDS: NotificationThreshold[] = [
    {
      percentage: 80,
      label: '80%',
      shouldNotify: (current, last) => current >= 80 && last < 80,
    },
    {
      percentage: 90,
      label: '90%',
      shouldNotify: (current, last) => current >= 90 && last < 90,
    },
    {
      percentage: 100,
      label: '100%',
      shouldNotify: (current, last) => current >= 100 && last < 100,
    },
  ];

  constructor(
    private readonly usageService: AiUsageService,
    private readonly usageRepository: AiUsageRepository,
    private readonly emailService: EmailService,
    private readonly logger: Logger,
  ) {}

  /**
   * Check usage and send notifications if thresholds crossed
   * Called after each AI run completes
   */
  async checkAndNotify(organizationId: string, organizationName: string): Promise<void> {
    try {
      const usage = await this.usageService.getCurrentMonthUsage(organizationId);

      const currentPercentage = (usage.tokensUsed / usage.tokenLimit) * 100;

      // Get the last notified percentage (from org metadata or cache)
      const lastNotifiedPercentage = await this.getLastNotifiedPercentage(organizationId);

      // Check each threshold
      for (const threshold of this.THRESHOLDS) {
        if (threshold.shouldNotify(currentPercentage, lastNotifiedPercentage)) {
          await this.sendNotification({
            organizationId,
            organizationName,
            tokensUsed: usage.tokensUsed,
            tokenLimit: usage.tokenLimit,
            percentageUsed: currentPercentage,
            planName: usage.planName,
            resetDate: usage.periodEnd,
            threshold: threshold.label,
          });

          // Update last notified percentage
          await this.updateLastNotifiedPercentage(organizationId, threshold.percentage);

          // Only send one notification per run
          break;
        }
      }
    } catch (error) {
      // Non-fatal: log error but don't break the run
      this.logger.error(error, 'Failed to check usage notifications', {
        organizationId,
      });
    }
  }

  /**
   * Send notification via email (and optionally webhook)
   */
  private async sendNotification(context: UsageNotificationContext): Promise<void> {
    const { organizationId, threshold } = context;

    this.logger.info('Sending AI usage notification', {
      organizationId,
      threshold,
      tokensUsed: context.tokensUsed,
      tokenLimit: context.tokenLimit,
    });

    // Send email notification
    await this.sendEmailNotification(context);

    // Send webhook notification (if configured)
    await this.sendWebhookNotification(context);
  }

  /**
   * Send email notification to organization admins
   */
  private async sendEmailNotification(context: UsageNotificationContext): Promise<void> {
    const {
      organizationName,
      tokensUsed,
      tokenLimit,
      percentageUsed,
      planName,
      resetDate,
      threshold,
    } = context;

    const subject =
      threshold === '100%'
        ? `🚨 AI Usage Limit Reached - ${organizationName}`
        : `⚠️ AI Usage Alert (${threshold}) - ${organizationName}`;

    const message = this.buildEmailMessage(context);

    try {
      // TODO: Get organization admin emails from membership table
      // For now, this is a placeholder - actual implementation would:
      // 1. Query organization memberships for admin/finance roles
      // 2. Get user emails
      // 3. Send to all admins

      this.logger.info('Email notification prepared', {
        organizationId: context.organizationId,
        subject,
        threshold,
      });

      // await this.emailService.sendEmail({
      //   to: adminEmails,
      //   subject,
      //   html: message,
      // });
    } catch (error) {
      this.logger.error(error, 'Failed to send email notification', {
        organizationId: context.organizationId,
      });
    }
  }

  /**
   * Build HTML email message
   */
  private buildEmailMessage(context: UsageNotificationContext): string {
    const {
      organizationName,
      tokensUsed,
      tokenLimit,
      percentageUsed,
      planName,
      resetDate,
      threshold,
    } = context;

    const isAtLimit = threshold === '100%';
    const formattedResetDate = resetDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${isAtLimit ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">
              ${isAtLimit ? '🚨 AI Usage Limit Reached' : `⚠️ AI Usage Alert (${threshold})`}
            </h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #374151; margin-top: 0;">
              Hi ${organizationName} team,
            </p>
            
            <p style="font-size: 16px; color: #374151;">
              ${
                isAtLimit
                  ? 'Your organization has reached its monthly AI token limit. AI features are now paused until the limit resets.'
                  : `Your organization has used ${percentageUsed.toFixed(0)}% of its monthly AI token allowance.`
              }
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">Usage Summary</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 10px 0; color: #6b7280;">Tokens Used</td>
                  <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">
                    ${tokensUsed.toLocaleString()} / ${tokenLimit.toLocaleString()}
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 10px 0; color: #6b7280;">Usage</td>
                  <td style="padding: 10px 0; text-align: right; font-weight: 600; color: ${isAtLimit ? '#dc2626' : '#f59e0b'};">
                    ${percentageUsed.toFixed(1)}%
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 10px 0; color: #6b7280;">Current Plan</td>
                  <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">
                    ${planName}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280;">Limit Resets</td>
                  <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">
                    ${formattedResetDate}
                  </td>
                </tr>
              </table>
            </div>
            
            ${
              isAtLimit
                ? `
              <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #991b1b; font-weight: 600;">
                  AI features are currently paused
                </p>
                <p style="margin: 10px 0 0 0; color: #991b1b; font-size: 14px;">
                  To continue using AI agents, chat, and document analysis, please upgrade your plan or wait for the monthly limit to reset.
                </p>
              </div>
            `
                : `
              <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e; font-weight: 600;">
                  Consider upgrading to avoid interruption
                </p>
                <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px;">
                  You're approaching your monthly limit. Upgrade your plan to ensure uninterrupted AI access.
                </p>
              </div>
            `
            }
            
            <div style="margin-top: 30px; text-align: center;">
              <a href="${process.env.APP_URL}/org/${context.organizationId}/settings/billing" 
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                ${isAtLimit ? 'Upgrade Plan' : 'View Usage Dashboard'}
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              Questions? Reply to this email or visit our <a href="${process.env.APP_URL}/support" style="color: #2563eb;">support center</a>.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Send webhook notification (if webhook URL configured for organization)
   */
  private async sendWebhookNotification(context: UsageNotificationContext): Promise<void> {
    try {
      // TODO: Implement webhook delivery
      // 1. Check if organization has webhook URL configured
      // 2. Build webhook payload
      // 3. Send POST request with retry logic
      // 4. Log delivery status

      const payload = {
        event: 'ai.usage.threshold_reached',
        timestamp: new Date().toISOString(),
        organization_id: context.organizationId,
        data: {
          tokens_used: context.tokensUsed,
          token_limit: context.tokenLimit,
          percentage_used: context.percentageUsed,
          threshold: context.threshold,
          plan_name: context.planName,
          reset_date: context.resetDate.toISOString(),
        },
      };

      this.logger.info('Webhook notification payload prepared', {
        organizationId: context.organizationId,
        event: payload.event,
      });

      // await this.webhookService.send(organizationId, payload);
    } catch (error) {
      this.logger.error(error, 'Failed to send webhook notification', {
        organizationId: context.organizationId,
      });
    }
  }

  /**
   * Get the last notified percentage for an organization
   * Uses organization metadata or Redis cache
   */
  private async getLastNotifiedPercentage(organizationId: string): Promise<number> {
    // TODO: Implement persistent storage
    // For now, return 0 (will notify on first threshold crossing)
    // Production: Store in organization.metadata JSONB or Redis
    return 0;
  }

  /**
   * Update the last notified percentage
   */
  private async updateLastNotifiedPercentage(
    organizationId: string,
    percentage: number,
  ): Promise<void> {
    // TODO: Implement persistent storage
    // Production: Update organization.metadata or Redis
    this.logger.info('Updated last notified percentage', {
      organizationId,
      percentage,
    });
  }

  /**
   * Reset notification state (e.g., at start of new billing period)
   */
  async resetNotificationState(organizationId: string): Promise<void> {
    try {
      await this.updateLastNotifiedPercentage(organizationId, 0);
      this.logger.info('Reset notification state for new billing period', {
        organizationId,
      });
    } catch (error) {
      this.logger.error(error, 'Failed to reset notification state', {
        organizationId,
      });
    }
  }
}
