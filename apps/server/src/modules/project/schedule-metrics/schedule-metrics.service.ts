// apps/server/src/modules/project/schedule-metrics/schedule-metrics.service.ts
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { getDb } from '../../../lib/db/index.js';
import { ensureRedisConnected } from '../../../lib/redis/redis.js';
import { generateId } from '../../../lib/id.js';
import { ScheduleMetricsRepository } from './schedule-metrics.repository.js';
import type { ScheduleMetricsDTO } from './schedule-metrics.types.js';
import type { ProjectScheduleMetrics } from '@siteflow/database/schema';
import { tasks, projects } from '@siteflow/database/schema';
import { eq, and, count } from 'drizzle-orm';

const tracer = trace.getTracer('schedule-metrics-service');

function toDTO(m: ProjectScheduleMetrics): ScheduleMetricsDTO {
  return {
    id: m.id,
    organizationId: m.organizationId,
    projectId: m.projectId,
    totalTasks: m.totalTasks,
    completedTasks: m.completedTasks,
    criticalTaskCount: m.criticalTaskCount,
    scheduleRevision: m.scheduleRevision,
    updatedAt: m.updatedAt.toISOString(),
  };
}

export class ScheduleMetricsService {
  constructor(private repo = new ScheduleMetricsRepository()) {}

  private get db() {
    return getDb();
  }

  /**
   * Get schedule metrics for a project.
   * Priority:
   * 1. Redis cache hit (key: siteflow:v1:schedule:metrics:{projectId}:{revision})
   * 2. DB materialized summary row matching revision
   * 3. Live recalculation & upsert into DB + Redis
   */
  async getMetrics(organizationId: string, projectId: string): Promise<ScheduleMetricsDTO> {
    return withSpan(tracer, 'schedule-metrics.get', async (span) => {
      span.setAttributes({ organizationId, projectId });

      // Get current project revision — scoped to organization for tenant isolation
      const projectRows = await this.db
        .select({ scheduleRevision: projects.scheduleRevision })
        .from(projects)
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.organizationId, organizationId),
          ),
        );
      const currentRevision = projectRows[0]?.scheduleRevision ?? 0;

      // Cache key includes orgId to guarantee per-tenant isolation
      const cacheKey = `siteflow:v1:schedule:metrics:${organizationId}:${projectId}:${currentRevision}`;

      // 1. Try Redis cache
      try {
        const redis = await ensureRedisConnected();
        const cached = await redis.get(cacheKey);
        if (cached) {
          span.setAttribute('cache_hit', true);
          return JSON.parse(cached) as ScheduleMetricsDTO;
        }
      } catch {
        // Fall back gracefully if Redis is down
      }

      // 2. Check DB materialized metrics row matching revision
      const existing = await this.repo.findByProject(this.db, organizationId, projectId);
      if (existing && existing.scheduleRevision === currentRevision) {
        const dto = toDTO(existing);
        this.cacheInRedis(cacheKey, dto);
        return dto;
      }

      // 3. Re-materialize live from DB
      return this.materializeMetrics(organizationId, projectId, currentRevision);
    });
  }

  /**
   * Compute metrics from live task data and persist via DB upsert + Redis cache.
   */
  async materializeMetrics(
    organizationId: string,
    projectId: string,
    scheduleRevision: number,
  ): Promise<ScheduleMetricsDTO> {
    return withSpan(tracer, 'schedule-metrics.materialize', async (span) => {
      span.setAttributes({ organizationId, projectId, scheduleRevision });

      // Count total tasks
      const totalRows = await this.db
        .select({ cnt: count() })
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.organizationId, organizationId)));

      const completedRows = await this.db
        .select({ cnt: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, projectId),
            eq(tasks.organizationId, organizationId),
            eq(tasks.status, 'COMPLETED'),
          ),
        );

      const criticalRows = await this.db
        .select({ cnt: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, projectId),
            eq(tasks.organizationId, organizationId),
            eq(tasks.isCritical, true),
          ),
        );

      const totalTasks = Number(totalRows[0]?.cnt ?? 0);
      const completedTasks = Number(completedRows[0]?.cnt ?? 0);
      const criticalTaskCount = Number(criticalRows[0]?.cnt ?? 0);

      const existing = await this.repo.findByProject(this.db, organizationId, projectId);
      const id = existing?.id ?? generateId();

      const upserted = await this.repo.upsert(this.db, {
        id,
        organizationId,
        projectId,
        totalTasks,
        completedTasks,
        criticalTaskCount,
        scheduleRevision,
      });

      const dto = toDTO(upserted);
      const cacheKey = `siteflow:v1:schedule:metrics:${organizationId}:${projectId}:${scheduleRevision}`;
      this.cacheInRedis(cacheKey, dto);

      return dto;
    });
  }

  private async cacheInRedis(key: string, dto: ScheduleMetricsDTO): Promise<void> {
    try {
      const redis = await ensureRedisConnected();
      await redis.set(key, JSON.stringify(dto), 'EX', 3600);
    } catch {
      // Non-blocking Redis write error fallback
    }
  }
}
