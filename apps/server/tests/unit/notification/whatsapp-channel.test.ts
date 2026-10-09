import { describe, it, expect } from 'vitest';
import { UnconfiguredWhatsAppProvider } from '../../../src/modules/notification/channels/whatsapp.channel.js';
import { notificationChannelRegistry } from '../../../src/modules/notification/channels/channel.registry.js';

describe('F.7 WhatsApp Channel Provider Abstraction Unit', () => {
  it('returns unconfigured status when no WhatsApp vendor is configured', async () => {
    const provider = new UnconfiguredWhatsAppProvider();
    const result = await provider.sendMessage({
      to: '+123456789',
      text: 'Test message',
      organizationId: 'org_123',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('UNCONFIGURED');
    expect(result.reason).toContain('not configured');
  });

  it('allows injecting custom WhatsApp provider into channel registry', () => {
    const customProvider = {
      sendMessage: async () => ({ success: true, status: 'DELIVERED' as const, messageId: 'wa_1' }),
    };

    notificationChannelRegistry.setWhatsAppProvider(customProvider);
    expect(notificationChannelRegistry.getWhatsAppProvider()).toBe(customProvider);

    // Reset back to default
    notificationChannelRegistry.setWhatsAppProvider(new UnconfiguredWhatsAppProvider());
  });
});
