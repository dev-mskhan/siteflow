// apps/server/src/modules/project/core/project.cache.service.ts
import crypto from 'node:crypto';
import { ensureRedisConnected } from '../../../lib/redis/redis.js';
import { createLogger } from '@siteflow/observability/server';
import type { ProjectDTO, ProjectListDTO, ListProjectsFilter } from './project.types.js';

const logger = createLogger({ name: 'project-cache-service' });

export class ProjectCacheService {
  /**
   * Helper to compute TTL with random jitter (+/- jitterRangeSeconds)
   */
  static getJitteredTTL(baseSeconds: number, jitterRangeSeconds = 30): number {
    const jitter = Math.floor(Math.random() * (jitterRangeSeconds * 2 + 1)) - jitterRangeSeconds;
    return Math.max(10, baseSeconds + jitter);
  }

  /**
   * Hashes project list query filters (status, search, cursor, limit)
   * to ensure unique cache keys for different query parameters (§2).
   */
  static hashListFilter(filter: ListProjectsFilter): string {
    const sorted = Object.keys(filter)
      .sort()
      .reduce((acc, key) => {
        const val = filter[key as keyof ListProjectsFilter];
        if (val !== undefined && val !== null && val !== '') {
          acc[key] = val;
        }
        return acc;
      }, {} as Record<string, unknown>);
    return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex').substring(0, 16);
  }

  // ─── Cache-Aside: Single Project (`project:{projectId}`) ──────────────────

  async getProject(projectId: string): Promise<ProjectDTO | null> {
    try {
      const client = await ensureRedisConnected();
      const key = `project:${projectId}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as ProjectDTO;
      }
    } catch (err) {
      logger.warn({ err, projectId }, 'Redis getProject read failed — falling back to DB');
    }
    return null;
  }

  async setProject(projectId: string, projectDto: ProjectDTO, baseTtlSeconds = 300): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `project:${projectId}`;
      const ttl = ProjectCacheService.getJitteredTTL(baseTtlSeconds, 30); // 270s-330s jittered
      await client.set(key, JSON.stringify(projectDto), 'EX', ttl);
    } catch (err) {
      logger.warn({ err, projectId }, 'Redis setProject write failed');
    }
  }

  async invalidateProject(projectId: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const key = `project:${projectId}`;
      await client.del(key);
    } catch (err) {
      logger.warn({ err, projectId }, 'Redis invalidateProject failed');
    }
  }

  // ─── Cache-Aside: Project List (`org:projects:list:{organizationId}:{hash}`) ─

  async getProjectList(orgId: string, filter: ListProjectsFilter): Promise<ProjectListDTO | null> {
    try {
      const client = await ensureRedisConnected();
      const filterHash = ProjectCacheService.hashListFilter(filter);
      const key = `org:projects:list:${orgId}:${filterHash}`;
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as ProjectListDTO;
      }
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis getProjectList read failed — falling back to DB');
    }
    return null;
  }

  async setProjectList(orgId: string, filter: ListProjectsFilter, result: ProjectListDTO, baseTtlSeconds = 45): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const filterHash = ProjectCacheService.hashListFilter(filter);
      const key = `org:projects:list:${orgId}:${filterHash}`;
      const ttl = ProjectCacheService.getJitteredTTL(baseTtlSeconds, 15); // 30s-60s jittered
      await client.set(key, JSON.stringify(result), 'EX', ttl);
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis setProjectList write failed');
    }
  }

  async invalidateOrgProjectLists(orgId: string): Promise<void> {
    try {
      const client = await ensureRedisConnected();
      const pattern = `org:projects:list:${orgId}:*`;
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (err) {
      logger.warn({ err, orgId }, 'Redis invalidateOrgProjectLists failed');
    }
  }

  // ─── Invalidate Single Project + Org Project Lists ───────────────────────

  async invalidateProjectAndOrgLists(orgId: string, projectId: string): Promise<void> {
    await this.invalidateProject(projectId);
    await this.invalidateOrgProjectLists(orgId);
  }
}
