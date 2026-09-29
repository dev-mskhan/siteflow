import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import crypto from 'node:crypto';
import { getDb } from '../../lib/db/index.js';
import { generateId } from '../../lib/id.js';
import { auditService } from '../audit/audit.service.js';
import { getRedis } from '../../lib/redis/redis.js';
import { SupplierRepository } from './supplier.repository.js';
import {
  SupplierNotFoundError,
  SupplierDuplicateCodeError,
  SupplierInactiveError,
  SupplierContactNotFoundError,
  PrimarySupplierContactAlreadyExistsError,
} from './supplier.errors.js';
import type {
  SupplierDTO,
  SupplierContactDTO,
  CreateSupplierInput,
  UpdateSupplierInput,
  CreateSupplierContactInput,
  UpdateSupplierContactInput,
  ListSuppliersQuery,
} from './supplier.types.js';
import type { Supplier, SupplierContact } from '@siteflow/database/schema';

const tracer = trace.getTracer('supplier-service');
const ENTITY_TTL = 3600; // 1 hour
const LIST_TTL = 300; // 5 minutes

function supplierCacheKey(orgId: string, supplierId: string) {
  return `siteflow:v1:org:${orgId}:supplier:${supplierId}`;
}

function supplierListCacheKey(orgId: string, queryHash: string) {
  return `siteflow:v1:org:${orgId}:supplier:list:${queryHash}`;
}

function hashQuery(query: ListSuppliersQuery): string {
  return crypto.createHash('md5').update(JSON.stringify(query)).digest('hex');
}

