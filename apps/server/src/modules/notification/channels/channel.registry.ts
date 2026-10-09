import { defaultWhatsAppProvider, type WhatsAppProvider } from './whatsapp.channel.js';
import { defaultEmailProvider, type EmailProvider } from '../email/email.provider.js';

export interface ChannelRegistry {
  emailProvider: EmailProvider;
  whatsAppProvider: WhatsAppProvider;
}

export class NotificationChannelRegistry {
  private email: EmailProvider = defaultEmailProvider;
  private whatsApp: WhatsAppProvider = defaultWhatsAppProvider;

  getEmailProvider(): EmailProvider {
    return this.email;
  }

  setEmailProvider(provider: EmailProvider): void {
    this.email = provider;
  }

  getWhatsAppProvider(): WhatsAppProvider {
    return this.whatsApp;
  }

  setWhatsAppProvider(provider: WhatsAppProvider): void {
    this.whatsApp = provider;
  }
}

export const notificationChannelRegistry = new NotificationChannelRegistry();
