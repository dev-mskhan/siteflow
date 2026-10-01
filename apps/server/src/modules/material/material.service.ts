import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import crypto from 'node:crypto';
import { getDb } from '../../lib/db/index.js';
import { generateId } from '../../lib/id.js';
import { auditService } from '../audit/audit.service.js';
import { getRedis } from '../../lib/redis/redis.js';
import { MaterialRepository } from './material.repository.js';
import { MaterialNotFoundError, MaterialDuplicateCodeError, MaterialInactiveError } from './material.errors.js';
import type { MaterialDTO, CreateMaterialInput, UpdateMaterialInput, ListMaterialsQuery } from './material.types.js';
import type { Material } from '@siteflow/database/schema';

const tracer = trace.getTracer('material-service');
const ENTITY_TTL = 3600; // 1 hour
const LIST_TTL = 300; // 5 minutes

function toDTO(row: Material): MaterialDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    materialCode: row.materialCode,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    defaultUnitCode: row.defaultUnitCode,
    materialType: row.materialType as MaterialDTO['materialType'],
    status: row.status as MaterialDTO['status'],
    defaultTaxCode: row.defaultTaxCode ?? null,
    defaultCurrencyCode: row.defaultCurrencyCode ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function cacheKey(orgId: string, id: string) {
  return `siteflow:v1:org:${orgId}:material:${id}`;
}

function listCacheKey(orgId: string, qHash: string) {
  return `siteflow:v1:org:${orgId}:material:list:${qHash}`;
}

async function getCached(key: string): Promise<string | null> {
  try {
    return await getRedis().get(key);
  } catch {
    return null;
  }
}

async function setCached(key: string, value: string, ttl: number): Promise<void> {
  try {
    await getRedis().set(key, value, 'EX', ttl);
  } catch {
    // cache failure must not break the service
  }
}

async function delCached(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await getRedis().del(...keys);
  } catch {
    // cache failure must not break the service
  }
}

async function scanAndDelete(redis: any, pattern: string): Promise<void> {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== '0');
}

async function invalidateListCache(orgId: string): Promise<void> {
  try {
    const redis = getRedis();
    await scanAndDelete(redis, `siteflow:v1:org:${orgId}:material:list:*`);
  } catch {
    // cache failure must not break the service
  }
}

export class MaterialService {
  constructor(private repo = new MaterialRepository()) {}

  private get db() {
    return getDb();
  }

  async createMaterial(
    actorUserId: string,
    organizationId: string,
    input: CreateMaterialInput,
  ): Promise<MaterialDTO> {
    return withSpan(tracer, 'material.create', async (span) => {
      span.setAttributes({ organizationId });

      return this.db.transaction(async (tx) => {
        const normalizedCode = input.materialCode.trim().toUpperCase();

        const existing = await this.repo.findByCode(tx as any, organizationId, normalizedCode);
        if (existing) throw new MaterialDuplicateCodeError(normalizedCode);

        const id = generateId();
        const row = await this.repo.create(tx as any, {
          id,
          organizationId,
          materialCode: normalizedCode,
          name: input.name,
          description: input.description,
          category: input.category,
          defaultUnitCode: input.defaultUnitCode.trim().toUpperCase(),
          materialType: input.materialType,
          defaultTaxCode: input.defaultTaxCode,
          defaultCurrencyCode: input.defaultCurrencyCode,
        });

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'material.created',
            resourceType: 'Material',
            resourceId: id,
            metadata: { materialCode: normalizedCode },
          },
          tx,
        );

        const dto = toDTO(row);
        await setCached(cacheKey(organizationId, id), JSON.stringify(dto), ENTITY_TTL);
        await invalidateListCache(organizationId);
        return dto;
      });
    });
  }

  async getMaterial(organizationId: string, materialId: string): Promise<MaterialDTO> {
    return withSpan(tracer, 'material.get', async (span) => {
      span.setAttributes({ organizationId, materialId });

      const cached = await getCached(cacheKey(organizationId, materialId));
      if (cached) {
        const dto = JSON.parse(cached) as MaterialDTO;
        if (dto.organizationId === organizationId) return dto;
      }

      const row = await this.repo.findById(this.db, materialId);
      if (!row || row.organizationId !== organizationId) {
        throw new MaterialNotFoundError(materialId);
      }

      const dto = toDTO(row);
      await setCached(cacheKey(organizationId, materialId), JSON.stringify(dto), ENTITY_TTL);
      return dto;
    });
  }

  /**
   * Used by downstream procurement services to resolve a material ID within a transaction.
   * Throws MaterialNotFoundError or MaterialInactiveError.
   */
  async findActiveById(db: any, organizationId: string, materialId: string): Promise<Material> {
    const row = await this.repo.findById(db, materialId);
    if (!row || row.organizationId !== organizationId) {
      throw new MaterialNotFoundError(materialId);
    }
    if (row.status === 'INACTIVE') {
      throw new MaterialInactiveError(materialId);
    }
    return row;
  }

  async listMaterials(
    organizationId: string,
    query: ListMaterialsQuery,
  ): Promise<{ data: MaterialDTO[]; nextCursor: string | null }> {
    return withSpan(tracer, 'material.list', async (span) => {
      span.setAttributes({ organizationId });

      const qHash = crypto.createHash('md5').update(JSON.stringify(query)).digest('hex');
      const listKey = listCacheKey(organizationId, qHash);
      const cached = await getCached(listKey);
      if (cached) return JSON.parse(cached) as { data: MaterialDTO[]; nextCursor: string | null };

      const limit = query.limit ?? 50;
      const rows = await this.repo.listByOrg(this.db, organizationId, {
        cursor: query.cursor,
        limit: limit + 1,
        status: query.status,
        category: query.category,
      });

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;

      let nextCursor: string | null = null;
      if (hasMore && data.length > 0) {
        const last = data[data.length - 1]!;
        nextCursor = Buffer.from(
          JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
        ).toString('base64');
      }

      const result = { data: data.map(toDTO), nextCursor };
      await setCached(listKey, JSON.stringify(result), LIST_TTL);
      return result;
    });
  }

  async updateMaterial(
    actorUserId: string,
    organizationId: string,
    materialId: string,
    input: UpdateMaterialInput,
  ): Promise<MaterialDTO> {
    return withSpan(tracer, 'material.update', async (span) => {
      span.setAttributes({ organizationId, materialId });

      return this.db.transaction(async (tx) => {
        const existing = await this.repo.findById(tx as any, materialId);
        if (!existing || existing.organizationId !== organizationId) {
          throw new MaterialNotFoundError(materialId);
        }

        const patch: any = { ...input };
        if (patch.defaultUnitCode) {
          patch.defaultUnitCode = patch.defaultUnitCode.trim().toUpperCase();
        }

        const updated = await this.repo.update(tx as any, materialId, patch);

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'material.updated',
            resourceType: 'Material',
            resourceId: materialId,
            metadata: {},
          },
          tx,
        );

        await delCached(cacheKey(organizationId, materialId));
        await invalidateListCache(organizationId);
        return toDTO(updated);
      });
    });
  }
}