function toSupplierDTO(row: Supplier): SupplierDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    supplierCode: row.supplierCode,
    legalName: row.legalName,
    displayName: row.displayName,
    supplierType: row.supplierType as SupplierDTO['supplierType'],
    status: row.status as SupplierDTO['status'],
    taxReference: row.taxReference ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    website: row.website ?? null,
    paymentTerms: row.paymentTerms ?? null,
    currencyCode: row.currencyCode ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toContactDTO(row: SupplierContact): SupplierContactDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    supplierId: row.supplierId,
    name: row.name,
    role: row.role ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    isPrimary: row.isPrimary,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class SupplierService {
  constructor(private repo = new SupplierRepository()) {}

  private get db() {
    return getDb();
  }

  // ── Cache helpers ──────────────────────────────────────────────────────────

  private async getCached(key: string): Promise<string | null> {
    try {
      const redis = getRedis();
      return await redis.get(key);
    } catch {
      return null;
    }
  }

  private async setCached(key: string, value: string, ttl: number): Promise<void> {
    try {
      const redis = getRedis();
      await redis.set(key, value, 'EX', ttl);
    } catch {
      // cache failure must not break the service
    }
  }

  private async delCached(...keys: string[]): Promise<void> {
    try {
      const redis = getRedis();
      if (keys.length > 0) await redis.del(...keys);
    } catch {
      // cache failure must not break the service
    }
  }

  private async invalidateListCache(orgId: string): Promise<void> {
    try {
      const redis = getRedis();
      const pattern = `siteflow:v1:org:${orgId}:supplier:list:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    } catch {
      // cache failure must not break the service
    }
  }

  // ── Supplier CRUD ──────────────────────────────────────────────────────────

  async createSupplier(
    actorUserId: string,
    organizationId: string,
    input: CreateSupplierInput,
  ): Promise<SupplierDTO> {
    return withSpan(tracer, 'supplier.create', async (span) => {
      span.setAttributes({ organizationId });

      return this.db.transaction(async (tx) => {
        // Normalize supplierCode: trim + uppercase
        const normalizedCode = input.supplierCode.trim().toUpperCase();

        const existing = await this.repo.findByCode(tx as any, organizationId, normalizedCode);
        if (existing) throw new SupplierDuplicateCodeError(normalizedCode);

        const id = generateId();
        const row = await this.repo.create(tx as any, {
          id,
          organizationId,
          supplierCode: normalizedCode,
          legalName: input.legalName,
          displayName: input.displayName,
          supplierType: input.supplierType,
          taxReference: input.taxReference,
          email: input.email,
          phone: input.phone,
          address: input.address,
          website: input.website,
          paymentTerms: input.paymentTerms,
          currencyCode: input.currencyCode,
          notes: input.notes,
        });

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'supplier.created',
            resourceType: 'Supplier',
            resourceId: id,
            metadata: { supplierCode: normalizedCode },
          },
          tx,
        );

        const dto = toSupplierDTO(row);
        await this.setCached(supplierCacheKey(organizationId, id), JSON.stringify(dto), ENTITY_TTL);
        await this.invalidateListCache(organizationId);
        return dto;
      });
    });
  }

  async getSupplier(organizationId: string, supplierId: string): Promise<SupplierDTO> {
    return withSpan(tracer, 'supplier.get', async (span) => {
      span.setAttributes({ organizationId, supplierId });

      const cached = await this.getCached(supplierCacheKey(organizationId, supplierId));
      if (cached) {
        const dto = JSON.parse(cached) as SupplierDTO;
        if (dto.organizationId === organizationId) return dto;
      }

      const row = await this.repo.findById(this.db, supplierId);
      if (!row || row.organizationId !== organizationId) {
        throw new SupplierNotFoundError(supplierId);
      }

      const dto = toSupplierDTO(row);
      await this.setCached(
        supplierCacheKey(organizationId, supplierId),
        JSON.stringify(dto),
        ENTITY_TTL,
      );
      return dto;
    });
  }

  async findActiveById(
    db: any,
    organizationId: string,
    supplierId: string,
  ): Promise<Supplier> {
    const row = await this.repo.findById(db, supplierId);
    if (!row || row.organizationId !== organizationId) {
      throw new SupplierNotFoundError(supplierId);
    }
    if (row.status === 'INACTIVE' || row.status === 'SUSPENDED') {
      throw new SupplierInactiveError(supplierId);
    }
    return row;
  }

  async listSuppliers(
    organizationId: string,
    query: ListSuppliersQuery,
  ): Promise<{ data: SupplierDTO[]; nextCursor: string | null }> {
    return withSpan(tracer, 'supplier.list', async (span) => {
      span.setAttributes({ organizationId });

      const qHash = hashQuery(query);
      const listKey = supplierListCacheKey(organizationId, qHash);
      const cached = await this.getCached(listKey);
      if (cached) {
        return JSON.parse(cached) as { data: SupplierDTO[]; nextCursor: string | null };
      }

      const limit = query.limit ?? 50;
      const rows = await this.repo.listByOrg(this.db, organizationId, {
        cursor: query.cursor,
        limit: limit + 1,
        status: query.status,
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

      const result = { data: data.map(toSupplierDTO), nextCursor };
      await this.setCached(listKey, JSON.stringify(result), LIST_TTL);
      return result;
    });
  }

  async updateSupplier(
    actorUserId: string,
    organizationId: string,
    supplierId: string,
    input: UpdateSupplierInput,
  ): Promise<SupplierDTO> {
    return withSpan(tracer, 'supplier.update', async (span) => {
      span.setAttributes({ organizationId, supplierId });

      return this.db.transaction(async (tx) => {
        const existing = await this.repo.findById(tx as any, supplierId);
        if (!existing || existing.organizationId !== organizationId) {
          throw new SupplierNotFoundError(supplierId);
        }

        const updated = await this.repo.update(tx as any, supplierId, input as any);

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'supplier.updated',
            resourceType: 'Supplier',
            resourceId: supplierId,
            metadata: {},
          },
          tx,
        );

        const dto = toSupplierDTO(updated);
        await this.delCached(supplierCacheKey(organizationId, supplierId));
        await this.invalidateListCache(organizationId);
        return dto;
      });
    });
  }

  // ── Contacts ───────────────────────────────────────────────────────────────

  async createContact(
    actorUserId: string,
    organizationId: string,
    supplierId: string,
    input: CreateSupplierContactInput,
  ): Promise<SupplierContactDTO> {
    return withSpan(tracer, 'supplier.contact.create', async (span) => {
      span.setAttributes({ organizationId, supplierId });

      return this.db.transaction(async (tx) => {
        const sup = await this.repo.findById(tx as any, supplierId);
        if (!sup || sup.organizationId !== organizationId) {
          throw new SupplierNotFoundError(supplierId);
        }

        if (input.isPrimary) {
          const existingPrimary = await this.repo.findPrimaryContact(tx as any, supplierId);
          if (existingPrimary) throw new PrimarySupplierContactAlreadyExistsError(supplierId);
        }

        const id = generateId();
        const row = await this.repo.createContact(tx as any, {
          id,
          organizationId,
          supplierId,
          name: input.name,
          role: input.role,
          email: input.email,
          phone: input.phone,
          isPrimary: input.isPrimary ?? false,
        });

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'supplier.contact.created',
            resourceType: 'SupplierContact',
            resourceId: id,
            metadata: { supplierId },
          },
          tx,
        );

        return toContactDTO(row);
      });
    });
  }

  async updateContact(
    actorUserId: string,
    organizationId: string,
    supplierId: string,
    contactId: string,
    input: UpdateSupplierContactInput,
  ): Promise<SupplierContactDTO> {
    return withSpan(tracer, 'supplier.contact.update', async (span) => {
      span.setAttributes({ organizationId, supplierId, contactId });

      return this.db.transaction(async (tx) => {
        const sup = await this.repo.findById(tx as any, supplierId);
        if (!sup || sup.organizationId !== organizationId) {
          throw new SupplierNotFoundError(supplierId);
        }

        const contact = await this.repo.findContactById(tx as any, contactId);
        if (!contact || contact.supplierId !== supplierId) {
          throw new SupplierContactNotFoundError(contactId);
        }

        // If promoting this contact to primary, demote the existing primary
        if (input.isPrimary === true && !contact.isPrimary) {
          const existingPrimary = await this.repo.findPrimaryContact(tx as any, supplierId);
          if (existingPrimary && existingPrimary.id !== contactId) {
            await this.repo.updateContact(tx as any, existingPrimary.id, { isPrimary: false });
          }
        }

        const updated = await this.repo.updateContact(tx as any, contactId, input as any);

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'supplier.contact.updated',
            resourceType: 'SupplierContact',
            resourceId: contactId,
            metadata: { supplierId },
          },
          tx,
        );

        return toContactDTO(updated);
      });
    });
  }
}
