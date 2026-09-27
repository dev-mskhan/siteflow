// apps/server/src/modules/organization/organization.cache.service.ts
import { ensureRedisConnected } from '../../lib/redis/redis.js';
import { createLogger } from '@siteflow/observability/server';
import type { OrgDTO } from './organization.types.js';
import type { OrgProfileDTO } from './profile/profile.types.js';
import type { DocumentSequenceDTO } from './sequences/sequences.types.js';
import type { OrgSettingsDTO } from './settings/settings.types.js';

const logger = createLogger({ name: 'org-cache-service' });

export class OrganizationCacheService {
  /**
   * Helper to compute TTL with random jitter (+/- jitterRangeSeconds)
   */
  static getJitteredTTL(baseSeconds: number, jitterRangeSeconds = 30): number {
    const jitter = Math.floor(Math.random() * (jitterRangeSeconds * 2 + 1)) - jitterRangeSeconds;
    return Math.max(10, baseSeconds + jitter);
  }

  // ─── Cache-Aside: User Organization List (`org:list:user:{userId}`) ────────

  async getUserOrgList(userId: string): Promise<OrgDTO[] | null> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:list:user:${userId}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as OrgDTO[];
      }
    } catch (err) {
      logger.warn({ err, userId }, 'Redis getUserOrgList read failed — falling back to DB');
    }
    return null;
  }

  async setUserOrgList(userId: string, orgs: OrgDTO[], baseTtlSeconds = 180): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:list:user:${userId}`;
      const ttl = OrganizationCacheService.getJitteredTTL(baseTtlSeconds, 30); // 150s-210s
      await client.set(key, JSON.stringify(orgs), 'EX', ttl);
    } catch (err) {
      logger.warn({ err, userId }, 'Redis setUserOrgList write failed');
    }
  }

  async invalidateUserOrgList(userId: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:list:user:${userId}`;
      await client.del(key);
    } catch (err) {
      logger.warn({ err, userId }, 'Redis invalidateUserOrgList failed');
    }
  }

  // ─── Cache-Aside: Single Organization (`org:{organizationId}`) ────────────

  async getOrg(orgId: string): Promise<OrgDTO | null> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:${orgId}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as OrgDTO;
      }
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis getOrg read failed — falling back to DB');
    }
    return null;
  }

  async setOrg(orgId: string, orgDto: OrgDTO, baseTtlSeconds = 600): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:${orgId}`;
      const ttl = OrganizationCacheService.getJitteredTTL(baseTtlSeconds, 60); // 540s-660s jittered (+/- 60s)
      await client.set(key, JSON.stringify(orgDto), 'EX', ttl);
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis setOrg write failed');
    }
  }

  async invalidateOrg(orgId: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:${orgId}`;
      await client.del(key);
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis invalidateOrg failed');
    }
  }

  // ─── Cache-Aside: Organization Profile (`org:profile:{organizationId}`) ───

  async getOrgProfile(orgId: string): Promise<OrgProfileDTO | null> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:profile:${orgId}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as OrgProfileDTO;
      }
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis getOrgProfile read failed — falling back to DB');
    }
    return null;
  }

  async setOrgProfile(orgId: string, profileDto: OrgProfileDTO, ttlSeconds = 900): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:profile:${orgId}`;
      // Fixed 15 min (900s) TTL per spec — no jitter needed
      await client.set(key, JSON.stringify(profileDto), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis setOrgProfile write failed');
    }
  }

  async invalidateOrgProfile(orgId: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:profile:${orgId}`;
      await client.del(key);
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis invalidateOrgProfile failed');
    }
  }

  // ─── Cache-Aside: Document Sequences ──────────────────────────────────────

  async getSequenceList(orgId: string): Promise<DocumentSequenceDTO[] | null> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:sequences:${orgId}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as DocumentSequenceDTO[];
      }
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis getSequenceList read failed — falling back to DB');
    }
    return null;
  }

  async setSequenceList(orgId: string, dtos: DocumentSequenceDTO[], baseTtlSeconds = 45): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:sequences:${orgId}`;
      const ttl = OrganizationCacheService.getJitteredTTL(baseTtlSeconds, 15); // 30s-60s jittered
      await client.set(key, JSON.stringify(dtos), 'EX', ttl);
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis setSequenceList write failed');
    }
  }

  async getSequenceByType(orgId: string, type: string): Promise<DocumentSequenceDTO | null> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:sequence:${orgId}:${type}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as DocumentSequenceDTO;
      }
    } catch (err) {
      logger.warn({ err, orgId, type }, 'Redis getSequenceByType read failed — falling back to DB');
    }
    return null;
  }

  async setSequenceByType(orgId: string, type: string, dto: DocumentSequenceDTO, baseTtlSeconds = 45): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:sequence:${orgId}:${type}`;
      const ttl = OrganizationCacheService.getJitteredTTL(baseTtlSeconds, 15); // 30s-60s jittered
      await client.set(key, JSON.stringify(dto), 'EX', ttl);
    } catch (err) {
      logger.warn({ err, orgId, type }, 'Redis setSequenceByType write failed');
    }
  }

  async invalidateSequence(orgId: string, type?: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const keysToDelete: string[] = [`org:sequences:${orgId}`];
      if (type) {
        keysToDelete.push(`org:sequence:${orgId}:${type}`);
      }
      await client.del(...keysToDelete);
    } catch (err) {
      logger.warn({ err, orgId, type }, 'Redis invalidateSequence failed');
    }
  }

  // ─── Cache-Aside: Organization Settings (`org:settings:{organizationId}`) ──

  async getOrgSettings(orgId: string): Promise<OrgSettingsDTO | null> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:settings:${orgId}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as OrgSettingsDTO;
      }
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis getOrgSettings read failed — falling back to DB');
    }
    return null;
  }

  async setOrgSettings(orgId: string, settingsDto: OrgSettingsDTO, baseTtlSeconds = 600): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:settings:${orgId}`;
      const ttl = OrganizationCacheService.getJitteredTTL(baseTtlSeconds, 60); // 10-15 min (540s-660s jittered)
      await client.set(key, JSON.stringify(settingsDto), 'EX', ttl);
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis setOrgSettings write failed');
    }
  }

  async invalidateOrgSettings(orgId: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `org:settings:${orgId}`;
      await client.del(key);
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis invalidateOrgSettings failed');
    }
  }

  // ─── Invalidate Org & All Member Org Lists ────────────────────────────────

  async invalidateOrgAndAllMembers(orgId: string, memberUserIds: string[]): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const keysToDelete: string[] = [`org:${orgId}`];
      for (const uid of memberUserIds) {
        keysToDelete.push(`org:list:user:${uid}`);
      }
      if (keysToDelete.length > 0) {
        await client.del(...keysToDelete);
      }
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis invalidateOrgAndAllMembers failed');
    }
  }
}
