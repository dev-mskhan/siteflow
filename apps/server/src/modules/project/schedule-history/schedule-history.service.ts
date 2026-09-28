// apps/server/src/modules/project/schedule-history/schedule-history.service.ts
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { getDb } from '../../../lib/db/index.js';
import { ScheduleHistoryRepository } from './schedule-history.repository.js';
import type { ScheduleChangeDTO, ScheduleSourceType } from './schedule-history.types.js';
import type { ScheduleChange } from '@siteflow/database/schema';

const tracer = trace.getTracer('schedule-history-service');

function toDTO(change: ScheduleChange): ScheduleChangeDTO {
  return {
    id: change.id,
    organizationId: change.organizationId,
    projectId: change.projectId,
    taskId: change.taskId,
    sourceType: change.sourceType as ScheduleSourceType,
    sourceId: change.sourceId ?? null,
    oldStartDate: change.oldStartDate ?? null,
    oldFinishDate: change.oldFinishDate ?? null,
    newStartDate: change.newStartDate ?? null,
    newFinishDate: change.newFinishDate ?? null,
    reason: change.reason ?? null,
    actorUserId: change.actorUserId ?? null,
    createdAt: change.createdAt.toISOString(),
  };
}

export class ScheduleHistoryService {
  constructor(private repo = new ScheduleHistoryRepository()) {}

  private get db() {
    return getDb();
  }

  async listProjectHistory(
    organizationId: string,
    projectId: string,
  ): Promise<ScheduleChangeDTO[]> {
    return withSpan(tracer, 'schedule-history.list-project', async (span) => {
      span.setAttributes({ organizationId, projectId });
      const rows = await this.repo.listByProject(this.db, organizationId, projectId);
      return rows.map(toDTO);
    });
  }

  async listTaskHistory(
    organizationId: string,
    projectId: string,
    taskId: string,
  ): Promise<ScheduleChangeDTO[]> {
    return withSpan(tracer, 'schedule-history.list-task', async (span) => {
      span.setAttributes({ organizationId, projectId, taskId });
      const rows = await this.repo.listByTask(this.db, organizationId, projectId, taskId);
      return rows.map(toDTO);
    });
  }
}
