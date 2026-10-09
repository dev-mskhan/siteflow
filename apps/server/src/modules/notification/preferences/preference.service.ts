import { getDb } from '../../../lib/db/index.js';
import { preferenceRepository, PreferenceRepository } from './preference.repository.js';
import { type NotificationPreference } from '@siteflow/database/schema';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'preference-service' });

export class PreferenceService {
  constructor(private repo: PreferenceRepository = preferenceRepository) {}

  private get db() {
    return getDb();
  }

  async isChannelEnabled(
    organizationId: string,
    userId: string,
    eventType: string,
    channel: 'EMAIL' | 'IN_APP' | 'REALTIME' | 'WHATSAPP',
  ): Promise<boolean> {
    if (!organizationId || !userId) {
      throw new Error('organizationId and userId are required to evaluate preferences');
    }

    const pref = await this.repo.findPreference(this.db, organizationId, userId, eventType, channel);
    if (!pref) {
      // Default to enabled if no explicit preference override exists
      return true;
    }

    logger.debug({ organizationId, userId, eventType, channel, enabled: pref.enabled }, 'Evaluated notification channel preference');
    return pref.enabled;
  }

  async getUserPreferences(organizationId: string, userId: string): Promise<NotificationPreference[]> {
    if (!organizationId || !userId) {
      throw new Error('organizationId and userId are required');
    }
    return this.repo.getPreferences(this.db, organizationId, userId);
  }

  async setPreference(
    organizationId: string,
    userId: string,
    eventType: string,
    channel: 'EMAIL' | 'IN_APP' | 'REALTIME' | 'WHATSAPP',
    enabled: boolean,
  ): Promise<NotificationPreference> {
    if (!organizationId || !userId) {
      throw new Error('organizationId and userId are required to update preference');
    }

    logger.info({ organizationId, userId, eventType, channel, enabled }, 'Updating notification preference');
    return this.repo.upsertPreference(this.db, organizationId, userId, eventType, channel, enabled);
  }
}

export const preferenceService = new PreferenceService();
