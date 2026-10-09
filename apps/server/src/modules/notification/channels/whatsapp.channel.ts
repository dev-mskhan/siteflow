import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'whatsapp-channel' });

export interface SendWhatsAppParams {
  to: string;
  text: string;
  organizationId: string;
}

export interface WhatsAppResult {
  success: boolean;
  status: 'DELIVERED' | 'UNCONFIGURED' | 'FAILED';
  messageId?: string;
  reason?: string;
}

export interface WhatsAppProvider {
  sendMessage(params: SendWhatsAppParams): Promise<WhatsAppResult>;
}

export class UnconfiguredWhatsAppProvider implements WhatsAppProvider {
  async sendMessage(params: SendWhatsAppParams): Promise<WhatsAppResult> {
    logger.info({ organizationId: params.organizationId, to: params.to }, 'WhatsApp delivery requested but provider is unconfigured');
    return {
      success: false,
      status: 'UNCONFIGURED',
      reason: 'WhatsApp provider is not configured for this deployment policy',
    };
  }
}

export const defaultWhatsAppProvider = new UnconfiguredWhatsAppProvider();
